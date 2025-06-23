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
  Alert, KeyboardAvoidingView,
  TouchableWithoutFeedback, Keyboard
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
import { collection, addDoc, serverTimestamp, Timestamp, doc, getDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface IndividualDetails {
  name: string;
  phoneNumber: string;
  emailId: string;
  designation: string;

}




interface MeetingFormData {
  date: string;
  submittedBy?: string; // <-- ADD
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
   status: string;  // <-- Add this line for status
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
  const [userName, setUserName] = useState<string>(''); // <-- Add this line
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

  if (event.type === 'set' && time) {
    setSelectedLocationReachTime(time);
    const formattedTime = format(time, 'hh:mm a');

    setFormData(prev => ({
      ...prev,
      locationReachTime: formattedTime,
      rawLocationReachTime: time,
    }));

    // ✅ Clear error if previously present
    setErrors(prevErrors => {
      const updated = { ...prevErrors };
      delete updated.locationReachTime;
      return updated;
    });
  }
};
const [showStatusPicker, setShowStatusPicker] = useState(false);

// Handle selection of meeting status
const handleStatusSelect = (status: string) => {
  setFormData({
    ...formData,
    status,
  });
  setShowStatusPicker(false); // Hide the status picker once selected

  // Clear any existing error on status field
  setErrors((prevErrors) => {
    const updated = { ...prevErrors };
    delete updated.status;
    return updated;
  });
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
      emailId: '',
       designation: '', // ✅ Add this
    }],
    meetingType: 'Individual',
    userId: auth.currentUser?.uid || '',
    notes: '',
    status: '',
    meetingId: ''
  });
useEffect(() => {
  const fetchUserName = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userDocRef = doc(db, 'users', userId);
      const snapshot = await getDoc(userDocRef);

      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.name) {
          setUserName(data.name);
        }
      }
    } catch (err) {
      console.error("Failed to fetch user name", err);
    }
  };

  fetchUserName();
}, []);

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
  // ✅ Clear the locationUrl error
    setErrors((prevErrors) => {
      const updated = { ...prevErrors };
      delete updated.locationUrl;
      return updated;
    });
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
      emailId: '',
       designation: '', // ✅ Add this
    }],
    meetingType: 'Individual',
    userId: auth.currentUser?.uid || '',
    notes: '',
    status: '',
    meetingId: newMeetingId
  });
};

 const validateForm = (): boolean => {
  const newErrors: Record<string, string> = {};

  // Date
  if (!formData.date) {
    newErrors.date = 'Meeting date is required';
  }

  // Location Reach Time
  if (!formData.locationReachTime) {
    newErrors.locationReachTime = 'Location reach time is required';
  }

  // Start and End Time
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

  // Location URL
  if (!formData.locationUrl.trim()) {
    newErrors.locationUrl = 'Location is required';
  } else if (!formData.locationUrl.startsWith('http')) {
    newErrors.locationUrl = 'Location must be a valid URL';
  }
if (!formData.notes.trim()) {
  newErrors.notes = 'Meeting notes are required';
}
  // Company name (if meetingType is Company)
  if (meetingType === 'Company' && !formData.companyName.trim()) {
    newErrors.companyName = 'Company name is required';
  }

  // Individuals validations
  formData.individuals.forEach((individual, index) => {
    if (!individual.name.trim()) {
      newErrors[`individuals[${index}].name`] = 'Name is required';
    }

    if (!individual.designation.trim()) {
      newErrors[`individuals[${index}].designation`] = 'Designation is required';
    }

    if (!individual.phoneNumber.trim()) {
      newErrors[`individuals[${index}].phoneNumber`] = 'Phone number is required';
    } else if (!/^\d{10}$/.test(individual.phoneNumber)) {
      newErrors[`individuals[${index}].phoneNumber`] = 'Enter a valid 10-digit phone number';
    }

    if (!individual.emailId.trim()) {
  newErrors[`individuals[${index}].emailId`] = 'Email ID is required';
} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(individual.emailId)) {
  newErrors[`individuals[${index}].emailId`] = 'Enter a valid email';
}

  });

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
const validateScheduleForm = () => {
  const newErrors: { [key: string]: string } = {};

  if (!scheduleDate) {
    newErrors.scheduleDate = 'Please select a date';
  }

  if (!scheduleTime) {
    newErrors.scheduleTime = 'Please select a time';
  }

  if (!meetingType) {
    newErrors.meetingType = 'Please select meeting type';
  }

  if (meetingType === 'Company' && !formData.companyName.trim()) {
    newErrors.companyName = 'Company name is required';
  }

  if (!formData.locationUrl.trim()) {
    newErrors.locationUrl = 'Location is required';
  } else if (!formData.locationUrl.trim().startsWith('http')) {
    newErrors.locationUrl = 'Location must be a valid URL';
  }

  formData.individuals.forEach((ind, index) => {
    if (!ind.name.trim()) {
      newErrors[`individuals[${index}].name`] = 'Name is required';
    }
    if (!ind.designation.trim()) {
      newErrors[`individuals[${index}].designation`] = 'Designation is required';
    }
    if (!/^\d{10}$/.test(ind.phoneNumber)) {
      newErrors[`individuals[${index}].phoneNumber`] = 'Phone number must be 10 digits';
    }
    if (!/^\S+@\S+\.\S+$/.test(ind.emailId)) {
      newErrors[`individuals[${index}].emailId`] = 'Enter a valid email address';
    }
  });

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};



 const handleSubmit = async () => {
    // console.log("Submit function called");  // Debug log
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
      syncStatus: '',
         submittedBy: userName,
      
    };
  //  console.log("Meeting Data: ", meetingData);  // Debug log for the data
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
          const docRef = await addDoc(collection(db, 'meetings'), {
            ...syncData,
            createdAt: serverTimestamp(),
            meetingStartDateTime: new Date(syncData.meetingStartDateTime),
            meetingEndDateTime: new Date(syncData.meetingEndDateTime),
          });
          
          // console.log('Document successfully written with ID: ', docRef.id); // Log document ID after writing to Firestore

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
    setErrors((prevErrors) => {
      const updated = { ...prevErrors };
      delete updated.date;
      return updated;
    });
  }
};

const onTimeChange = (event: DateTimePickerEvent, time?: Date) => {
  setShowTimePicker(Platform.OS === 'ios');
  if (time) {
    setSelectedTime(time);
    setFormData({
      ...formData,
      locationReachTime: format(time, 'hh:mm a'),
      rawLocationReachTime: time
    });
    setErrors((prevErrors) => {
      const updated = { ...prevErrors };
      delete updated.locationReachTime;
      return updated;
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
    setErrors((prevErrors) => {
      const updated = { ...prevErrors };
      delete updated.startTime;
      return updated;
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
    setErrors((prevErrors) => {
      const updated = { ...prevErrors };
      delete updated.endTime;
      return updated;
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
         { name: '', phoneNumber: '', emailId: '', designation: '' } // ✅ add designation
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
  if (!validateScheduleForm()) {
    Alert.alert("Validation Error", "Please correct the highlighted fields.");
    return;
  }

  try {
    const userId = auth.currentUser?.uid || 'guest';
    const scheduleId = generateMeetingId(); // You can reuse your generator
    const timestamp = new Date();

  await addDoc(collection(db, 'bdm_schedule_meeting'), {

  meetingId: scheduleId, // added
  createdBy: userId,
  userId: userId,
  meetingType: meetingType,
  companyName: formData.companyName,
  individuals: formData.individuals,
  meetingDate: scheduleDate ? Timestamp.fromDate(scheduleDate) : null,
  meetingTime: scheduleTime ? format(scheduleTime, 'hh:mm a') : null,
  createdAt: serverTimestamp(),
});
    // const scheduleId = generateMeetingId();

    await addDoc(collection(db, 'bdm_schedule_meeting'), {
      meetingId: scheduleId,
      createdBy: userId,
      userId: userId,
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
         onChangeText={(text) => {
  updateIndividual(index, 'name', text);

  if (text.trim()) {
    const updatedErrors = { ...errors };
    delete updatedErrors[`individuals[${index}].name`];
    setErrors(updatedErrors);
  }
}}

        />
        {errors[`individuals[${index}].name`] && (
          <Text style={styles.errorText}>{errors[`individuals[${index}].name`]}</Text>
        )}
      </View>
<View style={styles.inputGroup}>
  <Text style={styles.label}>Designation</Text>
  <TextInput
    style={[
      styles.input,
      errors[`individuals[${index}].designation`] && styles.inputError,
    ]}
    placeholder="Enter Designation"
    value={individual.designation}
   onChangeText={(text) => {
  updateIndividual(index, 'designation', text);

  if (text.trim()) {
    const updatedErrors = { ...errors };
    delete updatedErrors[`individuals[${index}].designation`];
    setErrors(updatedErrors);
  }
}}

  />
  {errors[`individuals[${index}].designation`] && (
    <Text style={styles.errorText}>
      {errors[`individuals[${index}].designation`]}
    </Text>
  )}
</View>
      <View style={styles.inputGroup}>
       <Text style={styles.label}>Phone Number</Text>
<TextInput
  style={[
    styles.input,
    errors[`individuals[${index}].phoneNumber`] && styles.inputError,
  ]}
  placeholder="Enter Phone Number"
  keyboardType="phone-pad"
  value={individual.phoneNumber}
 onChangeText={(text) => {
  const digitsOnly = text.replace(/[^0-9]/g, '');
  if (digitsOnly.length <= 10) {
    updateIndividual(index, 'phoneNumber', digitsOnly);

    // Clear error when valid
    if (digitsOnly.length === 10) {
      const updatedErrors = { ...errors };
      delete updatedErrors[`individuals[${index}].phoneNumber`];
      setErrors(updatedErrors);
    }
  }
}}

  maxLength={10}
/>
{errors[`individuals[${index}].phoneNumber`] && (
  <Text style={styles.errorText}>
    {errors[`individuals[${index}].phoneNumber`]}
  </Text>
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
          onChangeText={(text) => {
  updateIndividual(index, 'emailId', text);

  // Clear error if valid email is entered
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
  if (isValidEmail) {
    const updatedErrors = { ...errors };
    delete updatedErrors[`individuals[${index}].emailId`];
    setErrors(updatedErrors);
  }
}}

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
       onChangeText={(text) => {
  setFormData({ ...formData, companyName: text });

  if (text.trim()) {
    const updatedErrors = { ...errors };
    delete updatedErrors.companyName;
    setErrors(updatedErrors);
  }
}}

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
     <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
    style={[
      styles.input,
      styles.multilineInput,
      errors.notes && styles.inputError
    ]}
    placeholder="Add any notes about the meeting"
    multiline
    numberOfLines={3}
    value={formData.notes}
    onChangeText={(text) => {
      setFormData({ ...formData, notes: text });
      // Clear error on change
      setErrors((prevErrors) => {
        const updated = { ...prevErrors };
        delete updated.notes;
        return updated;
      });
    }}
  />
  {errors.notes && <Text style={styles.errorText}>{errors.notes}</Text>}
</View>

<View style={styles.inputGroup}>
  <Text style={styles.label}>Meeting Status</Text>
  
  {/* TouchableOpacity for status selection */}
  <TouchableOpacity
    style={[styles.input, errors.status && styles.inputError]}
    onPress={() => setShowStatusPicker(true)} // Show the status picker when tapped
  >
    <Text style={styles.inputText}>
      {formData.status || 'Select Status'}
    </Text>
    <MaterialIcons name="arrow-drop-down" size={24} color="#FF8447" />
  </TouchableOpacity>

  {/* Display error if status is not selected */}
  {errors.status && <Text style={styles.errorText}>{errors.status}</Text>}

  {/* Status Picker */}
  {showStatusPicker && (
    <View style={styles.statusPickerContainer}>
      <TouchableOpacity onPress={() => handleStatusSelect('Not Interested')}>
        <Text style={styles.statusOption}>Not Interested</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleStatusSelect('Prospect')}>
        <Text style={styles.statusOption}>Prospect</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleStatusSelect('Suspect')}>
        <Text style={styles.statusOption}>Suspect</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleStatusSelect('Closing')}>
        <Text style={styles.statusOption}>Closing</Text>
      </TouchableOpacity>
    </View>
  )}
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
       </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      
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
  <TouchableOpacity
    style={[styles.input, errors.scheduleDate && styles.inputError]} // Highlight input on error
    onPress={() => setShowScheduleDatePicker(true)}
  >
    <Text style={styles.placeholderText}>
      {scheduleDate ? format(scheduleDate, 'dd MMM yyyy') : 'Select Date'}
    </Text>
    <MaterialIcons name="calendar-today" size={20} color="#FF8447" />
  </TouchableOpacity>
  {errors.scheduleDate && (
    <Text style={styles.errorText}>{errors.scheduleDate}</Text>
  )}
</View>


<View style={styles.inputGroup}>
  <Text style={styles.label}>Time of Meeting</Text>
  <TouchableOpacity
    style={[styles.input, errors.scheduleTime && styles.inputError]} // Highlight input on error
    onPress={() => setShowScheduleTimePicker(true)}
  >
    <Text style={styles.placeholderText}>
      {scheduleTime ? format(scheduleTime, 'hh:mm a') : 'Select Time'}
    </Text>
    <MaterialIcons name="access-time" size={20} color="#FF8447" />
  </TouchableOpacity>
  {errors.scheduleTime && (
    <Text style={styles.errorText}>{errors.scheduleTime}</Text>
  )}
</View>


<View style={styles.inputGroup}>
  <Text style={styles.label}>Meeting With</Text>
  <View style={styles.meetingTypeContainer}>
    <TouchableOpacity
      style={[
        styles.meetingTypeButton,
        meetingType === 'Individual' && styles.selectedMeetingType,
      ]}
      onPress={() => setMeetingType('Individual')}
    >
      <MaterialIcons
        name="person"
        size={20}
        color={meetingType === 'Individual' ? '#FF8447' : '#999'}
      />
      <Text
        style={[
          styles.meetingTypeText,
          meetingType === 'Individual' && styles.selectedMeetingTypeText,
        ]}
      >
        Individual
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.meetingTypeButton,
        meetingType === 'Company' && styles.selectedMeetingType,
      ]}
      onPress={() => setMeetingType('Company')}
    >
      <MaterialIcons
        name="business"
        size={20}
        color={meetingType === 'Company' ? '#FF8447' : '#999'}
      />
      <Text
        style={[
          styles.meetingTypeText,
          meetingType === 'Company' && styles.selectedMeetingTypeText,
        ]}
      >
        Company
      </Text>
    </TouchableOpacity>
  </View>

  {/* 🔴 Validation for meetingType */}
  {errors.meetingType && (
    <Text style={styles.errorText}>{errors.meetingType}</Text>
  )}
</View>

{/* ✅ Conditionally show company name input with validation */}
{meetingType === 'Company' && (
 <View style={styles.inputGroup}>
  <Text style={styles.label}>Company Name</Text>
  <TextInput
    style={[
      styles.input,
      errors.companyName && styles.inputError, // Highlight input on error
    ]}
    placeholder="Enter Company Name"
    value={formData.companyName}
    onChangeText={(text) => {
      // Update company name
      setFormData({ ...formData, companyName: text });

      // Clear error when valid company name is entered
      if (text.trim()) {
        const updatedErrors = { ...errors };
        delete updatedErrors.companyName; // Remove error for companyName
        setErrors(updatedErrors); // Update state
      }
    }}
  />
  {errors.companyName && (
    <Text style={styles.errorText}>{errors.companyName}</Text>
  )}
</View>

)}

  <View style={styles.divider} />

    <Text style={styles.sectionTitle}>Individuals Details</Text>
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
    style={[
      styles.input,
      errors[`individuals[${index}].name`] && styles.inputError, // Highlight input on error
    ]}
    placeholder="Enter Name"
    value={individual.name}
    onChangeText={(text) => {
      updateIndividual(index, 'name', text);

      // Clear error when valid name is entered
      if (text.trim()) {
        const updatedErrors = { ...errors };
        delete updatedErrors[`individuals[${index}].name`]; // Remove error for name
        setErrors(updatedErrors); // Update state
      }
    }}
  />
  {errors[`individuals[${index}].name`] && (
    <Text style={styles.errorText}>{errors[`individuals[${index}].name`]}</Text>
  )}
</View>

<View style={styles.inputGroup}>
  <Text style={styles.label}>Designation</Text>
  <TextInput
    style={[
      styles.input,
      errors[`individuals[${index}].designation`] && styles.inputError, // Highlight input on error
    ]}
    placeholder="Enter Designation"
    value={individual.designation}
    onChangeText={(text) => {
      updateIndividual(index, 'designation', text);

      // Clear error when valid designation is entered
      if (text.trim()) {
        const updatedErrors = { ...errors };
        delete updatedErrors[`individuals[${index}].designation`]; // Remove error for designation
        setErrors(updatedErrors); // Update state
      }
    }}
  />
  {errors[`individuals[${index}].designation`] && (
    <Text style={styles.errorText}>{errors[`individuals[${index}].designation`]}</Text>
  )}
</View>


<View style={styles.inputGroup}>
  <Text style={styles.label}>Phone Number</Text>
  <TextInput
  style={[styles.input, errors[`individuals[${index}].phoneNumber`] && styles.inputError]} 
  placeholder="Enter Phone Number" 
  keyboardType="phone-pad" 
  value={individual.phoneNumber} 
  onChangeText={(text) => {
    const digitsOnly = text.replace(/[^0-9]/g, '');
    if (digitsOnly.length <= 10) {
      updateIndividual(index, 'phoneNumber', digitsOnly);
      
      // Clear error when valid
      if (digitsOnly.length === 10) {
        const updatedErrors = { ...errors };
        delete updatedErrors[`individuals[${index}].phoneNumber`];
        setErrors(updatedErrors);
      }
    }
  }}
  maxLength={10}
/>
{errors[`individuals[${index}].phoneNumber`] && (
  <Text style={styles.errorText}>
    {errors[`individuals[${index}].phoneNumber`]}
  </Text>
)}

</View>

<View style={styles.inputGroup}>
  <Text style={styles.label}>Email ID</Text>
 <TextInput
  style={[styles.input, errors[`individuals[${index}].emailId`] && styles.inputError]}
  placeholder="Enter Email ID"
  keyboardType="email-address"
  value={individual.emailId}
  onChangeText={(text) => {
    updateIndividual(index, 'emailId', text);

    // Clear error if valid email
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
    if (isValidEmail) {
      const updatedErrors = { ...errors };
      delete updatedErrors[`individuals[${index}].emailId`];
      setErrors(updatedErrors);
    }
  }}
/>
{errors[`individuals[${index}].emailId`] && (
  <Text style={styles.errorText}>{errors[`individuals[${index}].emailId`]}</Text>
)}

</View>

    {index > 0 && <View style={styles.individualDivider} />}
  </View>
))}

<TouchableOpacity style={styles.addButton} onPress={addIndividual}>
  <MaterialIcons name="person-add" size={20} color="#FF8447" />
  <Text style={styles.addButtonText}>Add Another Individual</Text>
</TouchableOpacity>

 <View style={styles.inputGroup}>
  <Text style={styles.label}>Location URL</Text>
  <TextInput
  style={[styles.input, errors.locationUrl && styles.inputError]} 
  placeholder="Add location URL" 
  value={formData.locationUrl}
  onChangeText={(text) => {
    setFormData({ ...formData, locationUrl: text });

    // Clear error if valid URL
    if (text.trim().startsWith('http')) {
      const updatedErrors = { ...errors };
      delete updatedErrors.locationUrl; // remove error for locationUrl
      setErrors(updatedErrors);
    }
  }}
  onBlur={() => {
    const trimmed = formData.locationUrl.trim();
    const updatedErrors = { ...errors };

    if (!trimmed) {
      updatedErrors.locationUrl = 'Location is required';
    } else if (!trimmed.startsWith('http')) {
      updatedErrors.locationUrl = 'Location must be a valid URL';
    } else {
      delete updatedErrors.locationUrl;
    }

    setErrors(updatedErrors);
  }}
/>
{errors.locationUrl && <Text style={styles.errorText}>{errors.locationUrl}</Text>}

  
</View>


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

        // Clear the error for the date once selected
        setErrors(prevErrors => {
          const updated = { ...prevErrors };
          delete updated.scheduleDate; // Remove the error for the scheduleDate field
          return updated;
        });
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

        // Clear the error for the time once selected
        setErrors(prevErrors => {
          const updated = { ...prevErrors };
          delete updated.scheduleTime; // Remove the error for the scheduleTime field
          return updated;
        });
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
  scrollContent: {
  flexGrow: 1,  // Makes sure the content stretches to fill the available space
  paddingBottom: 30, // Ensures there's space for the submit button
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
statusPickerContainer: {
  position: 'absolute',
  top: 70, // Adjust based on your layout
  left: 0,
  width: '100%',
  backgroundColor: 'white',
  borderRadius: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  padding: 10,
  zIndex: 1, // Ensure the dropdown is visible on top
},
statusOption: {
  fontSize: 16,
  fontFamily: 'LexendDeca_400Regular',
  color: '#333',
  paddingVertical: 8,
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