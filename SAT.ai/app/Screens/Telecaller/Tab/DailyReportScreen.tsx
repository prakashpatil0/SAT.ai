import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Image } from "expo-image";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import { LinearGradient } from 'expo-linear-gradient';
import { Chip } from 'react-native-paper';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { auth, db } from '@/firebaseConfig';
import { collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/app/services/api';
import AppGradient from "@/app/components/AppGradient";
import { getTargets } from '@/app/services/targetService';
import { format, startOfDay, endOfDay } from 'date-fns';

const PRODUCT_LIST = [
  { label: 'Health Insurance', value: 'health_insurance' },
  { label: 'Bike Insurance', value: 'bike_insurance' },
  { label: 'Car Insurance', value: 'car_insurance' },
  { label: 'Term Insurance', value: 'term_insurance' },
  { label: 'Saving Plans', value: 'saving_plan' },
  { label: 'Travel Insurance', value: 'travel_insurance' },
  { label: 'Group Mediclaim', value: 'group_mediclaim' },
  { label: 'Group Personal Accident', value: 'group_personal_accident' },
  { label: 'Group Term Life', value: 'group_term_life' },
  { label: 'Group Credit Life', value: 'group_credit_life' },
  { label: 'Workmen Compensation', value: 'workmen_compensation' },
  { label: 'Group Gratuity', value: 'group_gratuity' },
  { label: 'Fire & Burglary Insurance', value: 'fire_burglary_insurance' },
  { label: 'Shop Owner Insurance', value: 'shop_owner_insurance' },
  { label: 'Motor Fleet Insurance', value: 'motor_fleet_insurance' },
  { label: 'Marine Single Transit', value: 'marine_single_transit' },
  { label: 'Marine Open Policy', value: 'marine_open_policy' },
  { label: 'Marine Sales Turnover', value: 'marine_sales_turnover' },
  { label: 'Directors & Officers Insurance', value: 'directors_officers_insurance' },
  { label: 'General Liability Insurance', value: 'general_liability_insurance' },
  { label: 'Product Liability Insurance', value: 'product_liability_insurance' },
  { label: 'Professional Indemnity for Doctors', value: 'professional_indemnity_for_doctors' },
  { label: 'Professional Indemnity for Companies', value: 'professional_indemnity_for_companies' },
  { label: 'Cyber Insurance', value: 'cyber_insurance' },
  { label: 'Office Package Policy', value: 'office_package_policy' },
  { label: 'Crime Insurance', value: 'crime_insurance' },
  { label: 'Other', value: 'other' },
];

interface ClosingDetail {
  selectedProducts: string[];
  otherProduct: string;
  amount: string;
  description: string;
  showOtherInput: boolean;
}

interface DailyReport {
  date: Date;
  numMeetings: number;
  meetingDuration: string;
  positiveLeads: number;
  rejectedLeads: number;
  notAttendedCalls: number;
  closingLeads: number;
  closingDetails: ClosingDetail[];
  totalClosingAmount: number;
}

const STORAGE_KEYS = {
  DRAFT_REPORT: 'telecaller_report_draft',
  LAST_REPORT: 'telecaller_last_report'
};

const ReportScreen: React.FC = () => {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const [numMeetings, setNumMeetings] = useState('');
  const [meetingDuration, setMeetingDuration] = useState('');
  const [positiveLeads, setPositiveLeads] = useState('');
  const [rejectedLeads, setRejectedLeads] = useState('');
  const [notAttendedCalls, setNotAttendedCalls] = useState('');
  const [closingLeads, setClosingLeads] = useState('');
  const [closingDetails, setClosingDetails] = useState<ClosingDetail[]>([{
    selectedProducts: [],
    otherProduct: '',
    amount: '',
    description: '',
    showOtherInput: false
  }]);
  const [totalClosingAmount, setTotalClosingAmount] = useState(0);
  const [dropdownVisible, setDropdownVisible] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState(PRODUCT_LIST);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [todayCalls, setTodayCalls] = useState(0);
  const [todayDuration, setTodayDuration] = useState(0);

  // Filter products based on search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProducts(PRODUCT_LIST);
    } else {
      const filtered = PRODUCT_LIST.filter(product => 
        product.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchQuery]);

  // Load draft data on mount
  useEffect(() => {
    loadDraftData();
  }, []);

  // Auto-save draft
  useEffect(() => {
    const autoSaveTimer = setTimeout(saveDraftData, 1000);
    return () => clearTimeout(autoSaveTimer);
  }, [numMeetings, meetingDuration, positiveLeads, rejectedLeads, notAttendedCalls, closingLeads, closingDetails]);

  // Add function to fetch today's call data
  const fetchTodayCallData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log('No user ID found');
        return;
      }

      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      // First try to get from AsyncStorage
      const storedLogs = await AsyncStorage.getItem('device_call_logs');
      const lastUpdate = await AsyncStorage.getItem('call_logs_last_update');
      const now = Date.now();

      if (storedLogs && lastUpdate && (now - parseInt(lastUpdate)) < 5 * 60 * 1000) {
        // Use stored logs if they're recent
        const parsedLogs = JSON.parse(storedLogs);
        const todayLogs = parsedLogs.filter((log: any) => {
          const logDate = new Date(log.timestamp);
          return logDate >= startOfToday && logDate <= endOfToday;
        });

        let totalCalls = 0;
        let totalDuration = 0;

        todayLogs.forEach((log: any) => {
          if (log.status === 'completed') {
            totalCalls++;
            if (log.duration) {
              totalDuration += Number(log.duration);
            }
          }
        });

        setTodayCalls(totalCalls);
        setTodayDuration(totalDuration);
        setNumMeetings(totalCalls.toString());
        setMeetingDuration(formatDuration(totalDuration));
        return;
      }

      // If no recent stored logs, fetch from Firebase
      const callLogsRef = collection(db, 'callLogs');
      const q = query(
        callLogsRef,
        where('userId', '==', userId),
        where('timestamp', '>=', startOfToday),
        where('timestamp', '<=', endOfToday)
      );

      const querySnapshot = await getDocs(q);
      console.log('Total documents found:', querySnapshot.size);

      let totalCalls = 0;
      let totalDuration = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'completed') {
          totalCalls++;
          if (data.duration) {
            totalDuration += Number(data.duration);
          }
        }
      });

      console.log('Calculated totals:', {
        totalCalls,
        totalDuration,
        formattedDuration: formatDuration(totalDuration)
      });

      // Update state with fetched data
      setTodayCalls(totalCalls);
      setTodayDuration(totalDuration);
      setNumMeetings(totalCalls.toString());
      setMeetingDuration(formatDuration(totalDuration));

    } catch (error) {
      console.error('Error fetching today\'s call data:', error);
      Alert.alert('Error', 'Failed to fetch today\'s call data');
    }
  };

  // Add useEffect to fetch call data on mount and periodically
  useEffect(() => {
    // Fetch immediately on mount
    fetchTodayCallData();
    
    // Set up interval to fetch every 30 seconds
    const interval = setInterval(fetchTodayCallData, 30000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  // Format duration to HH:mm:ss format
  const formatDuration = (seconds: number) => {
    if (!seconds) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const saveDraftData = async () => {
    try {
      const draftData = {
        numMeetings,
        meetingDuration,
        positiveLeads,
        rejectedLeads,
        notAttendedCalls,
        closingLeads,
        closingDetails,
        totalClosingAmount
      };
      await AsyncStorage.setItem(STORAGE_KEYS.DRAFT_REPORT, JSON.stringify(draftData));
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  };

  const loadDraftData = async () => {
    try {
      const draftDataString = await AsyncStorage.getItem(STORAGE_KEYS.DRAFT_REPORT);
      if (draftDataString) {
        const draftData = JSON.parse(draftDataString);
        setNumMeetings(draftData.numMeetings || '');
        setMeetingDuration(draftData.meetingDuration || '');
        setPositiveLeads(draftData.positiveLeads || '');
        setRejectedLeads(draftData.rejectedLeads || '');
        setNotAttendedCalls(draftData.notAttendedCalls || '');
        setClosingLeads(draftData.closingLeads || '');
        setClosingDetails(draftData.closingDetails || [{
          selectedProducts: [],
          otherProduct: '',
          amount: '',
          description: '',
          showOtherInput: false
        }]);
        setTotalClosingAmount(draftData.totalClosingAmount || 0);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    if (!numMeetings.trim()) {
      newErrors.numMeetings = "Number of calls is required";
    } else if (isNaN(Number(numMeetings)) || Number(numMeetings) < 0) {
      newErrors.numMeetings = "Please enter a valid number";
    }

    if (!meetingDuration.trim()) {
      newErrors.meetingDuration = "Call duration is required";
    }

    if (!positiveLeads.trim()) {
      newErrors.positiveLeads = "Positive leads is required";
    } else if (isNaN(Number(positiveLeads)) || Number(positiveLeads) < 0) {
      newErrors.positiveLeads = "Please enter a valid number";
    }

    if (!rejectedLeads.trim()) {
      newErrors.rejectedLeads = "Rejected leads is required";
    } else if (isNaN(Number(rejectedLeads)) || Number(rejectedLeads) < 0) {
      newErrors.rejectedLeads = "Please enter a valid number";
    }

    if (!notAttendedCalls.trim()) {
      newErrors.notAttendedCalls = "Not attended calls is required";
    } else if (isNaN(Number(notAttendedCalls)) || Number(notAttendedCalls) < 0) {
      newErrors.notAttendedCalls = "Please enter a valid number";
    }

    if (!closingLeads.trim()) {
      newErrors.closingLeads = "Closing leads is required";
    } else if (isNaN(Number(closingLeads)) || Number(closingLeads) < 0) {
      newErrors.closingLeads = "Please enter a valid number";
    }
    
    closingDetails.forEach((detail, index) => {
      if (detail.selectedProducts.length === 0) {
        newErrors[`closing_${index}_products`] = "Please select at least one product";
      }
      if (!detail.amount.trim()) {
        newErrors[`closing_${index}_amount`] = "Amount is required";
      }
      if (!detail.description.trim()) {
        newErrors[`closing_${index}_description`] = "Description is required";
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }

    try {
      if (!auth.currentUser) {
        Alert.alert('Error', 'Please login first');
        return;
      }

      const now = new Date();
      const reportData = {
        userId: auth.currentUser.uid,
        date: Timestamp.fromDate(now),
        numMeetings: parseInt(numMeetings),
        meetingDuration,
        positiveLeads: parseInt(positiveLeads),
        rejectedLeads: parseInt(rejectedLeads),
        notAttendedCalls: parseInt(notAttendedCalls),
        closingLeads: parseInt(closingLeads),
        closingDetails: closingDetails.map(detail => ({
          products: detail.selectedProducts,
          otherProduct: detail.otherProduct,
          amount: parseInt(detail.amount.replace(/[^0-9]/g, '')),
          description: detail.description
        })),
        totalClosingAmount,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      };

      // Save to Firebase
      const docRef = await addDoc(collection(db, 'telecaller_reports'), reportData);
      
      // Save as last report in AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_REPORT, JSON.stringify(reportData));
      
      // Clear draft after successful submission
      await AsyncStorage.removeItem(STORAGE_KEYS.DRAFT_REPORT);

      setModalVisible(true);
      setTimeout(() => {
        setModalVisible(false);
        // Reset form
        setNumMeetings('');
        setMeetingDuration('');
        setPositiveLeads('');
        setRejectedLeads('');
        setNotAttendedCalls('');
        setClosingLeads('');
        setClosingDetails([{
          selectedProducts: [],
          otherProduct: '',
          amount: '',
          description: '',
          showOtherInput: false
        }]);
        setTotalClosingAmount(0);
      }, 2000);

    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  const toggleProductSelection = (index: number, productValue: string, isDeselect: boolean = false) => {
    const newClosingDetails = [...closingDetails];
    const selectedProducts = [...newClosingDetails[index].selectedProducts];
    
    if (isDeselect) {
      const productIndex = selectedProducts.indexOf(productValue);
      if (productIndex !== -1) {
        selectedProducts.splice(productIndex, 1);
      }
    } else {
      const productIndex = selectedProducts.indexOf(productValue);
      if (productIndex === -1) {
        selectedProducts.push(productValue);
      } else {
        selectedProducts.splice(productIndex, 1);
      }
    }

    newClosingDetails[index] = {
      ...newClosingDetails[index],
      selectedProducts,
      showOtherInput: selectedProducts.includes('other')
    };

    setClosingDetails(newClosingDetails);
  };

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBackButton={true} title="Daily Report">
        <View style={styles.container}>
          <KeyboardAwareScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
          >
            <View style={styles.inputContainer}>
              <Text style={styles.dateText}>{format(new Date(), 'dd MMMM (EEEE)')}</Text>
              
              {/* Number of Calls - Read Only */}
              <Text style={styles.label}>Number of Calls</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>{todayCalls}</Text>
              </View>

              {/* Call Duration - Read Only */}
              <Text style={styles.label}>Call Duration</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>{formatDuration(todayDuration)}</Text>
              </View>

              <Text style={styles.label}>Positive Leads</Text>
              <TextInput
                style={[styles.input, errors.positiveLeads && styles.inputError]}
                value={positiveLeads}
                onChangeText={setPositiveLeads}
                keyboardType="numeric"
                placeholder="0"
              />
              {errors.positiveLeads && (
                <Text style={styles.errorText}>{errors.positiveLeads}</Text>
              )}

              <Text style={styles.label}>Rejected Leads</Text>
              <TextInput
                style={[styles.input, errors.rejectedLeads && styles.inputError]}
                value={rejectedLeads}
                onChangeText={setRejectedLeads}
                keyboardType="numeric"
                placeholder="0"
              />
              {errors.rejectedLeads && (
                <Text style={styles.errorText}>{errors.rejectedLeads}</Text>
              )}

              <Text style={styles.label}>Not Attended Calls</Text>
              <TextInput
                style={[styles.input, errors.notAttendedCalls && styles.inputError]}
                value={notAttendedCalls}
                onChangeText={setNotAttendedCalls}
                keyboardType="numeric"
                placeholder="0"
              />
              {errors.notAttendedCalls && (
                <Text style={styles.errorText}>{errors.notAttendedCalls}</Text>
              )}

              <Text style={styles.label}>Closing Leads</Text>
              <TextInput
                style={[styles.input, errors.closingLeads && styles.inputError]}
                value={closingLeads}
                onChangeText={setClosingLeads}
                keyboardType="numeric"
                placeholder="0"
              />
              {errors.closingLeads && (
                <Text style={styles.errorText}>{errors.closingLeads}</Text>
              )}

              {/* Closing Details */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Closing Details</Text>

                {closingDetails.map((detail, index) => (
                  <View key={index} style={styles.closingItem}>
                    <Text style={styles.label}>Type of Product <Text style={styles.required}>*</Text></Text>

                    {/* Product Selection */}
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => setDropdownVisible(dropdownVisible === index ? null : index)}
                    >
                      <Text style={styles.dropdownTriggerText}>
                        {detail.selectedProducts.length > 0
                          ? detail.selectedProducts.map(val => 
                              PRODUCT_LIST.find(p => p.value === val)?.label
                            ).join(', ')
                          : 'Select Product(s)'}
                      </Text>
                      <Ionicons 
                        name={dropdownVisible === index ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color="#666" 
                      />
                    </TouchableOpacity>

                    {/* Product Dropdown */}
                    {dropdownVisible === index && (
                      <View style={styles.dropdownContainer}>
                        <View style={styles.searchContainer}>
                          <TextInput
                            style={styles.searchInput}
                            placeholder="Search products..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                          />
                          <Ionicons name="search" size={20} color="#666" />
                        </View>
                        <FlatList
                          data={filteredProducts}
                          keyExtractor={(item) => item.value}
                          style={styles.dropdownList}
                          nestedScrollEnabled
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[
                                styles.dropdownItem,
                                detail.selectedProducts.includes(item.value) && styles.dropdownItemSelected
                              ]}
                              onPress={() => toggleProductSelection(index, item.value)}
                            >
                              <Text style={[
                                styles.dropdownItemText,
                                detail.selectedProducts.includes(item.value) && styles.dropdownItemTextSelected
                              ]}>
                                {item.label}
                              </Text>
                              {detail.selectedProducts.includes(item.value) && (
                                <TouchableOpacity
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    toggleProductSelection(index, item.value, true);
                                  }}
                                  style={styles.closeIcon}
                                >
                                  <Ionicons name="close" size={18} color="#FFFFFF" />
                                </TouchableOpacity>
                              )}
                            </TouchableOpacity>
                          )}
                        />
                      </View>
                    )}
                    {errors[`closing_${index}_products`] && (
                      <Text style={styles.errorText}>{errors[`closing_${index}_products`]}</Text>
                    )}

                    {/* Other fields */}
                    <Text style={styles.label}>Closing Amount <Text style={styles.required}>*</Text></Text>
                    <View style={styles.amountInputContainer}>
                      <Text style={styles.currencySymbol}>₹</Text>
                      <TextInput
                        style={[
                          styles.amountInput,
                          errors[`closing_${index}_amount`] && styles.inputError
                        ]}
                        value={detail.amount}
                        onChangeText={(text) => {
                          const newDetails = [...closingDetails];
                          newDetails[index] = { ...detail, amount: text };
                          setClosingDetails(newDetails);
                          
                          // Update total amount
                          const total = newDetails.reduce((sum, d) => {
                            const amount = parseInt(d.amount.replace(/[^0-9]/g, '')) || 0;
                            return sum + amount;
                          }, 0);
                          setTotalClosingAmount(total);
                        }}
                        keyboardType="numeric"
                        placeholder="Enter Amount"
                      />
                    </View>
                    {errors[`closing_${index}_amount`] && (
                      <Text style={styles.errorText}>{errors[`closing_${index}_amount`]}</Text>
                    )}

                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={[
                        styles.textArea,
                        errors[`closing_${index}_description`] && styles.inputError
                      ]}
                      value={detail.description}
                      onChangeText={(text) => {
                        const newDetails = [...closingDetails];
                        newDetails[index] = { ...detail, description: text };
                        setClosingDetails(newDetails);
                      }}
                      multiline
                      numberOfLines={4}
                      placeholder="Enter description product wise, if multiple products are selected"
                    />
                    {errors[`closing_${index}_description`] && (
                      <Text style={styles.errorText}>{errors[`closing_${index}_description`]}</Text>
                    )}
                  </View>
                ))}

                {/* Add More Button */}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setClosingDetails([...closingDetails, {
                    selectedProducts: [],
                    otherProduct: '',
                    amount: '',
                    description: '',
                    showOtherInput: false
                  }])}
                >
                  <Text style={styles.addButtonText}>+ Add Another Closing</Text>
                </TouchableOpacity>
              </View>

              {/* Total Amount */}
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total Closing Amount</Text>
                <Text style={styles.totalAmount}>₹ {totalClosingAmount.toLocaleString()}</Text>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
              >
                <LinearGradient
                  colors={['#FF8447', '#FF6D24']}
                  style={styles.submitGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.submitText}>Submit Report</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </View>

        {/* Success Modal */}
        <Modal
          transparent={true}
          visible={modalVisible}
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Image
                source={require("@/assets/images/mail.gif")}
                style={styles.gif}
                contentFit="contain"
              />
              <Text style={styles.modalTitle}>Report Submitted Successfully!</Text>
              <Text style={styles.modalSubtitle}>
                Your report has been recorded. Keep up the great work!
              </Text>
            </View>
          </View>
        </Modal>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  inputContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dateText: {
    fontSize: 20,
    color: "#FF8447",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "LexendDeca_500Medium",
  },
  label: {
    fontSize: 14,
    color: "#4A4A4A",
    marginBottom: 8,
    fontFamily: "LexendDeca_500Medium",
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    backgroundColor: "#f9f9f9",
  },
  inputError: {
    borderColor: "#FF5252",
  },
  errorText: {
    color: "#FF5252",
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    color: "#333",
    fontFamily: "LexendDeca_600SemiBold",
    marginBottom: 15,
  },
  closingItem: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
  },
  required: {
    color: "#FF5252",
  },
  dropdownTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  dropdownTriggerText: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  dropdownContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
    elevation: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  searchInput: {
    flex: 1,
    marginRight: 8,
    padding: 8,
  },
  dropdownList: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 20,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  dropdownItemSelected: {
    backgroundColor: "#FF8447",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: "#FFFFFF",
  },
  closeIcon: {
    marginLeft: 8,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  currencySymbol: {
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#666",
  },
  amountInput: {
    flex: 1,
    padding: 12,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    height: 100,
    textAlignVertical: "top",
  },
  addButton: {
    marginTop: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FF8447",
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: {
    color: "#FF8447",
    fontSize: 14,
    fontFamily: "LexendDeca_500Medium",
  },
  totalContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#FFF5E6",
    borderRadius: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: "#333",
    fontFamily: "LexendDeca_600SemiBold",
  },
  totalAmount: {
    fontSize: 24,
    color: "#FF8447",
    fontFamily: "LexendDeca_600SemiBold",
    marginTop: 8,
  },
  submitButton: {
    marginTop: 30,
    marginBottom: 40,
    height: 56,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#FF8447",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  submitGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  submitText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    width: "80%",
    elevation: 5,
  },
  gif: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    color: "#FF8447",
    fontFamily: "LexendDeca_600SemiBold",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#666",
    fontFamily: "LexendDeca_400Regular",
    textAlign: "center",
    marginTop: 10,
  },
  readOnlyInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    backgroundColor: "#f5f5f5",
  },
  readOnlyText: {
    fontSize: 16,
    color: "#333",
    fontFamily: "LexendDeca_500Medium",
  },
});

export default ReportScreen;