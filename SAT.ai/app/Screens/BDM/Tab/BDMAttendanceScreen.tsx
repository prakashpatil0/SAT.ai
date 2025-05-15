import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform, Alert, Image, ActivityIndicator, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DEFAULT_LOCATION, DEFAULT_MAP_DELTA, GOOGLE_MAPS_STYLE } from '@/app/utils/MapUtils';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths } from 'date-fns';
import { collection, addDoc, getDocs, query, where, Timestamp, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  date: string;          // "01", "02", ..., "31"
  day: string;           // "MON", "TUE", etc.
  month: string;         // "01" to "12"
  year: string;          // "2023"
  punchIn: string;       // "09:00" (24-hour format)
  punchOut: string;      // "17:30" (24-hour format)
  status: 'Present' | 'Half Day' | 'On Leave';
  userId: string;
  timestamp: Date;
  photoUri: string;      // Punch-in photo URL
  punchOutPhotoUri?: string; // Punch-out photo URL
  location: {            // Punch-in location
    latitude: number;
    longitude: number;
  };
  punchOutLocation?: {   // Punch-out location
    latitude: number;
    longitude: number;
  };
  designation: string;
  employeeName: string;
  phoneNumber: string;
  email: string;
  totalHours: number;
  workMode: 'Office' | 'Work From Home';
  locationName: string;  // Punch-in location name
  punchOutLocationName?: string; // Punch-out location name
  lastUpdated: Date;
};

type ChartData = {
  labels: string[];
  datasets: {
    data: number[];
  }[];
};

const CACHE_KEY = '@map_location_cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const BDMAttendanceScreen = () => {
  // Map and location states
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [mapError, setMapError] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [locationServiceEnabled, setLocationServiceEnabled] = useState<boolean | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  
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

  // New states for enhanced features
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthsList, setMonthsList] = useState<Date[]>([]);
  const [userDetails, setUserDetails] = useState<{
    designation?: string;
    employeeName?: string;
    phoneNumber?: string;
    email?: string;
  }>({});
  const [chartData, setChartData] = useState<ChartData>({
    labels: [],
    datasets: [{ data: [] }]
  });
  const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(true);

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

  const openLocationSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('App-Prefs:root=Privacy&path=LOCATION');
    } else {
      Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
    }
  };

  // Add new function to save location to cache
  const saveLocationToCache = async (location: Location.LocationObject) => {
    try {
      const cacheData = {
        location: location,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving location to cache:', error);
    }
  };

  // Add new function to get location from cache
  const getLocationFromCache = async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { location, timestamp } = JSON.parse(cachedData);
        const isExpired = Date.now() - timestamp > CACHE_EXPIRY;
        
        if (!isExpired) {
          return location;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting location from cache:', error);
      return null;
    }
  };

  // Modify checkLocationStatus to use cache
  const checkLocationStatus = async () => {
    try {
      setIsLocationLoading(true);
      const enabled = await Location.hasServicesEnabledAsync();
      setLocationServiceEnabled(enabled);
      
      if (enabled) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(status);
        
        if (status === 'granted') {
          // Try to load from cache first
          const cachedLocation = await getLocationFromCache();
          if (cachedLocation) {
            setLocation(cachedLocation);
            setMapReady(true);
          }
          // Then load current location
          await loadLocation();
        }
      }
    } catch (error) {
      console.error('Error checking location status:', error);
      setMapError(true);
    } finally {
      setIsLocationLoading(false);
    }
  };

  useEffect(() => {
    // Initialize months list
    const months = eachMonthOfInterval({
      start: subMonths(new Date(), 11),
      end: new Date()
    });
    setMonthsList(months);
    
    // Load user details
    loadUserDetails();
    
    // Check location status immediately
    checkLocationStatus();
    
    // Initialize the current date and update weekly days
    initializeDate();
    
    // Fetch attendance history
    fetchAttendanceHistory();
  }, []);

  // Add effect for selected month changes
  useEffect(() => {
    if (attendanceHistory.length > 0) {
      updateChartData();
      filterHistoryByMonth();
    }
  }, [selectedMonth, attendanceHistory]);

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
    
    const updatedWeekDays = weekDaysStatus.map((day, index) => {
      // Calculate the date for this weekday
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + index);
      const dateStr = format(currentDate, 'dd');
      
      return { 
        day: day.day,
        date: dateStr,
        status: (index <= adjustedDay ? 'active' : 'inactive') as 'active' | 'inactive' | 'Present' | 'Half Day' | 'On Leave'
      };
    });
    
    setWeekDaysStatus(updatedWeekDays);
  };

  const loadLocation = async () => {
    try {
      setMapError(false);
      
      // First try to get location from cache
      const cachedLocation = await getLocationFromCache();
      if (cachedLocation) {
        setLocation(cachedLocation);
        setMapReady(true);
      }

      // Then try to get last known location
      const lastKnownLocation = await Location.getLastKnownPositionAsync({
        maxAge: 10000 // 10 seconds
      });

      if (lastKnownLocation) {
        setLocation(lastKnownLocation);
        saveLocationToCache(lastKnownLocation);
        // Then get current location in background
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        }).then(currentLocation => {
          if (currentLocation) {
            setLocation(currentLocation);
            saveLocationToCache(currentLocation);
          }
        }).catch(error => {
          console.error('Error getting current location:', error);
        });
      } else {
        // If no last known location, get current location
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        
        if (currentLocation) {
          setLocation(currentLocation);
          saveLocationToCache(currentLocation);
        } else {
          setLocation(defaultLocation as Location.LocationObject);
          setMapError(true);
        }
      }
    } catch (error) {
      console.error('Error loading location:', error);
      setMapError(true);
      setLocation(defaultLocation as Location.LocationObject);
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const attendanceRef = collection(db, 'bdm_monthly_attendance');
      const monthQuery = query(
        attendanceRef,
        where('month', '==', format(selectedMonth, 'MM')),
        where('year', '==', format(selectedMonth, 'yyyy')),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(monthQuery);
      
      const history: AttendanceRecord[] = [];
      const today = format(new Date(), 'dd');
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        history.push({
          date: data.date,
          day: data.day,
          month: data.month,
          year: data.year,
          punchIn: data.punchIn,
          punchOut: data.punchOut,
          status: data.status,
          userId: data.userId,
          timestamp: data.timestamp.toDate(),
          photoUri: data.photoUri,
          punchOutPhotoUri: data.punchOutPhotoUri,
          location: data.location,
          punchOutLocation: data.punchOutLocation,
          designation: data.designation,
          employeeName: data.employeeName,
          phoneNumber: data.phoneNumber,
          email: data.email,
          totalHours: data.totalHours,
          workMode: data.workMode,
          locationName: data.locationName,
          punchOutLocationName: data.punchOutLocationName,
          lastUpdated: data.lastUpdated.toDate()
        });

        // Update today's punch in/out status
        if (data.date === today && data.month === format(new Date(), 'MM')) {
          setTodayRecord({
            date: data.date,
            day: data.day,
            month: data.month,
            year: data.year,
            punchIn: data.punchIn,
            punchOut: data.punchOut,
            status: data.status,
            userId: data.userId,
            timestamp: data.timestamp.toDate(),
            photoUri: data.photoUri,
            punchOutPhotoUri: data.punchOutPhotoUri,
            location: data.location,
            punchOutLocation: data.punchOutLocation,
            designation: data.designation,
            employeeName: data.employeeName,
            phoneNumber: data.phoneNumber,
            email: data.email,
            totalHours: data.totalHours,
            workMode: data.workMode,
            locationName: data.locationName,
            punchOutLocationName: data.punchOutLocationName,
            lastUpdated: data.lastUpdated.toDate()
          });
          
          setPunchInTime(data.punchIn ? format(new Date(`2000-01-01T${data.punchIn}`), 'hh:mm a') : '');
          setPunchOutTime(data.punchOut ? format(new Date(`2000-01-01T${data.punchOut}`), 'hh:mm a') : '');
          setIsPunchedIn(!!data.punchIn && !data.punchOut);
        }
      });

      const sortedHistory = history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setAttendanceHistory(sortedHistory);

      // Check if there are any records for the selected month
      if (sortedHistory.length > 0) {
        calculateStatusCounts(sortedHistory);
        updateWeekDaysStatus(sortedHistory);
      } else {
        // If no records, set absent days to zero
        setStatusCounts({ Present: 0, 'Half Day': 0, 'On Leave': 0 });
      }
    } catch (error) {
      console.error('Error fetching attendance history:', error);
    }
  };

  const updateWeekDaysStatus = (history: AttendanceRecord[]) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Start from Monday
    
    const updatedWeekDays = weekDaysStatus.map((day, index) => {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + index);
      
      // Find attendance record for this date
      const dateStr = format(currentDate, 'dd');
      const attendanceRecord = history.find(record => record.date === dateStr);
      
      // Default to 'inactive' for future dates, use attendance status for past dates
      let status: 'active' | 'inactive' | 'Present' | 'Half Day' | 'On Leave';
      if (currentDate > today) {
        status = 'inactive';
      } else if (attendanceRecord) {
        status = attendanceRecord.status as 'Present' | 'Half Day' | 'On Leave';
      } else {
        status = 'On Leave';
      }
      
      return {
        day: day.day,
        date: dateStr,
        status
      };
    });
    
    setWeekDaysStatus(updatedWeekDays);
  };

  const calculateStatusCounts = (history: AttendanceRecord[]) => {
    const currentMonth = format(new Date(), 'MM');
    const currentYear = format(new Date(), 'yyyy');
    
    const counts = {
      Present: 0,
      'Half Day': 0,
      'On Leave': 0
    };

    // Get the number of days in current month
    const daysInMonth = new Date(parseInt(currentYear), parseInt(currentMonth), 0).getDate();
    
    // Create array of all dates in current month (excluding Sundays)
    const allDates = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(parseInt(currentYear), parseInt(currentMonth) - 1, i + 1);
      return {
        dateStr: format(date, 'dd'),
        isSunday: format(date, 'EEEE') === 'Sunday'
      };
    });

    // Filter records for current month and count statuses
    const currentMonthRecords = history.filter(record => {
      const recordDate = new Date(record.timestamp);
      return format(recordDate, 'MM') === currentMonth && 
             format(recordDate, 'yyyy') === currentYear;
    });

    currentMonthRecords.forEach(record => {
      if (record.status in counts) {
        counts[record.status]++;
      }
    });

    // Calculate On Leave days (days without any attendance record)
    const attendedDates = currentMonthRecords.map(record => record.date);
    
    // Get current date for comparison
    const today = format(new Date(), 'dd');
    
    // Filter dates that are:
    // 1. Not Sundays
    // 2. Not attended
    // 3. Are in the past or today
    const onLeaveDates = allDates.filter(({ dateStr, isSunday }) => 
      !isSunday && // Exclude Sundays
      !attendedDates.includes(dateStr) && // Not attended
      parseInt(dateStr) <= parseInt(today) // Past or today
    );
    
    counts['On Leave'] = onLeaveDates.length;

    setStatusCounts(counts);
  };

  const loadUserDetails = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserDetails({
          designation: data.designation,
          employeeName: data.name,
          phoneNumber: data.phoneNumber,
          email: data.email
        });
      }
    } catch (error) {
      console.error('Error loading user details:', error);
    } finally {
      setIsLoadingUserDetails(false);
    }
  };

  const updateChartData = () => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    // Filter attendance records for selected month
    const monthRecords = attendanceHistory.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    // Create labels for each day of the month
    const daysInMonth = monthEnd.getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
    
    // Calculate attendance percentage for each day
    const data = labels.map(day => {
      const record = monthRecords.find(r => r.date === day);
      if (!record) return 0;
      
      switch (record.status) {
        case 'Present': return 100;
        case 'Half Day': return 50;
        default: return 0;
      }
    });

    setChartData({
      labels,
      datasets: [{ data }]
    });
  };

  const filterHistoryByMonth = () => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    const filtered = attendanceHistory.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    if (activeFilter) {
      setFilteredHistory(filtered.filter(record => record.status === activeFilter));
    } else {
      setFilteredHistory(filtered);
    }
  };

  const handleMonthSelect = (month: Date) => {
    setSelectedMonth(month);
  };

  const calculateTotalHours = (punchIn: string, punchOut: string): number => {
    if (!punchIn || !punchOut) return 0;
    
    const [inHours, inMinutes] = punchIn.split(':').map(Number);
    const [outHours, outMinutes] = punchOut.split(':').map(Number);
    
    const totalInMinutes = inHours * 60 + inMinutes;
    const totalOutMinutes = outHours * 60 + outMinutes;
    
    return (totalOutMinutes - totalInMinutes) / 60;
  };

  const saveAttendance = async (isPunchIn: boolean, photoUri: string, locationCoords: any) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const currentTime = new Date();
      const dateStr = format(currentTime, 'dd');
      const dayStr = format(currentTime, 'EEE').toUpperCase();
      const monthStr = format(currentTime, 'MM');
      const yearStr = format(currentTime, 'yyyy');
      const timeStr = format(currentTime, 'HH:mm');

      const attendanceRef = collection(db, 'bdm_monthly_attendance');
      const todayQuery = query(
        attendanceRef,
        where('date', '==', dateStr),
        where('month', '==', monthStr),
        where('year', '==', yearStr),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(todayQuery);
      
      if (querySnapshot.empty) {
        // Create new attendance record
        await addDoc(attendanceRef, {
          date: dateStr,
          day: dayStr,
          month: monthStr,
          year: yearStr,
          punchIn: isPunchIn ? timeStr : '',
          punchOut: !isPunchIn ? timeStr : '',
          status: isPunchIn ? 'Half Day' : 'On Leave',
          userId,
          timestamp: Timestamp.fromDate(currentTime),
          photoUri: isPunchIn ? photoUri : '',
          punchOutPhotoUri: !isPunchIn ? photoUri : '',
          location: isPunchIn ? locationCoords : null,
          punchOutLocation: !isPunchIn ? locationCoords : null,
          designation: userDetails.designation,
          employeeName: userDetails.employeeName,
          phoneNumber: userDetails.phoneNumber,
          email: userDetails.email,
          totalHours: 0,
          workMode: 'Office',
          locationName: isPunchIn ? await getLocationName(locationCoords) : '',
          punchOutLocationName: !isPunchIn ? await getLocationName(locationCoords) : '',
          lastUpdated: Timestamp.fromDate(currentTime)
        });
      } else {
        // Update existing record
        const docRef = querySnapshot.docs[0].ref;
        const existingData = querySnapshot.docs[0].data();
        const newPunchIn = isPunchIn ? timeStr : existingData.punchIn;
        const newPunchOut = !isPunchIn ? timeStr : existingData.punchOut;
        
        let newStatus = 'Half Day';
        if (newPunchIn && newPunchOut) {
          const totalHours = calculateTotalHours(newPunchIn, newPunchOut);
          newStatus = totalHours >= 8 ? 'Present' : 'Half Day';
        } else if (!newPunchIn && !newPunchOut) {
          newStatus = 'On Leave';
        }
        
        await updateDoc(docRef, {
          punchIn: newPunchIn,
          punchOut: newPunchOut,
          status: newStatus,
          photoUri: isPunchIn ? photoUri : existingData.photoUri,
          punchOutPhotoUri: !isPunchIn ? photoUri : existingData.punchOutPhotoUri,
          location: isPunchIn ? locationCoords : existingData.location,
          punchOutLocation: !isPunchIn ? locationCoords : existingData.punchOutLocation,
          totalHours: newPunchIn && newPunchOut ? calculateTotalHours(newPunchIn, newPunchOut) : 0,
          locationName: isPunchIn ? await getLocationName(locationCoords) : existingData.locationName,
          punchOutLocationName: !isPunchIn ? await getLocationName(locationCoords) : existingData.punchOutLocationName,
          lastUpdated: Timestamp.fromDate(currentTime)
        });
      }

      // Update local state
      if (isPunchIn) {
        setPunchInTime(format(currentTime, 'hh:mm a'));
        setIsPunchedIn(true);
      } else {
        setPunchOutTime(format(currentTime, 'hh:mm a'));
        setIsPunchedIn(false);
      }

      // Refresh attendance history
      fetchAttendanceHistory();
    } catch (error) {
      console.error('Error saving attendance:', error);
      Alert.alert('Error', 'Failed to save attendance');
    }
  };

  const getLocationName = async (coords: any): Promise<string> => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=YOUR_GOOGLE_MAPS_API_KEY`
      );
      const data = await response.json();
      if (data.results && data.results[0]) {
        return data.results[0].formatted_address;
      }
      return 'Unknown Location';
    } catch (error) {
      console.error('Error getting location name:', error);
      return 'Unknown Location';
    }
  };

  const handlePunch = async () => {
    if (isPunchButtonDisabled) {
      Alert.alert(
        "Punch Disabled",
        "You've already completed today's attendance. Punch will be available at 8 AM tomorrow."
      );
      return;
    }

    // Check location status before proceeding
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      openLocationSettings();
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      openLocationSettings();
      return;
    }
    
    navigation.navigate('BDMCameraScreen', {
      type: isPunchedIn ? 'out' : 'in'
    });
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
        return '#4CAF50';
      case 'Half Day':
        return '#FFC107';
      case 'On Leave':
        return '#FF5252';
      case 'active':
        return '#FF8447';
      default:
        return 'white';
    }
  };

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'Present':
      case 'Half Day':
      case 'On Leave':
      case 'active':
        return 'transparent';
      default:
        return '#DDD';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Present':
        return <MaterialIcons name="check" size={20} color="#FFF" />;
      case 'Half Day':
        return <MaterialIcons name="remove" size={20} color="#FFF" />;
      case 'On Leave':
        return <MaterialIcons name="close" size={20} color="#FFF" />;
      default:
        return null;
    }
  };

  const handleMapReady = () => {
    setMapReady(true);
    console.log('Map is ready');
  };

  const renderMapFallback = () => (
    <TouchableOpacity 
      style={styles.mapFallback}
      onPress={openLocationSettings}
    >
      <MaterialIcons name="map" size={48} color="#FF8447" />
      <Text style={styles.mapFallbackText}>
        {locationServiceEnabled === false 
          ? 'Location services are disabled. Tap to enable.' 
          : permissionStatus !== 'granted' 
            ? 'Location permission required. Tap to grant.' 
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

  return (
    <AppGradient>
      <BDMMainLayout 
        title="Attendance"
        showBackButton
        showDrawer={true}
      >
        <ScrollView style={styles.scrollView}>
          {/* Map View */}
          <View style={styles.mapContainer}>
            {mapError ? (
              renderMapFallback()
            ) : location ? (
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  latitudeDelta: DEFAULT_MAP_DELTA.latitudeDelta,
                  longitudeDelta: DEFAULT_MAP_DELTA.longitudeDelta,
                }}
                customMapStyle={GOOGLE_MAPS_STYLE}
                showsUserLocation={true}
                showsMyLocationButton={true}
                followsUserLocation={true}
                loadingEnabled={true}
                loadingIndicatorColor="#FF8447"
                loadingBackgroundColor="#FFF8F0"
                onMapReady={handleMapReady}
                moveOnMarkerPress={false}
                showsCompass={false}
                showsScale={false}
                showsTraffic={false}
                showsBuildings={false}
                showsIndoors={false}
                showsPointsOfInterest={false}
              >
                {mapReady && (
                  <Marker
                    coordinate={{
                      latitude: location.coords.latitude,
                      longitude: location.coords.longitude,
                    }}
                  >
                    <View style={styles.markerContainer}>
                      <MaterialIcons name="location-pin" size={36} color="#E53935" />
                    </View>
                  </Marker>
                )}
              </MapView>
            ) : (
              <View style={styles.loadingLocation}>
                <ActivityIndicator size="large" color="#FF8447" />
                <Text style={styles.loadingText}>
                  {isLocationLoading ? 'Getting your location...' : 'Location not available'}
                </Text>
              </View>
            )}
          </View>

          {/* Punch In/Out Section */}
          <View style={styles.punchCard}>
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
            {isPunchButtonDisabled && (
              <Text style={styles.nextPunchInfo}>
                Next punch available at 8:00 AM tomorrow
              </Text>
            )}
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
                  <Text style={styles.weekDayText}>{day.day}</Text>
                  {day.date && <Text style={styles.weekDateText}>{day.date}</Text>}
                </View>
              ))}
            </View>
          </View>

          {/* Month Selection */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.monthScrollView}
          >
            {monthsList.map((month, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.monthButton,
                  format(selectedMonth, 'MM-yyyy') === format(month, 'MM-yyyy') && styles.selectedMonthButton
                ]}
                onPress={() => handleMonthSelect(month)}
              >
                <Text style={[
                  styles.monthButtonText,
                  format(selectedMonth, 'MM-yyyy') === format(month, 'MM-yyyy') && styles.selectedMonthButtonText
                ]}>
                  {format(month, 'MMM yyyy')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
                      {record.locationName && (
                        <Text style={styles.locationText} numberOfLines={1}>
                          {record.locationName}
                        </Text>
                      )}
                    </View>
                    <View style={styles.punchTimeContainer}>
                      <Text style={styles.punchTime}>{record.punchOut ? format(new Date(`2000-01-01T${record.punchOut}`), 'hh:mm a') : '-----'}</Text>
                      <Text style={styles.punchType}>Punch Out</Text>
                    </View>
                    {record.totalHours > 0 && (
                      <Text style={styles.totalHours}>
                        Total Hours: {record.totalHours.toFixed(1)}h
                      </Text>
                    )}
                    {record.workMode && (
                      <Text style={styles.workMode}>
                        Mode: {record.workMode}
                      </Text>
                    )}
                    <Text style={styles.lastUpdated}>
                      Last Updated: {format(record.lastUpdated, 'dd MMM yyyy, hh:mm a')}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, getStatusStyle(record.status)]}>
                    <Text style={[styles.statusText, getStatusTextStyle(record.status)]}>{record.status}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    margin: 16,
    marginBottom: 12,
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
    borderColor: '#DDD',
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
  chartCard: {
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
  chartTitle: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  monthScrollView: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  monthButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  selectedMonthButton: {
    backgroundColor: '#FF8447',
  },
  monthButtonText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  selectedMonthButtonText: {
    color: 'white',
  },
  totalHours: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
    marginTop: 4,
  },
  workMode: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
    marginTop: 2,
    maxWidth: 200,
  },
  lastUpdated: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'LexendDeca_400Regular',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default BDMAttendanceScreen; 