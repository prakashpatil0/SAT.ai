import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { IconButton, Chip, Provider } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import { MaterialIcons } from '@expo/vector-icons';
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
  const [hours, setHours] = useState('6');
  const [minutes, setMinutes] = useState('10');
  const [period, setPeriod] = useState('PM');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // ✅ Auto-fill from meeting
  useEffect(() => {
    if (meeting) {
      setPhoneNumber(meeting.phoneNumber || '');
      setContactName(meeting.contactName || '');
    }
  }, [meeting]);

  const times = [
    '9:00', '9:30', '10:00', '10:30', '11:00', '11:30', '12:00',
    '12:30', '13:00', '13:30', '14:00', '14:30', '16:30', '17:00',
    '17:30', '18:00', '18:30', '19:00'
  ];

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

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

  const changeMonth = (direction: string) => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(selectedMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedMonth(newMonth);
  };

  const handleSubmit = async () => {
    if (!selectedDate || (!selectedTime && !`${hours}:${minutes} ${period}`)) {
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

      let finalTime = selectedTime;
      if (!selectedTime) {
        let hour = parseInt(hours);
        if (period === 'PM' && hour !== 12) hour += 12;
        else if (period === 'AM' && hour === 12) hour = 0;
        finalTime = `${hour.toString().padStart(2, '0')}:${minutes}`;
      }

      const followUpEvent = {
        title: 'Follow Up: ' + (description || 'Client Call'),
        startTime: finalTime,
        endTime: addMinutes(finalTime, 30),
        type: 'followup',
        date: date,
        description: description,
        contactName: contactName,
        phoneNumber: phoneNumber,
        status: 'Pending',
        userId: userId,
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

  const addMinutes = (time: string, minutes: number) => {
    const [hours, mins] = time.split(':').map(Number);
    const date = new Date(2000, 0, 1, hours, mins + minutes);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
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
          <View style={styles.timeColumn}>
            <TouchableOpacity onPress={() => setMinutes(String(Number(minutes) + 1))}>
              <MaterialIcons name="keyboard-arrow-up" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.timeValue}>{minutes}</Text>
            <TouchableOpacity onPress={() => setMinutes(String(Number(minutes) - 1))}>
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#333" />
            </TouchableOpacity>
          </View>
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
    <LinearGradient colors={['#FFF8F0', '#FFF']} style={styles.gradient}>
      <TelecallerMainLayout showDrawer showBackButton={true} showBottomTabs={true} title="Create Follow Up">
        <Provider>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.container}>
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

              <View style={styles.timeContainer}>
                <Text style={styles.sectionTitle}>Select time for the follow up</Text>
                <View style={styles.chipContainer}>
                  {times.map((time, index) => (
                    <Chip
                      key={index}
                      style={[
                        styles.chip,
                        selectedTime === time && styles.selectedChip
                      ]}
                      onPress={() => setSelectedTime(time)}
                    >
                      {time}
                    </Chip>
                  ))}
                </View>
              </View>

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

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitText}>Submit</Text>
              </TouchableOpacity>
            </View>

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
          <TimePickerModal />
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
