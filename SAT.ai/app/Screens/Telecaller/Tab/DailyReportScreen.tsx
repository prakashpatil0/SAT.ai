import React, { useState, useEffect, useRef } from "react";
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
  Animated,
  Easing,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Image } from "expo-image";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import { LinearGradient } from "expo-linear-gradient";
import { Chip } from "react-native-paper";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { auth, db } from "@/firebaseConfig";
import { MaterialIcons } from "@expo/vector-icons";

import {
  collection,
  addDoc,
  Timestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "@/app/services/api";
import AppGradient from "@/app/components/AppGradient";
import { getTargets } from "@/app/services/targetService";
import { format, startOfDay, endOfDay } from "date-fns";
import { doc, getDoc } from "firebase/firestore";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

interface ClosingDetail {
  selectedProduct: string;
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
  DRAFT_REPORT: "telecaller_report_draft",
  LAST_REPORT: "telecaller_last_report",
};

const ReportScreen: React.FC = () => {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const [numMeetings, setNumMeetings] = useState("");
  const [meetingDuration, setMeetingDuration] = useState("");
  const [positiveLeads, setPositiveLeads] = useState("");
  const [rejectedLeads, setRejectedLeads] = useState("");
  const [notAttendedCalls, setNotAttendedCalls] = useState("");
  const [closingLeads, setClosingLeads] = useState("");
  const [closingDetails, setClosingDetails] = useState<ClosingDetail[]>([
    {
      selectedProduct: "",
      otherProduct: "",
      amount: "",
      description: "",
      showOtherInput: false,
    },
  ]);
  const resetForm = () => {
    // Reset all form field values
    setPositiveLeads("");
    setRejectedLeads("");
    setNotAttendedCalls("");
    setClosingLeads("");

    // Reset closingDetails array
    setClosingDetails([
      {
        selectedProduct: "",
        otherProduct: "",
        amount: "",
        description: "",
        showOtherInput: false,
      },
    ]);

    // Reset error states
    setErrors({
      positiveLeads: "",
      rejectedLeads: "",
      notAttendedCalls: "",
      closingLeads: "",
      [`closing_0_amount`]: "",
      [`closing_0_description`]: "",
      [`closing_0_product`]: "",
    });

    // Reset total closing amount
    setTotalClosingAmount(0);
  };
  const [totalClosingAmount, setTotalClosingAmount] = useState(0);
  const [dropdownVisible, setDropdownVisible] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [productList, setProductList] = useState<string[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<string[]>([]);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [todayCalls, setTodayCalls] = useState(0);
  const [todayDuration, setTodayDuration] = useState(0);
  const [waveAnimation] = useState(new Animated.Value(0));
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numMeetingsRef = useRef<TextInput>(null);
  const meetingDurationRef = useRef<TextInput>(null);
  const positiveLeadsRef = useRef<TextInput>(null);
  const rejectedLeadsRef = useRef<TextInput>(null);
  const notAttendedCallsRef = useRef<TextInput>(null);
  const closingLeadsRef = useRef<TextInput>(null);
  const closingAmountRefs = useRef<Array<TextInput | null>>([]);

  // Filter products based on search

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const userDoc = await getDoc(doc(db, "users", userId));
        const companyId = userDoc.exists() ? userDoc.data().companyId : null;
        if (!companyId) return;

        const q = query(
          collection(db, "products"),
          where("active", "==", true),
          where("companyId", "==", companyId)
        );

        const snapshot = await getDocs(q);
        console.log(
          "Fetched product docs:",
          snapshot.docs.map((doc) => doc.data())
        ); // ✅ Add this line
        const list = snapshot.docs.map((doc) => doc.data().name);

        setProductList(list);
        setFilteredProducts(list);
      } catch (error) {
        console.error("Error fetching product list:", error);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredProducts(productList);
    } else {
      const filtered = productList.filter((product) =>
        product.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchQuery, productList]);

  // Load draft data on mount
  useEffect(() => {
    loadDraftData();
  }, []);

  // Auto-save draft
  useEffect(() => {
    const autoSaveTimer = setTimeout(saveDraftData, 1000);
    return () => clearTimeout(autoSaveTimer);
  }, [
    numMeetings,
    meetingDuration,
    positiveLeads,
    rejectedLeads,
    notAttendedCalls,
    closingLeads,
    closingDetails,
  ]);

  const fetchTodayCallData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log("No user ID found");
        return;
      }

      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      // First try to get from AsyncStorage
      const storedLogs = await AsyncStorage.getItem("device_call_logs");
      const lastUpdate = await AsyncStorage.getItem("call_logs_last_update");
      const now = Date.now();

      if (
        storedLogs &&
        lastUpdate &&
        now - parseInt(lastUpdate) < 5 * 60 * 1000
      ) {
        // Use stored logs if they're recent
        const parsedLogs = JSON.parse(storedLogs);
        const todayLogs = parsedLogs.filter((log: any) => {
          const logDate = new Date(log.timestamp);
          return logDate >= startOfToday && logDate <= endOfToday;
        });

        let totalCalls = 0;
        let totalDuration = 0;

        todayLogs.forEach((log: any) => {
          if (log.status === "completed") {
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
      const callLogsRef = collection(db, "callLogs");
      const q = query(
        callLogsRef,
        where("userId", "==", userId),
        where("timestamp", ">=", startOfToday),
        where("timestamp", "<=", endOfToday)
      );

      const querySnapshot = await getDocs(q);
      let totalCalls = 0;
      let totalDuration = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === "completed") {
          totalCalls++;
          if (data.duration) {
            totalDuration += Number(data.duration);
          }
        }
      });

      // Update state with fetched data
      setTodayCalls(totalCalls);
      setTodayDuration(totalDuration);
      setNumMeetings(totalCalls.toString());
      setMeetingDuration(formatDuration(totalDuration));

      // Store in AsyncStorage for faster future access
      await AsyncStorage.setItem(
        "device_call_logs",
        JSON.stringify(querySnapshot.docs.map((doc) => doc.data()))
      );
      await AsyncStorage.setItem("call_logs_last_update", now.toString());
    } catch (error) {
      console.error("Error fetching today's call data:", error);
      Alert.alert("Error", "Failed to fetch today's call data");
    } finally {
      setIsLoading(false);
    }
  };

  // Add useEffect for wave animation
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(waveAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      ).start();
    } else {
      waveAnimation.setValue(0);
    }
  }, [isLoading]);

  // Update the useEffect for fetching data
  useFocusEffect(
    useCallback(() => {
      fetchTodayCallData(); // ✅ Runs every time screen comes into focus

      const interval = setInterval(fetchTodayCallData, 1000); // ⏱ Keep updating every 10s

      return () => clearInterval(interval); // 🧹 Clean up on screen blur
    }, [])
  );

  // Format duration to HH:mm:ss format
  const formatDuration = (seconds: number) => {
    if (!seconds) return "00:00:00";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
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
        totalClosingAmount,
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.DRAFT_REPORT,
        JSON.stringify(draftData)
      );
    } catch (error) {
      console.error("Error saving draft:", error);
    }
  };

  const loadDraftData = async () => {
    try {
      const draftDataString = await AsyncStorage.getItem(
        STORAGE_KEYS.DRAFT_REPORT
      );
      if (draftDataString) {
        const draftData = JSON.parse(draftDataString);
        setNumMeetings(draftData.numMeetings || "");
        setMeetingDuration(draftData.meetingDuration || "");
        setPositiveLeads(draftData.positiveLeads || "");
        setRejectedLeads(draftData.rejectedLeads || "");
        setNotAttendedCalls(draftData.notAttendedCalls || "");
        setClosingLeads(draftData.closingLeads || "");
        setClosingDetails(
          draftData.closingDetails || [
            {
              selectedProduct: "",
              otherProduct: "",
              amount: "",
              description: "",
              showOtherInput: false,
            },
          ]
        );

        setTotalClosingAmount(draftData.totalClosingAmount || 0);
      }
    } catch (error) {
      console.error("Error loading draft:", error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    let firstEmptyField: (() => void) | null = null;

    if (!numMeetings.trim()) {
      newErrors.numMeetings = "Number of calls is required";
      if (!firstEmptyField)
        firstEmptyField = () => numMeetingsRef.current?.focus();
    } else if (isNaN(Number(numMeetings)) || Number(numMeetings) < 0) {
      newErrors.numMeetings = "Please enter a valid number";
      if (!firstEmptyField)
        firstEmptyField = () => numMeetingsRef.current?.focus();
    }

    if (!meetingDuration.trim()) {
      newErrors.meetingDuration = "Call duration is required";
      if (!firstEmptyField)
        firstEmptyField = () => meetingDurationRef.current?.focus();
    }

    if (!positiveLeads.trim()) {
      newErrors.positiveLeads = "Positive leads is required";
      if (!firstEmptyField)
        firstEmptyField = () => positiveLeadsRef.current?.focus();
    } else if (isNaN(Number(positiveLeads)) || Number(positiveLeads) < 0) {
      newErrors.positiveLeads = "Please enter a valid number";
      if (!firstEmptyField)
        firstEmptyField = () => positiveLeadsRef.current?.focus();
    }

    if (!rejectedLeads.trim()) {
      newErrors.rejectedLeads = "Rejected leads is required";
      if (!firstEmptyField)
        firstEmptyField = () => rejectedLeadsRef.current?.focus();
    } else if (isNaN(Number(rejectedLeads)) || Number(rejectedLeads) < 0) {
      newErrors.rejectedLeads = "Please enter a valid number";
      if (!firstEmptyField)
        firstEmptyField = () => rejectedLeadsRef.current?.focus();
    }

    if (!notAttendedCalls.trim()) {
      newErrors.notAttendedCalls = "Not attended calls is required";
      if (!firstEmptyField)
        firstEmptyField = () => notAttendedCallsRef.current?.focus();
    } else if (
      isNaN(Number(notAttendedCalls)) ||
      Number(notAttendedCalls) < 0
    ) {
      newErrors.notAttendedCalls = "Please enter a valid number";
      if (!firstEmptyField)
        firstEmptyField = () => notAttendedCallsRef.current?.focus();
    }

    if (!closingLeads.trim()) {
      newErrors.closingLeads = "Closing leads is required";
      if (!firstEmptyField)
        firstEmptyField = () => closingLeadsRef.current?.focus();
    } else if (isNaN(Number(closingLeads)) || Number(closingLeads) < 0) {
      newErrors.closingLeads = "Please enter a valid number";
      if (!firstEmptyField)
        firstEmptyField = () => closingLeadsRef.current?.focus();
    }

    closingDetails.forEach((detail, index) => {
      if (!detail.selectedProduct) {
        newErrors[`closing_${index}_product`] = "Please select a product";
        if (!firstEmptyField)
          firstEmptyField = () => closingAmountRefs.current[index]?.focus();
    }

      if (!detail.amount.trim()) {
        newErrors[`closing_${index}_amount`] = "Amount is required";
        if (!firstEmptyField)
          firstEmptyField = () => closingAmountRefs.current[index]?.focus();
      }
      if (!detail.description.trim()) {
        newErrors[`closing_${index}_description`] = "Description is required";
        if (!firstEmptyField)
          firstEmptyField = () => closingAmountRefs.current[index]?.focus();
      }
    });

    setErrors(newErrors);

    // Focus the first empty field if any
    if (firstEmptyField) {
      setTimeout(() => firstEmptyField && firstEmptyField(), 100);
      return false;
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!validateForm()) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!auth.currentUser) {
        Alert.alert("Error", "Please login first");
        setIsSubmitting(false);
        return;
      }
      const userId = auth.currentUser.uid;

      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);

      let submittedBy = "Unknown";
      if (userDoc.exists()) {
        const userData = userDoc.data();
        submittedBy = userData.name || "Unnamed User";
      }

      const now = new Date();
      const reportData = {
        userId,
        submittedBy,
        date: Timestamp.fromDate(now),
        numMeetings: parseInt(numMeetings),
        meetingDuration,
        positiveLeads: parseInt(positiveLeads),
        rejectedLeads: parseInt(rejectedLeads),
        notAttendedCalls: parseInt(notAttendedCalls),
        closingLeads: parseInt(closingLeads),
        closingDetails: closingDetails.map((detail) => ({
          product: detail.selectedProduct,
          otherProduct: detail.otherProduct,
          amount: parseInt(detail.amount.replace(/[^0-9]/g, "")),
          description: detail.description,
        })),
        totalClosingAmount,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      };

      await addDoc(collection(db, "telecaller_reports"), reportData);

      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_REPORT,
        JSON.stringify(reportData)
      );

      await AsyncStorage.removeItem(STORAGE_KEYS.DRAFT_REPORT);

      setModalVisible(true);
      setTimeout(() => {
        setModalVisible(false);
        setNumMeetings("");
        setMeetingDuration("");
        setPositiveLeads("");
        setRejectedLeads("");
        setNotAttendedCalls("");
        setClosingLeads("");
        setClosingDetails([
          {
            selectedProduct: "",
            otherProduct: "",
            amount: "",
            description: "",
            showOtherInput: false,
          },
        ]);
        setTotalClosingAmount(0);
        setIsSubmitting(false);
      }, 2000);
    } catch (error) {
      console.error("Error submitting report:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleProductSelection = (index: number, value: string) => {
    const newDetails = [...closingDetails];
    newDetails[index] = {
      ...newDetails[index],
      selectedProduct: value,
      showOtherInput: value === "other",
    };
    setClosingDetails(newDetails);
    setDropdownVisible(null); // auto-close dropdown
  };

  const renderWaveSkeleton = () => {
    const translateY = waveAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 10],
    });

    return (
      <View style={styles.skeletonContainer}>
        <Animated.View
          style={[
            styles.skeletonWave,
            {
              transform: [{ translateY }],
            },
          ]}
        />
        <View style={styles.skeletonContent}>
          <View style={styles.skeletonHeader} />
          <View style={styles.skeletonCard}>
            <View style={styles.skeletonCardHeader} />
            <View style={styles.skeletonCardContent}>
              <View style={styles.skeletonProgress} />
              <View style={styles.skeletonStats}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={styles.skeletonStatRow} />
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <AppGradient>
        <TelecallerMainLayout
          showDrawer
          showBackButton={true}
          title="Daily Report"
        >
          {renderWaveSkeleton()}
        </TelecallerMainLayout>
      </AppGradient>
    );
  }

  return (
    <AppGradient>
      <TelecallerMainLayout
        showDrawer
        showBackButton={true}
        title="Daily Report"
      >
        <View style={styles.container}>
          <KeyboardAwareScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
          >
            <View style={styles.inputContainer}>
              <View style={{ position: "relative", alignItems: "center" }}>
                {/* Reset Icon at Top Right */}
                <TouchableOpacity
                  onPress={resetForm}
                  style={{ position: "absolute", right: 0 }}
                >
                  <Ionicons name="refresh" size={24} color="#FF5252" />
                </TouchableOpacity>

                {/* Centered Date */}
                <Text style={styles.dateText}>
                  {format(new Date(), "dd MMMM (EEEE)")}
                </Text>
              </View>
              {/* Number of Calls - Read Only with Auto Update */}
              <Text style={styles.label}>Number of Calls</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>{todayCalls}</Text>
              </View>
              {/* Call Duration - Read Only with Auto Update */}
              <Text style={styles.label}>Call Duration</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>
                  {formatDuration(todayDuration)}
                </Text>
              </View>
              <Text style={styles.label}>Positive Leads</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.positiveLeads && styles.inputError,
                ]}
                value={positiveLeads}
                onChangeText={(text) => {
                  // Check if the new text contains only digits
                  const isValid = /^[0-9]*$/.test(text);

                  if (isValid) {
                    setPositiveLeads(text);
                    setErrors((prev) => ({ ...prev, positiveLeads: "" })); // Clear error
                  } else {
                    setErrors((prev) => ({
                      ...prev,
                      positiveLeads: "Only valid number allowed",
                    }));
                  }
                }}
                keyboardType="numeric"
                placeholder="Enter number"
                ref={positiveLeadsRef}
              />
              {/* Show error if present */}
              {errors.positiveLeads ? (
                <Text style={styles.errorText}>{errors.positiveLeads}</Text>
              ) : null}
              {/* Positive Leads Field */}
              {/* Rejected Leads Field */}
              <Text style={styles.label}>Rejected Leads</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.rejectedLeads && styles.inputError,
                ]}
                value={rejectedLeads}
                onChangeText={(text) => {
                  // Check if the input is a valid number (only digits)
                  const isValid = /^[0-9]*$/.test(text);

                  if (isValid) {
                    setRejectedLeads(text); // Update value only if valid
                    setErrors((prev) => ({ ...prev, rejectedLeads: "" })); // Clear error message
                  } else {
                    setErrors((prev) => ({
                      ...prev,
                      rejectedLeads: "Only valid number allowed", // Show error message
                    }));
                  }
                }}
                keyboardType="numeric"
                placeholder="Enter number"
                ref={rejectedLeadsRef}
              />
              {/* Show error message below if any */}
              {errors.rejectedLeads && (
                <Text style={styles.errorText}>{errors.rejectedLeads}</Text>
              )}
              {/* Not Attended Calls Field */}
              <Text style={styles.label}>Not Attended Calls</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.notAttendedCalls && styles.inputError,
                ]}
                value={notAttendedCalls}
                onChangeText={(text) => {
                  // Allow only digits
                  const numericText = text.replace(/[^0-9]/g, ""); // Only digits allowed
                  setNotAttendedCalls(numericText);

                  // Clear error if valid number is entered
                  if (numericText) {
                    setErrors((prev) => ({ ...prev, notAttendedCalls: "" }));
                  } else {
                    setErrors((prev) => ({
                      ...prev,
                      notAttendedCalls: "Only valid number allowed", // Show error message
                    }));
                  }
                }}
                keyboardType="numeric"
                placeholder=""
                ref={notAttendedCallsRef}
              />
              {/* Show error message below if any */}
              {errors.notAttendedCalls && (
                <Text style={styles.errorText}>{errors.notAttendedCalls}</Text>
              )}
              {/* Closing Leads Field */}
              <Text style={styles.label}>Closing Leads</Text>
              <TextInput
                style={[styles.input, errors.closingLeads && styles.inputError]}
                value={closingLeads}
                onChangeText={(text) => {
                  // Allow only digits using a regular expression
                  const numericText = text.replace(/[^0-9]/g, ""); // Only digits allowed
                  setClosingLeads(numericText);

                  // Clear the error message if valid number is entered
                  if (numericText) {
                    setErrors((prev) => ({ ...prev, closingLeads: "" }));
                  } else {
                    // Show error message if the input is invalid
                    setErrors((prev) => ({
                      ...prev,
                      closingLeads: "Only valid number allowed", // Error message
                    }));
                  }
                }}
                keyboardType="numeric"
                placeholder=""
                ref={closingLeadsRef}
              />
              {/* Display error message if there's an error */}
              {errors.closingLeads && (
                <Text style={styles.errorText}>{errors.closingLeads}</Text>
              )}
              {/* Closing Details */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Closing Details</Text>

                {closingDetails.map((detail, index) => (
                  <View key={index} style={styles.closingItem}>
                    {index > 0 && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => {
                          const newDetails = closingDetails.filter(
                            (_, i) => i !== index
                          );
                          setClosingDetails(newDetails);
                        }}
                      >
                        <Ionicons
                          name="remove-circle"
                          size={24}
                          color="#FF5252"
                        />
                      </TouchableOpacity>
                    )}
                    <Text style={styles.label}>
                      Type of Product <Text style={styles.required}>*</Text>
                    </Text>

                    {/* Product Selection */}
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() =>
                        setDropdownVisible(
                          dropdownVisible === index ? null : index
                        )
                      }
                    >
                      <Text>{detail.selectedProduct || "Select Product"}</Text>

                      <Ionicons
                        name={
                          dropdownVisible === index
                            ? "chevron-up"
                            : "chevron-down"
                        }
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
                            onChangeText={(text) => setSearchQuery(text)}
                          />
                          <MaterialIcons name="search" size={20} color="#666" />
                        </View>

                        <ScrollView
                          style={styles.dropdownList}
                          nestedScrollEnabled={true}
                        >
                          {filteredProducts.map((item) => (
                            <TouchableOpacity
                              key={item}
                              style={[
                                styles.dropdownItem,
                                detail.selectedProduct === item &&
                                  styles.dropdownItemSelected,
                              ]}
                              onPress={() => {
                                handleProductSelection(index, item);
                                setSearchQuery("");
                              }}
                            >
                              <Text
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                style={[
                                  styles.dropdownItemText,
                                  detail.selectedProduct === item &&
                                    styles.dropdownItemTextSelected,
                                ]}
                              >
                                {item}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {errors[`closing_${index}_product`] && (
                      <Text style={styles.errorText}>
                        {errors[`closing_${index}_product`]}
                      </Text>
                    )}

                    {/* Other fields */}
                    <Text style={styles.label}>
                      Closing Amount <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={styles.amountInputContainer}>
                      <Text style={styles.currencySymbol}>₹</Text>
                      <TextInput
                        style={[
                          styles.amountInput,
                          errors[`closing_${index}_amount`] &&
                            styles.inputError, // Apply error styles if error exists
                        ]}
                        value={detail.amount}
                        onChangeText={(text) => {
                          // Ensure only digits are stored
                          const numericText = text.replace(/[^0-9]/g, ""); // Only digits allowed

                          // Update the amount in the closingDetails array
                          const newDetails = [...closingDetails];
                          newDetails[index] = {
                            ...detail,
                            amount: numericText,
                          };
                          setClosingDetails(newDetails);

                          // Recalculate total amount
                          const total = newDetails.reduce((sum, d) => {
                            const amount =
                              parseInt(d.amount.replace(/[^0-9]/g, "")) || 0; // Ensure no NaN
                            return sum + amount;
                          }, 0);
                          setTotalClosingAmount(total); // Update the total
                        }}
                        keyboardType="numeric"
                        placeholder="Enter Amount"
                        ref={(el) => (closingAmountRefs.current[index] = el)} // Dynamic ref for each index
                      />
                    </View>

                    {/* Show error message below if any */}
                    {errors[`closing_${index}_amount`] && (
                      <Text style={styles.errorText}>
                        {errors[`closing_${index}_amount`]}{" "}
                        {/* Display the error message */}
                      </Text>
                    )}

                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={[
                        styles.textArea,
                        errors[`closing_${index}_description`] &&
                          styles.inputError,
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
                      <Text style={styles.errorText}>
                        {errors[`closing_${index}_description`]}
                      </Text>
                    )}
                  </View>
                ))}

                {/* Add More Button */}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() =>
                    setClosingDetails([
                      ...closingDetails,
                      {
                        selectedProduct: "", // ✅ Correct property
                        otherProduct: "",
                        amount: "",
                        description: "",
                        showOtherInput: false,
                      },
                    ])
                  }
                >
                  <Text style={styles.addButtonText}>
                    + Add Another Closing
                  </Text>
                </TouchableOpacity>
              </View>
              {/* Total Amount */}
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total Closing Amount</Text>
                <Text style={styles.totalAmount}>
                  ₹ {totalClosingAmount.toLocaleString()}
                </Text>
              </View>
              // Add this within the return block in your JSX
              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
              >
                <LinearGradient
                  colors={["#FF8447", "#FF6D24"]}
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
              <Text style={styles.modalTitle}>
                Report Submitted Successfully!
              </Text>
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
  dropdownList: {
    marginTop: 8,
    backgroundColor: "#fff",
    maxHeight: 220,
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
  removeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 5,
  },
  skeletonContainer: {
    flex: 1,
    overflow: "hidden",
  },
  skeletonWave: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    transform: [{ translateY: 0 }],
  },
  skeletonContent: {
    flex: 1,
    padding: 16,
  },
  skeletonHeader: {
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 8,
    marginBottom: 16,
    width: "60%",
    alignSelf: "center",
  },
  skeletonCard: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  skeletonCardHeader: {
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 4,
    marginBottom: 16,
    width: "40%",
  },
  skeletonCardContent: {
    flex: 1,
  },
  skeletonProgress: {
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 4,
    marginBottom: 24,
  },
  skeletonStats: {
    marginTop: 16,
  },
  skeletonStatRow: {
    height: 20,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 4,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 8,
    fontFamily: "LexendDeca_400Regular",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    padding: 8,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    marginBottom: 15,
    elevation: 3,
    maxHeight: 300, // Total height limit
    overflow: "hidden",
  },
});

export default ReportScreen;
