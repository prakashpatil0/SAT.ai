import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { db } from '@/firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';






// Define types
type RootStackParamList = {
  BDMHomeScreen: undefined;
  BDMCreateFollowUp: {
    contactName: string;
    phoneNumber?: string;
    notes: string;
  };
  BDMCallNoteDetailsScreen: {
    meeting: {
      name: string;
      time: string;
      duration: string;
      phoneNumber?: string;
      date?: string;
      type?: 'incoming' | 'outgoing' | 'missed';
      contactType?: 'person' | 'company';
      timestamp?: Date | string;
    }
  };
  BDMPersonNote: {
    name: string;
    time: string;
    duration: string;
    status: string;
    notes: string[];
    phoneNumber?: string;
    contactInfo: {
      name: string;
      phoneNumber?: string;
      timestamp: Date;
      duration: string;
    };
    contactIdentifier: string;
  };
};

type CallNoteDetailsScreenProps = {
  route: RouteProp<RootStackParamList, 'BDMCallNoteDetailsScreen'>;
};

interface Note {
  id: string;
  contactName: string;
  phoneNumber?: string;
  date: string;
  time: string;
  duration: string;
  notes: string;
  status: string;
  followUp: boolean;
  userId: string;
  createdAt: number;
}

// Define AsyncStorage key
const CALL_NOTES_STORAGE_KEY = 'bdm_call_notes';

const CallNoteDetailsScreen: React.FC<CallNoteDetailsScreenProps> = ({ route }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [status, setStatus] = useState('Mark Status');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { meeting } = route.params;

const statusOptions = ['Prospect', 'Suspect', 'Closing','Not Interested'];
type ProductItem = {
  label: string;
  value: string;
};

const PRODUCT_LIST: ProductItem[] = [
  { label: "Health Insurance", value: "health_insurance" },
  { label: "Bike Insurance", value: "bike_insurance" },
  { label: "Car Insurance", value: "car_insurance" },
  { label: "Term Insurance", value: "term_insurance" },
  { label: "Mutual Funds", value: "mutual_funds" },
  { label: "Saving Plans", value: "saving_plan" },
  { label: "Travel Insurance", value: "travel_insurance" },
  { label: "Group Mediclaim", value: "group_mediclaim" },
  { label: "Group Personal Accident", value: "group_personal_accident" },
  { label: "Group Term Life", value: "group_term_life" },
  { label: "Group Credit Life", value: "group_credit_life" },
  { label: "Workmen Compensation", value: "workmen_compensation" },
  { label: "Group Gratuity", value: "group_gratuity" },
  { label: "Fire & Burglary Insurance", value: "fire_burglary_insurance" },
  { label: "Shop Owner Insurance", value: "shop_owner_insurance" },
  { label: "Motor Fleet Insurance", value: "motor_fleet_insurance" },
  { label: "Marine Single Transit", value: "marine_single_transit" },
  { label: "Marine Open Policy", value: "marine_open_policy" },
  { label: "Marine Sales Turnover", value: "marine_sales_turnover" },
  { label: "Directors & Officers Insurance", value: "directors_officers_insurance" },
  { label: "General Liability Insurance", value: "general_liability_insurance" },
  { label: "Product Liability Insurance", value: "product_liability_insurance" },
  { label: "Professional Indemnity for Doctors", value: "professional_indemnity_for_doctors" },
  { label: "Professional Indemnity for Companies", value: "professional_indemnity_for_companies" },
  { label: "Cyber Insurance", value: "cyber_insurance" },
  { label: "Office Package Policy", value: "office_package_policy" },
  { label: "Crime Insurance", value: "crime_insurance" },
  { label: "Other", value: "other" },
];
const [productOpen, setProductOpen] = useState(false);
const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
const [showProductModal, setShowProductModal] = useState(false);
const [selectedProductLabel, setSelectedProductLabel] = useState('Select Product');
const [showDatePicker, setShowDatePicker] = useState(false);
const [expectedDate, setExpectedDate] = useState<Date | null>(null);
const [expectedClosingAmount, setExpectedClosingAmount] = useState('');

  const handleStatusSelect = (selectedStatus: string) => {
    setStatus(selectedStatus);
    setShowStatusModal(false);
  };
const handleProductSelect = (item: ProductItem) => {
  setSelectedProduct(item.value);
  setSelectedProductLabel(item.label);
  setShowProductModal(false);
};
const onChangeDate = (event: any, selectedDate?: Date) => {
  setShowDatePicker(false);
  if (selectedDate) {
    setExpectedDate(selectedDate);
  }
};

  const handleFollowUpPress = () => {
    setFollowUp(!followUp);
    if (!followUp) {
      navigation.navigate('BDMCreateFollowUp', {
        contactName: meeting.name,
        phoneNumber: meeting.phoneNumber,
        notes,
      });
    }
  };
  

  // Update your handleSubmit function
// Updated handleSubmit function with complete error handling
const handleSubmit = async () => {
  const noteRequiredStatuses = [ 'Mark Status']; // Add others if needed

  if (
    (noteRequiredStatuses.includes(status) && notes.trim().length === 0) ||
    status === 'Mark Status'
  ) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert('Validation', 'Please enter notes and select a valid status.');
    return;
  }

  try {
    setIsSaving(true);
    const auth = getAuth();
    const user = auth.currentUser;

const callData: any = {
  callId: `${Date.now()}`,
  callTimestamp: meeting.timestamp ? new Date(meeting.timestamp) : new Date(),
  contactName: meeting.name,
  phoneNumber: meeting.phoneNumber,
  callDuration: meeting.duration || 0,
  notes,
  followUp,
  status,
  selectedProduct: selectedProduct || '',
  userId: user?.uid || 'anonymous',
  timestamp: new Date()
};

// ✅ Only save expectedClosingDate if status is Suspect
if (status === 'Suspect' && expectedDate) {
  callData.expectedClosingDate = expectedDate;
}

// ✅ Save expectedClosingAmount for all 3 statuses
if (['Prospect', 'Suspect', 'Closing'].includes(status) && expectedClosingAmount) {
  callData.expectedClosingAmount = expectedClosingAmount;
}



    await addDoc(collection(db, 'callNotes'), callData);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    navigation.navigate('BDMPersonNote', {
      name: meeting.name,
      time: meeting.time,
      duration: meeting.duration,
      status,
      notes: [notes],
      phoneNumber: meeting.phoneNumber,
      contactInfo: {
        name: meeting.name,
        phoneNumber: meeting.phoneNumber,
        timestamp: meeting.timestamp ? new Date(meeting.timestamp) : new Date(),
        duration: meeting.duration
      },
      contactIdentifier: `${meeting.phoneNumber || meeting.name}`
    });

  } catch (error) {
    console.error('Firestore Save Error:', error);
    Alert.alert('Error', 'Failed to save to the database.');
  } finally {
    setIsSaving(false);
  }
};


// Helper functions:

const createSafeContactIdentifier = (meeting: any): string => {
  try {
    // Return empty string if meeting is invalid
    if (!meeting || typeof meeting !== 'object') return 'unknown_contact';

    // Use phone number if available and valid
    if (meeting.phoneNumber && typeof meeting.phoneNumber === 'string') {
      const cleanPhone = meeting.phoneNumber.replace(/[^0-9]/g, '');
      if (cleanPhone.length > 3) {
        return `phone_${cleanPhone}`;
      }
    }

    // Use name if available and valid
    if (meeting.name && typeof meeting.name === 'string') {
      const cleanName = meeting.name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      if (cleanName.length > 1) {
        return `name_${cleanName}`;
      }
    }

    // Fallback to random ID
    return `unknown_${Date.now()}`;
  } catch (error) {
    console.error('Error creating contact identifier:', error);
    return 'unknown_contact';
  }
};

const getSafeTimestamp = (timestamp: any): Date => {
  try {
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp === 'string') return new Date(timestamp);
    return new Date();
  } catch (error) {
    console.error('Error parsing timestamp:', error);
    return new Date();
  }
};

const createNoteData = ({
  meeting,
  notes,
  status,
  followUp,
  contactIdentifier,
  validTimestamp
}: {
  meeting: any;
  notes: string;
  status: string;
  followUp: boolean;
  contactIdentifier: string;
  validTimestamp: Date;
}) => {
  return {
    id: `${contactIdentifier}_${validTimestamp.getTime()}`,
    contactIdentifier,
    phoneNumber: meeting?.phoneNumber || null,
    contactName: meeting?.name || 'Unknown Contact',
    notes,
    status: status || 'No Status',
    timestamp: new Date().toISOString(),
    followUp,
    callTimestamp: validTimestamp.toISOString(),
    callDuration: meeting?.duration || '0s',
    type: meeting?.type || 'outgoing'
  };
};

const saveNoteToStorage = async (noteData: any) => {
  try {
    const existingNotesStr = await AsyncStorage.getItem(CALL_NOTES_STORAGE_KEY);
    const allNotes = existingNotesStr ? JSON.parse(existingNotesStr) : {};

    // Initialize if doesn't exist
    if (!allNotes[noteData.contactIdentifier]) {
      allNotes[noteData.contactIdentifier] = [];
    }

    // Remove duplicate if exists
    allNotes[noteData.contactIdentifier] = allNotes[noteData.contactIdentifier]
      .filter((note: any) => note.id !== noteData.id);

    // Add new note
    allNotes[noteData.contactIdentifier].push(noteData);

    await AsyncStorage.setItem(CALL_NOTES_STORAGE_KEY, JSON.stringify(allNotes));
  } catch (error) {
    console.error('AsyncStorage error:', error);
    throw new Error('Failed to save note');
  }
};

const navigateToPersonNote = ({
  meeting,
  notes,
  status,
  contactIdentifier,
  validTimestamp
}: {
  meeting: any;
  notes: string;
  status: string;
  contactIdentifier: string;
  validTimestamp: Date;
}) => {
  navigation.navigate('BDMPersonNote', {
    name: meeting?.name || 'Unknown Contact',
    time: format(validTimestamp, 'hh:mm a'),
    duration: meeting?.duration || '0s',
    status: status !== 'Mark Status' ? status : 'No Status',
    notes: [notes],
    phoneNumber: meeting?.phoneNumber,
    contactInfo: {
      name: meeting?.name || 'Unknown Contact',
      phoneNumber: meeting?.phoneNumber || null,
      timestamp: validTimestamp,
      duration: meeting?.duration || '0s'
    },
    contactIdentifier
  });
};

const getErrorMessage = (error: any): string => {
  if (error instanceof Error) {
    return error.message || 'Failed to save the note. Please try again.';
  }
  return 'An unexpected error occurred. Please try again.';
};
  return (
    <AppGradient>
    <BDMMainLayout title="Call Notes" showBackButton={true} showDrawer={true} showBottomTabs={true}>
<ScrollView
  style={styles.scrollContainer}
  contentContainerStyle={styles.scrollContent}
  keyboardShouldPersistTaps="handled"
>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{meeting.name}</Text>
            <Text style={styles.headerSubtitle}>{meeting.time} • {meeting.duration}</Text>
          </View>
          <TouchableOpacity style={styles.playButton}>
            <MaterialIcons name="play-circle-outline" size={28} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Status Dropdown Button */}
<Text style={styles.label}>
  <Text style={styles.required}>* </Text>
  Mark the Status of the Call
</Text>
        <TouchableOpacity 
          style={styles.statusButton}
          onPress={() => setShowStatusModal(true)}
        >
         
          <Text style={styles.statusText}>{status}</Text>
          <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
        </TouchableOpacity>

        {/* Status Modal */}
        <Modal
          visible={showStatusModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStatusModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowStatusModal(false)}
          >
            <View style={styles.modalContent}>
              {statusOptions.map((option, index) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.statusOption,
                    index < statusOptions.length - 1 && styles.statusOptionBorder
                  ]}
                  onPress={() => handleStatusSelect(option)}
                >
                  <Text style={styles.statusOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Notes Section */}
       {status === 'Mark Status' && (
  <View style={styles.notesContainer}>
    <TextInput
      style={styles.notesInput}
      placeholder="Add Call Notes"
      placeholderTextColor="#999"
      multiline
      value={notes}
      onChangeText={setNotes}
      maxLength={120}
    />
    <Text style={styles.characterCount}>{notes.length}/120</Text>
  </View>
)}

{status === 'Not Interested' && (
  <View style={styles.notesContainer}>
    <TextInput
      style={styles.notesInput}
      placeholder="Add Call Notes"
      placeholderTextColor="#999"
      multiline
      value={notes}
      onChangeText={setNotes}
      maxLength={120}
    />
    <Text style={styles.characterCount}>{notes.length}/120</Text>
  </View>
)}

{status === 'Prospect' && (
  <View style={styles.notesContainer}>
    <Text style={styles.label}>Prospective Client Details</Text>
<TouchableOpacity
  style={styles.statusButton}
  onPress={() => setShowProductModal(true)}
>
  <Text style={styles.statusText}>{selectedProductLabel}</Text>
  <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
</TouchableOpacity>

<Modal
  visible={showProductModal}
  transparent
  animationType="fade"
  onRequestClose={() => setShowProductModal(false)}
>
  <TouchableOpacity
    style={styles.modalOverlay}
    activeOpacity={1}
    onPressOut={() => setShowProductModal(false)}
  >
    <View style={[styles.modalContent, { maxHeight: 600 }]}>
      <ScrollView nestedScrollEnabled>
        {PRODUCT_LIST.map((item, index) => (
          <TouchableOpacity
            key={item.value}
            style={[
              styles.statusOption,
              index < PRODUCT_LIST.length - 1 && styles.statusOptionBorder
            ]}
            onPress={() => handleProductSelect(item)}
          >
            <Text style={styles.statusOptionText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  </TouchableOpacity>
</Modal>





 <TextInput
  style={styles.input}
  placeholder="Enter Expected Closing Amount"
  keyboardType="numeric"
  value={expectedClosingAmount}
  onChangeText={setExpectedClosingAmount}
/>


   <TextInput
  style={styles.notesInput}
  placeholder="Add Call Notes"
  multiline
  value={notes}
  onChangeText={setNotes}
/>

    <TouchableOpacity style={styles.followUpContainer} onPress={handleFollowUpPress}>
      <View style={[styles.checkbox, followUp && styles.checkboxChecked]}>
        {followUp && <MaterialIcons name="check" size={16} color="#FFF" />}
      </View>
      <Text style={styles.followUpText}>Follow up on this call</Text>
    </TouchableOpacity>
    <Text style={{ color: 'gray', fontSize: 12, marginTop: 8 }}>
      *Note - If a prospective client is not moved to 'Suspect' within 45 days, they will automatically be marked as 'Not Interested.'
    </Text>
  </View>
)}

{status === 'Suspect' && (
  <View style={styles.notesContainer}>
    <Text style={styles.label}>Suspective Client Details</Text>
<TouchableOpacity
  style={styles.statusButton}
  onPress={() => setShowProductModal(true)}
>
  <Text style={styles.statusText}>{selectedProductLabel}</Text>
  <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
</TouchableOpacity>

<Modal
  visible={showProductModal}
  transparent
  animationType="fade"
  onRequestClose={() => setShowProductModal(false)}
>
  <TouchableOpacity
    style={styles.modalOverlay}
    activeOpacity={1}
    onPressOut={() => setShowProductModal(false)}
  >
    <View style={[styles.modalContent, { maxHeight: 600 }]}>
      <ScrollView nestedScrollEnabled>
        {PRODUCT_LIST.map((item, index) => (
          <TouchableOpacity
            key={item.value}
            style={[
              styles.statusOption,
              index < PRODUCT_LIST.length - 1 && styles.statusOptionBorder
            ]}
            onPress={() => handleProductSelect(item)}
          >
            <Text style={styles.statusOptionText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  </TouchableOpacity>
</Modal>



    <TextInput
  style={styles.input}
  placeholder="Enter Expected Closing Amount"
  keyboardType="numeric"
  value={expectedClosingAmount}
  onChangeText={setExpectedClosingAmount}
/>

   <TextInput
  style={styles.notesInput}
  placeholder="Add Call Notes"
  multiline
  value={notes}
  onChangeText={setNotes}
/>

    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.input}>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} >
    <Text style={{ color: expectedDate ? '#333' : '#999', fontSize: 16 }}>
      {expectedDate ? format(expectedDate, 'dd/MM/yyyy') : 'Select Expected Closing Date'}
    </Text>
    <MaterialIcons name="calendar-today" size={24} color="#666" />
  </View>
</TouchableOpacity>


{showDatePicker && (
  <DateTimePicker
    value={expectedDate || new Date()}
    mode="date"
    display="calendar"
    onChange={onChangeDate}
  />
)}

    <TouchableOpacity style={styles.followUpContainer} onPress={handleFollowUpPress}>
      <View style={[styles.checkbox, followUp && styles.checkboxChecked]}>
        {followUp && <MaterialIcons name="check" size={16} color="#FFF" />}
      </View>
      <Text style={styles.followUpText}>Follow up on this call</Text>
    </TouchableOpacity>
  </View>
)}

{status === 'Closing' && (
  <View style={styles.notesContainer}>
    <Text style={styles.label}>Closed Client Details</Text>
   <TouchableOpacity
  style={styles.statusButton}
  onPress={() => setShowProductModal(true)}
>
  <Text style={styles.statusText}>{selectedProductLabel}</Text>
  <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
</TouchableOpacity>

<Modal
  visible={showProductModal}
  transparent
  animationType="fade"
  onRequestClose={() => setShowProductModal(false)}
>
  <TouchableOpacity
    style={styles.modalOverlay}
    activeOpacity={1}
    onPressOut={() => setShowProductModal(false)}
  >
    <View style={[styles.modalContent, { maxHeight: 600 }]}>
      <ScrollView nestedScrollEnabled>
        {PRODUCT_LIST.map((item, index) => (
          <TouchableOpacity
            key={item.value}
            style={[
              styles.statusOption,
              index < PRODUCT_LIST.length - 1 && styles.statusOptionBorder
            ]}
            onPress={() => handleProductSelect(item)}
          >
            <Text style={styles.statusOptionText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  </TouchableOpacity>
</Modal>


 <TextInput
  style={styles.input}
  placeholder="Enter Expected Closing Amount"
  keyboardType="numeric"
  value={expectedClosingAmount}
  onChangeText={setExpectedClosingAmount}
/>

    <TextInput
  style={styles.notesInput}
  placeholder="Add Call Notes"
  multiline
  value={notes}
  onChangeText={setNotes}
/>

    <TextInput style={styles.input} placeholder="Enter Closing Amount" />
    <TouchableOpacity style={styles.followUpContainer} onPress={handleFollowUpPress}>
      <View style={[styles.checkbox, followUp && styles.checkboxChecked]}>
        {followUp && <MaterialIcons name="check" size={16} color="#FFF" />}
      </View>
      <Text style={styles.followUpText}>Follow up on this call</Text>
    </TouchableOpacity>
  </View>
)}
<TouchableOpacity 
  style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
  disabled={isSaving}
  onPress={handleSubmit}
>
  <Text style={styles.submitButtonText}>
    {isSaving ? 'Saving...' : 'Submit'}
  </Text>
</TouchableOpacity>

      </ScrollView>
    </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContainer: {
  flex: 1,
},

scrollContent: {
  padding: 16,
  paddingBottom: 100, // extra space for button visibility
},
required: {
  color: 'red',
  fontSize: 16,
  fontFamily: 'LexendDeca_600SemiBold',
},
dropdown: {
  borderColor: '#ccc',
  borderRadius: 8,
  paddingHorizontal: 12,
  marginBottom: 12,
  backgroundColor: '#FFF',
  zIndex: 3000,
  position: 'relative', // This is key
},

dropdownContainer: {
  borderColor: '#ccc',
  borderRadius: 8,
  zIndex: 3000,
  maxHeight: 750,        // Limit height so it scrolls
},


  input: {
  height: 48,
  borderWidth: 1,
  borderColor: '#ccc',
  borderRadius: 8,
  paddingHorizontal: 16,
  fontSize: 16,
  fontFamily: 'LexendDeca_400Regular',
  color: '#333',
  marginBottom: 12,
  backgroundColor: '#FFF',
 paddingVertical: 10,
  
},

label: {
  fontSize: 16,
  fontFamily: 'LexendDeca_600SemiBold',
  marginBottom: 8,
  color: '#333',
},

  gradient: {
 
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#FFF',
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 4,
  },
  playButton: {
    padding: 8,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  notesContainer: {
    padding: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  notesInput: {
    height: 120,
    textAlignVertical: 'top',
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
     backgroundColor: '#FFF',
     borderWidth: 1,
  borderColor: '#ccc',
  borderRadius: 8,
  paddingHorizontal: 15, 
  marginBottom: 8,

  },
  characterCount: {
    alignSelf: 'flex-start',
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#FF7A45',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
  },
  followUpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF8447',
    borderColor: '#FF8447',
  },
  followUpText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 120,
  },
modalContent: {
  backgroundColor: 'white',
  borderRadius: 12,
  elevation: 5,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  paddingVertical: 4,
  maxHeight: 400, // You can tweak this as needed
  width: '100%',
}
,
  statusOption: {
    padding: 16,
  },
  statusOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  statusOptionText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
});

export default CallNoteDetailsScreen;