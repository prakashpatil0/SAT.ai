import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { IconButton, Chip, Provider } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getAuth } from 'firebase/auth';

// 👇 Meeting interface
interface Meeting {
  id: string;
  phoneNumber: string;
  timestamp: Date;
  duration: number;
  type: 'incoming' | 'outgoing' | 'missed';
  status: 'completed' | 'missed' | 'in-progress';
  contactId?: string;
  contactName?: string;
}

const CreateFollowUpScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { meeting } = route.params as { meeting?: Meeting };

  const [selectedTime, setSelectedTime] = useState('');
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (meeting) {
      setPhoneNumber(meeting.phoneNumber || '');
      setContactName(meeting.contactName || '');
    }
  }, [meeting]);

  const times = [];
  for (let hour = 9; hour <= 19; hour++) {
    for (let min = 0; min < 60; min += 15) {
      if (hour === 19 && min > 0) break;
      times.push(
        `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
      );
    }
  }

  const daysInMonth = (month: number, year: number) =>
    new Date(year, month + 1, 0).getDate();

  const firstDayOfMonth = (month: number, year: number) =>
    new Date(year, month, 1).getDay();

  const renderCalendar = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const days = daysInMonth(month, year);
    const firstDay = firstDayOfMonth(month, year);

    const dates = [];
    for (let i = 0; i < firstDay; i++) {
      dates.push(<View key={`empty-${i}`} style={styles.dateCell} />);
    }
    for (let i = 1; i <= days; i++) {
      dates.push(
        <TouchableOpacity
          key={`date-${i}`}
          style={[styles.dateCell, selectedDate === i && styles.selectedDate]}
          onPress={() => setSelectedDate(i)}
        >
          <Text style={styles.dateText}>{i}</Text>
        </TouchableOpacity>
      );
    }
    return dates;
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(selectedMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedMonth(newMonth);
  };

  const addMinutes = (time: string, minutes: number) => {
    const [hrs, mins] = time.split(':').map(Number);
    const date = new Date(2000, 0, 1, hrs, mins + minutes);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      alert("Please select a date and time.");
      return;
    }

    try {
      const auth = getAuth();
      const userId = auth.currentUser?.uid;
      if (!userId) {
        alert("Please login first");
        return;
      }

      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth();
      const date = new Date(year, month, selectedDate);

      const followUpEvent = {
        title: 'Follow Up: ' + (description || 'Client Call'),
        startTime: selectedTime,
        endTime: addMinutes(selectedTime, 30),
        type: 'followup',
        date,
        description,
        contactName,
        phoneNumber,
        status: 'Pending',
        userId,
        createdAt: new Date(),
      };

      await addDoc(collection(db, 'followups'), followUpEvent);
      alert('Follow-up scheduled successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
      alert('Failed to schedule follow-up');
    }
  };

  return (
    <LinearGradient colors={['#FFF8F0', '#FFF']} style={styles.gradient}>
      <TelecallerMainLayout showDrawer showBackButton showBottomTabs title="Create Follow Up">
        <Provider>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.container}>
              {/* Calendar */}
              <View style={styles.calendarContainer}>
                <View style={styles.calendarHeader}>
                  <IconButton icon="chevron-left" size={30} onPress={() => changeMonth('prev')} />
                  <Text style={styles.monthTitle}>
                    {selectedMonth.toLocaleString('default', { month: 'long' })} {selectedMonth.getFullYear()}
                  </Text>
                  <IconButton icon="chevron-right" size={30} onPress={() => changeMonth('next')} />
                </View>
                <View style={styles.calendar}>
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                    <Text key={day} style={styles.dayHeader}>{day}</Text>
                  ))}
                  {renderCalendar()}
                </View>
              </View>

              {/* Time Slots */}
              <View style={styles.timeContainer}>
                <Text style={styles.sectionTitle}>Select time for the follow up</Text>
                <View style={styles.chipContainer}>
                  {times.map((time, index) => (
                    <Chip
                      key={index}
                      style={[styles.chip, selectedTime === time && styles.selectedChip]}
                      onPress={() => setSelectedTime(time)}
                    >
                      {time}
                    </Chip>
                  ))}
                </View>
              </View>

              {/* Submit */}
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitText}>Submit</Text>
              </TouchableOpacity>
            </View>

            {/* Contact & Description */}
            <View style={styles.formContainer}>
              <TextInput
                style={styles.input}
                placeholder="Contact Name"
                value={contactName}
                onChangeText={setContactName}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
              <TextInput
                style={[styles.input, styles.descriptionInput]}
                placeholder="Description"
                value={description}
                onChangeText={setDescription}
                multiline
              />
            </View>
          </ScrollView>
        </Provider>
      </TelecallerMainLayout>
    </LinearGradient>
  );
};

export default CreateFollowUpScreen;
const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'transparent',
  },
  calendarContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    backgroundColor: "#F5F1FD",
    borderColor: "#DCDCDC",
    borderRadius: 15,
  },
  monthTitle: {
    fontSize: 16,
    fontFamily: "LexendDeca_700Bold",
    color: "#000",
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayHeader: {
    width: '14.28%',
    textAlign: 'center',
    fontFamily: "LexendDeca_600SemiBold",
    color: "#7B827E",
    fontSize: 12,
    marginBottom: 10,
  },
  dateCell: {
    width: '14.28%',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateText: {
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
  },
  selectedDate: {
    backgroundColor: 'orange',
    borderRadius: 20,
    padding: 5,
  },
  timeContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: "#000",
    marginBottom: 10,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    margin: 4,
    borderColor: "#DCDCDC",
    borderWidth: 1,
  },
  selectedChip: {
    backgroundColor: 'orange',
  },
  customTimeSection: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 20,
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
    backgroundColor: 'orange',
    width: '45%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: "center",
    borderRadius: 10,
    marginVertical: 10,
  },
  submitText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
    textAlign: "center",
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 50,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
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