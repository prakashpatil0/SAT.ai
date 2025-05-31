import React, { useState, useEffect } from "react";
import * as MailComposer from "expo-mail-composer";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import DropDownPicker from "react-native-dropdown-picker";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import AppGradient from "@/app/components/AppGradient";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import { auth, db, storage } from "@/firebaseConfig";
import {
  collection,
  addDoc,
  Timestamp,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const ApplyLeaveScreen = () => {
  const navigation = useNavigation();

  const [leaveTypeDropdownOpen, setLeaveTypeDropdownOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<string | null>(null);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState([
    { label: "Earned Leave (20)", value: "Earned Leave", fontFamily: 'LexendDeca_400Regular' },
    { label: "Sick Leave (13)", value: "Sick Leave", fontFamily: 'LexendDeca_400Regular' },
    { label: "Casual Leave (08)", value: "Casual Leave", fontFamily: 'LexendDeca_400Regular' },
    { label: "Emergency Leave (10)", value: "Emergency Leave", fontFamily: 'LexendDeca_400Regular' },
    { label: "Maternity Leave (60)", value: "Maternity Leave", fontFamily: 'LexendDeca_400Regular' },
    { label: "Other", value: "Other", fontFamily: 'LexendDeca_400Regular' },
  ]);

  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromDate, setShowFromDate] = useState(false);
  const [showToDate, setShowToDate] = useState(false);
  const [reason, setReason] = useState("");
  const [uploadedFile, setUploadedFile] =
  useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [fromDateSelected, setFromDateSelected] = useState(false);
  const [toDateSelected, setToDateSelected] = useState(false);

  const [lineDropdownOpen, setLineDropdownOpen] = useState(false);
  const [selectedLineManager, setSelectedLineManager] = useState(null);
  const [lineManagerOptions, setLineManagerOptions] = useState([
    { label: "John Smith", value: "john_smith" },
    { label: "Priya Mehta", value: "priya_mehta" },
    { label: "Amit Kumar", value: "amit_kumar" },
  ]);
  const grantedLeaves = {
    "Earned Leave": 20,
    "Sick Leave": 25,
    "Casual Leave": 20,
    "Emergency Leave": 25,
    "Maternity Leave": 80,
  };
  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
  
    const fetchLeaveBalances = async () => {
      const q = query(
        collection(db, "leave_applications"),
        where("userId", "==", userId),
        where("status", "==", "approved")
      );
  
      const snapshot = await getDocs(q);
      const taken: Record<string, number> = {};
  
      snapshot.forEach((doc) => {
        const data = doc.data();
        const type = data.leaveType;
        const duration = parseFloat(data.duration?.replace(/[^\d.]/g, "") || "0");
        taken[type] = (taken[type] || 0) + duration;
      });
  
      const updatedOptions = Object.entries(grantedLeaves).map(
        ([type, granted]) => {
          const used = taken[type] || 0;
          const available = granted - used;
          return {
            label: `${type} (${available})`,
            value: type,
            fontFamily: "LexendDeca_400Regular",
          };
        }
      );
  
      // Add "Other" as a static option
      updatedOptions.push({
        label: "Other",
        value: "Other",
        fontFamily: "LexendDeca_400Regular",
      });
  
      setLeaveTypeOptions(updatedOptions);
    };
  
    fetchLeaveBalances();
  }, []);
  
  const [hrDropdownOpen, setHrDropdownOpen] = useState(false);
  const [selectedHrManager, setSelectedHrManager] = useState(null);
  const [hrManagerOptions, setHrManagerOptions] = useState([]);

  useEffect(() => {
    fetchHrManagers();
  }, []);

  const fetchHrManagers = async () => {
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "hrmanager")
      );
      const querySnapshot = await getDocs(q);
      const hrList: { label: string; value: string }[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data?.name) {
          hrList.push({
            label: data.name,
            value: docSnap.id, // 🔥 use document ID instead of formatting the name
          });
        }
      });

      setHrManagerOptions(hrList);
    } catch (error) {
      console.error("Error fetching HR managers:", error);
    }
  };

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
      if (!result.canceled) {
        const file = result.assets[0];
        setUploadedFile(file);
      }
    } catch (error) {
      console.log("File upload error:", error);
    }
  };

  const calculateLeaveDuration = (start: Date, end: Date) => {
    const oneDay = 24 * 60 * 60 * 1000;
    const startDate = new Date(start.setHours(0, 0, 0, 0));
    const endDate = new Date(end.setHours(0, 0, 0, 0));
    const diffDays =
      Math.round((endDate.getTime() - startDate.getTime()) / oneDay) + 1;
    return diffDays <= 1 ? "1 day" : `${diffDays} days`;
  };

 
  const handleSubmit = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert(
          "Authentication Error",
          "You must be logged in to submit leave."
        );
        return;
      }

      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        Alert.alert("Error", "User not found.");
        return;
      }

      const userData = userDocSnap.data();
      const employeeName = userData?.name || "Unknown";

      let fileUrl = "";
      if (uploadedFile) {
        const response = await fetch(uploadedFile.uri);
        const blob = await response.blob();
        const cleanFileName = uploadedFile.name.replace(/[^\w.-]/g, "_");
        const storageRef = ref(
          storage,
          `leave_documents/${Date.now()}_${cleanFileName}`
        );
        await uploadBytes(storageRef, blob, {
          contentType: uploadedFile.mimeType || "application/pdf",
        });
        fileUrl = await getDownloadURL(storageRef);
      }

      const duration = calculateLeaveDuration(fromDate, toDate);

      const dataToSend = {
        userId,
        name: employeeName,
        leaveType: leaveType || "Not Selected",
        fromDate: Timestamp.fromDate(fromDate),
        toDate: Timestamp.fromDate(toDate),
        duration,
        reason,
        lineManager: selectedLineManager,
        hrManager: selectedHrManager,
        uploadedFileName: uploadedFile?.name || "",
        uploadedFileURL: fileUrl,
        status: "pending",
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, "leave_applications"), dataToSend);
      console.log("✅ Leave application saved");

      // ✅ Fetch HR Manager Email
      console.log("🔍 Selected HR Manager UID:", selectedHrManager);
      const hrDocRef = doc(db, "users", selectedHrManager);
      const hrDocSnap = await getDoc(hrDocRef);

      if (!hrDocSnap.exists()) {
        console.warn("⚠️ HR manager document not found");
        return;
      }

      const hrEmail = hrDocSnap.data().email;
      console.log("📧 HR Email:", hrEmail);

      // ✅ Send Email via MailComposer
      const isAvailable = await MailComposer.isAvailableAsync();
      if (isAvailable) {
        await MailComposer.composeAsync({
          recipients: [], // No direct recipient
          // ccRecipients: [], // ← Replace with actual Line Manager email
          bccRecipients: [hrEmail], // HR gets BCC
          subject: `New Leave Request from ${employeeName}`,
          body: `
        Hi ${hrDocSnap.data().name},
        
        Employee ${employeeName} has requested a leave.
        
        Leave Type: ${leaveType}
        From: ${fromDate.toDateString()}
        To: ${toDate.toDateString()}
        Duration: ${duration}
        Reason: ${reason}
        
        Best regards,
        SAT.ai App
          `.trim(),
          // attachments: [uploadedFile?.uri] // optional
        });
      } else {
        Alert.alert(
          "Mail not available",
          "Email service is not available on this device."
        );
      }

      Alert.alert(
        "Success",
        "Leave submitted! Review and send the email from your mail app."
      );
      navigation.goBack();
    } catch (error) {
      console.error("❌ Error submitting leave application:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
  };

  return (
    <AppGradient>
      <TelecallerMainLayout
        showDrawer
        showBackButton
        showBottomTabs
        title={"Apply for a Leave"}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            <View style={{ zIndex: 5000, marginBottom: 20 }}>
              <Text style={styles.label}>Select Leave Type</Text>
              <DropDownPicker
                open={leaveTypeDropdownOpen}
                value={leaveType}
                items={leaveTypeOptions}
                setOpen={setLeaveTypeDropdownOpen}
                setValue={setLeaveType}
                setItems={setLeaveTypeOptions}
                placeholder="Choose Leave Type" 
                style={styles.dropdownFull}
                dropDownContainerStyle={{ borderColor: "#ddd" }}
              />
            </View>

            <Text style={styles.label}>Leave Period</Text>
            <View style={styles.fromToRow}>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowFromDate(true)}
              >
                <Text>
                  {fromDateSelected
                    ? `${fromDate
                        .getDate()
                        .toString()
                        .padStart(2, "0")}-${fromDate.toLocaleString("en-IN", {
                        month: "short",
                      })}-${fromDate.getFullYear()}`
                    : "From"}
                </Text>
                <MaterialIcons name="calendar-month" size={18} color="#000" />
              </TouchableOpacity>
              {showFromDate && (
                <DateTimePicker
                  value={fromDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowFromDate(false);
                    if (selectedDate) {
                      setFromDate(selectedDate);
                      setFromDateSelected(true);
                    }
                  }}
                />
              )}

              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowToDate(true)}
              >
                <Text>
                  {toDateSelected
                    ? `${toDate
                        .getDate()
                        .toString()
                        .padStart(2, "0")}-${toDate.toLocaleString("en-IN", {
                        month: "short",
                      })}-${toDate.getFullYear()}`
                    : "To"}
                </Text>
                <MaterialIcons name="calendar-month" size={18} color="#000" />
              </TouchableOpacity>
              {showToDate && (
                <DateTimePicker
                  value={toDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowToDate(false);
                    if (selectedDate) {
                      setToDate(selectedDate);
                      setToDateSelected(true);
                    }
                  }}
                />
              )}
            </View>

            <View style={{ zIndex: 4000 }}>
              <View style={styles.dropdownRow}>
                <Text style={styles.dropdownLabel}>To</Text>
                <DropDownPicker
                  open={lineDropdownOpen}
                  value={selectedLineManager}
                  items={lineManagerOptions}
                  setOpen={setLineDropdownOpen}
                  setValue={setSelectedLineManager}
                  setItems={setLineManagerOptions}
                  placeholder="Select Line Manager"
                  style={styles.dropdownHalf}
                  dropDownContainerStyle={{ borderColor: "#ddd" }}
                />
              </View>
            </View>

            <View style={{ zIndex: 3000 }}>
              <View style={styles.dropdownRow}>
                <Text style={styles.dropdownLabel}>To (BCC)</Text>
                <DropDownPicker
                  open={hrDropdownOpen}
                  value={selectedHrManager}
                  items={hrManagerOptions}
                  setOpen={setHrDropdownOpen}
                  setValue={setSelectedHrManager}
                  setItems={setHrManagerOptions}
                  placeholder="Select HR Manager"
                  style={styles.dropdownHalf}
                  dropDownContainerStyle={{ borderColor: "#ddd" }}
                />

              </View>
            </View>

            <View style={styles.notesContainer}>
              <TextInput
                style={styles.textarea}
                placeholder="Enter Reason For Leave"
                multiline
                maxLength={120}
                value={reason}
                onChangeText={setReason}
              />
              {uploadedFile && (
                <View style={styles.filePreview}>
                  <MaterialIcons
                    name="insert-drive-file"
                    size={20}
                    color="#555"
                  />
                  <Text style={styles.fileName} numberOfLines={1}>
                    {uploadedFile.name}
                  </Text>
                  <MaterialIcons name="verified" size={20} color="#00C566" />
                  <TouchableOpacity onPress={handleRemoveFile}>
                    <MaterialIcons name="cancel" size={20} color="#FF0000" />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.bottomArea}>
                <Text style={styles.charCount}>{reason.length}/120</Text>
                <TouchableOpacity onPress={handleFileUpload}>
                  <MaterialIcons name="attach-file" size={20} color="#555" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={{ color: "white", fontFamily: 'LexendDeca_600SemiBold', fontSize: 16 }}>Submit</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </TelecallerMainLayout>
    </AppGradient>
  );
};



const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { fontSize: 16, marginBottom: 10, fontFamily: 'LexendDeca_500Medium' },
  fromToRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    gap: 10,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    width: "48%",
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  dropdownLabel: { fontSize: 16, fontFamily: 'LexendDeca_500Medium', width: "30%" },
  dropdownHalf: { borderColor: "#ddd", backgroundColor: "#fff", width: "68%" },
  dropdownFull: { borderColor: "#ddd", backgroundColor: "#fff" },
  notesContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  textarea: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: "#333",
    minHeight: 120,
    textAlignVertical: "top",
  },
  filePreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  fileName: { flex: 1, marginHorizontal: 8, fontSize: 14, color: "#333", fontFamily: 'LexendDeca_400Regular' },
  bottomArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  charCount: { fontSize: 12, color: "#999", fontFamily: 'LexendDeca_400Regular' },
  submitBtn: {
    flexDirection: "row",
    backgroundColor: "#ff914d",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    width: "50%",
    alignSelf: "center",
    marginTop: 10,
  },
});
export default ApplyLeaveScreen;