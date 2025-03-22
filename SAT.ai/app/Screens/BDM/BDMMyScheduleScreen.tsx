import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import BDMScreenHeader from '@/app/Screens/BDM/BDMScreenHeader';
import { useNavigation } from "@react-navigation/native";
import AppGradient from '@/app/components/AppGradient';

type Meeting = {
  startTime: string;
  endTime: string;
  title: string;
  type: 'morning' | 'individual' | 'company' | 'break';
  color: string;
};

type DayData = {
  date: string;
  day: string;
  events: Meeting[];
};

const BDMMyScheduleScreen = () => {
  const navigation = useNavigation();
  const [selectedView, setSelectedView] = useState<'Day' | '3 Days' | 'Week'>('3 Days');
  const [showMeetingDetails, setShowMeetingDetails] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const daySchedule: Meeting[] = [
    { startTime: '9:00 AM', endTime: '10:00 AM', title: 'Morning Meeting', type: 'morning', color: '#F3E8FF' },
    { startTime: '10:00 AM', endTime: '11:00 AM', title: 'Meeting with Aarav Pandey', type: 'individual', color: '#FFF5E6' },
    { startTime: '11:00 AM', endTime: '12:30 PM', title: 'Meeting with Glycon Tech', type: 'company', color: '#F3E8FF' },
    { startTime: '2:00 PM', endTime: '3:00 PM', title: 'Break Time', type: 'break', color: '#E3F2FD' },
    { startTime: '4:00 PM', endTime: '5:30 PM', title: 'Meeting with Google', type: 'company', color: '#F3E8FF' },
    { startTime: '6:00 PM', endTime: '7:00 PM', title: 'Meeting with Priyanka Chopra', type: 'individual', color: '#FFF5E6' },
  ];

  const threeDaySchedule: DayData[] = [
    { date: '23', day: 'Thu', events: [...daySchedule] },
    { date: '24', day: 'Fri', events: [...daySchedule] },
    { date: '25', day: 'Sat', events: [...daySchedule] },
  ];

  const getTimeInMinutes = (time: string): number => {
    const [timeStr, period] = time.split(' ');
    let [hours, minutes] = timeStr.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const calculateHeight = (startTime: string, endTime: string): number => {
    const start = getTimeInMinutes(startTime);
    const end = getTimeInMinutes(endTime);
    return (end - start) * 1.5; // 1.5px per minute
  };

  const renderTimeColumn = () => (
    <View style={styles.timeColumn}>
      {Array.from({ length: 11 }, (_, i) => {
        const hour = i + 9;
        const time = `${hour > 12 ? hour - 12 : hour} ${hour >= 12 ? 'PM' : 'AM'}`;
        return (
          <Text key={hour} style={styles.timeText}>{time}</Text>
        );
      })}
    </View>
  );

  const renderScheduleView = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.scheduleContainer}>
        {renderTimeColumn()}
        
        <ScrollView horizontal>
          <View style={styles.daysContainer}>
            {(selectedView === 'Day' ? [threeDaySchedule[0]] : threeDaySchedule).map((day, index) => (
              <View key={index} style={styles.dayColumn}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayText}>{day.day}</Text>
                  <Text style={styles.dateText}>{day.date}</Text>
                </View>

                <View style={styles.eventsContainer}>
                  {day.events.map((event, eventIndex) => (
                    <TouchableOpacity
                      key={eventIndex}
                      style={[
                        styles.eventCard,
                        {
                          top: getTimeInMinutes(event.startTime) - getTimeInMinutes('9:00 AM'),
                          height: calculateHeight(event.startTime, event.endTime),
                          backgroundColor: event.color,
                        },
                      ]}
                      onPress={() => {
                        setSelectedMeeting(event);
                        setShowMeetingDetails(true);
                      }}
                    >
                      <Text style={styles.eventTime}>{event.startTime}</Text>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );

  return (
    <AppGradient>
    <View style={styles.container}>
      <BDMScreenHeader title="My Schedule" />

      <View style={styles.viewTypeContainer}>
        {['Day', '3 Days', 'Week'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.viewTypeButton,
              selectedView === type && styles.selectedViewType
            ]}
            onPress={() => setSelectedView(type as typeof selectedView)}
          >
            <Text style={[
              styles.viewTypeText,
              selectedView === type && styles.selectedViewTypeText
            ]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {renderScheduleView()}

      <Modal
        visible={showMeetingDetails}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMeetingDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedMeeting && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedMeeting.title}</Text>
                  <TouchableOpacity onPress={() => setShowMeetingDetails(false)}>
                    <MaterialIcons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalTime}>
                  {`${selectedMeeting.startTime} - ${selectedMeeting.endTime}`}
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  viewTypeContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  viewTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  selectedViewType: {
    backgroundColor: '#FF8447',
  },
  viewTypeText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  selectedViewTypeText: {
    color: 'white',
  },
  scheduleContainer: {
    flexDirection: 'row',
    flex: 1,
    paddingLeft: 16,
  },
  timeColumn: {
    width: 50,
    marginRight: 16,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    height: 60,
    textAlign: 'right',
    fontFamily: 'LexendDeca_400Regular',
  },
  daysContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  dayColumn: {
    width: 150,
    marginRight: 16,
  },
  dayHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  dayText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  dateText: {
    fontSize: 18,
    color: '#333',
    fontFamily: 'LexendDeca_600SemiBold',
  },
  eventsContainer: {
    position: 'relative',
    minHeight: 660, // 11 hours * 60px
  },
  eventCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
  },
  eventTime: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'LexendDeca_500Medium',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'LexendDeca_400Regular',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  modalTime: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
});

export default BDMMyScheduleScreen; 