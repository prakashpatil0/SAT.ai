import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform, Alert, Image, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import PermissionsService from '@/app/services/PermissionsService';
import { DEFAULT_LOCATION, DEFAULT_MAP_DELTA, GOOGLE_MAPS_STYLE } from '@/app/utils/MapUtils';
import { format } from 'date-fns';
import { collection, addDoc, getDocs, query, where, Timestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';

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
};

const BDMAttendanceScreen = () => {
  // Map and location states
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [mapError, setMapError] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [locationServiceEnabled, setLocationServiceEnabled] = useState<boolean | null>(null);
  const [mapReady, setMapReady] = useState(false);
  
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
    fetchAttendanceHistory();
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
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      if (currentLocation) {
        setLocation(currentLocation);
      } else {
        // Fallback to default location
        console.log('Using default location');
        setLocation(defaultLocation as Location.LocationObject);
        setMapError(true);
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

      const attendanceRef = collection(db, 'users', userId, 'attendance');
      const querySnapshot = await getDocs(attendanceRef);
      
      const history: AttendanceRecord[] = [];
      const today = format(new Date(), 'dd');
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        history.push({
          date: data.date,
          day: data.day,
          punchIn: data.punchIn,
          punchOut: data.punchOut,
          status: data.status,
          userId: data.userId,
          timestamp: data.timestamp.toDate(),
          photoUri: data.photoUri,
          location: data.location
        });

        // Update today's punch in/out status
        if (data.date === today) {
          setTodayRecord({
            date: data.date,
            day: data.day,
            punchIn: data.punchIn,
            punchOut: data.punchOut,
            status: data.status,
            userId: data.userId,
            timestamp: data.timestamp.toDate(),
            photoUri: data.photoUri,
            location: data.location
          });
          
          setPunchInTime(data.punchIn ? format(new Date(`2000-01-01T${data.punchIn}`), 'hh:mm a') : '');
          setPunchOutTime(data.punchOut ? format(new Date(`2000-01-01T${data.punchOut}`), 'hh:mm a') : '');
          setIsPunchedIn(!!data.punchIn && !data.punchOut);
        }
      });

      const sortedHistory = history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setAttendanceHistory(sortedHistory);

      // Check if there are any records for the current month
      const currentMonthRecords = sortedHistory.filter(record => {
        const recordDate = new Date(record.timestamp);
        return format(recordDate, 'MM') === format(new Date(), 'MM') && 
               format(recordDate, 'yyyy') === format(new Date(), 'yyyy');
      });

      if (currentMonthRecords.length > 0) {
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
      const timeStr = format(currentTime, 'HH:mm'); // Changed to 24-hour format for easier calculations

      const attendanceRef = collection(db, 'users', userId, 'attendance');
      const todayQuery = query(
        attendanceRef,
        where('date', '==', dateStr),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(todayQuery);
      
      if (querySnapshot.empty) {
        // Create new attendance record
        await addDoc(attendanceRef, {
          date: dateStr,
          day: dayStr,
          punchIn: isPunchIn ? timeStr : '',
          punchOut: !isPunchIn ? timeStr : '',
          status: isPunchIn ? 'Half Day' : 'On Leave',
          userId,
          timestamp: Timestamp.fromDate(currentTime),
          photoUri,
          location: locationCoords
        });
      } else {
        // Update existing record
        const docRef = querySnapshot.docs[0].ref;
        const existingData = querySnapshot.docs[0].data();
        const newPunchIn = isPunchIn ? timeStr : existingData.punchIn;
        const newPunchOut = !isPunchIn ? timeStr : existingData.punchOut;
        
        let newStatus = 'Half Day';
        if (newPunchIn && newPunchOut) {
          // Calculate time difference for full day vs half day
          const punchInTime = new Date(`2000-01-01T${newPunchIn}`);
          const punchOutTime = new Date(`2000-01-01T${newPunchOut}`);
          const diffMs = punchOutTime.getTime() - punchInTime.getTime();
          const diffHrs = diffMs / (1000 * 60 * 60);
          
          newStatus = diffHrs >= 8 ? 'Present' : 'Half Day';
        } else if (!newPunchIn && !newPunchOut) {
          newStatus = 'On Leave';
        }
        
        await updateDoc(docRef, {
          punchIn: newPunchIn,
          punchOut: newPunchOut,
          status: newStatus,
          photoUri: !isPunchIn ? photoUri : existingData.photoUri,
          location: !isPunchIn ? locationCoords : existingData.location
        });
      }

      // Update local state
      if (isPunchIn) {
        setPunchInTime(format(currentTime, 'hh:mm a')); // Display in 12-hour format
        setIsPunchedIn(true);
      } else {
        setPunchOutTime(format(currentTime, 'hh:mm a')); // Display in 12-hour format
        setIsPunchedIn(false);
      }

      // Refresh attendance history
      fetchAttendanceHistory();
    } catch (error) {
      console.error('Error saving attendance:', error);
      Alert.alert('Error', 'Failed to save attendance');
    }
  };

  const handlePunch = () => {
    if (isPunchButtonDisabled) {
      Alert.alert(
        "Punch Disabled",
        "You've already completed today's attendance. Punch will be available at 8 AM tomorrow."
      );
      return;
    }

    if (permissionStatus !== 'granted') {
      Alert.alert(
        "Location Permission Required",
        "Please grant location permission to punch in/out."
      );
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
                <Text style={styles.loadingText}>Getting your location...</Text>
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
});

export default BDMAttendanceScreen; 