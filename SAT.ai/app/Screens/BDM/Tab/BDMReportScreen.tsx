import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  FlatList
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import BDMMainLayout from '@/app/components/BDMMainLayout';
import { auth, db } from '@/firebaseConfig';
import { collection, addDoc, getDocs, query, where, Timestamp, orderBy, limit } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppGradient from "@/app/components/AppGradient";

// Manually specify Picker type since we may not have the npm package installed yet
// You should install @react-native-picker/picker package:
// npm install @react-native-picker/picker
// or
// yarn add @react-native-picker/picker
const Picker = require('@react-native-picker/picker').Picker;

interface ClosingDetail {
  productType: string[];
  closingAmount: number;
  description: string;
}

interface DailyReport {
  date: Date;
  numMeetings: number;
  meetingDuration: string;
  positiveLeads: number;
  closingDetails: ClosingDetail[];
  totalClosingAmount: number;
}

const BDMReportScreen = () => {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [numMeetings, setNumMeetings] = useState<string>("");
  const [meetingDuration, setMeetingDuration] = useState<string>("");
  const [positiveLeads, setPositiveLeads] = useState<string>("");
  const [closingDetails, setClosingDetails] = useState<ClosingDetail[]>([
    { productType: ["Health Insurance"], closingAmount: 0, description: "" }
  ]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  
  // Current date
  const [currentDate, setCurrentDate] = useState<string>("");
  
  // Product options
  const productOptions = [
    "Health Insurance",
    "Life Insurance",
    "Car Insurance",
    "Property Insurance",
    "Travel Insurance",
    "Investment Plans",
    "Mutual Funds",
    "Other"
  ];
  
  // Validation errors
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Selected products for multi-select UI
  const [selectedProducts, setSelectedProducts] = useState<{[key: number]: string[]}>({
    0: ["Health Insurance"] // Default product selection for first closing detail
  });

  // Add new state for product dropdown
  const [showProductDropdown, setShowProductDropdown] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<string[]>(productOptions);
  
  // Filter products based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProducts(productOptions);
    } else {
      const filtered = productOptions.filter(product => 
        product.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchQuery]);

  // Calculate total on closingDetails change
  useEffect(() => {
    const total = closingDetails.reduce((sum, detail) => {
      return sum + (Number(detail.closingAmount) || 0);
    }, 0);
    setTotalAmount(total);
  }, [closingDetails]);

  // Format current date on load
  useEffect(() => {
    const date = new Date();
    const day = date.getDate();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const month = monthNames[date.getMonth()];
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
    
    setCurrentDate(`${day} ${month} (${dayOfWeek})`);
  }, []);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    // Validate number of meetings
    if (!numMeetings.trim()) {
      newErrors.numMeetings = "Number of meetings is required";
    } else if (isNaN(Number(numMeetings)) || Number(numMeetings) < 0) {
      newErrors.numMeetings = "Please enter a valid number";
    }

    // Validate meeting duration
    if (!meetingDuration.trim()) {
      newErrors.meetingDuration = "Meeting duration is required";
    }

    // Validate positive leads
    if (!positiveLeads.trim()) {
      newErrors.positiveLeads = "Positive leads is required";
    } else if (isNaN(Number(positiveLeads)) || Number(positiveLeads) < 0) {
      newErrors.positiveLeads = "Please enter a valid positive number";
    }
    
    // Validate each closing detail
    closingDetails.forEach((detail, index) => {
      if (!detail.closingAmount) {
        newErrors[`closing_${index}_closingAmount`] = "Amount is required";
      }
      
      if (!detail.description.trim()) {
        newErrors[`closing_${index}_description`] = "Description is required";
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fill in all required fields");
      return;
    }
    
    try {
      setIsLoading(true);
      
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }
      
      const now = new Date();
      const reportData = {
        userId,
        date: Timestamp.fromDate(now),
        numMeetings: Number(numMeetings),
        meetingDuration,
        positiveLeads: Number(positiveLeads),
        closingDetails,
        totalClosingAmount: totalAmount,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      };
      
      // Add report to Firebase
      const docRef = await addDoc(collection(db, 'bdm_reports'), reportData);
      
      console.log("Report submitted with ID:", docRef.id);
      
      // Show success modal
      setModalVisible(true);
      setTimeout(() => {
        setModalVisible(false);
        // Clear form after successful submission
        setNumMeetings("");
        setMeetingDuration("");
        setPositiveLeads("");
        setClosingDetails([
          { productType: ["Health Insurance"], closingAmount: 0, description: "" }
        ]);
      }, 2000);
      
    } catch (error) {
      console.error("Error submitting report:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Add new closing detail
  const addClosingDetail = () => {
    setClosingDetails([
      ...closingDetails,
      { productType: ["Health Insurance"], closingAmount: 0, description: "" }
    ]);
  };

  // Remove closing detail at specific index
  const removeClosingDetail = (index: number) => {
    const newClosingDetails = closingDetails.filter((_, i) => i !== index);
    setClosingDetails(newClosingDetails);
  };

  // Update closing detail at specific index
  const updateClosingDetail = (index: number, field: keyof ClosingDetail, value: any) => {
    const newClosingDetails = [...closingDetails];
    if (field === 'closingAmount') {
      newClosingDetails[index] = {
        ...newClosingDetails[index],
        [field]: Number(value) || 0
      };
    } else {
      newClosingDetails[index] = {
        ...newClosingDetails[index],
        [field]: value
      };
    }
    setClosingDetails(newClosingDetails);
  };

  // Toggle product dropdown visibility
  const toggleProductDropdown = (index: number) => {
    setShowProductDropdown(showProductDropdown === index ? null : index);
  };

  // Toggle product selection in multi-select
  const toggleProductSelection = (index: number, product: string) => {
    const currentProducts = selectedProducts[index] || [];
    const newProducts = currentProducts.includes(product)
      ? currentProducts.filter(p => p !== product)
      : [...currentProducts, product];
    
    setSelectedProducts({
      ...selectedProducts,
      [index]: newProducts
    });

    // Update closing details with new product selection
    const newClosingDetails = [...closingDetails];
    newClosingDetails[index] = {
      ...newClosingDetails[index],
      productType: newProducts
    };
    setClosingDetails(newClosingDetails);
  };

  return (
    <AppGradient>
    <BDMMainLayout title="Daily Report" showBackButton>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
    <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.container}>
        <View style={styles.contentContainer}>
              {/* Date Header */}
              <Text style={styles.dateText}>{currentDate}</Text>
              
              {/* Meeting Information Section */}
              <View style={styles.section}>
                <Text style={styles.label}>Number of Meetings</Text>
                <TextInput
                  style={[
                    styles.input,
                    errors.numMeetings ? styles.inputError : null
                  ]}
                  placeholder="Enter number of meetings"
                  value={numMeetings}
                  onChangeText={(text) => {
                    setNumMeetings(text);
                    if (errors.numMeetings) {
                      const newErrors = {...errors};
                      delete newErrors.numMeetings;
                      setErrors(newErrors);
                    }
                  }}
                  keyboardType="numeric"
                />
                {errors.numMeetings && (
                  <Text style={styles.errorText}>{errors.numMeetings}</Text>
                )}

                <Text style={styles.label}>Meeting Duration</Text>
                <TextInput
                  style={[
                    styles.input,
                    errors.meetingDuration ? styles.inputError : null
                  ]}
                  placeholder="e.g., 1 hr 30 mins"
                  value={meetingDuration}
                  onChangeText={(text) => {
                    setMeetingDuration(text);
                    if (errors.meetingDuration) {
                      const newErrors = {...errors};
                      delete newErrors.meetingDuration;
                      setErrors(newErrors);
                    }
                  }}
                />
                {errors.meetingDuration && (
                  <Text style={styles.errorText}>{errors.meetingDuration}</Text>
                )}

                <Text style={styles.label}>
                  Prospective No. of Meetings <Text style={styles.requiredStar}>*</Text>
                </Text>
            <TextInput
                  style={[
                    styles.input,
                    errors.positiveLeads ? styles.inputError : null
                  ]}
              placeholder="0"
                  value={positiveLeads}
                  onChangeText={(text) => {
                    setPositiveLeads(text);
                    if (errors.positiveLeads) {
                      const newErrors = {...errors};
                      delete newErrors.positiveLeads;
                      setErrors(newErrors);
                    }
                  }}
              keyboardType="numeric"
            />
                {errors.positiveLeads && (
                  <Text style={styles.errorText}>{errors.positiveLeads}</Text>
                )}
              </View>
              
              {/* Separator */}
              <View style={styles.separator} />
              
              {/* Closing Details Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Closing Details</Text>
                
                {closingDetails.map((detail, index) => (
                  <View key={index} style={styles.closingDetailContainer}>
                    {index > 0 && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeClosingDetail(index)}
                      >
                        <MaterialIcons name="remove-circle" size={24} color="#FF5252" />
                      </TouchableOpacity>
                    )}
                    
                    <Text style={styles.label}>
                      Type of Product <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    
                    {/* Product Dropdown Button */}
                    <TouchableOpacity 
                      style={styles.dropdownButton}
                      onPress={() => toggleProductDropdown(index)}
                    >
                      <Text style={styles.dropdownButtonText}>
                        {selectedProducts[index]?.join(', ') || 'Select products'}
                      </Text>
                      <MaterialIcons 
                        name={showProductDropdown === index ? "arrow-drop-up" : "arrow-drop-down"} 
                        size={24} 
                        color="#666" 
                      />
                    </TouchableOpacity>
                    
                    {/* Product Dropdown Menu */}
                    {showProductDropdown === index && (
                      <View style={styles.dropdownContainer}>
                        <View style={styles.searchContainer}>
                          <TextInput
                            style={styles.searchInput}
                            placeholder="Search products..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                          />
                          <MaterialIcons name="search" size={20} color="#666" />
                        </View>
                        <FlatList
                          data={filteredProducts}
                          keyExtractor={(item) => item}
                          style={styles.dropdownList}
                          nestedScrollEnabled
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[
                                styles.dropdownItem,
                                (selectedProducts[index] || []).includes(item) 
                                  ? styles.dropdownItemSelected 
                                  : null
                              ]}
                              onPress={() => toggleProductSelection(index, item)}
                            >
                              <Text style={[
                                styles.dropdownItemText,
                                (selectedProducts[index] || []).includes(item) 
                                  ? styles.dropdownItemTextSelected 
                                  : null
                              ]}>
                                {item}
                              </Text>
                              {(selectedProducts[index] || []).includes(item) && (
                                <MaterialIcons name="check" size={18} color="#FF8447" />
                              )}
                            </TouchableOpacity>
                          )}
                          ListEmptyComponent={
                            <Text style={styles.noResultsText}>No products found</Text>
                          }
                        />
                        <TouchableOpacity 
                          style={styles.closeDropdownButton}
                          onPress={() => setShowProductDropdown(null)}
                        >
                          <Text style={styles.closeDropdownText}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    
                    <Text style={styles.label}>
                      Closing Amount <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <View style={styles.amountInputContainer}>
                      <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
                        style={[
                          styles.amountInput,
                          errors[`closing_${index}_closingAmount`] ? styles.inputError : null
                        ]}
                        placeholder="Enter Amount"
                        value={detail.closingAmount ? detail.closingAmount.toString() : ''}
                        onChangeText={(text) => 
                          updateClosingDetail(index, 'closingAmount', text)
                        }
              keyboardType="numeric"
            />
                    </View>
                    {errors[`closing_${index}_closingAmount`] && (
                      <Text style={styles.errorText}>
                        {errors[`closing_${index}_closingAmount`]}
                      </Text>
                    )}
                    
                    <Text style={styles.label}>Description Box</Text>
                    <TextInput
                      style={[
                        styles.textArea,
                        errors[`closing_${index}_description`] ? styles.inputError : null
                      ]}
                      placeholder="Enter description"
                      value={detail.description}
                      onChangeText={(text) => 
                        updateClosingDetail(index, 'description', text)
                      }
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                    {errors[`closing_${index}_description`] && (
                      <Text style={styles.errorText}>
                        {errors[`closing_${index}_description`]}
                      </Text>
                    )}
                  </View>
                ))}
                
                {/* Add Another Closing Button */}
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={addClosingDetail}
                >
                  <MaterialIcons name="add" size={24} color="#FF8447" />
                  <Text style={styles.addButtonText}>Add Another Closing</Text>
                </TouchableOpacity>
                
                {/* Total Closing Amount */}
                <View style={styles.totalContainer}>
                  <Text style={styles.totalLabel}>
                    Total Closing Amount <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.totalAmountContainer}>
                    <Text style={styles.totalCurrencySymbol}>₹</Text>
                    <Text style={styles.totalAmount}>
                      {totalAmount.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>

            {/* Submit Button */}
              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
              <Text style={styles.submitText}>Submit</Text>
                )}
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
        <Modal
          transparent={true}
          visible={modalVisible}
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            <MaterialIcons name="check-circle" size={60} color="#4CAF50" />
            <Text style={styles.modalTitle}>Report Submitted!</Text>
              <Text style={styles.modalSubtitle}>
              Your daily report has been successfully submitted.
              </Text>
            </View>
          </View>
        </Modal>
    </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    marginHorizontal: 10,
  },
  contentContainer: {
    padding: 20,
  },
  dateText: {
    fontSize: 20,
    color: "#FF8447",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "LexendDeca_500Medium",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#333",
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: "#4A4A4A",
    marginBottom: 8,
    fontFamily: "LexendDeca_500Medium",
    marginTop: 10,
  },
  requiredStar: {
    color: "#FF5252",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#F9F9F9",
    fontFamily: "LexendDeca_400Regular",
    fontSize: 16,
  },
  inputError: {
    borderColor: "#FF5252",
  },
  errorText: {
    color: "#FF5252",
    fontSize: 12,
    marginTop: 4,
    fontFamily: "LexendDeca_400Regular",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    backgroundColor: "#F9F9F9",
    marginBottom: 15,
  },
  picker: {
    height: 50,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    backgroundColor: "#F9F9F9",
    marginBottom: 15,
  },
  currencySymbol: {
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#4A4A4A",
    fontFamily: "LexendDeca_500Medium",
  },
  amountInput: {
    flex: 1,
    padding: 12,
    fontFamily: "LexendDeca_400Regular",
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#F9F9F9",
    fontFamily: "LexendDeca_400Regular",
    fontSize: 16,
    height: 100,
    marginBottom: 15,
  },
  separator: {
    height: 1,
    backgroundColor: "#EEEEEE",
    marginVertical: 20,
  },
  closingDetailContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 12,
    padding: 15,
    position: "relative",
  },
  removeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 1,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FF8447",
    borderRadius: 8,
    paddingVertical: 12,
    marginVertical: 10,
  },
  addButtonText: {
    color: "#FF8447",
    marginLeft: 8,
    fontFamily: "LexendDeca_500Medium",
    fontSize: 16,
  },
  totalContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#FFF5E6",
    borderRadius: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#333",
    marginBottom: 10,
  },
  totalAmountContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  totalCurrencySymbol: {
    fontSize: 20,
    color: "#4A4A4A",
    fontFamily: "LexendDeca_500Medium",
    marginRight: 4,
  },
  totalAmount: {
    fontSize: 24,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#FF8447",
  },
  submitButton: {
    backgroundColor: "#FF8447",
    borderRadius: 8,
    paddingVertical: 15,
    marginTop: 30,
    alignItems: "center",
    width: "100%",
  },
  submitText: {
    fontSize: 18,
    color: "#FFFFFF",
    fontFamily: "LexendDeca_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    width: "80%",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#333",
    marginTop: 15,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 16,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
    textAlign: "center",
    marginTop: 10,
  },
  productSelectionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  productButton: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 4,
  },
  productButtonSelected: {
    backgroundColor: '#FFF0E6',
    borderColor: '#FF8447',
  },
  productButtonText: {
    fontSize: 14,
    color: '#4A4A4A',
    fontFamily: "LexendDeca_400Regular",
  },
  productButtonTextSelected: {
    color: '#FF8447',
    fontFamily: "LexendDeca_500Medium",
  },
  // New dropdown styles
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    padding: 12,
    marginBottom: 15,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'LexendDeca_400Regular',
    flex: 1,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    padding: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 8,
    fontFamily: 'LexendDeca_400Regular',
  },
  dropdownList: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownItemSelected: {
    backgroundColor: '#FFF8F0',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'LexendDeca_400Regular',
  },
  dropdownItemTextSelected: {
    color: '#FF8447',
    fontFamily: 'LexendDeca_500Medium',
  },
  noResultsText: {
    padding: 16,
    textAlign: 'center',
    color: '#999',
    fontFamily: 'LexendDeca_400Regular',
  },
  closeDropdownButton: {
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    backgroundColor: '#FAFAFA',
  },
  closeDropdownText: {
    fontSize: 16,
    color: '#FF8447',
    fontFamily: 'LexendDeca_500Medium',
  },
  readOnlyInputContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F5F5F5',
    marginBottom: 15,
  },
  readOnlyText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
});

export default BDMReportScreen;