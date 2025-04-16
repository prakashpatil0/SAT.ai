import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import DropDownPicker from 'react-native-dropdown-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import AppGradient from '@/app/components/AppGradient';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';

const ApplyLeaveScreen = () => {
  const navigation = useNavigation();

  const [leaveType, setLeaveType] = useState('Earned Leave');
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromDate, setShowFromDate] = useState(false);
  const [showToDate, setShowToDate] = useState(false);
  const [leavePeriod, setLeavePeriod] = useState(null);
  // const [leavePeriodOpen, setLeavePeriodOpen] = useState(false);
  // const [reason, setReason] = useState('');


  const [fromLeavePeriodOpen, setFromLeavePeriodOpen] = useState(false);
const [fromLeavePeriod, setFromLeavePeriod] = useState(null);

const [toLeavePeriodOpen, setToLeavePeriodOpen] = useState(false);
const [toLeavePeriod, setToLeavePeriod] = useState(null);

  const leavePeriodItems = [
    { label: 'First Half', value: 'First Half' },
    { label: 'Second Half', value: 'Second Half' },
  ];

  const handleSubmit = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack(); // or Navigate to another screen
  };
  const [reason, setReason] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  
  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (!result.canceled) {
        setUploadedFile(result.assets[0]);
      }
    } catch (error) {
      console.log('File upload error:', error);
    }
  };
  
  return (
    <AppGradient>
      <TelecallerMainLayout
        showDrawer
        showBackButton={true}
        showBottomTabs={true}
        title={"Apply for a Leave"}
      >
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

          {/* Leave Type */}
          <Text style={styles.label}>Select Leave Type</Text>
          

          <ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  style={{ marginBottom: 20 }}
>
  <View style={styles.leaveTypeContainer}>
    {/* Selected Leave Type - rendered first with close icon */}
    {leaveType && (
      <View style={[styles.leaveTypeBtn, styles.activeLeaveTypeBtn]}>
        <Text style={styles.activeText}>
          {leaveType.replace(/[0-9]/g, '').trim()}
        </Text>
        <TouchableOpacity onPress={() => setLeaveType(null)}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    )}

    {/* All Leave Types except the selected one */}
    {[
      'Earned Leave 20',
      'Sick Leave 13',
      'Casual Leave 08',
      'Emergency Leave 10',
      'Maternity Leave 60',
      'Other',
    ]
      .filter((type) => type !== leaveType)
      .map((type) => (
        <TouchableOpacity
          key={type}
          style={styles.leaveTypeBtn}
          onPress={() => setLeaveType(type)}
        >
          <Text style={styles.text}>{type}</Text>
        </TouchableOpacity>
      ))}
  </View>
</ScrollView>



{/* From Date & Dropdown */}
<View style={styles.dateContainer}>
  <TouchableOpacity style={styles.dateInput} onPress={() => setShowFromDate(true)}>
    <Text>From {'            '}</Text>
    <MaterialIcons name="calendar-month" size={18} color="#000" />
  </TouchableOpacity>

  {showFromDate && (
    <DateTimePicker
      value={fromDate}
      mode="date"
      display="default"
      onChange={(event, selectedDate) => {
        setShowFromDate(false);
        if (selectedDate) setFromDate(selectedDate);
      }}
    />
  )}

  <DropDownPicker
    open={fromLeavePeriodOpen}
    value={fromLeavePeriod}
    items={leavePeriodItems}
    setOpen={setFromLeavePeriodOpen}
    setValue={setFromLeavePeriod}
    setItems={() => {}}
    style={styles.dropdown}
    containerStyle={{ width: '100%', zIndex: 1000 }}
    dropDownContainerStyle={{ width: '55%', borderWidth: 1, borderColor: '#ddd', zIndex: 1000 }}
    placeholder={fromLeavePeriodOpen ? '' : 'Select Leave Period'}
    dropDownDirection="BOTTOM"
  />
</View>


{/* To Date & Dropdown */}
<View style={styles.dateContainer}>
  <TouchableOpacity style={styles.dateInput} onPress={() => setShowToDate(true)}>
    <Text>To{'                 '}</Text>
    <MaterialIcons name="calendar-month" size={18} color="#000" />
  </TouchableOpacity>

  {showToDate && (
    <DateTimePicker
      value={toDate}
      mode="date"
      display="default"
      onChange={(event, selectedDate) => {
        setShowToDate(false);
        if (selectedDate) setToDate(selectedDate);
      }}
    />
  )}

  <DropDownPicker
    open={toLeavePeriodOpen}
    value={toLeavePeriod}
    items={leavePeriodItems}
    setOpen={setToLeavePeriodOpen}
    setValue={setToLeavePeriod}
    setItems={() => {}}
    style={styles.dropdown}
    containerStyle={{ width: '100%', zIndex: 500 }}
    dropDownContainerStyle={{ width: '55%', borderWidth: 1, borderColor: '#ddd', zIndex: 500 }}
    placeholder={toLeavePeriodOpen ? '' : 'Select Leave Period'}
    dropDownDirection="BOTTOM"
  />
</View>

          

          {/* Total Days */}
          <Text style={styles.label}>Total Number of Days</Text>
          <View style={styles.daysCountBox}>
            <Text style={styles.daysCountText}>
              {Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 3600 * 24))} Days
            </Text>
          </View>

          {/* Reason */}
         {/* Reason for Leave */}
<View style={styles.notesContainer}>
  <TextInput
    style={styles.textarea}
    placeholder="Enter Reason For Leave"
    multiline
    maxLength={120}
    value={reason}
    onChangeText={setReason}
  />
  
  <View style={styles.reasonCard}>
  <Text style={styles.reasonText}>
    {reason || 'Enter your reason here...'}
  </Text>

  {/* Uploaded File Preview */}
  {uploadedFile && (
    <View style={styles.filePreview}>
      <MaterialIcons name="insert-drive-file" size={20} color="#555" />
      <Text style={styles.fileName} numberOfLines={1}>
        {uploadedFile.name}
      </Text>
      <MaterialIcons name="verified" size={20} color="#00C566" />
    </View>
  )}

  {/* Bottom Row: Char count + attach */}
  <View style={styles.bottomArea}>
    <Text style={styles.charCount}>{reason.length}/120</Text>
    <TouchableOpacity onPress={handleFileUpload}>
      <MaterialIcons name="attach-file" size={20} color="#555" />
    </TouchableOpacity>
  </View>
</View>

</View>




          {/* Notes */}

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            {/* <MaterialIcons name="send" size={20} color="white" /> */}
            <Text style={{ color: 'white', fontWeight: 'bold' }}>{'  '}Submit</Text>
          </TouchableOpacity>

        </ScrollView>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

export default ApplyLeaveScreen;

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { fontSize: 16, marginBottom: 10, fontWeight: '500',gap: 10 },
  leaveTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  
  leaveTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
  },
  
  activeLeaveTypeBtn: {
    backgroundColor: '#E6FAEC',
    borderColor: 'green',
  },
  
  text: {
    fontSize: 14,
    color: '#000',
  },
  
  activeText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  
  closeIcon: {
    marginLeft: 8,
    color: '#333',
    fontSize: 14,
  },
  
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,  // Add this for space between both inputs (From & To)
  },
  
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    width: '40%',  // Reduced width for equal gap
  },
  
  dropdown: {
    width: '55%',  // Same as above for perfect symmetry
    borderWidth: 1,
    borderColor: '#ddd',
  },
  daysCountBox: { backgroundColor: 'white', borderRadius: 8, padding: 12, marginBottom: 20 ,borderWidth: 1,          // Add this
    borderColor: '#ddd',},
  daysCountText: { fontSize: 16, color: '#333' },
  submitBtn: { flexDirection: 'row', backgroundColor: '#ff914d', padding: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' ,width:'50%',alignSelf:'center',marginTop:10},
  notesContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inputWithIcon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,          // Add this
    borderColor: '#ddd',
  },
  
  textarea: {
    fontSize: 16,
    color: '#333',
    minHeight: 120,
    textAlignVertical: 'top', // for android
  },

  reasonCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginVertical: 10,
    elevation: 2,
  },
  
  reasonText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
  },
  
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  
  fileName: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 14,
    color: '#333',
  },
  
  bottomArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  charCount: {
    fontSize: 12,
    color: '#999',
  },
  
});