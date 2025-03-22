import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Image } from "expo-image";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import { LinearGradient } from 'expo-linear-gradient';
import { Chip, Button } from 'react-native-paper'; 
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { auth } from '@/firebaseConfig';
import api from '@/app/services/api';
import AppGradient from "@/app/components/AppGradient";
import { getTargets } from '@/app/services/targetService';
import { format } from 'date-fns';

const PRODUCT_LIST = [
  { label: 'Car Insurance', value: 'car_insurance' },
  { label: 'Bike Insurance', value: 'bike_insurance' },
  { label: 'Health Insurance', value: 'health_insurance' },
  { label: 'Term Insurance', value: 'term_insurance' },
  { label: 'Saving Plan', value: 'saving_plan' },
  { label: 'Travel Insurance', value: 'travel_insurance' },
  { label: 'Group Mediclaim', value: 'group_mediclaim' },
  { label: 'Other', value: 'other' },
];

interface ClosingDetail {
  selectedProducts: string[];
  otherProduct: string;
  amount: string;
  description: string;
  showOtherInput: boolean;
}

const ReportScreen: React.FC = () => {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const [numMeetings, setNumMeetings] = useState('');
  const [meetingDuration, setMeetingDuration] = useState('');
  const [positiveLeads, setPositiveLeads] = useState('');
  const [closingDetails, setClosingDetails] = useState<ClosingDetail[]>([{
    selectedProducts: [],
    otherProduct: '',
    amount: '',
    description: '',
    showOtherInput: false
  }]);
  const [totalClosingAmount, setTotalClosingAmount] = useState(0);
  const [dropdownVisible, setDropdownVisible] = useState<number | null>(null); // Track which dropdown is open
  const currentDate = new Date();
  const formattedDate = format(currentDate, 'dd MMMM (EEEE)');

  const handleSubmit = async () => {
    try {
      if (!auth.currentUser) {
        Alert.alert('Error', 'Please login first');
        return;
      }

      // Validate required fields
      if (!numMeetings || !meetingDuration || !positiveLeads) {
        Alert.alert('Error', 'Please fill all required fields');
        return;
      }

      // Validate closing details
      const validClosingDetails = closingDetails.filter(detail => 
        detail.selectedProducts.length > 0 && detail.amount
      );

      if (closingDetails.length > 0 && validClosingDetails.length === 0) {
        Alert.alert('Error', 'Please complete all closing details or remove them');
        return;
      }

      // Parse the meeting duration to extract hours and minutes
      const durationStr = meetingDuration;
      const hourMatch = durationStr.match(/(\d+)\s*hr/);
      const minMatch = durationStr.match(/(\d+)\s*min/);
      
      const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
      const mins = minMatch ? parseInt(minMatch[1]) : 0;
      
      const durationInHours = hours + (mins / 60);

      // Calculate percentage achievement based on targets
      const targets = getTargets();
      const positiveLeadsPercentage = (parseInt(positiveLeads) / targets.positiveLeads) * 100;
      const numCallsPercentage = (parseInt(numMeetings) / targets.numCalls) * 100;
      const durationPercentage = (durationInHours / targets.callDuration) * 100;
      const closingPercentage = (totalClosingAmount / targets.closingAmount) * 100;
      
      // Calculate overall achievement percentage
      const percentageAchieved = (
        positiveLeadsPercentage + 
        numCallsPercentage + 
        durationPercentage + 
        closingPercentage
      ) / 4;

      // Format data for database
      const reportData = {
        userId: auth.currentUser.uid,
        date: new Date(),
        numMeetings: parseInt(numMeetings),
        meetingDuration,
        positiveLeads: parseInt(positiveLeads),
        closingDetails: validClosingDetails.map(detail => ({
          products: detail.selectedProducts,
          otherProduct: detail.otherProduct,
          amount: parseInt(detail.amount.replace(/[^0-9]/g, '')),
          description: detail.description
        })),
        totalClosingAmount,
        durationInHours, // Store parsed duration in hours
        // Store achievement percentages
        positiveLeadsPercentage: parseFloat(positiveLeadsPercentage.toFixed(1)),
        numCallsPercentage: parseFloat(numCallsPercentage.toFixed(1)),
        durationPercentage: parseFloat(durationPercentage.toFixed(1)),
        closingPercentage: parseFloat(closingPercentage.toFixed(1)),
        percentageAchieved: parseFloat(percentageAchieved.toFixed(1))
      };

      // Set loading state or show spinner here if needed
      const result = await api.saveDailyReport(auth.currentUser.uid, reportData);
      
      if (result.success) {
        setModalVisible(true);
        setTimeout(() => {
          setModalVisible(false);
          // Reset form
          setNumMeetings('');
          setMeetingDuration('');
          setPositiveLeads('');
          setClosingDetails([{
            selectedProducts: [],
            otherProduct: '',
            amount: '',
            description: '',
            showOtherInput: false
          }]);
          setTotalClosingAmount(0);
          
          // Alert user that data will be reflected in reports after processing
          Alert.alert(
            'Report Submitted',
            'Your data has been saved. It may take a moment to reflect in your target and report screens.',
            [{ text: 'OK' }]
          );
        }, 3000);
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert(
        'Error',
        'Failed to save report. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleAddClosing = () => {
    setClosingDetails([...closingDetails, { selectedProducts: [], otherProduct: '', amount: '', description: '', showOtherInput: false }]);
  };

  const updateClosingDetail = (index: number, field: keyof ClosingDetail, value: any) => {
    const newClosingDetails = [...closingDetails];

    if (field === 'selectedProducts') {
      const hasOther = value.includes('other');
      newClosingDetails[index] = {
        ...newClosingDetails[index],
        selectedProducts: value,
        showOtherInput: hasOther
      };
    } else if (field === 'amount') {
      const numericValue = value.replace(/[^0-9]/g, '');
      newClosingDetails[index] = {
        ...newClosingDetails[index],
        amount: numericValue ? `₹${parseInt(numericValue).toLocaleString()}` : ''
      };

      const total = newClosingDetails.reduce((sum, detail) => {
        const amt = detail.amount?.replace(/[^0-9]/g, '') || '0';
        return sum + parseInt(amt);
      }, 0);
      setTotalClosingAmount(total);
    } else {
      newClosingDetails[index] = {
        ...newClosingDetails[index],
        [field]: value
      };
    }

    setClosingDetails(newClosingDetails);
  };

  const toggleProductSelection = (index: number, productValue: string) => {
    const selectedProducts = [...closingDetails[index].selectedProducts];
    const productIndex = selectedProducts.indexOf(productValue);

    if (productIndex === -1) {
      selectedProducts.push(productValue); // Add product
    } else {
      selectedProducts.splice(productIndex, 1); // Remove product
    }

    updateClosingDetail(index, 'selectedProducts', selectedProducts);
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
        
          <View style={styles.header}>
            {/* Header content */}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.dateText}>{formattedDate}</Text>
            <Text style={styles.label}>Number of Calls</Text>
            <TextInput
              style={styles.input}
              value={numMeetings}
              onChangeText={setNumMeetings}
              keyboardType="numeric"
              placeholder="12"
            />

            <Text style={styles.label}>Call Duration</Text>
            <TextInput
              style={styles.input}
              value={meetingDuration}
              onChangeText={setMeetingDuration}
              placeholder="1 hr 20 mins"
            />

            <Text style={styles.label}>Positive Leads</Text>
            <TextInput
              style={styles.input}
              value={positiveLeads}
              onChangeText={setPositiveLeads}
              placeholder="Enter Positive Leads"
            />

            {/* Closing Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Closing Details</Text>

              {closingDetails.map((detail, index) => (
                <View key={index} style={styles.closingItem}>
                  <Text style={styles.label}>Type of Product <Text style={styles.required}>*</Text></Text>

                  {/* Dropdown Trigger */}
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setDropdownVisible(dropdownVisible === index ? null : index)}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {detail.selectedProducts.length > 0
                        ? detail.selectedProducts.map(val => PRODUCT_LIST.find(p => p.value === val)?.label).join(', ')
                        : 'Select Product(s)'}
                    </Text>
                    <Ionicons name={dropdownVisible === index ? "chevron-up" : "chevron-down"} size={20} color="#666" />
                  </TouchableOpacity>

                  {/* Chip Selection Menu */}
                  {dropdownVisible === index && (
                    <View style={styles.chipContainer}>
                      {PRODUCT_LIST.map((product) => (
                        <Chip
                          key={product.value}
                          mode="outlined"
                          selected={detail.selectedProducts.includes(product.value)}
                          onPress={() => toggleProductSelection(index, product.value)}
                          style={styles.chip}
                          selectedColor="#FF8447"
                        >
                          {product.label}
                        </Chip>
                      ))}
                    </View>
                  )}

                  {/* Other Product Input - Show when 'other' is selected */}
                  {detail.showOtherInput && (
                    <View style={styles.otherProductContainer}>
                      <TextInput
                        style={[styles.input, styles.otherInput]}
                        value={detail.otherProduct}
                        onChangeText={(text) => updateClosingDetail(index, 'otherProduct', text)}
                        placeholder="Enter other product name"
                      />
                    </View>
                  )}

                  <Text style={styles.label}>Closing Amount <Text style={styles.required}>*</Text></Text>
                  <TextInput
                    style={styles.input}
                    value={detail.amount}
                    onChangeText={(value) => updateClosingDetail(index, 'amount', value)}
                    keyboardType="numeric"
                    placeholder="₹ 50,000"
                  />

                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={detail.description}
                    onChangeText={(value) => updateClosingDetail(index, 'description', value)}
                    multiline
                    numberOfLines={4}
                    placeholder="Sold Health Insurance, they want to discuss more"
                  />
                </View>
              ))}

              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddClosing}
              >
                <Text style={styles.addButtonText}>+ Add Another Closing</Text>
              </TouchableOpacity>
            </View>

            {/* Total Amount */}
            <View style={styles.section}>
              <Text style={styles.label}>Total Closing Amount <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={`₹ ${totalClosingAmount.toLocaleString()}`}
                editable={false}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              style={styles.submitButton}
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

          {/* Popup Modal */}
          <Modal
            transparent={true}
            visible={modalVisible}
            animationType="fade"
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.backButton}
                >
                  <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>

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
        </KeyboardAwareScrollView>
      </View>
    </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    
    padding: 20,
  },
  backButton: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#000",
    textAlign: "center",
    flex: 1,
  },
  dateText: {
    fontSize: 20,
    color: "#FF8447",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "LexendDeca_500Medium",
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
  submitButton: {
    marginTop: 20,
    marginBottom: 40,
    width: '100%',
    alignSelf: "center",
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#FF8447',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    height: 56,
  },
  submitGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    fontSize: 18,
    color: "#fff",
    fontFamily: "LexendDeca_600SemiBold",
    textAlign: "center",
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
    height: 400,
    elevation: 10,
    justifyContent: "center",
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 16,
  },
  closingItem: {
    marginBottom: 24,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    backgroundColor: "#f9f9f9",
  },
  dropdownTriggerText: {
    fontSize: 14,
    color: '#666',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  chip: {
    margin: 4,
  },
  addButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF8447',
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: '#FF8447',
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  required: {
    color: '#FF0000',
  },
  otherProductContainer: {
    marginBottom: 16,
  },
  otherInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    backgroundColor: "#f9f9f9",
  },
});

export default ReportScreen;