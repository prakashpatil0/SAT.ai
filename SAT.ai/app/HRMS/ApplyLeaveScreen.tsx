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
    { label: "Earned Leave (20)", value: "Earned Leave" },
    { label: "Sick Leave (13)", value: "Sick Leave" },
    { label: "Casual Leave (08)", value: "Casual Leave" },
    { label: "Emergency Leave (10)", value: "Emergency Leave" },
    { label: "Maternity Leave (60)", value: "Maternity Leave" },
    { label: "Other", value: "Other" },
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

  // const handleSubmit = async () => {
  //   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  //   try {
  //     const userId = auth.currentUser?.uid;
  //     if (!userId) {
  //       Alert.alert("Authentication Error", "You must be logged in to submit leave.");
  //       return;
  //     }

  //     const userDocRef = doc(db, "users", userId);
  //     const userDocSnap = await getDoc(userDocRef);
  //     if (!userDocSnap.exists()) {
  //       Alert.alert("Error", "User not found.");
  //       return;
  //     }

  //     const userData = userDocSnap.data();
  //     const employeeName = userData?.name || "Unknown";

  //     let fileUrl = "";
  //     if (uploadedFile) {
  //       const response = await fetch(uploadedFile.uri);
  //       const blob = await response.blob();
  //       const cleanFileName = uploadedFile.name.replace(/[^\w.-]/g, "_");
  //       const storageRef = ref(storage, `leave_documents/${Date.now()}_${cleanFileName}`);
  //       await uploadBytes(storageRef, blob, {
  //         contentType: uploadedFile.mimeType || "application/pdf",
  //       });
  //       fileUrl = await getDownloadURL(storageRef);
  //     }

  //     const duration = calculateLeaveDuration(fromDate, toDate);

  //     const dataToSend = {
  //       userId,
  //       name: employeeName,
  //       leaveType: leaveType || "Not Selected",
  //       fromDate: Timestamp.fromDate(fromDate),
  //       toDate: Timestamp.fromDate(toDate),
  //       duration,
  //       reason,
  //       lineManager: selectedLineManager,
  //       hrManager: selectedHrManager,
  //       uploadedFileName: uploadedFile?.name || "",
  //       uploadedFileURL: fileUrl,
  //       status: "pending",
  //       createdAt: Timestamp.now(),
  //     };

  //     await addDoc(collection(db, "leave_applications"), dataToSend);
  //     console.log("✅ Leave application saved");

  //     // ✅ Fetch HR Manager Email using UID (document ID)
  //     console.log("🔍 Selected HR Manager UID:", selectedHrManager);
  //     const hrDocRef = doc(db, "users", selectedHrManager);
  //     const hrDocSnap = await getDoc(hrDocRef);

  //     if (!hrDocSnap.exists()) {
  //       console.warn("⚠️ HR manager document not found");
  //       return;
  //     }

  //     const hrEmail = hrDocSnap.data().email;
  //     console.log("📧 HR Email:", hrEmail);

  //     // ✅ Send Email to HR Manager
  //     const response = await fetch("https://us-central1-sat1-f51fd.cloudfunctions.net/sendLeaveEmail", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json"
  //       },
  //       body: JSON.stringify({
  //         to: hrEmail,
  //         subject: `New Leave Request from ${employeeName}`,
  //         html: `
  //           <div style="font-family: Arial;">
  //             <h2>Leave Application Submitted</h2>
  //             <p><strong>Employee:</strong> ${employeeName}</p>
  //             <p><strong>Leave Type:</strong> ${leaveType}</p>
  //             <p><strong>From:</strong> ${fromDate.toDateString()}</p>
  //             <p><strong>To:</strong> ${toDate.toDateString()}</p>
  //             <p><strong>Duration:</strong> ${duration}</p>
  //             <p><strong>Reason:</strong> ${reason}</p>
  //           </div>
  //         `
  //       })
  //     });

  //     if (response.ok) {
  //       console.log("✅ Email sent successfully to HR manager");
  //     } else {
  //       console.error("❌ Failed to send email:", await response.text());
  //     }

  //     Alert.alert("Success", "Leave submitted and email sent to HR Manager!");
  //     navigation.goBack();

  //   } catch (error) {
  //     console.error("❌ Error submitting leave application:", error);
  //     Alert.alert("Error", "Something went wrong. Please try again.");
  //   }
  // };

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
              <Text style={{ color: "white", fontWeight: "bold" }}>Submit</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </TelecallerMainLayout>
    </AppGradient>
  );
};



const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { fontSize: 16, marginBottom: 10, fontWeight: "500" },
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
  dropdownLabel: { fontSize: 16, fontWeight: "500", width: "30%" },
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
  fileName: { flex: 1, marginHorizontal: 8, fontSize: 14, color: "#333" },
  bottomArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  charCount: { fontSize: 12, color: "#999" },
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