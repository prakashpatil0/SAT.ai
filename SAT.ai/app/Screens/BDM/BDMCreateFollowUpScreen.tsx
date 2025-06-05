import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Calendar, DateData } from 'react-native-calendars';
import { format } from 'date-fns';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getAuth } from 'firebase/auth';
import * as Haptics from 'expo-haptics';
import AppGradient from '@/app/components/AppGradient';
import BDMMainLayout from '@/app/components/BDMMainLayout';

interface RouteParams {
  contactName?: string;
  phoneNumber?: string;
}

const times = [
  '09:00', '09:15', '09:30', '09:45',
  '10:00', '10:15', '10:30', '10:45',
  '11:00', '11:15', '11:30', '11:45',
  '12:00', '12:15', '12:30', '12:45',
  '13:00', '13:15', '13:30', '13:45',
  '14:00', '14:15', '14:30', '14:45',
  '15:00', '15:15', '15:30', '15:45',
  '16:00', '16:15', '16:30', '16:45',
  '17:00', '17:15', '17:30', '17:45',
  '18:00', '18:15', '18:30', '18:45',
  '19:00'
];

const CreateFollowUpScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [contactName, setContactName] = useState(route.params?.contactName || '');
  const [phoneNumber, setPhoneNumber] = useState(route.params?.phoneNumber || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || !contactName) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const auth = getAuth();
      const userId = auth.currentUser?.uid;

      if (!userId) {
        Alert.alert('Error', 'You must be logged in.');
        setIsSubmitting(false);
        return;
      }

      const [startHour, startMinute] = selectedTime.split(':').map(Number);
      let endHour = startHour, endMinute = startMinute + 30;
      if (endMinute >= 60) {
        endHour += 1;
        endMinute -= 60;
      }

      const [year, month, day] = selectedDate.split('-').map(Number);
      const followUpDate = new Date(year, month - 1, day, startHour, startMinute);

      const followUpData = {
        userId,
        title: `Follow-up with ${contactName}`,
        contactName,
        phoneNumber,
        description: notes,
        date: Timestamp.fromDate(followUpDate),
        startTime: selectedTime,
        endTime: `${endHour}:${endMinute.toString().padStart(2, '0')}`,
        status: 'Scheduled',
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'followups'), followUpData);
      Alert.alert('Success', 'Follow-up scheduled!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      console.error('Error scheduling follow-up:', err);
      Alert.alert('Error', 'Could not schedule follow-up.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppGradient>
      <BDMMainLayout title="Create Follow Up" showBackButton showDrawer showBottomTabs>
        <View style={styles.container}>
          <ScrollView>
            {/* Contact */}
            <Text style={styles.label}>Contact Name</Text>
            <TextInput
              style={styles.input}
              value={contactName}
              onChangeText={setContactName}
              placeholder="Contact Name"
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Phone Number"
              keyboardType="phone-pad"
            />

            {/* Calendar */}
            <Calendar
              onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
              markedDates={{ [selectedDate]: { selected: true, selectedColor: '#FF8447' } }}
              minDate={format(new Date(), 'yyyy-MM-dd')}
            />

            {/* Time Selection */}
            <Text style={styles.label}>Select Time</Text>
            <View style={styles.timeGrid}>
              {times.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[styles.timeSlot, selectedTime === time && styles.timeSelected]}
                  onPress={() => setSelectedTime(time)}
                >
                  <Text style={selectedTime === time ? styles.selectedText : styles.timeText}>{time}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { height: 100 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes..."
              multiline
            />

            {/* Submit */}
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
              <Text style={styles.submitText}>{isSubmitting ? 'Scheduling...' : 'Schedule Follow-up'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { marginTop: 16, marginBottom: 8, fontSize: 16, fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 10,
  },
  timeSlot: {
    width: '30%',
    padding: 10,
    backgroundColor: '#eee',
    borderRadius: 8,
    alignItems: 'center',
  },
  timeSelected: {
    backgroundColor: '#FF8447',
  },
  timeText: {
    color: '#333',
  },
  selectedText: {
    color: '#fff',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#FF8447',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CreateFollowUpScreen;
