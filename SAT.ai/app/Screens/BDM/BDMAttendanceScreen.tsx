import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import BDMScreenHeader from '@/app/Screens/BDM/BDMScreenHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
type AttendanceRecord = {
  date: number;
  day: string;
  punchIn: string;
  punchOut: string;
  status: 'Present' | 'Half Day' | 'On Leave';
};

const BDMAttendanceScreen = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [punchInTime, setPunchInTime] = useState<string>('');
  const [punchOutTime, setPunchOutTime] = useState<string>('');
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const navigation = useNavigation();

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S'];
  const attendanceHistory: AttendanceRecord[] = [
    { date: 22, day: 'WED', punchIn: '09:08 AM', punchOut: '6:15 PM', status: 'Present' },
    { date: 21, day: 'TUE', punchIn: '09:08 AM', punchOut: '6:15 PM', status: 'Half Day' },
    { date: 20, day: 'MON', punchIn: '09:08 AM', punchOut: '6:15 PM', status: 'On Leave' },
    { date: 19, day: 'SAT', punchIn: '09:08 AM', punchOut: '6:15 PM', status: 'Present' },
    { date: 18, day: 'FRI', punchIn: '09:08 AM', punchOut: '6:15 PM', status: 'Present' },
    { date: 17, day: 'THU', punchIn: '09:08 AM', punchOut: '6:15 PM', status: 'Present' },
    { date: 16, day: 'WED', punchIn: '09:08 AM', punchOut: '6:15 PM', status: 'Present' },
  ];

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    })();
  }, []);

  const handlePunch = () => {
    navigation.navigate('BDMCameraScreen', {
      type: isPunchedIn ? 'out' : 'in',
      onPhotoCapture: (time: string) => {
        if (!isPunchedIn) {
          setPunchInTime(time);
          setIsPunchedIn(true);
        } else {
          setPunchOutTime(time);
        }
      }
    });
  };

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

  return (
    <AppGradient>
    <BDMMainLayout 
      title="Attendance"
      showBackButton
      showDrawer={true}
    >
      <ScrollView style={styles.scrollView}>
        {/* Map View */}
        {location && (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
            >
              <Marker
                coordinate={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
              />
            </MapView>
          </View>
        )}

        {/* Punch In/Out Section */}
        <View style={styles.punchCard}>
          <View style={styles.punchInfo}>
            <Text style={styles.punchLabel}>Take Attendance</Text>
            <TouchableOpacity
              style={[styles.punchButton, isPunchedIn && styles.punchOutButton]}
              onPress={handlePunch}
            >
              <Text style={styles.punchButtonText}>
                {isPunchedIn ? 'Punch Out' : 'Punch In'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.timeInfo}>
            <View style={styles.timeColumn}>
              <Text style={styles.timeLabel}>Punch In</Text>
              <Text style={styles.timeValue}>{punchInTime || '8:57 AM'}</Text>
            </View>
            <View style={styles.timeColumn}>
              <Text style={styles.timeLabel}>Punch Out</Text>
              <Text style={styles.timeValue}>{punchOutTime || '-----'}</Text>
            </View>
          </View>
        </View>

        {/* Week View */}
        <View style={styles.weekCard}>
          <Text style={styles.dateText}>23 January (Thursday)</Text>
          <View style={styles.weekDays}>
            {weekDays.map((day, index) => (
              <View 
                key={index} 
                style={[
                  styles.dayCircle,
                  index < 3 && styles.dayCircleActive
                ]}
              >
                <Text style={[
                  styles.dayText,
                  index < 3 && styles.dayTextActive
                ]}>{day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Attendance History */}
        {attendanceHistory.map((record, index) => (
          <View key={index} style={styles.historyCard}>
            <View style={styles.dateColumn}>
              <Text style={styles.dateNumber}>{record.date}</Text>
              <Text style={styles.dateDay}>{record.day}</Text>
            </View>
            <View style={styles.timeColumn}>
              <Text style={styles.punchTime}>{record.punchIn}</Text>
              <Text style={styles.punchLabel}>Punch In</Text>
            </View>
            <View style={styles.timeColumn}>
              <Text style={styles.punchTime}>{record.punchOut}</Text>
              <Text style={styles.punchLabel}>Punch Out</Text>
            </View>
            <View style={[styles.statusBadge, getStatusStyle(record.status)]}>
              <Text style={styles.statusText}>{record.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </BDMMainLayout>
    </AppGradient>
   
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  punchCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
    backgroundColor: '#FF8447',
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
    marginBottom: 16,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'LexendDeca_500Medium',
    marginBottom: 12,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleActive: {
    backgroundColor: '#FF8447',
    borderColor: '#FF8447',
  },
  dayText: {
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  dayTextActive: {
    color: 'white',
  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateColumn: {
    alignItems: 'center',
    width: 50,
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
  punchTime: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'LexendDeca_500Medium',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
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
  statusText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
  },
});

export default BDMAttendanceScreen; 