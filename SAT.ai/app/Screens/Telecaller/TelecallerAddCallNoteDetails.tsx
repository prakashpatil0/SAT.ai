import React, { useState ,useEffect} from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AppGradient from '@/app/components/AppGradient';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { getAuth } from 'firebase/auth';
import { doc, updateDoc, addDoc, collection,getDoc ,query,where,getDocs} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Meeting {
  id: string;
  phoneNumber: string;
  timestamp: Date | string | number; // Can be Date, string, or number
  duration: number;
  type: 'incoming' | 'outgoing' | 'missed';
  status: 'completed' | 'missed' | 'in-progress';
  contactId?: string;
  contactName?: string;
}

type RootStackParamList = {
  TelecallerCreateFollowUp: { meeting: Meeting };
  TelecallerCallNoteDetails: { meeting: Meeting };
  TelecallerPersonNotes: { 
    name: string; 
    time: string; 
    duration: string; 
    status: string; 
    notes: string[]; 
    phoneNumber: string;
    contactInfo: {
      name: string;
      phoneNumber: string;
      timestamp: Date;
      duration: number;
    };
    contactIdentifier: string;
  };
};

const TelecallerCallNoteDetails = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [status, setStatus] = useState('Mark Status');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const { meeting } = route.params as { meeting: Meeting };
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expectedDate, setExpectedDate] = useState<Date | null>(null);
  const [expectedClosingAmount, setExpectedClosingAmount] = useState('');
    const [isSaving, setIsSaving] = useState(false);
  
type ProductItem = {
  name: string;
  id: string;
};

const [productList, setProductList] = useState<ProductItem[]>([]);
const [loadingProducts, setLoadingProducts] = useState(true);
useEffect(() => {
  const fetchProducts = async () => {
    try {
      const auth = getAuth();
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      // Step 1: Fetch user document to get companyId
      const userDocRef = doc(db, 'users', userId);
      const userSnapshot = await getDoc(userDocRef);
      if (!userSnapshot.exists()) throw new Error('User document not found');

      const userData = userSnapshot.data();
      const companyId = userData.companyId;

      // Step 2: Fetch products for that companyId
      const productsQuery = query(
        collection(db, 'products'),
        where('companyId', '==', companyId),
        where('active', '==', true)
      );

      const snapshot = await getDocs(productsQuery);
     const products: ProductItem[] = snapshot.docs.map(doc => ({
  id: doc.id,
  name: doc.data().name,
}));
setProductList(products);

    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  fetchProducts();
}, []);


const handleProductSelect = (item: ProductItem) => {
  setSelectedProduct(item.name); // store the readable name like "1BHK"
  setShowProductModal(false);
};

const onChangeDate = (event: any, selectedDate?: Date) => {
  setShowDatePicker(false);
  if (selectedDate) {
    setExpectedDate(selectedDate);
  }
};

  // Helper function to safely parse dates
  const parseDate = (dateValue: Date | string | number): Date => {
    if (dateValue instanceof Date) {
      return dateValue;
    }
    // If it's a string or number, try to parse it
    const parsedDate = new Date(dateValue);
    if (isNaN(parsedDate.getTime())) {
      // If parsing fails, return current date as fallback
      return new Date();
    }
    return parsedDate;
  };

  // Ensure we have a valid timestamp
  const callTimestamp = parseDate(meeting.timestamp);

const statusOptions = ['Prospect', 'Suspect', 'Closing','Not Interested'];

  const handleStatusSelect = (selectedStatus: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStatus(selectedStatus);
    setShowStatusModal(false);
  };

  const handleFollowUpPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFollowUp(!followUp);
    if (!followUp) {
      navigation.navigate('TelecallerCreateFollowUp', { meeting });
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const CALL_NOTES_STORAGE_KEY = 'call_notes';

  // Helper function to create a safe contact identifier
  const createSafeContactIdentifier = (meeting: any): string => {
    try {
      if (!meeting || typeof meeting !== 'object') return 'unknown_contact';

      if (meeting.phoneNumber && typeof meeting.phoneNumber === 'string') {
        const cleanPhone = meeting.phoneNumber.replace(/[^0-9]/g, '');
        if (cleanPhone.length > 3) {
          return `phone_${cleanPhone}`;
        }
      }

      if (meeting.contactName && typeof meeting.contactName === 'string') {
        const cleanName = meeting.contactName
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');
        if (cleanName.length > 1) {
          return `name_${cleanName}`;
        }
      }

      return `unknown_${Date.now()}`;
    } catch (error) {
      console.error('Error creating contact identifier:', error);
      return 'unknown_contact';
    }
  };

const handleSubmit = async () => {
  if (notes.trim().length === 0) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    return;
  }

  try {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const contactIdentifier = createSafeContactIdentifier({
      phoneNumber: meeting.phoneNumber,
      contactName: meeting.contactName,
    });

    const callId = `${meeting.phoneNumber}_${callTimestamp.getTime()}`;

    const noteData = {
      id: callId,
      userId,
      contactIdentifier,
      phoneNumber: meeting.phoneNumber,
      contactName: meeting.contactName || meeting.phoneNumber,
      notes,
      status,
      timestamp: new Date().toISOString(),
      followUp,
      callTimestamp: callTimestamp.toISOString(),
      callDuration: meeting.duration,
      type: meeting.type || 'outgoing',
      selectedProduct: selectedProduct,
      expectedClosingAmount,
      expectedClosingDate: expectedDate ? expectedDate.toISOString() : null,
    };

    // 🔥 Save to Firestore
    await addDoc(collection(db, 'telecaller_call_notes'), noteData);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    navigation.navigate('TelecallerPersonNotes', {
      phoneNumber: meeting.phoneNumber,
      name: meeting.contactName || meeting.phoneNumber,
      time: format(callTimestamp, 'hh:mm a'),
      duration: formatDuration(meeting.duration),
      status: status !== 'Mark Status' ? status : 'No Status',
      notes: [notes],
      contactInfo: {
        name: meeting.contactName || meeting.phoneNumber,
        phoneNumber: meeting.phoneNumber,
        timestamp: callTimestamp,
        duration: meeting.duration
      },
      contactIdentifier
    });
  } catch (error) {
    console.error('Error saving call notes:', error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};


  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBackButton={true} showBottomTabs={true} title={meeting.contactName || meeting.phoneNumber}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>
                {meeting.phoneNumber}
              </Text>
              <Text style={styles.timeText}>
                {format(callTimestamp, 'hh:mm a')} • {formatDuration(meeting.duration)}
              </Text>
            </View>
          </View>

          {/* Status Dropdown */}
          <Text style={styles.label}>
            <Text style={styles.required}>* </Text>
            Mark the Status of the Call
          </Text>
          <TouchableOpacity 
            style={styles.statusButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowStatusModal(true);
            }}
          >
            <Text style={[
              styles.statusText,
              status !== 'Mark Status' && styles.selectedStatusText
            ]}>
              {status}
            </Text>
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
                    index < statusOptions.length - 1 && styles.statusOptionBorder,
                  ]}
                  onPress={() => handleStatusSelect(option)}
                >
                  <Text style={[
                    styles.statusOptionText,
                    status === option && styles.selectedStatusOptionText
                  ]}>
                    {option}
                  </Text>
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
  <Text style={styles.statusText}>{selectedProduct}</Text>
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
      {productList.map((item, index) => (
  <TouchableOpacity
    key={`${item.name}-${index}`} // Ensure uniqueness using name+index
    style={[
      styles.statusOption,
      index < productList.length - 1 && styles.statusOptionBorder
    ]}
    onPress={() => handleProductSelect(item)}
  >
    <Text style={styles.statusOptionText}>{item.name}</Text>
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
  <Text style={styles.statusText}>{selectedProduct}</Text>
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
      {productList.map((item, index) => (
  <TouchableOpacity
    key={`${item.name}-${index}`} // Ensure uniqueness using name+index
    style={[
      styles.statusOption,
      index < productList.length - 1 && styles.statusOptionBorder
    ]}
    onPress={() => handleProductSelect(item)}
  >
    <Text style={styles.statusOptionText}>{item.name}</Text>
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
  <Text style={styles.statusText}>{selectedProduct}</Text>
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
{productList.map((item, index) => (
  <TouchableOpacity
    key={`${item.name}-${index}`} // Ensure uniqueness using name+index
    style={[
      styles.statusOption,
      index < productList.length - 1 && styles.statusOptionBorder
    ]}
    onPress={() => handleProductSelect(item)}
  >
    <Text style={styles.statusOptionText}>{item.name}</Text>
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
      </TelecallerMainLayout>
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
required: {
  color: 'red',
  fontSize: 16,
  fontFamily: 'LexendDeca_600SemiBold',
},
scrollContent: {
  padding: 16,
  paddingBottom: 100, // extra space for button visibility
},

  gradient: {
 
    padding: 16,
  },
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
  headerSection: {
    marginBottom: 24,
   
    padding: 16,
 
  },
  titleRow: {
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 12,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  selectedStatusText: {
    color: '#FF8447',
    fontFamily: 'LexendDeca_500Medium',
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
  notesFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  characterCount: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  characterCountLimit: {
    color: '#DC2626',
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
    padding: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
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
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
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
},


  selectedStatusOptionText: {
    color: '#FF8447',
    fontFamily: 'LexendDeca_500Medium',
  },
});

export default TelecallerCallNoteDetails; 