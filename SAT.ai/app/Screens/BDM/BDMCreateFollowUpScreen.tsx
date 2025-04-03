import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Modal, Alert, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Calendar, DateData } from 'react-native-calendars';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import { format, addDays } from 'date-fns';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getAuth } from 'firebase/auth';
import * as Haptics from 'expo-haptics';
import AppGradient from '@/app/components/AppGradient';

interface RouteParams {
  contactName?: string;
  phoneNumber?: string;
  notes?: string;
}

const CreateFollowUpScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  
  // Get passed parameters if available
  const initialContactName = route.params?.contactName || '';
  const initialPhoneNumber = route.params?.phoneNumber || '';
  const initialNotes = route.params?.notes || '';

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [hours, setHours] = useState('12');
  const [minutes, setMinutes] = useState('00');
  const [period, setPeriod] = useState('PM');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [contactName, setContactName] = useState(initialContactName);
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [notes, setNotes] = useState(initialNotes);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize today's date
  useEffect(() => {
    const today = new Date();
    setSelectedDate(format(today, 'yyyy-MM-dd'));
  }, []);

  // Update contact info if route params change
  useEffect(() => {
    if (route.params) {
      if (route.params.contactName && route.params.contactName !== contactName) {
        setContactName(route.params.contactName);
      }
      
      if (route.params.phoneNumber && route.params.phoneNumber !== phoneNumber) {
        setPhoneNumber(route.params.phoneNumber);
      }
      
      if (route.params.notes && route.params.notes !== notes) {
        setNotes(route.params.notes);
      }
    }
  }, [route.params]);

  const timeSlots = [
    ['9:00', '9:30', '10:00'],
    ['10:30', '11:00', '11:30'],
    ['12:00', '12:30', '13:00'],
    ['13:30', '14:00', '14:30'],
    ['15:00', '15:30', '16:00'],
    ['16:30', '17:00', '17:30'],
    ['18:00', '18:30', '19:00'],
  ];

  const handleSubmit = async () => {
    if (!selectedDate) {
      Alert.alert('Error', 'Please select a date for the follow-up.');
      return;
    }

    if (!selectedTime && !customTime) {
      Alert.alert('Error', 'Please select a time for the follow-up.');
      return;
    }

    if (!contactName) {
      Alert.alert('Error', 'Please enter a contact name.');
      return;
    }

    try {
      setIsSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const auth = getAuth();
      const userId = auth.currentUser?.uid;
      
      if (!userId) {
        Alert.alert('Error', 'You must be logged in to create a follow-up.');
        setIsSubmitting(false);
        return;
      }

      // Format time properly
      const finalTime = selectedTime || `${hours}:${minutes}`;
      
      // Calculate end time (30 minutes after start)
      const [startHour, startMinute] = finalTime.split(':').map(Number);
      let endHour = startHour;
      let endMinute = startMinute + 30;
      
      if (endMinute >= 60) {
        endHour += 1;
        endMinute -= 60;
      }
      
      const endTime = `${endHour}:${endMinute.toString().padStart(2, '0')}`;
      
      // Create date object for the follow-up
      const [year, month, day] = selectedDate.split('-').map(Number);
      
      let hours24 = startHour;
      
      // If using custom time with AM/PM, convert to 24-hour format
      if (customTime && period === 'PM' && startHour !== 12) {
        hours24 = startHour + 12;
      } else if (customTime && period === 'AM' && startHour === 12) {
        hours24 = 0;
      }
      
      const followUpDate = new Date(year, month - 1, day, hours24, startMinute);
      
      // Prepare follow-up data
      const followUpData = {
        userId,
        title: `Follow-up with ${contactName}`,
        contactName,
        phoneNumber,
        description: notes,
        date: Timestamp.fromDate(followUpDate),
        startTime: finalTime,
        endTime,
        status: 'Scheduled',
        createdAt: Timestamp.now()
      };
      
      // Add to Firestore
      await addDoc(collection(db, 'followups'), followUpData);
      
      Alert.alert(
        'Success',
        'Follow-up has been scheduled successfully!',
        [
          { 
            text: 'OK', 
            onPress: () => navigation.goBack() 
          }
        ]
      );
    } catch (error) {
      console.error('Error creating follow-up:', error);
      Alert.alert('Error', 'Failed to create follow-up. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <TouchableOpacity onPress={() => {
              const newHours = (parseInt(hours) % 12) + 1;
              setHours(newHours.toString().padStart(2, '0'));
            }}>
              <MaterialIcons name="keyboard-arrow-up" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.timeValue}>{hours}</Text>
            <TouchableOpacity onPress={() => {
              const newHours = parseInt(hours) - 1 <= 0 ? 12 : parseInt(hours) - 1;
              setHours(newHours.toString().padStart(2, '0'));
            }}>
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <Text style={styles.timeSeparator}>:</Text>

          {/* Minutes */}
          <View style={styles.timeColumn}>
            <TouchableOpacity onPress={() => {
              const newMinutes = (parseInt(minutes) + 5) % 60;
              setMinutes(newMinutes.toString().padStart(2, '0'));
            }}>
              <MaterialIcons name="keyboard-arrow-up" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.timeValue}>{minutes}</Text>
            <TouchableOpacity onPress={() => {
              const newMinutes = (parseInt(minutes) - 5 + 60) % 60;
              setMinutes(newMinutes.toString().padStart(2, '0'));
            }}>
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

          {/* Apply Button */}
          <TouchableOpacity 
            style={styles.applyButton}
            onPress={() => {
              setCustomTime(`${hours}:${minutes} ${period}`);
              setSelectedTime('');
              setShowTimePicker(false);
            }}
          >
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <AppGradient>
    <BDMMainLayout title="Create Follow Up" showBackButton={true} showDrawer={true} showBottomTabs={true}>  
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Contact Details Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Details</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="person" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Contact Name"
                value={contactName}
                onChangeText={setContactName}
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.inputContainer}>
              <MaterialIcons name="phone" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Calendar */}
          <View style={styles.calendarContainer}>
            <Text style={styles.sectionTitle}>Select Date</Text>
            <Calendar
              style={styles.calendar}
              theme={{
                calendarBackground: '#F8F7FF',
                textSectionTitleColor: '#666',
                selectedDayBackgroundColor: '#FF8447',
                selectedDayTextColor: '#fff',
                todayTextColor: '#FF8447',
                dayTextColor: '#333',
                textDisabledColor: '#d9e1e8',
                dotColor: '#FF8447',
                monthTextColor: '#333',
                textMonthFontWeight: 'bold',
                textMonthFontFamily: 'LexendDeca_600SemiBold',
                textDayFontFamily: 'LexendDeca_400Regular',
                textDayHeaderFontFamily: 'LexendDeca_500Medium',
                arrowColor: '#FF8447',
              }}
              onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
              markedDates={{
                [selectedDate]: { selected: true, selectedColor: '#FF8447' }
              }}
              enableSwipeMonths={true}
              minDate={format(new Date(), 'yyyy-MM-dd')}
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
                      onPress={() => {
                        setSelectedTime(time);
                        setCustomTime('');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
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
              style={[
                styles.customTimeButton,
                customTime ? styles.customTimeButtonSelected : {}
              ]}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={[
                styles.customTimeText,
                customTime ? styles.customTimeTextSelected : {}
              ]}>
                {customTime || `${hours}:${minutes} ${period}`}
              </Text>
              <MaterialIcons 
                name="access-time" 
                size={20} 
                color={customTime ? "#fff" : "#666"} 
              />
            </TouchableOpacity>
          </View>

          {/* Notes Section */}
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes for this follow-up..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              placeholderTextColor="#999"
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitText}>
              {isSubmitting ? 'Scheduling...' : 'Schedule Follow-up'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
        <TimePickerModal />
      </View>
    </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    color: '#333',
    fontFamily: 'LexendDeca_400Regular',
  },
  calendarContainer: {
    backgroundColor: '#F8F7FF',
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  calendar: {
    borderRadius: 12,
  },
  timeSection: {
    marginBottom: 24,
  },
  timeGrid: {
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '30%',
  },
  selectedTimeSlot: {
    backgroundColor: '#FF8447',
    borderColor: '#FF8447',
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  selectedTimeText: {
    color: '#fff',
    fontFamily: 'LexendDeca_500Medium',
  },
  customTimeSection: {
    marginBottom: 24,
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
  customTimeButtonSelected: {
    backgroundColor: '#FF8447',
    borderColor: '#FF8447',
  },
  customTimeText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  customTimeTextSelected: {
    color: '#fff',
    fontFamily: 'LexendDeca_500Medium',
  },
  notesSection: {
    marginBottom: 24,
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    height: 100,
    textAlignVertical: 'top',
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#FF8447',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
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
    width: '90%',
  },
  timeColumn: {
    alignItems: 'center',
    width: 50,
  },
  timeValue: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginVertical: 10,
  },
  timeSeparator: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginHorizontal: 5,
  },
  periodContainer: {
    marginLeft: 15,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FF8447',
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  periodButtonActive: {
    backgroundColor: '#FF8447',
  },
  periodText: {
    color: '#FF8447',
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
  },
  periodTextActive: {
    color: 'white',
  },
  applyButton: {
    backgroundColor: '#FF8447',
    padding: 10,
    borderRadius: 8,
    marginLeft: 20,
  },
  applyButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
  },
});

export default CreateFollowUpScreen; 