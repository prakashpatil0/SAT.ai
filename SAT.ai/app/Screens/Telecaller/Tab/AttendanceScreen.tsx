import React, { useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet, Animated } from "react-native";
import { Button } from "react-native-paper";
import { useNavigation, RouteProp, useRoute } from "@react-navigation/native";
import { StackNavigationProp } from '@react-navigation/stack';
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import { MaterialIcons } from '@expo/vector-icons';
import { Camera } from "expo-camera";
import AppGradient from "@/app/components/AppGradient";
import { collection, addDoc, getDocs, query, where, Timestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';
import { format } from 'date-fns';

type AttendanceStatus = 'Present' | 'Half Day' | 'On Leave';

type CameraScreenParams = {
  photo: { uri: string };
  location: { coords: { latitude: number; longitude: number } };
  dateTime: Date;
  isPunchIn: boolean;
};

type RootStackParamList = {
  CameraScreen: { isPunchIn: boolean };
  AttendanceScreen: {
    photo?: { uri: string };
    location?: { coords: { latitude: number; longitude: number } };
    isPunchIn?: boolean;
  };
};

type AttendanceScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface AttendanceRecord {
  date: string;
  day: string;
  punchIn: string;
  punchOut: string;
  status: AttendanceStatus;
  userId: string;
  timestamp: Date;
}

interface WeekDay {
  day: string;
  date: string;
  status: AttendanceStatus;
}

const EIGHT_HOURS_IN_MS = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
const PUNCH_IN_DEADLINE = '09:45'; // 9:45 AM
const PUNCH_OUT_MINIMUM = '18:25'; // 6:25 PM
const NEXT_DAY_PUNCH_TIME = '08:45'; // 8:45 AM

const AttendanceScreen = () => {
  const navigation = useNavigation<AttendanceScreenNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'AttendanceScreen'>>();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'MMMM'));
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | null>(null);
  const [filteredHistory, setFilteredHistory] = useState<AttendanceRecord[]>([]);
  const months = ['January','February','March','April','May','June', 'July', 'August', 'September', 'October','November','December'];
  const [punchInTime, setPunchInTime] = useState('');
  const [punchOutTime, setPunchOutTime] = useState('');
  const [isPunchedIn, setIsPunchedIn] = useState<boolean>(false);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [statusCounts, setStatusCounts] = useState({
    Present: 0,
    'Half Day': 0,
    'On Leave': 0
  });
  const [isPunchButtonDisabled, setIsPunchButtonDisabled] = useState(false);

  const [weekDays, setWeekDays] = useState<WeekDay[]>([
    { day: 'M', date: '', status: 'On Leave' },
    { day: 'T', date: '', status: 'On Leave' },
    { day: 'W', date: '', status: 'On Leave' },
    { day: 'T', date: '', status: 'On Leave' },
    { day: 'F', date: '', status: 'On Leave' },
    { day: 'S', date: '', status: 'On Leave' },
  ]);

  const statusColors: Record<AttendanceStatus, string> = {
    'Present': '#4CAF50',
    'Half Day': '#FF9800',
    'On Leave': '#F44336',
  };

  const checkPunchAvailability = () => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 45, 0, 0); // Set to 8:45 AM next day

    // If user has punched out today, disable punch button until tomorrow 8:45 AM
    if (punchOutTime) {
      setIsPunchButtonDisabled(now < tomorrow);
      return;
    }

    // For punch in, check if it's before deadline
    if (!punchInTime) {
      const [currentHour, currentMinute] = currentTime.split(':').map(Number);
      const [deadlineHour, deadlineMinute] = PUNCH_IN_DEADLINE.split(':').map(Number);
      
      const currentMinutes = currentHour * 60 + currentMinute;
      const deadlineMinutes = deadlineHour * 60 + deadlineMinute;
      
      setIsPunchButtonDisabled(currentMinutes > deadlineMinutes);
    }
  };

  useEffect(() => {
    checkPunchAvailability();
    // Check availability every minute
    const interval = setInterval(checkPunchAvailability, 60000);
    return () => clearInterval(interval);
  }, [punchInTime, punchOutTime]);

  const calculateStatus = (punchIn: string, punchOut: string): AttendanceStatus => {
    if (!punchIn && !punchOut) return 'On Leave';
    if (!punchOut) return 'Half Day';
    
    // Convert time strings to minutes for easier comparison
    const [punchInHours, punchInMinutes] = punchIn.split(':').map(Number);
    const [punchOutHours, punchOutMinutes] = punchOut.split(':').map(Number);
    const [minOutHours, minOutMinutes] = PUNCH_OUT_MINIMUM.split(':').map(Number);
    const [maxInHours, maxInMinutes] = PUNCH_IN_DEADLINE.split(':').map(Number);
    
    const punchInMins = punchInHours * 60 + punchInMinutes;
    const punchOutMins = punchOutHours * 60 + punchOutMinutes;
    const minOutMins = minOutHours * 60 + minOutMinutes;
    const maxInMins = maxInHours * 60 + maxInMinutes;
    
    // If punch in is after deadline (9:45 AM) or punch out is before minimum time (6:25 PM), mark as Half Day
    if (punchInMins > maxInMins || punchOutMins < minOutMins) {
      return 'Half Day';
    }
    
    return 'Present';
  };

  const handlePunchInOut = async (isPunchIn: boolean) => {
    try {
      // Check if punch in/out is allowed
      if (isPunchButtonDisabled) {
        if (!punchInTime) {
          Alert.alert('Punch In Not Allowed', 'You can only punch in before 9:45 AM for a full day. Punching in after 9:45 AM will be counted as a half day.');
        } else {
          Alert.alert('Punch Out Not Allowed', 'You can punch in again tomorrow at 8:45 AM.');
        }
        return;
      }

      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status === 'granted') {
        navigation.navigate('CameraScreen', { isPunchIn });
      } else {
        Alert.alert('Permission Required', 'Camera permission is required to take attendance photos.');
      }
    } catch (err) {
      console.log('Error:', err);
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const attendanceRef = collection(db, 'users', userId, 'attendance');
      const querySnapshot = await getDocs(attendanceRef);
      
      const history: AttendanceRecord[] = [];
      const today = format(new Date(), 'dd');
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const status = calculateStatus(data.punchIn, data.punchOut);
        
        history.push({
          date: data.date,
          day: data.day,
          punchIn: data.punchIn,
          punchOut: data.punchOut,
          status,
          userId: data.userId,
          timestamp: data.timestamp.toDate()
        });

        // Update today's punch in/out status
        if (data.date === today) {
          setPunchInTime(data.punchIn ? format(new Date(`2000-01-01T${data.punchIn}`), 'hh:mm a') : '');
          setPunchOutTime(data.punchOut ? format(new Date(`2000-01-01T${data.punchOut}`), 'hh:mm a') : '');
          setIsPunchedIn(!!data.punchIn && !data.punchOut);
        }
      });

      const sortedHistory = history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setAttendanceHistory(sortedHistory);
      calculateStatusCounts(sortedHistory);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
    }
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
      counts[record.status]++;
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

  const saveAttendance = async (isPunchIn: boolean, photoUri: string, location: any) => {
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
          location
        });
      } else {
        // Update existing record
        const docRef = querySnapshot.docs[0].ref;
        const existingData = querySnapshot.docs[0].data();
        const newPunchIn = isPunchIn ? timeStr : existingData.punchIn;
        const newPunchOut = !isPunchIn ? timeStr : existingData.punchOut;
        
        const newStatus = calculateStatus(newPunchIn, newPunchOut);
        
        await updateDoc(docRef, {
          punchIn: newPunchIn,
          punchOut: newPunchOut,
          status: newStatus,
          photoUri: !isPunchIn ? photoUri : existingData.photoUri,
          location: !isPunchIn ? location : existingData.location
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

  useEffect(() => {
    if (route.params?.photo && route.params?.location && route.params?.isPunchIn !== undefined) {
      const { photo, location, isPunchIn } = route.params;
      saveAttendance(isPunchIn, photo.uri, location);
    }
  }, [route.params]);

  useEffect(() => {
    fetchAttendanceHistory();
  }, []);

  useEffect(() => {
    if (attendanceHistory.length > 0) {
      updateWeekDays();
    }
  }, [attendanceHistory]);

  useEffect(() => {
    if (attendanceHistory.length > 0) {
      let filtered = [...attendanceHistory];
      
      // Filter by month
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.timestamp);
        return format(recordDate, 'MMMM') === selectedMonth;
      });

      // Filter by status if selected
      if (selectedStatus) {
        filtered = filtered.filter(record => record.status === selectedStatus);
      }

      setFilteredHistory(filtered);
      calculateStatusCounts(filtered);
    }
  }, [selectedMonth, selectedStatus, attendanceHistory]);

  const updateWeekDays = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Start from Monday

    const updatedWeekDays = weekDays.map((day, index) => {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + index);
      
      // Find attendance record for this date
      const dateStr = format(currentDate, 'dd');
      const attendanceRecord = attendanceHistory.find(record => record.date === dateStr);
      
      return {
        day: day.day,
        date: dateStr,
        status: attendanceRecord ? attendanceRecord.status : 'On Leave' as AttendanceStatus
      };
    });

    setWeekDays(updatedWeekDays);
  };

  const renderStatusBadge = (status: AttendanceStatus) => {
    const isSelected = selectedStatus === status;
    return (
      <TouchableOpacity 
        onPress={() => setSelectedStatus(isSelected ? null : status)}
        style={[
          styles.statusBadge, 
          { borderColor: statusColors[status] },
          isSelected && { backgroundColor: statusColors[status] }
        ]}
      >
        <Text style={[
          styles.statusText, 
          { color: statusColors[status] },
          isSelected && { color: '#FFFFFF' }
        ]}>
          {status}
        </Text>
        <Text style={[
          styles.daysText,
          isSelected && { color: '#FFFFFF' }
        ]}>
          {statusCounts[status]} days
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBackButton={true} title="Attendance">
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            {/* Punch Card */}
            <View style={styles.punchCard}>
              <View style={styles.punchHeader}>
                <Text style={styles.punchTitle}>Take Attendance</Text>
                {!punchInTime ? (
                  <TouchableOpacity
                    style={[
                      styles.punchButton,
                      styles.punchInButton,
                      isPunchButtonDisabled && styles.disabledButton
                    ]}
                    onPress={() => handlePunchInOut(true)}
                    disabled={isPunchButtonDisabled}
                  >
                    <Text style={[
                      styles.punchInText,
                      isPunchButtonDisabled && styles.disabledButtonText
                    ]}>Punch In</Text>
                  </TouchableOpacity>
                ) : isPunchedIn && !punchOutTime ? (
                  <TouchableOpacity
                    style={[
                      styles.punchButton,
                      styles.punchOutButton,
                      isPunchButtonDisabled && styles.disabledButton
                    ]}
                    onPress={() => handlePunchInOut(false)}
                    disabled={isPunchButtonDisabled}
                  >
                    <Text style={[
                      styles.punchOutText,
                      isPunchButtonDisabled && styles.disabledButtonText
                    ]}>Punch Out</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.punchTimes}>
                <View style={styles.punchTimeBlock}>
                  <Text style={styles.punchLabel}>Punch In</Text>
                  <Text style={styles.punchTime}>{punchInTime || '——'}</Text>
                </View>
                <View style={styles.punchTimeBlock}>
                  <Text style={styles.punchLabel}>Punch Out</Text>
                  <Text style={styles.punchTime}>{punchOutTime || '——'}</Text>
                </View>
              </View>
            </View>

            {/* Calendar Card */}
            <View style={styles.calendarCard}>
              <Text style={styles.dateHeader}>
                {format(currentDate, 'dd MMMM (EEEE)')}
              </Text>

              <View style={styles.weekDays}>
                {weekDays.map((item, index) => (
                  <View key={index} style={styles.dayContainer}>
                    <View style={[
                      styles.dayCircle,
                      { backgroundColor: item.status === 'Present' ? '#4CAF50' :
                                      item.status === 'Half Day' ? '#FF9800' :
                                      item.status === 'On Leave' ? '#F44336' : 'white' }
                    ]}>
                      {item.status === 'Present' && (
                        <MaterialIcons name="check" size={20} color="#FFF" />
                      )}
                      {item.status === 'Half Day' && (
                        <MaterialIcons name="remove" size={20} color="#FFF" />
                      )}
                      {item.status === 'On Leave' && (
                        <MaterialIcons name="close" size={20} color="#FFF" />
                      )}
                    </View>
                    <Text style={styles.weekName}>{item.day}</Text>
                    <Text style={styles.dateNumber}>{item.date}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Month Selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.monthSelector}
            >
              {months.map((month, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedMonth(month)}
                  style={[
                    styles.monthButton,
                    selectedMonth === month && styles.selectedMonthButton
                  ]}
                >
                  <Text style={[
                    styles.monthText,
                    selectedMonth === month && styles.selectedMonthText
                  ]}>
                    {month}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Status Badges */}
            <View style={styles.statusContainer}>
              {renderStatusBadge('Present')}
              {renderStatusBadge('Half Day')}
              {renderStatusBadge('On Leave')}
            </View>

            {/* Attendance History */}
            <View style={styles.historyContainer}>
              {filteredHistory.map((item, index) => (
                <View key={index} style={styles.historyCard}>
                  <View style={styles.dateBlock}>
                    <Text style={styles.dateNumber}>{item.date}</Text>
                    <Text style={styles.dateDay}>{item.day}</Text>
                  </View>
                  <View style={styles.timeBlock}>
                    <View>
                      <Text style={styles.timeLabel}>Punch In</Text>
                      <Text style={styles.timeValue}>{item.punchIn}</Text>
                    </View>
                    <View>
                      <Text style={styles.timeLabel}>Punch Out</Text>
                      <Text style={styles.timeValue}>{item.punchOut}</Text>
                    </View>
                  </View>
                  <View style={[
                    styles.statusBlock,
                    { backgroundColor: getStatusColor(item.status) }
                  ]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
              ))}
              {filteredHistory.length === 0 && (
                <Text style={styles.noHistoryText}>
                  No attendance records found for {selectedMonth}
                  {selectedStatus ? ` with status ${selectedStatus}` : ''}
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Present':
      return '#E8F5E9';
    case 'Half Day':
      return '#FFF3E0';
    case 'On Leave':
      return '#FFEBEE';
    default:
      return '#E8F5E9';
  }
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  punchCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  punchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  punchTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  punchButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  punchInButton: {
    borderColor: "#4CAF50",
    backgroundColor: "#4CAF50",
  },
  punchOutButton: {
    borderColor: "#FF6B00",
    backgroundColor: "transparent",
  },
  punchInText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FFFFFF',
  },
  punchOutText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF6B00',
  },
  punchTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  punchTimeBlock: {
    flex: 1,
  },
  punchLabel: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
    marginBottom: 4,
  },
  punchTime: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'LexendDeca_500Medium',
  },
  calendarCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
  },
  dateHeader: {
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  weekDays: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 10,
  },
  dayContainer: {
    alignItems: "center",
    width: 45,
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  weekName: {
    marginTop: 4,
    fontSize: 14,
    color: "#666",
    fontFamily: "LexendDeca_500Medium",
  },
  dateNumber: {
    fontSize: 12,
    color: "#666",
    fontFamily: "LexendDeca_400Regular",
    marginTop: 2,
  },
  monthSelector: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  monthButton: {
    marginRight: 24,
  },
  monthText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  selectedMonthText: {
    color: '#FF8447',
    textDecorationLine: 'underline',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    marginBottom: 24,
    gap: 10,
    alignItems: "center",
    marginRight: 15,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 100,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    marginBottom: 4,
  },
  daysText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  historyContainer: {
    flex: 1,
  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dateBlock: {
    width: 50,
    alignItems: 'center',
  },
  dateDay: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  timeBlock: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  timeValue: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'LexendDeca_500Medium',
  },
  statusBlock: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#CCCCCC',
    borderColor: '#CCCCCC',
  },
  disabledButtonText: {
    color: '#666666',
  },
  selectedMonthButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF8447',
  },
  noHistoryText: {
    textAlign: 'center',
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
    fontSize: 14,
    marginTop: 20,
  },
});

export default AttendanceScreen;