import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform, Alert, Image, ActivityIndicator, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import PermissionsService from '@/app/services/PermissionsService';
import { DEFAULT_LOCATION, DEFAULT_MAP_DELTA, GOOGLE_MAPS_STYLE } from '@/app/utils/MapUtils';
import { format, startOfMonth, endOfMonth, parseISO, eachDayOfInterval, parse } from 'date-fns';
import { collection, addDoc, getDocs, query, where, Timestamp, updateDoc, doc, setDoc, getDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import WaveSkeleton from '@/app/components/WaveSkeleton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';


const STORAGE_KEY = '@attendance_records';
const SYNC_INTERVAL = 60 * 1000; // Sync every minute
const LOCATION_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const ATTENDANCE_CACHE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// Add new constants for offline support
const OFFLINE_STORAGE_KEY = '@offline_attendance_records';
const NETWORK_CHECK_INTERVAL = 60 * 1000; // Check network every minute
const MAX_SYNC_RETRIES = 3;

// Add new constants for local storage
const LOCAL_ATTENDANCE_KEY = '@bdm_attendance_local';
const LOCAL_SYNC_QUEUE_KEY = '@bdm_sync_queue';
const SYNC_RETRY_DELAY = 5000; // 5 seconds

// Add missing constants at the top with other constants
const DAILY_SYNC_HOUR = 0; // Midnight
const DAILY_SYNC_MINUTE = 0;

const professionalMessages = {
  absent: [
    "Your presence is valuable to our team. Let's work together to maintain consistent attendance.",
    "We notice you were absent. Please ensure to inform your manager in advance for future leaves.",
    "Consistent attendance is key to our team's success. Let's strive for better attendance records.",
    "Your contribution is important. Please maintain regular attendance for team efficiency.",
    "We value your work. Let's work on improving attendance for better team coordination."
  ],
  halfDay: [
    "Half-day attendance affects team productivity. Please try to maintain full-day attendance.",
    "Your full presence is important for team success. Let's aim for complete attendance.",
    "We appreciate your partial attendance. Let's work towards full-day attendance next time.",
    "Team coordination works best with full-day presence. Let's maintain complete attendance.",
    "Your complete presence is valuable. Let's strive for full-day attendance in the future."
  ]
};

type RootStackParamList = {
  BDMCameraScreen: {
    type: 'in' | 'out';
  };
  BDMAttendanceScreen: {
    photo?: { uri: string };
    location?: { coords: { latitude: number; longitude: number } };
    dateTime?: Date;
    isPunchIn?: boolean;
  };
};

type BDMAttendanceScreenRouteProp = RouteProp<RootStackParamList, 'BDMAttendanceScreen'>;
type BDMAttendanceScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BDMAttendanceScreen'>;

type AttendanceRecord = {
  date: string;
  day: string;
  punchIn: string;
  punchOut: string;
  status: 'Present' | 'Half Day' | 'On Leave';
  userId: string;
  timestamp: Date;
  photoUri?: string;
  location?: { latitude: number; longitude: number };
  synced: boolean;
};

// Add new interfaces for month selection
interface MonthOption {
  value: number;
  label: string;
}

const MONTHS: MonthOption[] = [
  { value: 0, label: 'January' },
  { value: 1, label: 'February' },
  { value: 2, label: 'March' },
  { value: 3, label: 'April' },
  { value: 4, label: 'May' },
  { value: 5, label: 'June' },
  { value: 6, label: 'July' },
  { value: 7, label: 'August' },
  { value: 8, label: 'September' },
  { value: 9, label: 'October' },
  { value: 10, label: 'November' },
  { value: 11, label: 'December' }
];

// Add new interfaces for local storage
interface LocalAttendanceRecord extends AttendanceRecord {
  localId: string;
  needsSync: boolean;
  syncRetries: number;
}

interface SyncQueueItem {
  localId: string;
  timestamp: number;
  retries: number;
}

// Add AttendanceSkeleton component
const AttendanceSkeleton = () => {
  return (
    <View style={styles.skeletonContainer}>
      <WaveSkeleton width="100%" height={200} style={styles.skeletonMap} />
      <WaveSkeleton width="100%" height={120} style={styles.skeletonPunchCard} />
      <WaveSkeleton width="100%" height={100} style={styles.skeletonWeekCard} />
      <WaveSkeleton width="100%" height={80} style={styles.skeletonSummary} />
      <WaveSkeleton width="100%" height={200} style={styles.skeletonHistory} />
    </View>
  );
};

// Add MonthScroll component
const MonthScroll = ({ 
  selectedMonth,
  onSelectMonth,
  onLongPressMonth
}: { 
  selectedMonth: number;
  onSelectMonth: (month: number) => void;
  onLongPressMonth: (month: number) => void;
}) => {
  const currentMonth = new Date().getMonth();
  
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.monthScrollContainer}
      contentContainerStyle={styles.monthScrollContent}
    >
      {MONTHS.map((month, index) => (
        <TouchableOpacity
          key={month.value}
          style={[
            styles.monthItem,
            selectedMonth === month.value && styles.selectedMonthItem,
            index < currentMonth && styles.pastMonthItem
          ]}
          onPress={() => onSelectMonth(month.value)}
          onLongPress={() => onLongPressMonth(month.value)}
        >
          <Text style={[
            styles.monthText,
            selectedMonth === month.value && styles.selectedMonthText,
            index < currentMonth && styles.pastMonthText
          ]}>
            {month.label.substring(0, 3)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const BDMAttendanceScreen = () => {
  // Map and location states
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [mapError, setMapError] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [locationServiceEnabled, setLocationServiceEnabled] = useState<boolean | null>(null);
  const [mapReady, setMapReady] = useState(false);
  
  // Add new state variables for offline support at the top
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineRecords, setOfflineRecords] = useState<AttendanceRecord[]>([]);
  const [syncQueue, setSyncQueue] = useState<AttendanceRecord[]>([]);
  const [syncRetries, setSyncRetries] = useState<number>(0);
  const [lastSyncAttempt, setLastSyncAttempt] = useState<Date | null>(null);
  
  // Attendance states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [punchInTime, setPunchInTime] = useState<string>('');
  const [punchOutTime, setPunchOutTime] = useState<string>('');
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [isPunchButtonDisabled, setIsPunchButtonDisabled] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<AttendanceRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<'Present' | 'Half Day' | 'On Leave' | null>(null);
  const [statusCounts, setStatusCounts] = useState({
    Present: 0,
    'Half Day': 0,
    'On Leave': 0
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [isLoading, setIsLoading] = useState(true);
  const [showMonthSelector, setShowMonthSelector] = useState(false);

  // Add new state for location caching
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<MapView | null>(null);
  const locationCacheKey = 'bdm_location_cache';
  const locationCacheTimeout = 5 * 60 * 1000; // 5 minutes

  const navigation = useNavigation<BDMAttendanceScreenNavigationProp>();
  const route = useRoute<BDMAttendanceScreenRouteProp>();

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S'];
  const [weekDaysStatus, setWeekDaysStatus] = useState<Array<{ day: string, date?: string, status: 'active' | 'inactive' | 'Present' | 'Half Day' | 'On Leave' }>>([
    { day: 'M', status: 'inactive' },
    { day: 'T', status: 'inactive' },
    { day: 'W', status: 'inactive' },
    { day: 'T', status: 'inactive' },
    { day: 'F', status: 'inactive' },
    { day: 'S', status: 'inactive' }
  ]);

  // Set default location
  const defaultLocation = {
    coords: {
      latitude: DEFAULT_LOCATION.latitude,
      longitude: DEFAULT_LOCATION.longitude,
      altitude: null,
      accuracy: 5,
      altitudeAccuracy: null,
      heading: null,
      speed: null
    },
    timestamp: Date.now()
  };

  // Add new state for loading optimization
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [cachedLocation, setCachedLocation] = useState<Location.LocationObject | null>(null);
  const [cachedAttendance, setCachedAttendance] = useState<AttendanceRecord[]>([]);

  // Update time constants
  const PUNCH_IN_START = 1 * 60; // 1:00 AM in minutes
  const PUNCH_OUT_DEADLINE = 23 * 60; // 11:00 PM in minutes
  const REQUIRED_HOURS = 8; // 8 hours required for full day

  // Add checkAndRequestPermissions function
  const checkAndRequestPermissions = async () => {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      setLocationServiceEnabled(enabled);
      
      if (!enabled) {
        Alert.alert(
          "Location Services Required",
          "Please enable location services to use the attendance feature.",
          [
            { text: "Open Settings", onPress: () => Linking.openSettings() },
            { text: "Cancel", style: "cancel" }
          ]
        );
        return;
      }
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      
      if (status !== 'granted') {
        Alert.alert(
          "Location Permission Required",
          "Please grant location permission to use the attendance feature.",
          [
            { text: "Open Settings", onPress: () => Linking.openSettings() },
            { text: "Cancel", style: "cancel" }
          ]
        );
        return;
      }
      
      // If all permissions are granted, proceed with loading the map
      await loadLocation();
    } catch (error) {
      console.error('Error setting up location services:', error);
      setMapError(true);
    }
  };

  // Optimized data loading function
  const loadInitialData = useCallback(async () => {
    try {
      setIsDataLoading(true);
      
      // Load local data first
      const localRecordsStr = await AsyncStorage.getItem(LOCAL_ATTENDANCE_KEY);
      let localRecords: LocalAttendanceRecord[] = [];
      
      if (localRecordsStr) {
        try {
          localRecords = JSON.parse(localRecordsStr);
        } catch (parseError) {
          console.warn('Error parsing local records:', parseError);
          // Don't throw error, continue with empty records
        }
      }
      
      // Set initial data from local storage
      setAttendanceHistory(localRecords);
      updateWeekDaysStatus(localRecords);
      calculateStatusCounts(localRecords);
      
      // Find today's record
      const today = format(new Date(), 'dd');
      const todayRecord = localRecords.find(r => r.date === today);
      if (todayRecord) {
        setTodayRecord(todayRecord);
        setPunchInTime(todayRecord.punchIn ? format(new Date(`2000-01-01T${todayRecord.punchIn}`), 'hh:mm a') : '');
        setPunchOutTime(todayRecord.punchOut ? format(new Date(`2000-01-01T${todayRecord.punchOut}`), 'hh:mm a') : '');
        setIsPunchedIn(!!todayRecord.punchIn && !todayRecord.punchOut);
      }
      
      // Load location in parallel with other operations
      const locationPromise = loadLocation();
      
      // Try to load from Firebase if online
      if (await checkNetworkStatus()) {
        try {
          const firebaseRecords = await loadFirebaseRecords();
          if (firebaseRecords && firebaseRecords.length > 0) {
            setAttendanceHistory(firebaseRecords);
            updateWeekDaysStatus(firebaseRecords);
            calculateStatusCounts(firebaseRecords);
            
            // Update local storage with Firebase data
            await AsyncStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(firebaseRecords));
          }
        } catch (firebaseError) {
          console.warn('Error loading from Firebase:', firebaseError);
          // Continue with local data
        }
      }
      
      // Wait for location to be loaded
      const locationData = await locationPromise;
      setLocation(locationData);
      setCachedLocation(locationData);
      
      // Initialize date
      initializeDate();
      setIsInitialLoadComplete(true);
      
    } catch (error) {
      console.error('Error in loadInitialData:', error);
      // Don't show error alert, just log it
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  // Add function to load Firebase records
  const loadFirebaseRecords = async (): Promise<LocalAttendanceRecord[]> => {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];

    const currentDate = new Date();
    const monthYear = `${currentDate.getFullYear()}_${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    
    try {
      const monthlyRef = doc(db, 'bdm_monthly_attendance', `${userId}_${monthYear}`);
      const monthlyDoc = await getDoc(monthlyRef);
      
      if (monthlyDoc.exists()) {
        const data = monthlyDoc.data();
        return (data.records || []).map((record: any) => ({
          ...record,
          timestamp: record.timestamp instanceof Timestamp ? 
            record.timestamp.toDate() : 
            new Date(record.timestamp),
          synced: true
        }));
      }
      
      // If no monthly doc exists, try individual records
      const attendanceRef = collection(db, 'users', userId, 'attendance');
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      
      const q = query(
        attendanceRef,
        where('timestamp', '>=', Timestamp.fromDate(monthStart)),
        where('timestamp', '<=', Timestamp.fromDate(monthEnd)),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp instanceof Timestamp ? 
          doc.data().timestamp.toDate() : 
          new Date(doc.data().timestamp),
        synced: true
      })) as LocalAttendanceRecord[];
      
    } catch (error) {
      console.error('Error loading Firebase records:', error);
      return [];
    }
  };

  // Optimized location loading
  const loadLocation = useCallback(async () => {
    try {
      // Check cache first
      const cachedLoc = await getCachedLocation();
      if (cachedLoc) {
        return cachedLoc;
      }

      // Get fresh location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000
        });
        
        // Cache the location
        await cacheLocation(location);
        return location;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading location:', error);
      return null;
    }
  }, []);

  // Optimized attendance loading
  const loadCachedAttendance = useCallback(async () => {
    try {
      // Check cache first
      const cachedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        
        if (now - timestamp < ATTENDANCE_CACHE_TIMEOUT) {
          return data;
        }
      }

      // Load from Firebase if cache is invalid
      const userId = auth.currentUser?.uid;
      if (!userId) return [];

      const attendanceRef = collection(db, 'users', userId, 'attendance');
      const q = query(
        attendanceRef,
        where('timestamp', '>=', Timestamp.fromDate(startOfMonth(new Date()))),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const attendanceData = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as AttendanceRecord[];

      // Cache the data
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        data: attendanceData,
        timestamp: Date.now()
      }));

      return attendanceData;
    } catch (error) {
      console.error('Error loading attendance:', error);
      return [];
    }
  }, []);

  // Optimized useEffect for initial load
  useEffect(() => {
    loadInitialData();

    // Set up sync interval
    const syncInterval = setInterval(() => {
      if (!isDataLoading) {
        loadCachedAttendance();
      }
    }, SYNC_INTERVAL);

    return () => clearInterval(syncInterval);
  }, [loadInitialData, loadCachedAttendance]);

  useEffect(() => {
    // Request location permission immediately on screen load
    (async () => {
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        setLocationServiceEnabled(enabled);
        
        if (!enabled) {
          Alert.alert(
            "Location Services Required",
            "Please enable location services to use the attendance feature.",
            [
              { text: "Open Settings", onPress: () => Linking.openSettings() },
              { text: "Cancel", style: "cancel" }
            ]
          );
          return;
        }
        
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(status);
        
        if (status !== 'granted') {
          Alert.alert(
            "Location Permission Required",
            "Please grant location permission to use the attendance feature.",
            [
              { text: "Open Settings", onPress: () => Linking.openSettings() },
              { text: "Cancel", style: "cancel" }
            ]
          );
          return;
        }
        
        // If all permissions are granted, proceed with loading the map
        await loadLocation();
      } catch (error) {
        console.error('Error setting up location services:', error);
        setMapError(true);
      }
    })();
    
    // Initialize the current date and update weekly days
    initializeDate();
    
    // Fetch attendance history
    loadCachedAttendance();
  }, []);

  // Add filtered history effect
  useEffect(() => {
    if (activeFilter) {
      setFilteredHistory(attendanceHistory.filter(record => record.status === activeFilter));
    } else {
      setFilteredHistory(attendanceHistory);
    }
  }, [activeFilter, attendanceHistory]);

  // Add punch button disabled effect
  useEffect(() => {
    const checkPunchButtonState = () => {
      // If already punched out today, disable until 8 AM tomorrow
      if (punchInTime && punchOutTime) {
        const now = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(8, 0, 0, 0); // 8 AM tomorrow
        
        if (now < tomorrow) {
          setIsPunchButtonDisabled(true);
          
          // Set a timeout to re-enable the button at 8 AM tomorrow
          const timeUntil8AM = tomorrow.getTime() - now.getTime();
          const timeoutId = setTimeout(() => {
            setIsPunchButtonDisabled(false);
          }, timeUntil8AM);
          
          return () => clearTimeout(timeoutId);
        }
      } else {
        setIsPunchButtonDisabled(false);
      }
    };
    
    checkPunchButtonState();
    
    // Set up an interval to check every minute
    const intervalId = setInterval(checkPunchButtonState, 60000);
    return () => clearInterval(intervalId);
  }, [punchInTime, punchOutTime]);

  useEffect(() => {
    // Process camera data when returned from BDMCameraScreen
    if (route.params && route.params.photo && route.params.location) {
      try {
        const { photo, location, isPunchIn } = route.params;
        saveAttendance(isPunchIn || false, photo.uri, location.coords);
      } catch (error) {
        console.error("Error processing camera data:", error);
        Alert.alert("Error", "Failed to process camera data. Please try again.");
      }
    }
  }, [route.params]);

  const initializeDate = () => {
    const today = new Date();
    setCurrentDate(today);
    
    // Create default week days status first
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust to our 0-indexed array (M=0, T=1, etc.)
    
    // Calculate the date for Monday of this week
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - adjustedDay); // Go back to Monday
    
    {weekDaysStatus.map((day, index) => (
      <View key={index} style={styles.dayContainer}>
        <View style={[styles.dayCircle, {
          backgroundColor: getStatusCircleColor(day.status),
          borderColor: getStatusBorderColor(day.status)
        }]}>
          {getStatusIcon(day.status)}
        </View>
        ...
      </View>
    ))}
     
    
  };

  // Cache location for faster loading
  const cacheLocation = async (location: Location.LocationObject) => {
    try {
      await AsyncStorage.setItem(locationCacheKey, JSON.stringify({
        location,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error caching location:', error);
    }
  };

  // Get cached location if available and not expired
  const getCachedLocation = async (): Promise<Location.LocationObject | null> => {
    try {
      const cachedData = await AsyncStorage.getItem(locationCacheKey);
      if (cachedData) {
        const { location, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        
        // Check if cache is still valid (less than 5 minutes old)
        if (now - timestamp < locationCacheTimeout) {
          return location;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting cached location:', error);
      return null;
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const currentYear = new Date().getFullYear();
      const monthStr = (selectedMonth + 1).toString().padStart(2, '0');
      const monthYearKey = `${currentYear}_${monthStr}`;

      // Try to get from monthly attendance first
      const monthlyRef = doc(db, 'bdm_monthly_attendance', `${userId}_${monthYearKey}`);
      const monthlyDoc = await getDoc(monthlyRef);

      let records: AttendanceRecord[] = [];

      if (monthlyDoc.exists()) {
        const monthlyData = monthlyDoc.data();
        records = monthlyData.records || [];
      } else {
        // Fallback to individual records
        const attendanceRef = collection(db, 'users', userId, 'attendance');
        const monthStart = new Date(currentYear, selectedMonth, 1);
        const monthEnd = new Date(currentYear, selectedMonth + 1, 0);

        const q = query(
          attendanceRef,
          where('timestamp', '>=', Timestamp.fromDate(monthStart)),
          where('timestamp', '<=', Timestamp.fromDate(monthEnd)),
          orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(q);
        records = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate(),
          synced: true
        })) as AttendanceRecord[];

        // Save to monthly attendance for future quick access
        await setDoc(monthlyRef, {
          userId,
          month: selectedMonth + 1,
          year: currentYear,
          records,
          lastUpdated: Timestamp.fromDate(new Date())
        });
      }

      setAttendanceHistory(records);
      updateWeekDaysStatus(records);
      calculateStatusCounts(records);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      Alert.alert('Error', 'Failed to fetch attendance history');
    }
  };

  const updateWeekDaysStatus = (history: AttendanceRecord[]) => {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust to our 0-indexed array (M=0, T=1, etc.)
    
    // Calculate the date for Monday of this week
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - adjustedDay);

    const updatedWeekDays = weekDays.map((day, index) => {
      // Calculate the date for this weekday
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + index);
      const dateStr = format(currentDate, 'dd');
      
      // Find attendance record for this date
      const attendanceRecord = history.find(record => record.date === dateStr);
      
      // Determine status
      let status: 'active' | 'inactive' | 'Present' | 'Half Day' | 'On Leave';
      
      if (format(currentDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
        // Today's date
        status = attendanceRecord ? attendanceRecord.status : 'active';
      } else if (currentDate > today) {
        // Future date
        status = 'inactive';
      } else {
        // Past date
        status = attendanceRecord ? attendanceRecord.status : 'On Leave';
      }
      
      return {
        day,
        date: dateStr,
        status
      };
    });
    
    setWeekDaysStatus(updatedWeekDays);
  } catch (error) {
    console.error('Error updating week days status:', error);
  }
};

  // Update calculateStatusCounts function to handle date calculations safely
  const calculateStatusCounts = (history: AttendanceRecord[]) => {
    try {
      const counts = {
        Present: 0,
        'Half Day': 0,
        'On Leave': 0
      };

      if (!history || history.length === 0) {
        setStatusCounts(counts);
        return;
      }

      const today = new Date();
      const currentMonth = format(today, 'MM');
      const currentYear = format(today, 'yyyy');
      
      // Safely create start and end of month dates
      const startOfMonthDate = new Date(parseInt(currentYear), parseInt(currentMonth) - 1, 1);
      const endOfMonthDate = new Date(parseInt(currentYear), parseInt(currentMonth), 0);
      const daysInMonth = endOfMonthDate.getDate();

      // Create array of valid dates for current month
      const allDates = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(parseInt(currentYear), parseInt(currentMonth) - 1, day);
        if (!isNaN(currentDate.getTime())) { // Validate date is valid
          allDates.push({
            dateStr: format(currentDate, 'dd'),
            isSunday: format(currentDate, 'EEEE') === 'Sunday',
            fullDate: currentDate
          });
        }
      }

      // Filter and validate records for current month
      const currentMonthRecords = history.filter(record => {
        try {
          const recordTimestamp = record.timestamp instanceof Date ? 
            record.timestamp : 
            new Date(record.timestamp);

          if (isNaN(recordTimestamp.getTime())) {
            console.warn('Invalid timestamp in record:', record);
            return false;
          }

          return format(recordTimestamp, 'MM') === currentMonth && 
                 format(recordTimestamp, 'yyyy') === currentYear;
        } catch (error) {
          console.warn('Error processing record:', error);
          return false;
        }
      });

      // Count valid records
      currentMonthRecords.forEach(record => {
        if (record.status in counts) {
          counts[record.status]++;
        }
      });

      // Calculate On Leave days safely
      const attendedDates = new Set(currentMonthRecords.map(record => record.date));
      const todayStr = format(today, 'dd');
      
      const onLeaveDates = allDates.filter(({ dateStr, isSunday, fullDate }) => {
        return !isSunday && 
               !attendedDates.has(dateStr) && 
               fullDate <= today;
      });
      
      counts['On Leave'] = onLeaveDates.length;
      setStatusCounts(counts);
      
    } catch (error) {
      console.error('Error calculating status counts:', error);
      // Set default counts instead of showing error
      setStatusCounts({
        Present: 0,
        'Half Day': 0,
        'On Leave': 0
      });
    }
  };

  // Update calculateAttendanceStatus to handle invalid times
  const calculateAttendanceStatus = (punchIn: string, punchOut: string): 'Present' | 'Half Day' | 'On Leave' => {
    try {
      if (!punchIn || !punchOut) return 'On Leave';
  
      const punchInTime = parse(punchIn, 'HH:mm', new Date());
      if (isNaN(punchInTime.getTime())) {
        return 'On Leave';
      }
  
      const threshold = new Date();
      threshold.setHours(9, 45, 0, 0); // 9:45 AM threshold
  
      return punchInTime <= threshold ? 'Present' : 'Half Day';
    } catch (error) {
      console.error('Error calculating status:', error);
      return 'On Leave';
    }
  };
  

  const handlePunch = async () => {
    try {
      const currentTime = new Date();
      const currentHours = currentTime.getHours();
      const currentMinutes = currentTime.getMinutes();
      const currentTimeInMinutes = currentHours * 60 + currentMinutes;

      // If there's a punch-out record, check if enough time has passed for next punch-in
      if (todayRecord?.punchOut) {
        const nextPunchInTime = new Date();
        nextPunchInTime.setDate(nextPunchInTime.getDate() + 1);
        nextPunchInTime.setHours(1, 0, 0, 0); // 1 AM next day
        
        if (currentTime < nextPunchInTime) {
          Alert.alert(
            "Punch-in Not Allowed",
            "You can only punch-in after 1:00 AM tomorrow."
          );
          return;
        }
      }

      // Check punch in/out time restrictions
      if (!isPunchedIn) {
        // Punch In restrictions
        if (currentTimeInMinutes < PUNCH_IN_START) {
          Alert.alert(
            "Punch In Not Allowed",
            "You can only punch in after 1:00 AM."
          );
          return;
        }
      } else {
        // Punch Out restrictions
        if (currentTimeInMinutes >= PUNCH_OUT_DEADLINE) {
          Alert.alert(
            "Punch Out Not Allowed",
            "You cannot punch out after 11:00 PM."
          );
          return;
        }
      }

      // Check location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          "Location Permission Required",
          "Please grant location permission to punch in/out."
        );
        return;
      }

      // Get current location with timeout
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Location timeout')), 10000);
      });

      const location = await Promise.race([locationPromise, timeoutPromise])
        .catch(error => {
          console.error('Location error:', error);
          return defaultLocation;
        });

      if (location) {
        setLocation(location as Location.LocationObject);
        navigation.navigate('BDMCameraScreen', {
          type: isPunchedIn ? 'out' : 'in'
        });
      } else {
        Alert.alert(
          "Location Error",
          "Could not get your location. Please try again."
        );
      }
    } catch (error) {
      console.error('Error in handlePunch:', error);
      Alert.alert('Error', 'Failed to process punch request');
    }
  };

  const openMapsApp = () => {
    if (location) {
      const url = Platform.select({
        ios: `maps:?q=My+Location&ll=${location.coords.latitude},${location.coords.longitude}`,
        android: `geo:${location.coords.latitude},${location.coords.longitude}?q=${location.coords.latitude},${location.coords.longitude}(My+Location)`
      });
      
      if (url) {
        Linking.openURL(url).catch(err => {
          console.error('Error opening maps app:', err);
          Alert.alert('Error', 'Could not open maps application');
        });
      }
    }
  };

  const getStatusCircleColor = (status: string) => {
    switch (status) {
      case 'Present':
        return '#4CAF50'; // Green
      case 'Half Day':
        return '#FFC107'; // Yellow/Amber
      case 'On Leave':
        return '#FF5252'; // Red
      case 'active':
        return '#FF8447A'; // Orange for today
      case 'inactive':
        return '#E0E0E0'; // Grey for future dates
      default:
        return '#E0E0E0';
    }
  };

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'Present':
      case 'Half Day':
      case 'On Leave':
      case 'active':
        return 'transparent';
      case 'inactive':
        return '#DDD';
      default:
        return '#DDD';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Present':
        return <MaterialIcons name="check" size={16} color="#FFF" />;
      case 'Half Day':
        return <MaterialIcons name="remove" size={16} color="#FFF" />;
      case 'On Leave':
      default:
        return <MaterialIcons name="close" size={16} color="#FFF" />;
    }
  };
  
  const handleMapReady = () => {
    setMapReady(true);
    console.log('Map is ready');
  };

  const renderMapFallback = () => (
    <TouchableOpacity 
      style={styles.mapFallback}
      onPress={loadLocation}
    >
      <MaterialIcons name="map" size={48} color="#FF8447" />
      <Text style={styles.mapFallbackText}>
        {locationServiceEnabled === false 
          ? 'Location services are disabled. Tap to retry.' 
          : permissionStatus !== 'granted' 
            ? 'Location permission required to show map. Tap to request again.' 
            : 'Could not load map. Tap to retry.'}
      </Text>
    </TouchableOpacity>
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Present':
        return styles.presentStatus;
      case 'Half Day':
        return styles.halfDayStatus;
      case 'On Leave':
        return styles.leaveStatus;
      default:
        return styles.presentStatus;
    }
  };

  const getStatusTextStyle = (status: string) => {
    switch (status) {
      case 'Present':
        return styles.presentText;
      case 'Half Day':
        return styles.halfDayText;
      case 'On Leave':
        return styles.leaveText;
      default:
        return styles.presentText;
    }
  };

  const handleSummaryItemPress = (status: 'Present' | 'Half Day' | 'On Leave') => {
    if (activeFilter === status) {
      // If clicking the same filter again, clear it
      setActiveFilter(null);
    } else {
      setActiveFilter(status);
    }
  };

  const getSummaryItemStyle = (status: 'Present' | 'Half Day' | 'On Leave') => {
    // Return different styles based on whether this item is the active filter
    return [
      styles.summaryItem,
      activeFilter && activeFilter !== status ? styles.summaryItemBlurred : null,
      activeFilter === status ? styles.summaryItemActive : null
    ];
  };

  // Add function to handle long press on month
  const handleLongPressMonth = async (month: number) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const currentYear = new Date().getFullYear();
      const monthYearKey = `${currentYear}_${month.toString().padStart(2, '0')}`;
      
      // Check if report already exists
      const reportRef = doc(db, 'bdm_attendance_reports', `${userId}_${monthYearKey}`);
      const reportDoc = await getDoc(reportRef);
      
      if (reportDoc.exists()) {
        // Report exists, show options
        Alert.alert(
          'Attendance Report',
          'What would you like to do?',
          [
            {
              text: 'Download Report',
              onPress: () => downloadAttendanceReport(month, currentYear)
            },
            {
              text: 'Regenerate Report',
              onPress: () => generateAttendanceReport(month, currentYear)
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
      } else {
        // Report doesn't exist, generate it
        generateAttendanceReport(month, currentYear);
      }
    } catch (error) {
      console.error('Error handling long press on month:', error);
      Alert.alert('Error', 'Failed to process request');
    }
  };

  // Generate attendance report for a specific month
  const generateAttendanceReport = async (month: number, year: number) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      Alert.alert('Processing', 'Generating attendance report...');
      
      const monthYearKey = `${year}_${month.toString().padStart(2, '0')}`;
      const monthName = MONTHS.find(m => m.value === month)?.label || '';
      
      // Get monthly attendance data
      const monthlyAttendanceRef = doc(db, 'bdm_monthly_attendance', `${userId}_${monthYearKey}`);
      const monthlyDoc = await getDoc(monthlyAttendanceRef);
      
      if (!monthlyDoc.exists()) {
        Alert.alert('Error', 'No attendance data found for this month');
        return;
      }
      
      const monthlyData = monthlyDoc.data();
      const records = monthlyData.records || [];
      
      // Calculate statistics
      const totalDays = records.length;
      const presentDays = records.filter((record: any) => record.status === 'Present').length;
      const halfDays = records.filter((record: any) => record.status === 'Half Day').length;
      const absentDays = records.filter((record: any) => record.status === 'On Leave').length;
      
      // Create report data
      const reportData = {
        userId,
        monthYear: monthYearKey,
        year,
        month,
        monthName,
        totalDays,
        presentDays,
        halfDays,
        absentDays,
        attendancePercentage: totalDays > 0 ? ((presentDays + (halfDays * 0.5)) / totalDays) * 100 : 0,
        records: records.map((record: any) => ({
          date: record.date,
          day: record.day,
          punchIn: record.punchIn,
          punchOut: record.punchOut,
          status: record.status
        })),
        createdAt: Timestamp.fromDate(new Date()),
        lastUpdated: Timestamp.fromDate(new Date())
      };
      
      // Save report to database
      const reportRef = doc(db, 'bdm_attendance_reports', `${userId}_${monthYearKey}`);
      await setDoc(reportRef, reportData);
      
      Alert.alert('Success', 'Attendance report generated successfully');
      
      // Download the report
      downloadAttendanceReport(month, year);
    } catch (error) {
      console.error('Error generating attendance report:', error);
      Alert.alert('Error', 'Failed to generate attendance report');
    }
  };

  // Update downloadAttendanceReport to generate Excel format
  const downloadAttendanceReport = async (month: number, year: number) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const monthYearKey = `${year}_${month.toString().padStart(2, '0')}`;
      const monthName = MONTHS.find(m => m.value === month)?.label || '';
      
      // Get report data
      const reportRef = doc(db, 'bdm_attendance_reports', `${userId}_${monthYearKey}`);
      const reportDoc = await getDoc(reportRef);
      
      if (!reportDoc.exists()) {
        Alert.alert('Error', 'Report not found');
        return;
      }
      
      const reportData = reportDoc.data();
      
      // Format report as Excel (CSV format that Excel can open)
      let excelContent = `Attendance Report - ${monthName} ${year}\n\n`;
      excelContent += `Employee Name,${auth.currentUser?.displayName || 'Unknown'}\n`;
      excelContent += `Month,${monthName}\n`;
      excelContent += `Year,${year}\n\n`;
      excelContent += `Summary\n`;
      excelContent += `Total Days,${reportData.totalDays}\n`;
      excelContent += `Present Days,${reportData.presentDays}\n`;
      excelContent += `Half Days,${reportData.halfDays}\n`;
      excelContent += `Absent Days,${reportData.absentDays}\n`;
      excelContent += `Attendance Percentage,${reportData.attendancePercentage.toFixed(2)}%\n\n`;
      
      excelContent += `Detailed Attendance Record\n`;
      excelContent += `Date,Day,Punch In,Punch Out,Status\n`;
      
      reportData.records.forEach((record: any) => {
        excelContent += `${record.date},${record.day},${record.punchIn || '-'},${record.punchOut || '-'},${record.status}\n`;
      });
      
      // Save to Firebase for admin panel access
      const adminReportRef = doc(db, 'admin_reports', `attendance_${userId}_${monthYearKey}`);
      await setDoc(adminReportRef, {
        userId,
        userName: auth.currentUser?.displayName || 'Unknown',
        reportType: 'attendance',
        month,
        year,
        monthName,
        reportContent: excelContent,
        createdAt: Timestamp.fromDate(new Date()),
        lastUpdated: Timestamp.fromDate(new Date())
      });
      
      // Share the report
      const fileName = `Attendance_Report_${monthName}_${year}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, excelContent, {
        encoding: FileSystem.EncodingType.UTF8
      });
      
      await Share.share({
        url: filePath,
        title: `Attendance Report - ${monthName} ${year}`,
        message: `Attendance Report for ${monthName} ${year}`
      });
    } catch (error) {
      console.error('Error downloading attendance report:', error);
      Alert.alert('Error', 'Failed to download attendance report');
    }
  };

  // Add map ready handler
  const onMapReady = () => {
    setMapReady(true);
  };

  // Add a function to render map with loading indicator
  const renderMap = () => {
    if (mapError) {
      return renderMapFallback();
    }
    
    if (!location) {
      return (
        <View style={styles.mapFallback}>
          <ActivityIndicator size="large" color="#FF8447" />
          <Text style={styles.mapFallbackText}>Loading map...</Text>
        </View>
      );
    }
    
    return (
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: DEFAULT_MAP_DELTA.latitudeDelta,
          longitudeDelta: DEFAULT_MAP_DELTA.longitudeDelta,
        }}
        customMapStyle={GOOGLE_MAPS_STYLE}
        onMapReady={onMapReady}
        showsUserLocation
        showsMyLocationButton={false}
        loadingEnabled
        loadingIndicatorColor="#FF8447"
        loadingBackgroundColor="#FFF8F0"
      >
        <Marker
          coordinate={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }}
          title="Your Location"
        />
      </MapView>
    );
  };

  const [absentHistory, setAbsentHistory] = useState<{date: string; message: string}[]>([]);
  const [localRecords, setLocalRecords] = useState<AttendanceRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Load local records on component mount
  useEffect(() => {
    loadLocalRecords();
    const syncInterval = setInterval(syncWithFirebase, SYNC_INTERVAL);
    return () => clearInterval(syncInterval);
  }, []);

  const loadLocalRecords = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const monthYearKey = `${currentYear}_${(currentMonth + 1).toString().padStart(2, '0')}`;
      
      // Load from Firebase first
      const monthlyRef = doc(db, 'bdm_monthly_attendance', `${userId}_${monthYearKey}`);
      const monthlyDoc = await getDoc(monthlyRef);
      
      let records: AttendanceRecord[] = [];
      
      if (monthlyDoc.exists()) {
        const monthlyData = monthlyDoc.data();
        records = monthlyData.records.map((record: any) => ({
          ...record,
          timestamp: record.timestamp instanceof Timestamp ? record.timestamp.toDate() : new Date(record.timestamp)
        }));
      } else {
        // Fallback to individual records
        const attendanceRef = collection(db, 'users', userId, 'attendance');
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        
        const q = query(
          attendanceRef,
          where('timestamp', '>=', Timestamp.fromDate(monthStart)),
          where('timestamp', '<=', Timestamp.fromDate(monthEnd)),
          orderBy('timestamp', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        records = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
            synced: true
          } as AttendanceRecord;
        });
      }

      // Get today's record
      const todayStr = format(today, 'dd');
      const todayRecord = records.find(r => r.date === todayStr);
      
      if (todayRecord) {
        setTodayRecord(todayRecord);
        setPunchInTime(todayRecord.punchIn ? format(new Date(`2000-01-01T${todayRecord.punchIn}`), 'hh:mm a') : '');
        setPunchOutTime(todayRecord.punchOut ? format(new Date(`2000-01-01T${todayRecord.punchOut}`), 'hh:mm a') : '');
        setIsPunchedIn(!!todayRecord.punchIn && !todayRecord.punchOut);
        
        // Check if punch-in should be disabled until tomorrow 1 AM
        if (todayRecord.punchOut) {
          const nextPunchInTime = new Date();
          nextPunchInTime.setDate(nextPunchInTime.getDate() + 1);
          nextPunchInTime.setHours(1, 0, 0, 0); // Set to 1 AM next day
          setIsPunchButtonDisabled(new Date() < nextPunchInTime);
        }
      }

      setLocalRecords(records);
      setAttendanceHistory(records);
      updateWeekDaysStatus(records);
      calculateStatusCounts(records);
      
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      console.error('Error loading records:', error);
      Alert.alert('Error', 'Failed to load attendance records');
    }
  };

  const saveLocalRecord = async (record: AttendanceRecord) => {
    try {
      // Initialize as empty array if no records exist
      let existingRecords: AttendanceRecord[] = [];
      
      try {
        const storedData = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedData) {
          const parsed = JSON.parse(storedData);
          existingRecords = Array.isArray(parsed) ? parsed : [];
        }
      } catch (e) {
        console.error('Error reading from storage:', e);
        existingRecords = [];
      }

      // Find index of existing record for today
      const todayIndex = existingRecords.findIndex(r => r && r.date === record.date);

      if (todayIndex !== -1) {
        // Update existing record
        existingRecords[todayIndex] = {
          ...existingRecords[todayIndex],
          ...record,
          synced: false
        };
      } else {
        // Add new record
        existingRecords.push(record);
      }

      // Sort records by date (newest first)
      existingRecords.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existingRecords));
      
      // Update states
      setLocalRecords(existingRecords);
      setAttendanceHistory(existingRecords);
      updateWeekDaysStatus(existingRecords);
      calculateStatusCounts(existingRecords);
      
      return true;
    } catch (error) {
      console.error('Error saving local record:', error);
      return false;
    }
  };

  // Add new function for direct Firebase save
  const saveToFirebase = async (record: AttendanceRecord) => {
    try {
      const userId = auth.currentUser?.uid;
      const userName = auth.currentUser?.displayName || 'Unknown User';
      if (!userId) return false;

      const currentDate = new Date(record.timestamp);
      const currentYear = currentDate.getFullYear();
      const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const monthYearKey = `${currentYear}_${currentMonth}`;
      
      // Format the record with proper timestamps
      const recordToSave = {
        ...record,
        userName,
        timestamp: record.timestamp,
        lastUpdated: new Date(),
        date: format(new Date(record.timestamp), 'dd'),
        month: parseInt(currentMonth),
        year: currentYear,
        workingHours: record.punchIn && record.punchOut ? 
          calculateWorkingHours(record.punchIn, record.punchOut) : 0,
        synced: true
      };

      // Save to individual attendance collection
      const attendanceRef = collection(db, 'users', userId, 'attendance');
      const todayQuery = query(
        attendanceRef,
        where('date', '==', record.date),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(todayQuery);
      if (querySnapshot.empty) {
        await addDoc(attendanceRef, {
          ...recordToSave,
          timestamp: Timestamp.fromDate(new Date(record.timestamp)),
          lastUpdated: Timestamp.fromDate(new Date())
        });
      } else {
        const docRef = querySnapshot.docs[0].ref;
        await updateDoc(docRef, {
          ...recordToSave,
          timestamp: Timestamp.fromDate(new Date(record.timestamp)),
          lastUpdated: Timestamp.fromDate(new Date())
        });
      }

      // Update monthly attendance collection
      const monthlyRef = doc(db, 'bdm_monthly_attendance', `${userId}_${monthYearKey}`);
      const monthlyDoc = await getDoc(monthlyRef);

      if (monthlyDoc.exists()) {
        const monthlyData = monthlyDoc.data();
        const records = monthlyData.records || [];
        const recordIndex = records.findIndex((r: any) => r.date === record.date);

        if (recordIndex !== -1) {
          records[recordIndex] = {
            ...recordToSave,
            timestamp: Timestamp.fromDate(new Date(record.timestamp)),
            lastUpdated: Timestamp.fromDate(new Date())
          };
        } else {
          records.push({
            ...recordToSave,
            timestamp: Timestamp.fromDate(new Date(record.timestamp)),
            lastUpdated: Timestamp.fromDate(new Date())
          });
        }

        // Calculate monthly statistics
        const statistics = calculateMonthlyStatistics(records);

        await updateDoc(monthlyRef, {
          records: records.sort((a: any, b: any) => parseInt(b.date) - parseInt(a.date)),
          statistics,
          lastUpdated: Timestamp.fromDate(new Date())
        });
      } else {
        await setDoc(monthlyRef, {
          userId,
          userName,
          month: parseInt(currentMonth),
          year: currentYear,
          records: [{
            ...recordToSave,
            timestamp: Timestamp.fromDate(new Date(record.timestamp)),
            lastUpdated: Timestamp.fromDate(new Date())
          }],
          statistics: calculateMonthlyStatistics([recordToSave]),
          lastUpdated: Timestamp.fromDate(new Date())
        });
      }

      return true;
    } catch (error) {
      console.error('Error saving to Firebase:', error);
      return false;
    }
  };

  // Add helper function to format timestamp
  const formatTimestamp = (date: Date): Date => {
    try {
      return new Date(date.getTime());
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return new Date();
    }
  };

  // Add helper function to calculate working hours
  const calculateWorkingHours = (punchIn: string, punchOut: string): number => {
    const inTime = new Date(`2000-01-01T${punchIn}`);
    const outTime = new Date(`2000-01-01T${punchOut}`);
    const diffMs = outTime.getTime() - inTime.getTime();
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  };

  // Add helper function to calculate monthly statistics
  const calculateMonthlyStatistics = (records: AttendanceRecord[]) => {
    const statistics = {
      totalDays: records.length,
      presentDays: 0,
      halfDays: 0,
      absentDays: 0,
      totalWorkingHours: 0,
      averageWorkingHours: 0,
      lateArrivals: 0,
      earlyDepartures: 0
    };

    records.forEach(record => {
      switch (record.status) {
        case 'Present':
          statistics.presentDays++;
          break;
        case 'Half Day':
          statistics.halfDays++;
          break;
        case 'On Leave':
          statistics.absentDays++;
          break;
      }

      if (record.punchIn && record.punchOut) {
        const workingHours = calculateWorkingHours(record.punchIn, record.punchOut);
        statistics.totalWorkingHours += workingHours;

        // Check for late arrival (after 9:30 AM)
        const punchInTime = new Date(`2000-01-01T${record.punchIn}`);
        const lateThreshold = new Date(`2000-01-01T09:30`);
        if (punchInTime > lateThreshold) {
          statistics.lateArrivals++;
        }

        // Check for early departure (before 6:00 PM)
        const punchOutTime = new Date(`2000-01-01T${record.punchOut}`);
        const earlyThreshold = new Date(`2000-01-01T18:00`);
        if (punchOutTime < earlyThreshold) {
          statistics.earlyDepartures++;
        }
      }
    });

    statistics.averageWorkingHours = statistics.totalWorkingHours / (statistics.presentDays + statistics.halfDays || 1);
    statistics.averageWorkingHours = Math.round(statistics.averageWorkingHours * 100) / 100;

    return statistics;
  };

  // Update syncWithFirebase function to include sync status
  const syncWithFirebase = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    setSyncStatus('Syncing...');
    
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setSyncStatus('Not authenticated');
        return;
      }

      // Check for daily sync
      if (await isDailySyncNeeded()) {
        await performDailySync();
      }

      // Regular sync process
      const queueStr = await AsyncStorage.getItem(LOCAL_SYNC_QUEUE_KEY);
      let queue: SyncQueueItem[] = queueStr ? JSON.parse(queueStr) : [];
      
      if (queue.length === 0) {
        setSyncStatus('All data synced');
        setIsSyncing(false);
        return;
      }

      // Get local records
      const localRecordsStr = await AsyncStorage.getItem(LOCAL_ATTENDANCE_KEY);
      const localRecords: LocalAttendanceRecord[] = localRecordsStr ? JSON.parse(localRecordsStr) : [];

      // Group records by month for batch processing
      const recordsByMonth: { [key: string]: LocalAttendanceRecord[] } = {};
      
      for (const queueItem of queue) {
        const record = localRecords.find(r => r.localId === queueItem.localId);
        if (!record || !record.needsSync) continue;

        const date = new Date(record.timestamp);
        const monthYear = `${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!recordsByMonth[monthYear]) {
          recordsByMonth[monthYear] = [];
        }
        recordsByMonth[monthYear].push(record);
      }

      // Process each month's records
      for (const [monthYear, records] of Object.entries(recordsByMonth)) {
        const [year, month] = monthYear.split('_').map(Number);
        
        // Get existing monthly data
        const monthlyRef = doc(db, 'bdm_monthly_attendance', `${userId}_${monthYear}`);
        const monthlyDoc = await getDoc(monthlyRef);
        
        let existingRecords: any[] = [];
        if (monthlyDoc.exists()) {
          existingRecords = monthlyDoc.data()?.records || [];
        }

        // Merge new records with existing ones
        for (const record of records) {
          const index = existingRecords.findIndex((r: any) => r.date === record.date);
          const recordToSave = {
            ...record,
            timestamp: Timestamp.fromDate(new Date(record.timestamp)),
            lastUpdated: Timestamp.fromDate(new Date()),
            userName: auth.currentUser?.displayName || 'Unknown',
            month: parseInt(month.toString()),
            year: parseInt(year.toString()),
            workingHours: record.punchIn && record.punchOut ? 
              calculateWorkingHours(record.punchIn, record.punchOut) : 0
          };

          if (index !== -1) {
            existingRecords[index] = recordToSave;
          } else {
            existingRecords.push(recordToSave);
          }
        }

        // Calculate statistics
        const statistics = calculateMonthlyStatistics(existingRecords);

        // Save to Firebase
        try {
          await setDoc(monthlyRef, {
            userId,
            userName: auth.currentUser?.displayName || 'Unknown',
            month: parseInt(month.toString()),
            year: parseInt(year.toString()),
            records: existingRecords,
            statistics,
            lastUpdated: Timestamp.fromDate(new Date()),
            lastDailySync: Timestamp.fromDate(new Date())
          });

          // Update local records sync status
          records.forEach(record => {
            const localIndex = localRecords.findIndex(r => r.localId === record.localId);
            if (localIndex !== -1) {
              localRecords[localIndex].needsSync = false;
              localRecords[localIndex].synced = true;
            }
          });

          // Remove successfully synced items from queue
          queue = queue.filter(item => 
            !records.some(record => record.localId === item.localId)
          );

        } catch (error) {
          console.error(`Error syncing month ${monthYear}:`, error);
          // Update retry counts for failed records
          records.forEach(record => {
            const queueItem = queue.find(item => item.localId === record.localId);
            if (queueItem) {
              queueItem.retries++;
              if (queueItem.retries >= MAX_SYNC_RETRIES) {
                queue = queue.filter(item => item.localId !== queueItem.localId);
              }
            }
          });
        }
      }

      // Save updated queue and records
      await AsyncStorage.setItem(LOCAL_SYNC_QUEUE_KEY, JSON.stringify(queue));
      await AsyncStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(localRecords));
      
      setLastSyncTime(new Date());
      setSyncStatus(`Last synced: ${format(new Date(), 'hh:mm:ss a')}`);
      setSyncRetries(0);

    } catch (error: any) { // Type the error
      console.error('Error during sync:', error);
      setSyncStatus(`Sync failed: ${error?.message || 'Unknown error'}`);
      setSyncRetries(prev => prev + 1);
    } finally {
      setIsSyncing(false);
    }
  };

  // Add new state for sync status
  const [syncStatus, setSyncStatus] = useState<string>('Not synced yet');

  // Update useEffect for sync intervals
  useEffect(() => {
    let syncIntervalId: NodeJS.Timeout;
    let networkCheckIntervalId: NodeJS.Timeout;
    let dailySyncIntervalId: NodeJS.Timeout;

    const setupSync = async () => {
      // Initial sync
      if (isOnline) {
        await syncWithFirebase();
      }

      // Regular sync interval (every minute)
      syncIntervalId = setInterval(async () => {
        if (isOnline) {
          await syncWithFirebase();
        }
      }, SYNC_INTERVAL);

      // Network status check
      networkCheckIntervalId = setInterval(async () => {
        const online = await checkNetworkStatus();
        if (online && !isOnline) {
          await syncWithFirebase();
        }
      }, NETWORK_CHECK_INTERVAL);

      // Daily sync check (every hour)
      dailySyncIntervalId = setInterval(async () => {
        const now = new Date();
        if (now.getHours() === DAILY_SYNC_HOUR && now.getMinutes() === DAILY_SYNC_MINUTE) {
          await performDailySync();
        }
      }, 60 * 60 * 1000); // Check every hour
    };

    setupSync();

    // Cleanup
    return () => {
      clearInterval(syncIntervalId);
      clearInterval(networkCheckIntervalId);
      clearInterval(dailySyncIntervalId);
    };
  }, [isOnline]);

  // Add useEffect for network status monitoring and sync
  useEffect(() => {
    // Initial load
    loadOfflineRecords();
    checkNetworkStatus();

    // Set up intervals for network checking and sync
    const networkInterval = setInterval(checkNetworkStatus, NETWORK_CHECK_INTERVAL);
    const syncInterval = setInterval(() => {
      if (isOnline && syncQueue.length > 0 && syncRetries < MAX_SYNC_RETRIES) {
        syncWithFirebase();
      }
    }, SYNC_INTERVAL);

    return () => {
      clearInterval(networkInterval);
      clearInterval(syncInterval);
    };
  }, [isOnline, syncQueue.length, syncRetries]);

  // Add function to check network status
  const checkNetworkStatus = useCallback(async () => {
    try {
      const response = await fetch('https://www.google.com');
      setIsOnline(response.ok);
      return response.ok;
    } catch (error) {
      setIsOnline(false);
      return false;
    }
  }, []);

  // Add function to load offline records
  const loadOfflineRecords = async () => {
    try {
      const storedData = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY);
      if (storedData) {
        const records = JSON.parse(storedData) as AttendanceRecord[];
        setOfflineRecords(records);
        setSyncQueue(records.filter((record: AttendanceRecord) => !record.synced));
      }
    } catch (error) {
      console.error('Error loading offline records:', error);
    }
  };

  // Add function to save offline record
  const saveOfflineRecord = async (record: AttendanceRecord) => {
    try {
      const newRecord = { ...record, synced: false };
      const updatedRecords = [...offlineRecords, newRecord];
      
      await AsyncStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(updatedRecords));
      setOfflineRecords(updatedRecords);
      setSyncQueue(prev => [...prev, newRecord]);
      
      return true;
    } catch (error) {
      console.error('Error saving offline record:', error);
      return false;
    }
  };

  const calculateAbsentHistory = (history: AttendanceRecord[]) => {
    const currentMonth = format(new Date(), 'MM');
    const currentYear = format(new Date(), 'yyyy');
    const startDate = startOfMonth(new Date());
    const endDate = endOfMonth(new Date());
    const allDates = eachDayOfInterval({ start: startDate, end: endDate });
    
    const absentDates = allDates.filter(date => {
      const dateStr = format(date, 'dd');
      const day = format(date, 'EEE').toUpperCase();
      const record = history.find(r => r.date === dateStr);
      
      return !record || record.status === 'On Leave';
    });

    const absentHistory = absentDates.map(date => ({
      date: format(date, 'dd MMM yyyy'),
      message: professionalMessages.absent[Math.floor(Math.random() * professionalMessages.absent.length)]
    }));

    setAbsentHistory(absentHistory);
  };

  // Update saveAttendance function to ensure valid timestamps
  const saveAttendance = async (isPunchIn: boolean, photoUri: string, locationCoords: any) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const currentTime = new Date();
      if (isNaN(currentTime.getTime())) {
        throw new Error('Invalid current time');
      }

      const dateStr = format(currentTime, 'dd');
      const dayStr = format(currentTime, 'EEE').toUpperCase();
      const timeStr = format(currentTime, 'HH:mm');
      const localId = `${userId}_${dateStr}_${Date.now()}`;

      // Create new record with validated timestamp
      const newRecord: LocalAttendanceRecord = {
        localId,
        date: dateStr,
        day: dayStr,
        punchIn: isPunchIn ? timeStr : (todayRecord?.punchIn || ''),
        punchOut: !isPunchIn ? timeStr : (todayRecord?.punchOut || ''),
        status: 'Present',
        userId,
        timestamp: currentTime,
        photoUri,
        location: locationCoords,
        needsSync: true,
        syncRetries: 0,
        synced: false
      };

      // Validate punch times before calculating status
      const punchInTime = newRecord.punchIn ? 
        parse(newRecord.punchIn, 'HH:mm', new Date()) : null;
      const punchOutTime = newRecord.punchOut ? 
        parse(newRecord.punchOut, 'HH:mm', new Date()) : null;

      if ((newRecord.punchIn && !punchInTime) || (newRecord.punchOut && !punchOutTime)) {
        throw new Error('Invalid punch time format');
      }

      // Calculate status with validated times
     // Calculate status with validated times
newRecord.status = calculateAttendanceStatus(
  newRecord.punchIn,
  newRecord.punchOut
);


      // Save to local storage
      await saveToLocalStorage(newRecord);

      // Update UI
     // Update UI
if (isPunchIn) {
  setPunchInTime(format(currentTime, 'hh:mm a'));
  setIsPunchedIn(true);
} else {
  setPunchOutTime(format(currentTime, 'hh:mm a'));
  setIsPunchedIn(false);
}

// Update today record with updated status
setTodayRecord({
  ...newRecord,
  status: newRecord.status, // force update
});

      Alert.alert(
        'Success',
        `Successfully ${isPunchIn ? 'punched in' : 'punched out'} at ${format(currentTime, 'hh:mm a')}${
          !isOnline ? '\n(Saved offline - will sync when online)' : ''
        }`
      );

    } catch (error) {
      console.error('Error saving attendance:', error);
      Alert.alert('Error', 'Failed to save attendance. Please try again.');
    }
  };

  // Add function to save to local storage
  const saveToLocalStorage = async (record: LocalAttendanceRecord) => {
    try {
      // Get existing records
      const existingRecordsStr = await AsyncStorage.getItem(LOCAL_ATTENDANCE_KEY);
      let existingRecords: LocalAttendanceRecord[] = existingRecordsStr ? JSON.parse(existingRecordsStr) : [];

      // Update or add new record
      const existingIndex = existingRecords.findIndex(r => r.date === record.date);
      if (existingIndex !== -1) {
        existingRecords[existingIndex] = record;
      } else {
        existingRecords.push(record);
      }

      // Save updated records
      await AsyncStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(existingRecords));

      // Add to sync queue if needs sync
      if (record.needsSync) {
        await addToSyncQueue(record.localId);
      }

      return true;
    } catch (error) {
      console.error('Error saving to local storage:', error);
      return false;
    }
  };

  // Add function to manage sync queue
  const addToSyncQueue = async (localId: string) => {
    try {
      const queueStr = await AsyncStorage.getItem(LOCAL_SYNC_QUEUE_KEY);
      let queue: SyncQueueItem[] = queueStr ? JSON.parse(queueStr) : [];

      // Add new item to queue if not already present
      if (!queue.find(item => item.localId === localId)) {
        queue.push({
          localId,
          timestamp: Date.now(),
          retries: 0
        });
        await AsyncStorage.setItem(LOCAL_SYNC_QUEUE_KEY, JSON.stringify(queue));
      }
    } catch (error) {
      console.error('Error adding to sync queue:', error);
    }
  };

  // Add function to check if punch in is allowed
  const isPunchInAllowed = (lastPunchOutTime: string | null) => {
    const currentTime = new Date();
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    
    if (!lastPunchOutTime) return true;
    
    const lastPunchOutDate = new Date(lastPunchOutTime);
    const nextAllowedTime = new Date(lastPunchOutDate);
    nextAllowedTime.setDate(nextAllowedTime.getDate() + 1);
    nextAllowedTime.setHours(1, 0, 0, 0); // 1 AM next day
    
    return currentTime >= nextAllowedTime;
  };

  // Add function to check if daily sync is needed
  const isDailySyncNeeded = async () => {
    try {
      const lastSyncStr = await AsyncStorage.getItem('last_daily_sync');
      if (!lastSyncStr) return true;

      const lastSync = new Date(JSON.parse(lastSyncStr));
      const today = new Date();
      
      return lastSync.getDate() !== today.getDate() ||
             lastSync.getMonth() !== today.getMonth() ||
             lastSync.getFullYear() !== today.getFullYear();
    } catch (error) {
      console.error('Error checking daily sync:', error);
      return true;
    }
  };

  // Add function for daily sync
  const performDailySync = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const today = new Date();
      const monthYear = `${today.getFullYear()}_${(today.getMonth() + 1).toString().padStart(2, '0')}`;
      
      // Get all local records for current month
      const localRecordsStr = await AsyncStorage.getItem(LOCAL_ATTENDANCE_KEY);
      const localRecords: LocalAttendanceRecord[] = localRecordsStr ? JSON.parse(localRecordsStr) : [];
      
      // Get Firebase records
      const monthlyRef = doc(db, 'bdm_monthly_attendance', `${userId}_${monthYear}`);
      const monthlyDoc = await getDoc(monthlyRef);
      
      let firebaseRecords = monthlyDoc.exists() ? monthlyDoc.data()?.records || [] : [];
      
      // Merge records, giving priority to local records
      const mergedRecords = [...firebaseRecords];
      localRecords.forEach(localRecord => {
        const index = mergedRecords.findIndex((r: any) => r.date === localRecord.date);
        if (index !== -1) {
          mergedRecords[index] = {
            ...localRecord,
            timestamp: Timestamp.fromDate(new Date(localRecord.timestamp)),
            lastUpdated: Timestamp.fromDate(new Date()),
            synced: true
          };
        } else {
          mergedRecords.push({
            ...localRecord,
            timestamp: Timestamp.fromDate(new Date(localRecord.timestamp)),
            lastUpdated: Timestamp.fromDate(new Date()),
            synced: true
          });
        }
      });

      // Calculate updated statistics
      const statistics = calculateMonthlyStatistics(mergedRecords);

      // Update Firebase
      await setDoc(monthlyRef, {
        userId,
        userName: auth.currentUser?.displayName || 'Unknown',
        month: today.getMonth() + 1,
        year: today.getFullYear(),
        records: mergedRecords,
        statistics,
        lastUpdated: Timestamp.fromDate(new Date()),
        lastDailySync: Timestamp.fromDate(new Date())
      });

      // Update local storage
      await AsyncStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(mergedRecords));
      await AsyncStorage.setItem('last_daily_sync', JSON.stringify(new Date()));

      // Update UI
      setAttendanceHistory(mergedRecords);
      updateWeekDaysStatus(mergedRecords);
      calculateStatusCounts(mergedRecords);
      
      console.log('Daily sync completed successfully');
    } catch (error) {
      console.error('Error in daily sync:', error);
    }
  };

  // Update sync status display in the UI
  const renderSyncStatus = () => (
    <View style={styles.syncStatusContainer}>
      <View style={styles.syncStatusRow}>
        <MaterialIcons 
          name={isSyncing ? 'sync' : isOnline ? 'cloud-done' : 'cloud-off'} 
          size={16} 
          color={isSyncing ? '#FF8447' : isOnline ? '#4CAF50' : '#999'} 
          style={[styles.syncIcon, isSyncing && styles.syncingIcon]} 
        />
        <Text style={styles.syncStatusText}>{syncStatus}</Text>
      </View>
      {!isOnline && (
        <Text style={styles.offlineText}>
          Working offline - changes will sync when connection is restored
        </Text>
      )}
    </View>
  );

  return (
    <AppGradient>
      <BDMMainLayout 
        title="Attendance"
        showBackButton
        showDrawer={true}
      >
        {!isInitialLoadComplete ? (
          <AttendanceSkeleton />
        ) : (
          <ScrollView style={styles.scrollView}>
            {/* Punch Card with Map */}
            <View style={styles.punchCard}>
              {/* Map View */}
              <View style={styles.mapContainer}>
                {renderMap()}
              </View>

              {/* Punch Info */}
              <View style={styles.punchInfo}>
                <Text style={styles.punchLabel}>Take Attendance</Text>
                <TouchableOpacity
                  style={[
                    styles.punchButton, 
                    isPunchedIn && styles.punchOutButton,
                    isPunchButtonDisabled && styles.punchButtonDisabled
                  ]}
                  onPress={handlePunch}
                  disabled={isPunchButtonDisabled}
                >
                  <Text style={[
                    styles.punchButtonText,
                    isPunchButtonDisabled && styles.punchButtonTextDisabled
                  ]}>
                    {isPunchedIn ? 'Punch Out' : 'Punch In'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.timeInfo}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeLabel}>Punch In</Text>
                  <Text style={styles.timeValue}>{punchInTime || '-----'}</Text>
                </View>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeLabel}>Punch Out</Text>
                  <Text style={styles.timeValue}>{punchOutTime || '-----'}</Text>
                </View>
              </View>
            </View>

            {/* Week View */}
            <View style={styles.weekCard}>
              <Text style={styles.dateText}>{format(currentDate, 'dd MMMM (EEEE)')}</Text>
              <View style={styles.weekDays}>
                {weekDaysStatus.map((day, index) => (
                  <View key={index} style={styles.dayContainer}>
                    <View 
                      style={[
                        styles.dayCircle,
                        { 
                          backgroundColor: getStatusCircleColor(day.status),
                          borderColor: getStatusBorderColor(day.status)
                        }
                      ]}
                    >
                      {getStatusIcon(day.status)}
                    </View>
                    <Text style={[
                      styles.weekDayText,
                      day.status === 'inactive' && styles.inactiveText
                    ]}>
                      {day.day}
                    </Text>
                    {day.date && (
                      <Text style={[
                        styles.weekDateText,
                        day.status === 'inactive' && styles.inactiveText
                      ]}>
                        {day.date}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* Month Scroll */}
            <MonthScroll 
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
              onLongPressMonth={handleLongPressMonth}
            />

            {/* Attendance Summary */}
            <View style={styles.summaryContainer}>
              <TouchableOpacity 
                style={getSummaryItemStyle('Present')}
                onPress={() => handleSummaryItemPress('Present')}
              >
                <Text style={styles.summaryStatusPresent}>Present</Text>
                <Text style={styles.summaryCount}>{statusCounts.Present} days</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={getSummaryItemStyle('Half Day')}
                onPress={() => handleSummaryItemPress('Half Day')}
              >
                <Text style={styles.summaryStatusHalfDay}>Half Day</Text>
                <Text style={styles.summaryCount}>{statusCounts["Half Day"]} days</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={getSummaryItemStyle('On Leave')}
                onPress={() => handleSummaryItemPress('On Leave')}
              >
                <Text style={styles.summaryStatusAbsent}>Absent</Text>
                <Text style={styles.summaryCount}>{statusCounts["On Leave"]} days</Text>
              </TouchableOpacity>
            </View>

            {/* Attendance History */}
            <View style={styles.historySection}>
              <View style={styles.historyHeader}>
                <Text style={styles.sectionTitle}>Attendance History</Text>
                {activeFilter && (
                  <TouchableOpacity
                    style={styles.clearFilterButton}
                    onPress={() => setActiveFilter(null)}
                  >
                    <Text style={styles.clearFilterText}>Clear Filter</Text>
                    <MaterialIcons name="clear" size={16} color="#FF8447" />
                  </TouchableOpacity>
                )}
              </View>
              
              {filteredHistory.length === 0 ? (
                <View style={styles.emptyHistoryContainer}>
                  <MaterialIcons name="event-busy" size={48} color="#999" />
                  <Text style={styles.emptyHistoryText}>
                    {activeFilter 
                      ? `No ${activeFilter} records found` 
                      : "No attendance records found"}
                  </Text>
                  <Text style={styles.emptyHistorySubText}>
                    {activeFilter 
                      ? "Try selecting a different filter" 
                      : "Your attendance history will appear here"}
                  </Text>
                </View>
              ) : (
                filteredHistory.map((record, index) => (
                  <View key={index} style={styles.historyCard}>
                    <View style={styles.dateColumn}>
                      <Text style={styles.dateNumber}>{record.date}</Text>
                      <Text style={styles.dateDay}>{record.day}</Text>
                    </View>
                    <View style={styles.punchDetails}>
                      <View style={styles.punchTimeContainer}>
                        <Text style={styles.punchTime}>{record.punchIn ? format(new Date(`2000-01-01T${record.punchIn}`), 'hh:mm a') : '-----'}</Text>
                        <Text style={styles.punchType}>Punch In</Text>
                      </View>
                      <View style={styles.punchTimeContainer}>
                        <Text style={styles.punchTime}>{record.punchOut ? format(new Date(`2000-01-01T${record.punchOut}`), 'hh:mm a') : '-----'}</Text>
                        <Text style={styles.punchType}>Punch Out</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, getStatusStyle(record.status)]}>
                    <Text style={[styles.statusText, getStatusTextStyle(record.status)]}>
  {record.status}
</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Absent History Section */}
            {absentHistory.length > 0 && (
              <View style={styles.absentHistoryContainer}>
                <Text style={styles.absentHistoryTitle}>Absent History</Text>
                {absentHistory.map((item, index) => (
                  <View key={index} style={styles.absentHistoryItem}>
                    <Text style={styles.absentDate}>{item.date}</Text>
                    <Text style={styles.absentMessage}>{item.message}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Updated Sync Status */}
            {renderSyncStatus()}
          </ScrollView>
        )}
      </BDMMainLayout>
    </AppGradient>
  );
};

// Add styles first
const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  mapContainer: {
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  mapFallbackText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
  },
  punchCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 0,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  punchInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  punchLabel: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  punchButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  punchOutButton: {
    backgroundColor: '#FF4444',
  },
  punchButtonText: {
    color: 'white',
    fontFamily: 'LexendDeca_500Medium',
  },
  timeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  timeColumn: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  timeValue: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'LexendDeca_500Medium',
    marginTop: 4,
  },
  weekCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 0,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateText: {
    fontSize: 18,
    color: '#333',
    fontFamily: 'LexendDeca_500Medium',
    marginBottom: 16,
    textAlign: 'center',
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  dayContainer: {
    alignItems: 'center',
    width: 45,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
  },
  weekDayText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'LexendDeca_500Medium',
    marginTop: 2,
  },
  weekDateText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'LexendDeca_400Regular',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryStatusPresent: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#4CAF50',
    marginBottom: 4,
  },
  summaryStatusHalfDay: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FFC107',
    marginBottom: 4,
  },
  summaryStatusAbsent: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF5252',
    marginBottom: 4,
  },
  summaryCount: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateColumn: {
    alignItems: 'center',
    width: 40,
    marginRight: 12,
  },
  dateNumber: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  dateDay: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  punchDetails: {
    flex: 1,
    flexDirection: 'column',
    marginRight: 8,
  },
  punchTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  punchTime: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'LexendDeca_500Medium',
  },
  punchType: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  presentStatus: {
    backgroundColor: '#E8F5E9',
  },
  halfDayStatus: {
    backgroundColor: '#FFF3E0',
  },
  leaveStatus: {
    backgroundColor: '#FFEBEE',
  },
  presentText: {
    color: '#4CAF50',
    fontSize: 12,
    fontFamily: 'LexendDeca_500Medium',
  },
  halfDayText: {
    color: '#FFC107',
    fontSize: 12,
    fontFamily: 'LexendDeca_500Medium',
  },
  leaveText: {
    color: '#FF5252',
    fontSize: 12,
    fontFamily: 'LexendDeca_500Medium',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_500Medium',
  },
  markerContainer: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyHistoryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  emptyHistoryText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'LexendDeca_500Medium',
    marginTop: 16,
  },
  emptyHistorySubText: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'LexendDeca_400Regular',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#333',
    fontFamily: 'LexendDeca_600SemiBold',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  historySection: {
    marginTop: 16,
  },
  loadingLocation: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  punchButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.7,
  },
  punchButtonTextDisabled: {
    color: '#666',
  },
  nextPunchInfo: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  summaryItemBlurred: {
    opacity: 0.5,
  },
  summaryItemActive: {
    borderWidth: 2,
    borderColor: '#FF8447',
    transform: [{ scale: 1.05 }],
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  clearFilterText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#FF8447',
    marginRight: 4,
  },
  monthScrollContainer: {
    marginVertical: 8,
  },
  monthScrollContent: {
    paddingHorizontal: 16,
  },
  monthItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  selectedMonthItem: {
    backgroundColor: '#FF8447',
  },
  pastMonthItem: {
    opacity: 0.6,
  },
  monthText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  selectedMonthText: {
    color: '#FFFFFF',
    fontFamily: 'LexendDeca_500Medium',
  },
  pastMonthText: {
    color: '#999',
  },
  skeletonContainer: {
    padding: 16,
  },
  skeletonMap: {
    borderRadius: 12,
    marginBottom: 16,
  },
  skeletonPunchCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  skeletonWeekCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  skeletonSummary: {
    borderRadius: 12,
    marginBottom: 16,
  },
  skeletonHistory: {
    borderRadius: 12,
  },
  absentHistoryContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 8,
  },
  absentHistoryTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 12,
  },
  absentHistoryItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  absentDate: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    marginBottom: 4,
  },
  absentMessage: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    lineHeight: 20,
  },
  syncStatusContainer: {
    padding: 16,
    alignItems: 'center',
    // backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    // borderRadius: 8,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.1,
    // shadowRadius: 2,
    // elevation: 2,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncIcon: {
    marginRight: 8,
  },
  syncingIcon: {
    transform: [{ rotate: '0deg' }],
  },
  syncStatusText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  offlineText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  inactiveText: {
    color: '#BBB',
  },
});

export default BDMAttendanceScreen; 