import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';

const CreateFollowUpScreen = () => {
  const navigation = useNavigation();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [hours, setHours] = useState('6');
  const [minutes, setMinutes] = useState('10');
  const [period, setPeriod] = useState('PM');
  const [showTimePicker, setShowTimePicker] = useState(false);

  const timeSlots = [
    ['9:00', '9:30', '10:00'],
    ['10:30', '11:00', '11:30'],
    ['12:00', '12:30', '13:00'],
    ['13:30', '14:00', '14:30'],
    ['15:00', '15:30', '16:00'],
    ['16:30', '17:00', '17:30'],
    ['18:00', '18:30', '19:00'],
  ];

  const TimePickerModal = () => (
    <Modal
      visible={showTimePicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowTimePicker(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowTimePicker(false)}
      >
        <View style={styles.timePickerContainer}>
          {/* Hours */}
          <View style={styles.timeColumn}>
            <TouchableOpacity onPress={() => setHours(String(Number(hours) + 1))}>
              <MaterialIcons name="keyboard-arrow-up" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.timeValue}>{hours}</Text>
            <TouchableOpacity onPress={() => setHours(String(Number(hours) - 1))}>
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <Text style={styles.timeSeparator}>:</Text>

          {/* Minutes */}
          <View style={styles.timeColumn}>
            <TouchableOpacity onPress={() => setMinutes(String(Number(minutes) + 1))}>
              <MaterialIcons name="keyboard-arrow-up" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.timeValue}>{minutes}</Text>
            <TouchableOpacity onPress={() => setMinutes(String(Number(minutes) - 1))}>
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* AM/PM */}
          <View style={styles.periodContainer}>
            <TouchableOpacity 
              style={[styles.periodButton, period === 'AM' && styles.periodButtonActive]}
              onPress={() => setPeriod('AM')}
            >
              <Text style={[styles.periodText, period === 'AM' && styles.periodTextActive]}>AM</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.periodButton, period === 'PM' && styles.periodButtonActive]}
              onPress={() => setPeriod('PM')}
            >
              <Text style={[styles.periodText, period === 'PM' && styles.periodTextActive]}>PM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Follow Up</Text>
          <View style={{ width: 24 }} /> {/* For alignment */}
        </View>

        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <Calendar
            style={styles.calendar}
            theme={{
              calendarBackground: '#F8F7FF',
              textSectionTitleColor: '#666',
              selectedDayBackgroundColor: '#FF8800',
              selectedDayTextColor: '#fff',
              todayTextColor: '#FF8800',
              dayTextColor: '#333',
              textDisabledColor: '#d9e1e8',
              dotColor: '#FF8800',
              monthTextColor: '#333',
              textMonthFontWeight: 'bold',
              arrowColor: '#FF8800',
            }}
            onDayPress={day => setSelectedDate(day.dateString)}
            markedDates={{
              [selectedDate]: { selected: true, selectedColor: '#FF8800' }
            }}
            enableSwipeMonths={true}
          />
        </View>

        {/* Time Selection */}
        <View style={styles.timeSection}>
          <Text style={styles.sectionTitle}>Select time for the follow up</Text>
          <View style={styles.timeGrid}>
            {timeSlots.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.timeRow}>
                {row.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timeSlot,
                      selectedTime === time && styles.selectedTimeSlot
                    ]}
                    onPress={() => setSelectedTime(time)}
                  >
                    <Text style={[
                      styles.timeText,
                      selectedTime === time && styles.selectedTimeText
                    ]}>
                      {time}
                    </Text>
                    <MaterialIcons 
                      name="access-time" 
                      size={16} 
                      color={selectedTime === time ? "#fff" : "#666"} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Custom Time Selection */}
        <View style={styles.customTimeSection}>
          <Text style={styles.sectionTitle}>Select Custom Time</Text>
          <TouchableOpacity 
            style={styles.customTimeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.customTimeText}>{`${hours}:${minutes} ${period}`}</Text>
            <MaterialIcons name="access-time" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={styles.submitButton}
          onPress={() => {
            // Handle submit logic here
            navigation.goBack();
          }}
        >
          <Text style={styles.submitText}>Submit</Text>
        </TouchableOpacity>
      </ScrollView>
      <TimePickerModal />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  calendarContainer: {
    backgroundColor: '#F8F7FF',
    borderRadius: 12,
    margin: 16,
    overflow: 'hidden',
  },
  calendar: {
    borderRadius: 12,
  },
  timeSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 16,
  },
  timeGrid: {
    marginBottom: 24,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '30%',
  },
  selectedTimeSlot: {
    backgroundColor: '#FF8800',
    borderColor: '#FF8800',
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  selectedTimeText: {
    color: '#fff',
  },
  customTimeSection: {
    padding: 16,
  },
  customTimeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  customTimeText: {
    fontSize: 14,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#FF8800',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
  },
  timeColumn: {
    alignItems: 'center',
    width: 60,
  },
  timeValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginVertical: 10,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 10,
  },
  periodContainer: {
    marginLeft: 20,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  periodButtonActive: {
    backgroundColor: '#4285F4',
  },
  periodText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: '500',
  },
  periodTextActive: {
    color: 'white',
  },
});

export default CreateFollowUpScreen; 