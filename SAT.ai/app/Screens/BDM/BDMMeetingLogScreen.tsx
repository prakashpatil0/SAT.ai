import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView,
  Modal,
  Platform 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import BDMScreenHeader from '@/app/Screens/BDM/BDMScreenHeader';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { Event } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Image } from "expo-image";
import Ionicons from "react-native-vector-icons/Ionicons";


const BDMMeetingLogScreen = () => {
  const [meetingType, setMeetingType] = useState('Individual');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  
  const handleSubmit = () => {
    setModalVisible(true); // Show the modal
    setTimeout(() => setModalVisible(false), 15000); // Auto-hide the modal after 15 seconds
  };

  const [formData, setFormData] = useState({
    date: '',
    time: '',
    locationUrl: '',
    companyName: '',
    individualName: '',
    phoneNumber: '',
    emailId: '',
  });

  const onDateChange = (event: Event, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
      setFormData({
        ...formData,
        date: format(date, 'dd MMMM yyyy')
      });
    }
  };

  const onTimeChange = (event: Event, time?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (time) {
      setSelectedTime(time);
      setFormData({
        ...formData,
        time: format(time, 'hh:mm a')
      });
    }
  };

  const renderIndividualForm = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter Name"
          value={formData.individualName}
          onChangeText={(text) => setFormData({...formData, individualName: text})}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter Phone Number"
          keyboardType="phone-pad"
          value={formData.phoneNumber}
          onChangeText={(text) => setFormData({...formData, phoneNumber: text})}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email ID</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter Email ID"
          keyboardType="email-address"
          value={formData.emailId}
          onChangeText={(text) => setFormData({...formData, emailId: text})}
        />
      </View>
    </>
  );

  const renderCompanyForm = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Company Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter Company Name"
          value={formData.companyName}
          onChangeText={(text) => setFormData({...formData, companyName: text})}
        />
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Individual Details</Text>

      {renderIndividualForm()}
    </>
  );

  return (
    <LinearGradient colors={['#FFF8F0', '#FFF']} style={styles.container}>
      <BDMScreenHeader title="Meeting Log" />
      <ScrollView style={styles.scrollView}>
        <View style={styles.formContainer}>
          {/* Date Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Meeting</Text>
            <TouchableOpacity 
              style={styles.input}
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
          </View>

          {/* Time Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Time of Meeting</Text>
            <TouchableOpacity 
              style={styles.input}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={[
                styles.inputText,
                formData.time ? styles.selectedText : styles.placeholderText
              ]}>
                {formData.time || 'Select Time'}
              </Text>
              <MaterialIcons name="access-time" size={24} color="#FF8447" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location URL</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Add location URL"
              multiline
              numberOfLines={3}
              value={formData.locationUrl}
              onChangeText={(text) => setFormData({...formData, locationUrl: text})}
            />
          </View>

          {/* Meeting Type Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Meeting With</Text>
            <View style={styles.meetingTypeContainer}>
              <TouchableOpacity 
                style={[
                  styles.meetingTypeButton,
                  meetingType === 'Individual' && styles.selectedMeetingType
                ]}
                onPress={() => setMeetingType('Individual')}
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
                onPress={() => setMeetingType('Company')}
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
          {meetingType === 'Company' ? renderCompanyForm() : renderIndividualForm()}

          {/* Add Individual Button */}
          <TouchableOpacity style={styles.addButton}>
            <MaterialIcons name="add" size={24} color="#FF8447" />
            <Text style={styles.addButtonText}>Add Individual</Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit</Text>
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

          {/* Time Picker Modal */}
          {showTimePicker && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeChange}
              style={styles.dateTimePicker}
            />
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
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
});

export default BDMMeetingLogScreen; 