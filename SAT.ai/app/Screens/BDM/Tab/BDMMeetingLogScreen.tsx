import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Image } from "expo-image";
import Ionicons from "react-native-vector-icons/Ionicons";
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import { auth, db } from '@/firebaseConfig';
import { collection, addDoc, serverTimestamp,Timestamp } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface IndividualDetails {
  name: string;
  phoneNumber: string;
  emailId: string;
}

interface MeetingFormData {
  date: string;
  rawDate?: Date;
   locationReachTime: string;           // <-- ADD
  rawLocationReachTime?: Date;       
  startTime: string;
  rawStartTime?: Date;
  endTime: string;
  rawEndTime?: Date;
  locationUrl: string;
  companyName: string;
  individuals: IndividualDetails[];
  meetingType: 'Individual' | 'Company';
  userId: string;
  notes: string;
  status: 'planned' | 'completed' | 'cancelled';
  meetingId: string;
}

// Add this function at the top level, before the component
const generateMeetingId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `MTG-${timestamp.slice(-4)}${randomStr}`;
};

// Add storage key constant
const MEETING_LOGS_STORAGE_KEY = 'bdm_meeting_logs';
const MEETING_LOGS_PENDING_SYNC = 'bdm_meeting_logs_pending_sync';

const BDMMeetingLogScreen = () => {
  const navigation = useNavigation();
  const [meetingType, setMeetingType] = useState<'Individual' | 'Company'>('Individual');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [selectedStartTime, setSelectedStartTime] = useState(new Date());
  const [selectedEndTime, setSelectedEndTime] = useState(new Date());
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [showLocationReachTimePicker, setShowLocationReachTimePicker] = useState(false);
const [selectedLocationReachTime, setSelectedLocationReachTime] = useState(new Date());
const [showScheduleForm, setShowScheduleForm] = useState(false);
const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
const [scheduleTime, setScheduleTime] = useState<Date | null>(null);
const [showScheduleDatePicker, setShowScheduleDatePicker] = useState(false);
const [showScheduleTimePicker, setShowScheduleTimePicker] = useState(false);

const onLocationReachTimeChange = (event: DateTimePickerEvent, time?: Date) => {
  setShowLocationReachTimePicker(Platform.OS === 'ios');
  if (time) {
    setSelectedLocationReachTime(time);
    setFormData({
      ...formData,
      locationReachTime: format(time, 'hh:mm a'),
      rawLocationReachTime: time,
    });
  }
};

  const [formData, setFormData] = useState<MeetingFormData>({
    date: '',
    rawDate: undefined,
    locationReachTime: '',              // <-- ADD
  rawLocationReachTime: undefined,    // <-- ADD
    startTime: '',
    rawStartTime: undefined,
    endTime: '',
    rawEndTime: undefined,
    locationUrl: '',
    companyName: '',
    individuals: [{
      name: '',
      phoneNumber: '',
      emailId: ''
    }],
    meetingType: 'Individual',
    userId: auth.currentUser?.uid || '',
    notes: '',
    status: 'planned',
    meetingId: ''
  });

  useEffect(() => {
    // Generate unique meeting ID on component mount using our custom function
    setFormData(prev => ({
      ...prev,
      meetingId: generateMeetingId()
    }));
  }, []);

  const fetchCurrentLocation = async () => {
    try {
      setIsLocationLoading(true);
      
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to fetch your current location.');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      // Get address from coordinates
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      // Create Google Maps URL
      const mapsUrl = `https://www.google.com/maps?q=${location.coords.latitude},${location.coords.longitude}`;
      
      // Update form with location URL
      setFormData(prev => ({
        ...prev,
        locationUrl: mapsUrl
      }));

    } catch (error) {
      console.error('Error fetching location:', error);
      Alert.alert('Error', 'Failed to fetch location. Please try again.');
    } finally {
      setIsLocationLoading(false);
    }
  };
const resetForm = () => {
  const newMeetingId = generateMeetingId();
  const now = new Date();
  setScheduleDate(null);   // Reset meeting date
  setScheduleTime(null);   // Reset meeting time
  setSelectedDate(now);
  setSelectedTime(now);
  setSelectedStartTime(now);
  setSelectedEndTime(now);
  setErrors({});
  setMeetingType('Individual');
  setFormData({
    date: '',
    rawDate: undefined,
     locationReachTime: '',              // <-- ADD
  rawLocationReachTime: undefined,    // <-- ADD
    startTime: '',
    rawStartTime: undefined,
    endTime: '',
    rawEndTime: undefined,
    locationUrl: '',
    companyName: '',
    individuals: [{
      name: '',
      phoneNumber: '',
      emailId: ''
    }],
    meetingType: 'Individual',
    userId: auth.currentUser?.uid || '',
    notes: '',
    status: 'planned',
    meetingId: newMeetingId
  });
};

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.date) {
      newErrors.date = 'Meeting date is required';
    }
    
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }

    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }

    if (formData.startTime && formData.endTime) {
      const start = formData.rawStartTime;
      const end = formData.rawEndTime;
      if (start && end && end <= start) {
        newErrors.endTime = 'End time must be after start time';
      }
    }

    if (!formData.locationUrl) {
      newErrors.locationUrl = 'Location is required';
    }
    
    if (meetingType === 'Company' && !formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }
    
    // Validate first individual (required)
    if (!formData.individuals[0].name.trim()) {
      newErrors['individuals[0].name'] = 'Name is required';
    }
    
    if (!formData.individuals[0].phoneNumber.trim()) {
      newErrors['individuals[0].phoneNumber'] = 'Phone number is required';
    } else if (!/^\d{10,15}$/.test(formData.individuals[0].phoneNumber.replace(/[\s-]/g, ''))) {
      newErrors['individuals[0].phoneNumber'] = 'Valid phone number is required';
    }
    
    if (formData.individuals[0].emailId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.individuals[0].emailId)) {
      newErrors['individuals[0].emailId'] = 'Valid email is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

 const handleSubmit = async () => {
  if (!validateForm()) {
    Alert.alert('All Fields are Required', 'Please fill all the fields correctly');
    return;
  }

  try {
    setIsLoading(true);

    // Construct meeting object
    const meetingId = formData.meetingId || Date.now().toString();
    const meetingStartDateTime = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      selectedStartTime.getHours(),
      selectedStartTime.getMinutes()
    );
    const meetingEndDateTime = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      selectedEndTime.getHours(),
      selectedEndTime.getMinutes()
    );

    const meetingData = {
      ...formData,
      id: meetingId,
      meetingType,
      createdAt: new Date().toISOString(),
      meetingStartDateTime,
      meetingEndDateTime,
      individuals:
        meetingType === 'Individual' ? [formData.individuals[0]] : formData.individuals,
      syncStatus: 'pending',
    };

    // Save to AsyncStorage
    const existingLogsStr = await AsyncStorage.getItem(MEETING_LOGS_STORAGE_KEY);
    const existingLogs = existingLogsStr ? JSON.parse(existingLogsStr) : [];

    const updatedLogs = [...existingLogs, meetingData];
    await AsyncStorage.setItem(MEETING_LOGS_STORAGE_KEY, JSON.stringify(updatedLogs));

    // Add to pending sync queue
    const pendingSyncStr = await AsyncStorage.getItem(MEETING_LOGS_PENDING_SYNC);
    const pendingSync = pendingSyncStr ? JSON.parse(pendingSyncStr) : [];

    if (!pendingSync.includes(meetingId)) {
      pendingSync.push(meetingId);
      await AsyncStorage.setItem(MEETING_LOGS_PENDING_SYNC, JSON.stringify(pendingSync));
    }

    // Trigger background sync (optionally delay by 10 mins, or immediate if online)
   (async () => {
  try {
    const logsStr = await AsyncStorage.getItem(MEETING_LOGS_STORAGE_KEY);
    const logs = logsStr ? JSON.parse(logsStr) : [];

    const syncData = logs.find((m: any) => m.id === meetingId);
    if (syncData) {
      await addDoc(collection(db, 'meetings'), {
        ...syncData,
        createdAt: serverTimestamp(),
        meetingStartDateTime: new Date(syncData.meetingStartDateTime),
        meetingEndDateTime: new Date(syncData.meetingEndDateTime),
      });

      // Update syncStatus
      const updatedLogs = logs.map((log: any) =>
        log.id === meetingId ? { ...log, syncStatus: 'synced' } : log
      );
      await AsyncStorage.setItem(MEETING_LOGS_STORAGE_KEY, JSON.stringify(updatedLogs));

      // Remove from pending queue
      const filteredQueue = pendingSync.filter((id: string) => id !== meetingId);
      await AsyncStorage.setItem(MEETING_LOGS_PENDING_SYNC, JSON.stringify(filteredQueue));
    }
  } catch (err) {
    console.error('❌ Sync to Firebase failed:', err);
  }
})();


    // UI Success
    setModalVisible(true);
    setTimeout(() => {
      setModalVisible(false);
      resetForm();
      // navigation.goBack(); // Optional
    }, 2000);
  } catch (error) {
    console.error('Error in handleSubmit:', error);
    Alert.alert('Error', 'Unexpected error occurred. Please try again.');
  } finally {
    setIsLoading(false);
  }
};


  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
      setFormData({
        ...formData,
        date: format(date, 'dd MMMM yyyy'),
        rawDate: date
      });
    }
  };

  const onTimeChange = (event: DateTimePickerEvent, time?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (time) {
      setSelectedTime(time);
      setFormData({
        ...formData,
        startTime: format(time, 'hh:mm a'),
        rawStartTime: time
      });
    }
  };

  const onStartTimeChange = (event: DateTimePickerEvent, time?: Date) => {
    setShowStartTimePicker(Platform.OS === 'ios');
    if (time) {
      setSelectedStartTime(time);
      setFormData({
        ...formData,
        startTime: format(time, 'hh:mm a'),
        rawStartTime: time
      });
    }
  };

  const onEndTimeChange = (event: DateTimePickerEvent, time?: Date) => {
    setShowEndTimePicker(Platform.OS === 'ios');
    if (time) {
      setSelectedEndTime(time);
      setFormData({
        ...formData,
        endTime: format(time, 'hh:mm a'),
        rawEndTime: time
      });
    }
  };

  const updateIndividual = (index: number, field: keyof IndividualDetails, value: string) => {
    const updatedIndividuals = [...formData.individuals];
    updatedIndividuals[index] = {
      ...updatedIndividuals[index],
      [field]: value
    };
    
    setFormData({
      ...formData,
      individuals: updatedIndividuals
    });
  };

  const addIndividual = () => {
    if (formData.individuals.length >= 5) {
      Alert.alert('Limit Reached', 'You can add up to 5 individuals for a meeting');
      return;
    }
    
    setFormData({
      ...formData,
      individuals: [
        ...formData.individuals,
        { name: '', phoneNumber: '', emailId: '' }
      ]
    });
  };

  const removeIndividual = (index: number) => {
    if (index === 0) return; // Don't remove the first individual
    
    const updatedIndividuals = formData.individuals.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      individuals: updatedIndividuals
    });
  };
const handleScheduleMeetingSubmit = async () => {
  try {
    const userId = auth.currentUser?.uid || 'guest';
    const scheduleId = generateMeetingId(); // You can reuse your generator
    const timestamp = new Date();

  await addDoc(collection(db, 'bdm_schedule_meeting'), {

  meetingId: scheduleId, // added
  createdBy: userId,
  userId:userId,
  meetingType: meetingType,
  companyName: formData.companyName,
  individuals: formData.individuals,
  meetingDate: scheduleDate ? Timestamp.fromDate(scheduleDate) : null,
  meetingTime: scheduleTime ? format(scheduleTime, 'hh:mm a') : null,
  createdAt: serverTimestamp(),
});


    Alert.alert("Success", "Scheduled meeting saved!");
    setShowScheduleForm(false);
    resetForm();
  } catch (error) {
    console.error("Error saving scheduled meeting:", error);
    Alert.alert("Error", "Failed to save scheduled meeting. Try again.");
  }
};

  const renderIndividualForm = (individual: IndividualDetails, index: number) => (
    <View key={`individual-${index}`} style={styles.individualContainer}>
      {index > 0 && (
        <View style={styles.individualHeader}>
          <Text style={styles.individualTitle}>Individual {index + 1}</Text>
          <TouchableOpacity onPress={() => removeIndividual(index)}>
            <MaterialIcons name="delete" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={[styles.input, errors[`individuals[${index}].name`] && styles.inputError]}
          placeholder="Enter Name"
          value={individual.name}
          onChangeText={(text) => updateIndividual(index, 'name', text)}
        />
        {errors[`individuals[${index}].name`] && (
          <Text style={styles.errorText}>{errors[`individuals[${index}].name`]}</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={[styles.input, errors[`individuals[${index}].phoneNumber`] && styles.inputError]}
          placeholder="Enter Phone Number"
          keyboardType="phone-pad"
          value={individual.phoneNumber}
          onChangeText={(text) => updateIndividual(index, 'phoneNumber', text)}
        />
        {errors[`individuals[${index}].phoneNumber`] && ( 
          <Text style={styles.errorText}>{errors[`individuals[${index}].phoneNumber`]}</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email ID</Text>
        <TextInput
          style={[styles.input, errors[`individuals[${index}].emailId`] && styles.inputError]}
          placeholder="Enter Email ID"
          keyboardType="email-address"
          autoCapitalize="none"
          value={individual.emailId}
          onChangeText={(text) => updateIndividual(index, 'emailId', text)}
        />
        {errors[`individuals[${index}].emailId`] && (
          <Text style={styles.errorText}>{errors[`individuals[${index}].emailId`]}</Text>
        )}
      </View>
      
      {index > 0 && <View style={styles.individualDivider} />}
    </View>
  );

 const renderCompanyForm = () => (
  <>
    <View style={styles.inputGroup}>
      <Text style={styles.label}>Company Name</Text>
      <TextInput
        style={[styles.input, errors.companyName && styles.inputError]}
        placeholder="Enter Company Name"
        value={formData.companyName}
        onChangeText={(text) => setFormData({...formData, companyName: text})}
      />
      {errors.companyName && <Text style={styles.errorText}>{errors.companyName}</Text>}
    </View>

    <View style={styles.divider} />

    <Text style={styles.sectionTitle}>Individuals Details</Text>

    {formData.individuals.map((individual, index) => renderIndividualForm(individual, index))}

    {/* Keep only this one */}
    <TouchableOpacity style={styles.addButton} onPress={addIndividual}>
      <MaterialIcons name="person-add" size={24} color="#FF8447" />
      <Text style={styles.addButtonText}>Add Another Individual</Text>
    </TouchableOpacity>
  </>
);


  return (
    <AppGradient>
    <BDMMainLayout title="Meeting Log" showBackButton>
      <ScrollView style={styles.scrollView}>
        <View style={styles.formContainer}>
          <Text style={styles.meetingDateText}>
  {format(new Date(), 'dd MMMM (EEEE)')}
</Text>
{/* Schedule Meeting Button */}
<TouchableOpacity
  style={styles.scheduleMeetingButton}
  onPress={() => setShowScheduleForm(true)} // show the new form
>
  <View style={styles.scheduleLeft}>
    <MaterialIcons name="event" size={20} color="#FF8447" />
    <Text style={styles.scheduleText}>Schedule Meeting</Text>
  </View>
  <MaterialIcons name="arrow-forward-ios" size={18} color="#FF8447" />
</TouchableOpacity>


            {/* Meeting Type Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Meeting With</Text>
            <View style={styles.meetingTypeContainer}>
              <TouchableOpacity 
                style={[
                  styles.meetingTypeButton,
                  meetingType === 'Individual' && styles.selectedMeetingType
                ]}
                onPress={() => {
                  setMeetingType('Individual');
                  setFormData({
                    ...formData,
                    meetingType: 'Individual',
                    companyName: ''
                  });
                }}
              >
                <MaterialIcons 
                  name="person" 
                  size={24} 
                  color={meetingType === 'Individual' ? '#FF8447' : '#666'} 
                />
                <Text style={[
                  styles.meetingTypeText,
                  meetingType === 'Individual' && styles.selectedMeetingTypeText
                ]}>Individual</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.meetingTypeButton,
                  meetingType === 'Company' && styles.selectedMeetingType
                ]}
                onPress={() => {
                  setMeetingType('Company');
                  setFormData({
                    ...formData,
                    meetingType: 'Company'
                  });
                }}
              >
                <MaterialIcons 
                  name="business" 
                  size={24} 
                  color={meetingType === 'Company' ? '#FF8447' : '#666'} 
                />
                <Text style={[
                  styles.meetingTypeText,
                  meetingType === 'Company' && styles.selectedMeetingTypeText
                ]}>Company</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Conditional Form Fields */}
         {meetingType === 'Company' ? (
  renderCompanyForm()
) : (
  <>
    {formData.individuals.map((individual, index) => renderIndividualForm(individual, index))}
    <TouchableOpacity style={styles.addButton} onPress={addIndividual}>
      <MaterialIcons name="person-add" size={24} color="#FF8447" />
      <Text style={styles.addButtonText}>Add Another Individual</Text>
    </TouchableOpacity>
  </>
)}


          {/* Meeting ID Display */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Meeting ID</Text>
            <View style={[styles.input, styles.meetingIdContainer]}>
              <Text style={[styles.inputText, styles.meetingIdText]}>
                {formData.meetingId}
              </Text>
            </View>
          </View>
          {/* Date Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Meeting</Text>
            <TouchableOpacity 
              style={[styles.input, errors.date && styles.inputError]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[
                styles.inputText,
                formData.date ? styles.selectedText : styles.placeholderText
              ]}>
                {formData.date || 'Select Date'}
              </Text>
              <MaterialIcons name="calendar-today" size={24} color="#FF8447" />
            </TouchableOpacity>
            {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
          </View>

          {/* Time Picker */}
        <View style={styles.inputGroup}>
  <Text style={styles.label}>Location Reach Time</Text>
  <TouchableOpacity 
    style={[styles.input, errors.locationReachTime && styles.inputError]}
    onPress={() => setShowLocationReachTimePicker(true)}
  >
    <Text style={[
      styles.inputText,
      formData.locationReachTime ? styles.selectedText : styles.placeholderText
    ]}>
      {formData.locationReachTime || 'Select Time'}
    </Text>
    <MaterialIcons name="access-time" size={24} color="#FF8447" />
  </TouchableOpacity>
  {errors.locationReachTime && <Text style={styles.errorText}>{errors.locationReachTime}</Text>}
</View>

          {/* Start Time Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Meeting Start Time</Text>
            <TouchableOpacity 
              style={[styles.input, errors.startTime && styles.inputError]}
              onPress={() => setShowStartTimePicker(true)}
            >
              <Text style={[
                styles.inputText,
                formData.startTime ? styles.selectedText : styles.placeholderText
              ]}>
                {formData.startTime || 'Select Start Time'}
              </Text>
              <MaterialIcons name="access-time" size={24} color="#FF8447" />
            </TouchableOpacity>
            {errors.startTime && <Text style={styles.errorText}>{errors.startTime}</Text>}
          </View>

          {/* End Time Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Meeting End Time</Text>
            <TouchableOpacity 
              style={[styles.input, errors.endTime && styles.inputError]}
              onPress={() => setShowEndTimePicker(true)}
            >
              <Text style={[
                styles.inputText,
                formData.endTime ? styles.selectedText : styles.placeholderText
              ]}>
                {formData.endTime || 'Select End Time'}
              </Text>
              <MaterialIcons name="access-time" size={24} color="#FF8447" />
            </TouchableOpacity>
            {errors.endTime && <Text style={styles.errorText}>{errors.endTime}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location URL</Text>
            <View style={styles.locationContainer}>
              <View style={[styles.input, styles.locationInput, errors.locationUrl && styles.inputError]}>
                <Text style={[
                  styles.inputText,
                  formData.locationUrl ? styles.selectedText : styles.placeholderText
                ]} numberOfLines={1} ellipsizeMode="tail">
                  {formData.locationUrl || 'No location selected'}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.locationButton}
                onPress={fetchCurrentLocation}
                disabled={isLocationLoading}
              >
                {isLocationLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <MaterialIcons name="my-location" size={24} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
            {errors.locationUrl && <Text style={styles.errorText}>{errors.locationUrl}</Text>}
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Meeting Notes</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Add any notes about the meeting"
              multiline
              numberOfLines={3}
              value={formData.notes}
              onChangeText={(text) => setFormData({...formData, notes: text})}
            />
          </View>

        

          {/* Submit Button */}
          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit</Text>
            )}
          </TouchableOpacity>
        
          {/*Popup Modal*/}
          <Modal
            transparent={true}
            visible={modalVisible}
            animationType="fade"
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                {/*Back Button*/}
                <TouchableOpacity onPress={() => setModalVisible(false)}
                style={styles.backButton}>
                  <Ionicons name="arrow-back" size={24} color="#000"/>
                </TouchableOpacity>
                {/*GIF and Text*/}
                <Image
                source={require("@/assets/images/mail.gif")}
                style={styles.gif}
                contentFit="contain"
                />
                <Text style={styles.modalTitle}>Meeting Added Successfully!</Text>
                <Text style={styles.modalSubtitle}>Your meeting details has been recorded.</Text>
                <Text style={styles.modalSubtitle}>Keep up the great work.</Text>
              </View>
            </View>
          </Modal>

          {/* Date Picker Modal */}
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
              minimumDate={new Date()}
              style={styles.dateTimePicker}
            />
          )}

          {/* Time Pickers */}
          {showTimePicker && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeChange}
              style={styles.dateTimePicker}
            />
          )}

          {showStartTimePicker && (
            <DateTimePicker
              value={selectedStartTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onStartTimeChange}
              style={styles.dateTimePicker}
            />
          )}
          {showEndTimePicker && (
            <DateTimePicker
              value={selectedEndTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onEndTimeChange}
              style={styles.dateTimePicker}
            />
          )}
          {showLocationReachTimePicker && (
  <DateTimePicker
    value={selectedLocationReachTime}
    mode="time"
    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
    onChange={onLocationReachTimeChange}
    style={styles.dateTimePicker}
  />
)}

        </View>
      </ScrollView>
      
<Modal
  visible={showScheduleForm}
  animationType="fade"
  transparent
  onRequestClose={() => setShowScheduleForm(false)}
>
  <View style={styles.popupOverlay}>
    <View style={styles.popupContainer}>
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.newFormTitle}>Schedule Meeting</Text>
      <TouchableOpacity
        onPress={() => setShowScheduleForm(false)}
        style={{ position: 'absolute', top: 10, right: 10 }}
      >
        <MaterialIcons name="close" size={24} color="#999" />
      </TouchableOpacity>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Date of Meeting</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowScheduleDatePicker(true)}>
  <Text style={styles.placeholderText}>
    {scheduleDate ? format(scheduleDate, 'dd MMM yyyy') : 'Select Date'}
  </Text>
  <MaterialIcons name="calendar-today" size={20} color="#FF8447" />
</TouchableOpacity>

      </View>

      <View style={styles.inputGroup}>
       <Text style={styles.label}>Time of Meeting</Text>
<TouchableOpacity
  style={styles.input}
  onPress={() => setShowScheduleTimePicker(true)}
>
  <Text style={styles.placeholderText}>
    {scheduleTime ? format(scheduleTime, 'hh:mm a') : 'Select Time'}
  </Text>
  <MaterialIcons name="access-time" size={20} color="#FF8447" />
</TouchableOpacity>

      </View>

     <View style={styles.inputGroup}>
  <Text style={styles.label}>Meeting With</Text>
  <View style={styles.meetingTypeContainer}>
    <TouchableOpacity
      style={[styles.meetingTypeButton, meetingType === 'Individual' && styles.selectedMeetingType]}
      onPress={() => setMeetingType('Individual')}
    >
      <MaterialIcons name="person" size={20} color={meetingType === 'Individual' ? '#FF8447' : '#999'} />
      <Text style={[styles.meetingTypeText, meetingType === 'Individual' && styles.selectedMeetingTypeText]}>
        Individual
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.meetingTypeButton, meetingType === 'Company' && styles.selectedMeetingType]}
      onPress={() => setMeetingType('Company')}
    >
      <MaterialIcons name="business" size={20} color={meetingType === 'Company' ? '#FF8447' : '#999'} />
      <Text style={[styles.meetingTypeText, meetingType === 'Company' && styles.selectedMeetingTypeText]}>
        Company
      </Text>
    </TouchableOpacity>
  </View>
</View>


{meetingType === 'Company' && (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Company Name</Text>
    <TextInput
      style={styles.input}
      placeholder="Enter Company Name"
      value={formData.companyName}
      onChangeText={(text) =>
        setFormData({ ...formData, companyName: text })
      }
    />
  </View>
)}

{/* Render dynamic individual fields */}
{formData.individuals.map((individual, index) => (
  <View key={index} style={styles.individualContainer}>
    {index > 0 && (
      <View style={styles.individualHeader}>
        <Text style={styles.individualTitle}>Individual {index + 1}</Text>
        <TouchableOpacity onPress={() => removeIndividual(index)}>
          <MaterialIcons name="delete" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    )}

    <View style={styles.inputGroup}>
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter Name"
        value={individual.name}
        onChangeText={(text) => updateIndividual(index, 'name', text)}
      />
    </View>

    <View style={styles.inputGroup}>
      <Text style={styles.label}>Phone Number</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter Phone Number"
        keyboardType="phone-pad"
        value={individual.phoneNumber}
        onChangeText={(text) => updateIndividual(index, 'phoneNumber', text)}
      />
    </View>

    <View style={styles.inputGroup}>
      <Text style={styles.label}>Email ID</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter Email ID"
        keyboardType="email-address"
        value={individual.emailId}
        onChangeText={(text) => updateIndividual(index, 'emailId', text)}
      />
    </View>

    {index > 0 && <View style={styles.individualDivider} />}
  </View>
))}

<TouchableOpacity style={styles.addButton} onPress={addIndividual}>
  <MaterialIcons name="person-add" size={20} color="#FF8447" />
  <Text style={styles.addButtonText}>Add Another Individual</Text>
</TouchableOpacity>

      <Text style={styles.label}>Location URL</Text>
<TextInput style={styles.input} placeholder="Add location URL" />
      <TouchableOpacity style={styles.submitButton} onPress={handleScheduleMeetingSubmit}>
  <Text style={styles.submitButtonText}>Submit</Text>
</TouchableOpacity>

    </ScrollView>
  </View>
   </View>
</Modal>

{showScheduleDatePicker && (
  <DateTimePicker
    value={scheduleDate || new Date()}
    mode="date"
    display="default"
    onChange={(e, date) => {
      setShowScheduleDatePicker(false);
      if (date) {
        setScheduleDate(date);
        setFormData(prev => ({
          ...prev,
          rawDate: date,
          date: format(date, 'dd MMM yyyy'),
        }));
      }
    }}
  />
)}

{showScheduleTimePicker && (
  <DateTimePicker
    value={scheduleTime || new Date()}
    mode="time"
    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
    onChange={(event, selectedTime) => {
      setShowScheduleTimePicker(false);
      if (selectedTime) {
        setScheduleTime(selectedTime);
        setFormData(prev => ({
          ...prev,
          rawStartTime: selectedTime,
          startTime: format(selectedTime, 'hh:mm a'),
        }));
      }
    }}
  />
)}


    </BDMMainLayout>
    </AppGradient>
  );
  
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  popupOverlay: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
},

popupContainer: {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: 5,
  width: '90%', // Or use a fixed width like 340
  maxHeight: '90%',
},

  newFormContainer: {
  backgroundColor: '#FFF',
  padding: 20,
  margin: 16,
  borderRadius: 12,
  elevation: 2,
},
newFormTitle: {
  fontSize: 18,
  fontFamily: 'LexendDeca_600SemiBold',
  color: '#FF8447',
  marginBottom: 20,
  textAlign: 'center',
},

  meetingDateText: {
  fontSize: 18,
  color: '#FF8447',
  fontFamily: 'LexendDeca_600SemiBold',
  textAlign: 'center',
  marginBottom: 20,
},
  scheduleMeetingButton: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#FF8447',
  borderRadius: 30,
  paddingVertical: 10,
  paddingHorizontal: 20,
  marginBottom: 20,
  backgroundColor: '#FFF9F4',
},
scheduleLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
scheduleText: {
  fontSize: 16,
  color: '#FF8447',
  fontFamily: 'LexendDeca_500Medium',
},

  formContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    marginHorizontal: 10,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 20,
  },
  individualDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginBottom: 20,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    marginTop: 4,
    marginLeft: 4,
  },
  inputText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  meetingTypeContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  meetingTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  selectedMeetingType: {
    backgroundColor: '#FFF5E6',
  },
  meetingTypeText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  selectedMeetingTypeText: {
    color: '#FF8447',
  },
  individualContainer: {
    marginBottom: 15,
  },
  individualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  individualTitle: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FF8447',
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 25,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF8447',
  },
  submitButton: {
    backgroundColor: '#FF8447',
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 24,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: 'white',
    textAlign: 'center',
  },
  dateTimePicker: {
    backgroundColor: 'white',
    width: Platform.OS === 'ios' ? '100%' : 'auto',
  },
  selectedText: {
    color: '#333',
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    width: 300,
    height: 400, // Adjust this value to increase the height
    elevation: 10,
    justifyContent: "center", // Centers the content vertically
  },
  
  gif: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#FF5722",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: "#555555",
    textAlign: "center",
    marginTop: 10,
  },
  backButton: {
    position: "absolute", // Place it within the popup
    top: 10, // Adjust as needed
    left: 10, // Adjust as needed
    width: 40, // Button size
    height: 40, // Button size
    justifyContent: "center", // Center the icon
    alignItems: "center", // Center the iconw
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationInput: {
    flex: 1,
  },
  locationButton: {
    backgroundColor: '#FF8447',
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meetingIdContainer: {
    backgroundColor: '#F5F5F5',
  },
  meetingIdText: {
    color: '#666',
    fontFamily: 'LexendDeca_500Medium',
  },
});

export default BDMMeetingLogScreen; 