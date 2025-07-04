import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  FlatList,
  Button,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import BDMMainLayout from "@/app/components/BDMMainLayout";
import { auth, db } from "@/firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  orderBy,
  limit,
  doc,
  onSnapshot,
  getDoc,
  updateDoc,
  increment,
  setDoc,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppGradient from "@/app/components/AppGradient";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
  withDelay,
} from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";

interface ClosingDetail {
  productType: string;
  closingAmount: number;
  description: string;
}

interface DailyReport {
  date: Date;
  numMeetings: number;
  totalMeetingDuration: string;
  closingDetails: ClosingDetail[];
  totalClosingAmount: number;
}

interface CallLog {
  id: string;
  phoneNumber: string;
  timestamp: Date;
  duration: number;
  type: "incoming" | "outgoing" | "missed";
  status: "completed" | "missed" | "in-progress";
  contactId?: string;
  contactName?: string;
}

const WaveSkeleton = ({
  width,
  height,
  style,
}: {
  width: number | string;
  height: number;
  style?: any;
}) => {
  const translateX = useSharedValue(typeof width === "number" ? -width : -100);

  React.useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(typeof width === "number" ? width : 100, { duration: 1000 }),
        withDelay(
          500,
          withTiming(typeof width === "number" ? -width : -100, { duration: 0 })
        )
      ),
      -1
    );
  }, [translateX, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={[
        { width, height, backgroundColor: "#E5E7EB", overflow: "hidden" },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            width: "100%",
            height: "100%",
            backgroundColor: "transparent",
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={["transparent", "rgba(255, 255, 255, 0.3)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: "100%", height: "100%" }}
        />
      </Animated.View>
    </View>
  );
};
const FormSkeleton = () => (
  <View
    style={{
      gap: 16,
      padding: 16,
    }}
  >
    <WaveSkeleton width="100%" height={120} style={{ borderRadius: 8 }} />
    <WaveSkeleton width="100%" height={48} style={{ borderRadius: 8 }} />
  </View>
);

// Converts "1:05 PM" to "13:05", "12:15 AM" to "00:15", etc.
function convertTo24Hr(time12h: string): string {
  const [time, modifier] = time12h.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier?.toLowerCase() === "pm" && hours < 12) {
    hours += 12;
  }
  if (modifier?.toLowerCase() === "am" && hours === 12) {
    hours = 0;
  }
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

const BDMReportScreen = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "synced" | "error"
  >("idle");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [selectedProducts, setSelectedProducts] = useState<{
    [key: number]: string;
  }>({ 0: "Health Insurance" });
  const [showProductDropdown, setShowProductDropdown] = useState<number | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<string[]>([]);
  const [showOtherInput, setShowOtherInput] = useState<number | null>(null);
  const [otherProductInput, setOtherProductInput] = useState("");

  const [numMeetings, setNumMeetings] = useState<string>("");
  const [totalMeetingDuration, setMeetingDuration] = useState<string>("");
  const [closingDetails, setClosingDetails] = useState<ClosingDetail[]>([
    { productType: "Health Insurance", closingAmount: 0, description: "" },
  ]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [currentDate, setCurrentDate] = useState<string>("");

  const [numCalls, setNumCalls] = useState<string>("0");
  const [callDuration, setCallDuration] = useState<string>("00:00");
  const [positiveLeadsFromCalls, setPositiveLeadsFromCalls] =
    useState<string>("");

  const [meetings, setMeetings] = useState<
    {
      name: string;
      duration: string;
      locationUrl: string;
      locationReachTime: string;
      startTime: string;
      endTime: string;
    }[]
  >([
    // Example static data for initial display
    {
      name: "Google",
      duration: "3hr 40min",
      locationUrl: "https://www.google.com/maps?q=48.8584,2.2945",
      locationReachTime: "12:15 PM",
      startTime: "1:05 PM",
      endTime: "3:55 PM",
    },
  ]);
  const [expandedMeetingIndex, setExpandedMeetingIndex] = useState<
    number | null
  >(null);
  const [positiveLeadsFromMeetings, setPositiveLeadsFromMeetings] =
    useState<string>("");
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const productList = useMemo(
    () => [
      "None", // Added for deselect option
      "Car Insurance",
      "Bike Insurance",
      "Health Insurance",
      "Term Insurance",
      "Saving Plan",
      "Travel Insurance",
      "Group Mediclaim",
      "Group Personal Accident",
      "Group Term Life",
      "Group Credit Life",
      "Workmen Compensation",
      "Group Gratuity",
      "Fire & Burglary Insurance",
      "Shop Owner Insurance",
      "Motor Fleet Insurance",
      "Marine Single Transit",
      "Marine Open Policy",
      "Marine Sales Turnover",
      "Directors & Officers Insurance",
      "General Liability Insurance",
      "Product Liability Insurance",
      "Professional Indemnity for Doctors",
      "Professional Indemnity for Companies",
      "Cyber Insurance",
      "Office Package Policy",
      "Crime Insurance",
      "Other",
    ],
    []
  );

  const STORAGE_KEYS = useMemo(
    () => ({
      DRAFT_REPORT: "bdm_report_draft",
      LAST_REPORT: "bdm_last_report",
      PENDING_REPORTS: "bdm_pending_reports",
    }),
    []
  );

  const formatDuration = useCallback((seconds: number) => {
    if (!seconds || seconds === 0) return "00:00:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }, []);

  const updateMeetingDuration = useCallback(
    (logs: CallLog[]) => {
      const totalDuration = logs.reduce(
        (sum, log) => sum + (log.duration || 0),
        0
      );
      setMeetingDuration(formatDuration(totalDuration));
      setNumMeetings(logs.length.toString());
    },
    [formatDuration]
  );

  const fetchTodayCallData = useCallback(async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    try {
      // Try local cache first
      const storedLogs = await AsyncStorage.getItem("device_call_logs");
      const lastUpdate = await AsyncStorage.getItem("call_logs_last_update");
      const now = Date.now();

      let todayLogs = [];
      if (
        storedLogs &&
        lastUpdate &&
        now - parseInt(lastUpdate) < 5 * 60 * 1000
      ) {
        const parsedLogs = JSON.parse(storedLogs);
        todayLogs = parsedLogs.filter((log: any) => {
          const logDate = new Date(log.timestamp);
          return logDate >= startOfToday && logDate <= endOfToday;
        });
      } else {
        // Fetch from Firestore
        const callLogsRef = collection(db, "callLogs");
        const q = query(
          callLogsRef,
          where("userId", "==", userId),
          where("timestamp", ">=", startOfToday),
          where("timestamp", "<=", endOfToday)
        );
        const querySnapshot = await getDocs(q);
        todayLogs = querySnapshot.docs.map((doc) => doc.data());
        await AsyncStorage.setItem(
          "device_call_logs",
          JSON.stringify(todayLogs)
        );
        await AsyncStorage.setItem("call_logs_last_update", now.toString());
      }

      let totalCalls = 0;
      let totalDuration = 0;
      todayLogs.forEach((log: any) => {
        if (log.status === "completed") {
          totalCalls++;
          totalDuration += Number(log.duration) || 0;
        }
      });

      setNumCalls(totalCalls.toString());
      // Format duration as 'X hr Y min'
      const hours = Math.floor(totalDuration / 3600);
      const minutes = Math.floor((totalDuration % 3600) / 60);
      setCallDuration(`${hours} hr ${minutes} min`);
    } catch (error) {
      Alert.alert("Error", "Failed to fetch today's call data");
    }
  }, []);

  const processCallLogs = useCallback(async (snapshot: any) => {
    const logs: CallLog[] = [];
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const log: CallLog = {
        id: docSnapshot.id,
        phoneNumber: data.phoneNumber || "",
        timestamp: data.timestamp?.toDate() || new Date(),
        duration: data.duration || 0,
        type: data.type || "outgoing",
        status: data.status || "completed",
        contactId: data.contactId,
        contactName: data.contactName || "",
      };

      if (data.contactId) {
        const contactDocRef = doc(db, "contacts", data.contactId);
        const contactDoc = await getDoc(contactDocRef);
        if (contactDoc.exists()) {
          log.contactName = contactDoc.data().name || "";
        }
      }

      logs.push(log);
    }
    return logs;
  }, []);
  const fetchTodayMeetings = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const today = new Date();
    const day = today.getDate().toString().padStart(2, "0");
    const month = monthNames[today.getMonth()];
    const year = today.getFullYear();
    const formattedDate = `${day} ${month} ${year}`;

    try {
      const meetingsRef = collection(db, "meetings");
      const q = query(
        meetingsRef,
        where("userId", "==", userId),
        where("date", "==", formattedDate)
      );
      const snapshot = await getDocs(q);

      const meetingsData = snapshot.docs.map((doc) => doc.data());
      const mappedMeetings = meetingsData.map((data: any) => ({
        name: data.individuals?.[0]?.name || data.name || "Unnamed",
        duration: data.duration || "",
        locationUrl:
          data.locationUrl || data.individuals?.[0]?.locationUrl || "",
        locationReachTime:
          data.locationReachTime ||
          data.individuals?.[0]?.locationReachTime ||
          "",
        startTime: data.startTime || data.individuals?.[0]?.startTime || "",
        endTime: data.endTime || data.individuals?.[0]?.endTime || "",
      }));

      // console.log("✅ Mapped Meetings:", mappedMeetings); // 👈 this will show all fields

      setMeetings(mappedMeetings);
      setNumMeetings(meetingsData.length.toString()); // <-- ADD THIS LINE
      // Calculate total duration
      const totalMinutes = meetingsData.reduce((sum, meeting) => {
        const match = meeting.duration?.match(/(\d+)\s*hr\s*(\d+)?\s*min?/);
        if (match) {
          const hr = parseInt(match[1] || "0", 10);
          const min = parseInt(match[2] || "0", 10);
          return sum + hr * 60 + min;
        }
        return sum;
      }, 0);

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      setMeetingDuration(`${hours} hr ${minutes} min`);
    } catch (err) {
      console.error("Error fetching today's meetings:", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTodayMeetings();
      fetchTodayCallData();

      const interval = setInterval(fetchTodayCallData, 1000);

      const unsubscribe = onSnapshot(
        query(
          collection(db, "callLogs"),
          where("userId", "==", auth.currentUser?.uid),
          where("timestamp", ">=", new Date(new Date().setHours(0, 0, 0, 0))),
          orderBy("timestamp", "desc")
        ),
        async (snapshot) => {
          const logs = await processCallLogs(snapshot);
          setCallLogs(logs);
          updateMeetingDuration(logs);
        }
      );

      // 🧹 Clean up both snapshot listener and interval on blur
      return () => {
        unsubscribe();
        clearInterval(interval);
      };
    }, [fetchTodayCallData, processCallLogs, updateMeetingDuration])
  );

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredProducts(productList);
    } else {
      setFilteredProducts(
        productList.filter((product) =>
          product.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, productList]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const setupCallLogsListener = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const callLogsRef = collection(db, "callLogs");
      const q = query(
        callLogsRef,
        where("userId", "==", userId),
        where("timestamp", ">=", today),
        orderBy("timestamp", "desc")
      );

      unsubscribe = onSnapshot(q, async (snapshot) => {
        const logs = await processCallLogs(snapshot);
        setCallLogs(logs);
        updateMeetingDuration(logs);
      });
    };

    setupCallLogsListener().finally(() => setIsLoading(false));
    return () => unsubscribe?.();
  }, [processCallLogs, updateMeetingDuration]);

  useEffect(() => {
    const date = new Date();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const dayOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][date.getDay()];
    setCurrentDate(`${day} ${month} (${dayOfWeek})`);
  }, []);

  const saveDraftData = useCallback(async () => {
    try {
      const draftData = {
        numMeetings,
        totalMeetingDuration,
        closingDetails,
        totalAmount,
        date: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.DRAFT_REPORT,
        JSON.stringify(draftData)
      );
    } catch (error) {
      // Handle silently
    }
  }, [
    numMeetings,
    totalMeetingDuration,
    closingDetails,
    totalAmount,
    STORAGE_KEYS,
  ]);

  const loadDraftData = useCallback(async () => {
    try {
      const draftDataString = await AsyncStorage.getItem(
        STORAGE_KEYS.DRAFT_REPORT
      );
      if (draftDataString) {
        const draftData = JSON.parse(draftDataString);
        const draftDate = new Date(draftData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (draftDate.getTime() === today.getTime()) {
          setNumMeetings(draftData.numMeetings || "");
          setMeetingDuration(draftData.totalMeetingDuration || "");

          setClosingDetails(
            draftData.closingDetails || [
              {
                productType: "Health Insurance",
                closingAmount: 0,
                description: "",
              },
            ]
          );
          setTotalAmount(draftData.totalAmount || 0);
        } else {
          await AsyncStorage.removeItem(STORAGE_KEYS.DRAFT_REPORT);
        }
      }
    } catch (error) {
      // Handle silently
    }
  }, [STORAGE_KEYS]);

  const checkPendingReports = useCallback(async () => {
    try {
      const pendingReportsString = await AsyncStorage.getItem(
        STORAGE_KEYS.PENDING_REPORTS
      );
      if (pendingReportsString) {
        const pendingReports = JSON.parse(pendingReportsString);
        if (pendingReports.length > 0) {
          await syncPendingReports(pendingReports);
        }
      }
    } catch (error) {
      // Handle silently
    }
  }, [STORAGE_KEYS]);

  const syncPendingReports = useCallback(
    async (pendingReports: any[]) => {
      try {
        setSyncStatus("syncing");
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const syncedReports: string[] = [];
        for (const report of pendingReports) {
          try {
            await addDoc(collection(db, "bdm_reports"), {
              ...report,
              userId,
              syncedAt: Timestamp.fromDate(new Date()),
            });
            syncedReports.push(report.id);
          } catch (error) {
            // Handle silently
          }
        }

        if (syncedReports.length > 0) {
          const updatedPendingReports = pendingReports.filter(
            (report) => !syncedReports.includes(report.id)
          );
          await AsyncStorage.setItem(
            STORAGE_KEYS.PENDING_REPORTS,
            JSON.stringify(updatedPendingReports)
          );
        }

        setSyncStatus("synced");
      } catch (error) {
        setSyncStatus("error");
      }
    },
    [STORAGE_KEYS]
  );

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    // Validate positiveLeadsFromCalls
    if (
      positiveLeadsFromCalls === undefined ||
      positiveLeadsFromCalls === null ||
      positiveLeadsFromCalls.trim() === ""
    ) {
      newErrors.positiveLeadsFromCalls =
        "Positive leads from calls is required";
    }

    // Validate positiveLeadsFromMeetings
    if (
      positiveLeadsFromMeetings === undefined ||
      positiveLeadsFromMeetings === null ||
      positiveLeadsFromMeetings.trim() === ""
    ) {
      newErrors.positiveLeadsFromMeetings =
        "Positive leads from meetings is required";
    }

    // Validate closing details
    closingDetails.forEach((detail, index) => {
      const product = selectedProducts[index];
      const amount = detail.closingAmount;

      // Product type check
      if (!product || product.trim() === "" || product === "Select product") {
        newErrors[`closing_${index}_productType`] = "Product type is required";
      }

      // Closing amount check
      if (
        amount === undefined ||
        amount === null ||
        amount.toString().trim() === ""
      ) {
        newErrors[`closing_${index}_closingAmount`] =
          "Closing amount is required";
      } else if (isNaN(amount)) {
        newErrors[`closing_${index}_closingAmount`] = "Enter a valid number";
      }

      // Optional: description is not required unless you want it to be
    });

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Error", "You must be logged in to submit a report");
        return;
      }

      let submittedBy = "Unknown";
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        submittedBy = userDoc.data().name || "Unnamed User";
      }

      const now = new Date();
      const reportId = `report_${now.getTime()}`;
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const weekNumber = Math.ceil(
        (now.getDate() + new Date(year, now.getMonth(), 1).getDay()) / 7
      );
      const day = now.getDate();
      // Calculate accurate totalMeetingDuration from meetings array
      const totalMinutes = meetings.reduce((acc, m) => {
        const start = m.startTime;
        const end = m.endTime;
        if (start && end) {
          const startDate = new Date(`1970-01-01T${convertTo24Hr(start)}:00`);
          const endDate = new Date(`1970-01-01T${convertTo24Hr(end)}:00`);
          const diffMs = endDate.getTime() - startDate.getTime();
          const minutes = diffMs / (1000 * 60);
          return acc + (minutes > 0 ? minutes : 0);
        }
        return acc;
      }, 0);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.round(totalMinutes % 60);
      const formattedDuration = `${String(hours).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")}:00`;
      const meetingsWithDuration = meetings.map((m) => {
        let duration = "";

        if (m.startTime && m.endTime) {
          try {
            const startDate = new Date(
              `1970-01-01T${convertTo24Hr(m.startTime)}:00`
            );
            const endDate = new Date(
              `1970-01-01T${convertTo24Hr(m.endTime)}:00`
            );
            const diffMin = Math.floor(
              (endDate.getTime() - startDate.getTime()) / (1000 * 60)
            );

            if (diffMin > 0) {
              const hr = Math.floor(diffMin / 60);
              const min = diffMin % 60;
              duration = `${hr} hr ${min} min`;
            }
          } catch (error) {
            console.warn("Error calculating duration", error);
          }
        }

        return { ...m, duration };
      });

      const reportData = {
        id: reportId,
        userId,
        submittedBy,
        date: now.toISOString(),
        month,
        year,
        weekNumber,
        day,
        numMeetings: Number(numMeetings),
        totalMeetingDuration: formattedDuration,

        closingDetails,
        totalClosingAmount: totalAmount,
        numCalls: Number(numCalls),
        callDuration,
        positiveLeadsFromCalls: Number(positiveLeadsFromCalls || 0),
        positiveLeadsFromMeetings: Number(positiveLeadsFromMeetings || 0),
        meetings: meetingsWithDuration,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        synced: false,
      };

      await saveReportLocally(reportData);
      try {
        await syncReportToFirebase(reportData);
      } catch (error) {
        // Handle silently
      }

      await AsyncStorage.removeItem(STORAGE_KEYS.DRAFT_REPORT);
      setModalVisible(true);
      setTimeout(() => {
        setModalVisible(false);

        setClosingDetails([
          {
            productType: "Health Insurance",
            closingAmount: 0,
            description: "",
          },
        ]);
        setTotalAmount(0);
        setSelectedProducts({ 0: "Health Insurance" });
      }, 2000);
    } catch (error) {
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    numMeetings,
    totalMeetingDuration,
    closingDetails,
    totalAmount,
    numCalls,
    callDuration,
    positiveLeadsFromCalls,
    meetings,
    positiveLeadsFromMeetings,
    STORAGE_KEYS,
  ]);

  const saveReportLocally = useCallback(
    async (reportData: any) => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.LAST_REPORT,
          JSON.stringify(reportData)
        );
        const { year, month, weekNumber, day } = reportData;
        const structuredKey = `bdm_reports_${year}_${month}_${weekNumber}_${day}`;

        const existingReportsString = await AsyncStorage.getItem(structuredKey);
        const existingReports = existingReportsString
          ? JSON.parse(existingReportsString)
          : [];
        existingReports.push(reportData);

        await AsyncStorage.setItem(
          structuredKey,
          JSON.stringify(existingReports)
        );

        if (!reportData.synced) {
          const pendingReportsString = await AsyncStorage.getItem(
            STORAGE_KEYS.PENDING_REPORTS
          );
          const pendingReports = pendingReportsString
            ? JSON.parse(pendingReportsString)
            : [];
          pendingReports.push(reportData);
          await AsyncStorage.setItem(
            STORAGE_KEYS.PENDING_REPORTS,
            JSON.stringify(pendingReports)
          );
        }

        await updateWeeklySummary(reportData);
      } catch (error) {
        throw error;
      }
    },
    [STORAGE_KEYS]
  );

  const updateWeeklySummary = useCallback(async (reportData: any) => {
    try {
      const { year, month, weekNumber } = reportData;
      const weeklyKey = `bdm_weekly_summary_${year}_${month}_${weekNumber}`;

      const existingSummaryString = await AsyncStorage.getItem(weeklyKey);
      const existingSummary = existingSummaryString
        ? JSON.parse(existingSummaryString)
        : {
            year,
            month,
            weekNumber,
            totalMeetings: 0,
            totalDuration: 0,
            totalPositiveLeads: 0,
            totalClosingAmount: 0,
            reports: [],
          };

      existingSummary.totalMeetings += reportData.numMeetings;
      existingSummary.totalPositiveLeads += reportData.positiveLeads;
      existingSummary.totalClosingAmount += reportData.totalClosingAmount;

      const durationStr = reportData.totalMeetingDuration || "";
      let totalDurationHours = 0;
      if (durationStr.includes(":")) {
        const [hours, minutes, seconds] = durationStr.split(":").map(Number);
        totalDurationHours = hours + minutes / 60 + seconds / 3600;
      }
      existingSummary.totalDuration += totalDurationHours;

      if (!existingSummary.reports.some((r: any) => r.id === reportData.id)) {
        existingSummary.reports.push(reportData);
      }

      await AsyncStorage.setItem(weeklyKey, JSON.stringify(existingSummary));
    } catch (error) {
      // Handle silently
    }
  }, []);

  const syncReportToFirebase = useCallback(
    async (reportData: any) => {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("User not authenticated");

      let formattedDuration = reportData.totalMeetingDuration;
      if (formattedDuration && !formattedDuration.includes(":")) {
        const hrMatch = formattedDuration.match(/(\d+)\s*hr/);
        const minMatch = formattedDuration.match(/(\d+)\s*min/);
        const hours = hrMatch ? parseInt(hrMatch[1]) : 0;
        const minutes = minMatch ? parseInt(minMatch[1]) : 0;
        formattedDuration = `${String(hours).padStart(2, "0")}:${String(
          minutes
        ).padStart(2, "0")}:00`;
      }

      const reportsRef = collection(db, "bdm_reports");
      await addDoc(reportsRef, {
        ...reportData,
        totalMeetingDuration: formattedDuration,
        synced: true,
        syncedAt: Timestamp.fromDate(new Date()),
      });

      const weeklySummaryRef = doc(
        db,
        "bdm_weekly_summaries",
        `${userId}_${reportData.year}_${reportData.month}_${reportData.weekNumber}`
      );
      const weeklySummaryDoc = await getDoc(weeklySummaryRef);

      let totalDurationHours = 0;
      if (formattedDuration.includes(":")) {
        const [hours, minutes, seconds] = formattedDuration
          .split(":")
          .map(Number);
        totalDurationHours = hours + minutes / 60 + seconds / 3600;
      }

      if (weeklySummaryDoc.exists()) {
        await updateDoc(weeklySummaryRef, {
          totalMeetings: increment(reportData.numMeetings),
          totalDuration: increment(totalDurationHours),
          totalPositiveLeads: increment(reportData.positiveLeads),
          totalClosingAmount: increment(reportData.totalClosingAmount),
          updatedAt: Timestamp.fromDate(new Date()),
        });
      } else {
        await setDoc(weeklySummaryRef, {
          userId,
          year: reportData.year,
          month: reportData.month,
          weekNumber: reportData.weekNumber,
          totalMeetings: reportData.numMeetings,
          totalDuration: totalDurationHours,
          totalPositiveLeads: reportData.positiveLeads,
          totalClosingAmount: reportData.totalClosingAmount,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        });
      }

      const pendingReportsString = await AsyncStorage.getItem(
        STORAGE_KEYS.PENDING_REPORTS
      );
      if (pendingReportsString) {
        const pendingReports = JSON.parse(pendingReportsString);
        const updatedPendingReports = pendingReports.filter(
          (report: any) => report.id !== reportData.id
        );
        await AsyncStorage.setItem(
          STORAGE_KEYS.PENDING_REPORTS,
          JSON.stringify(updatedPendingReports)
        );
      }
    },
    [STORAGE_KEYS]
  );

  const syncLocalWithFirebase = useCallback(async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      setSyncStatus("syncing");
      const pendingReportsString = await AsyncStorage.getItem(
        STORAGE_KEYS.PENDING_REPORTS
      );
      if (!pendingReportsString) {
        setSyncStatus("synced");
        return;
      }

      const pendingReports = JSON.parse(pendingReportsString);
      if (pendingReports.length === 0) {
        setSyncStatus("synced");
        return;
      }

      const reportsByWeek: { [key: string]: any[] } = {};
      pendingReports.forEach((report: any) => {
        const weekKey = `${report.year}_${report.month}_${report.weekNumber}`;
        reportsByWeek[weekKey] = reportsByWeek[weekKey] || [];
        reportsByWeek[weekKey].push(report);
      });

      for (const weekKey in reportsByWeek) {
        const reports = reportsByWeek[weekKey];
        const [year, month, weekNumber] = weekKey.split("_").map(Number);

        for (const report of reports) {
          let formattedDuration = report.totalMeetingDuration;
          if (formattedDuration && !formattedDuration.includes(":")) {
            const hrMatch = formattedDuration.match(/(\d+)\s*hr/);
            const minMatch = formattedDuration.match(/(\d+)\s*min/);
            const hours = hrMatch ? parseInt(hrMatch[1]) : 0;
            const minutes = minMatch ? parseInt(minMatch[1]) : 0;
            formattedDuration = `${String(hours).padStart(2, "0")}:${String(
              minutes
            ).padStart(2, "0")}:00`;
          }

          await addDoc(collection(db, "bdm_reports"), {
            ...report,
            totalMeetingDuration: formattedDuration,
            synced: true,
            syncedAt: Timestamp.fromDate(new Date()),
          });
        }

        let totalMeetings = 0;
        let totalDuration = 0;
        let totalPositiveLeads = 0;
        let totalClosingAmount = 0;

        reports.forEach((report: any) => {
          totalMeetings += report.numMeetings || 0;
          totalPositiveLeads += report.positiveLeads || 0;
          totalClosingAmount += report.totalClosingAmount || 0;

          const durationStr = report.totalMeetingDuration || "";
          if (durationStr.includes(":")) {
            const [hours, minutes, seconds] = durationStr
              .split(":")
              .map(Number);
            totalDuration += hours + minutes / 60 + seconds / 3600;
          }
        });

        const weeklySummaryRef = doc(
          db,
          "bdm_weekly_summaries",
          `${userId}_${year}_${month}_${weekNumber}`
        );
        const weeklySummaryDoc = await getDoc(weeklySummaryRef);

        if (weeklySummaryDoc.exists()) {
          await updateDoc(weeklySummaryRef, {
            totalMeetings: increment(totalMeetings),
            totalDuration: increment(totalDuration),
            totalPositiveLeads: increment(totalPositiveLeads),
            totalClosingAmount: increment(totalClosingAmount),
            updatedAt: Timestamp.fromDate(new Date()),
          });
        } else {
          await setDoc(weeklySummaryRef, {
            userId,
            year,
            month,
            weekNumber,
            totalMeetings,
            totalDuration,
            totalPositiveLeads,
            totalClosingAmount,
            createdAt: Timestamp.fromDate(new Date()),
            updatedAt: Timestamp.fromDate(new Date()),
          });
        }
      }

      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_REPORTS,
        JSON.stringify([])
      );
      setSyncStatus("synced");
    } catch (error) {
      setSyncStatus("error");
    }
  }, [STORAGE_KEYS]);

  useEffect(() => {
    const autoSaveTimer = setTimeout(saveDraftData, 1000);
    return () => clearTimeout(autoSaveTimer);
  }, [saveDraftData]);

  useEffect(() => {
    syncLocalWithFirebase();
    const interval = setInterval(syncLocalWithFirebase, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [syncLocalWithFirebase]);

  const addClosingDetail = useCallback(() => {
    setClosingDetails((prev) => [
      ...prev,
      { productType: "Health Insurance", closingAmount: 0, description: "" },
    ]);
    setSelectedProducts((prev) => ({
      ...prev,
      [closingDetails.length]: "Health Insurance",
    }));
  }, [closingDetails.length]);

  const removeClosingDetail = useCallback((index: number) => {
    setClosingDetails((prev) => prev.filter((_, i) => i !== index));
    setSelectedProducts((prev) => {
      const newProducts = { ...prev };
      delete newProducts[index];
      return newProducts;
    });
  }, []);

  const updateClosingDetail = useCallback(
    (index: number, field: keyof ClosingDetail, value: any) => {
      setClosingDetails((prev) => {
        const newDetails = [...prev];
        if (field === "closingAmount") {
          newDetails[index] = {
            ...newDetails[index],
            [field]: Number(value) || 0,
          };
          setTotalAmount(
            newDetails.reduce(
              (sum, detail) => sum + (detail.closingAmount || 0),
              0
            )
          );
        } else {
          newDetails[index] = { ...newDetails[index], [field]: value };
        }
        return newDetails;
      });
    },
    []
  );

  const toggleProductDropdown = useCallback((index: number) => {
    setShowProductDropdown((prev) => (prev === index ? null : index));
    setSearchQuery("");
    setShowOtherInput(null);
  }, []);

  const toggleProductSelection = useCallback(
    (index: number, product: string) => {
      if (product === "Other") {
        setShowOtherInput(index);
        return;
      }

      setSelectedProducts((prev) => ({ ...prev, [index]: product }));
      setClosingDetails((prev) => {
        const newDetails = [...prev];
        newDetails[index].productType = product === "None" ? "" : product;
        return newDetails;
      });
      setShowProductDropdown(null);
    },
    []
  );

  const addCustomProduct = useCallback(
    (index: number) => {
      if (!otherProductInput.trim()) return;

      const newProduct = otherProductInput.trim();
      setSelectedProducts((prev) => ({ ...prev, [index]: newProduct }));
      setClosingDetails((prev) => {
        const newDetails = [...prev];
        newDetails[index].productType = newProduct;
        return newDetails;
      });
      setOtherProductInput("");
      setShowOtherInput(null);
    },
    [otherProductInput]
  );

  return (
    <AppGradient>
      <BDMMainLayout title="Daily Report" showBackButton>
        <View style={styles.container}>
          {isLoading ? (
            <FormSkeleton />
          ) : (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
            >
              <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.contentContainer}>
                  <Text style={styles.dateText}>{currentDate}</Text>

                  {syncStatus === "syncing" && (
                    <View style={styles.syncStatusContainer}>
                      <ActivityIndicator size="small" color="#FF8447" />
                      <Text style={styles.syncStatusText}>
                        Syncing reports...
                      </Text>
                    </View>
                  )}
                  {syncStatus === "synced" && (
                    <View style={styles.syncStatusContainer}>
                      <MaterialIcons
                        name="check-circle"
                        size={16}
                        color="#4CAF50"
                      />
                      <Text style={styles.syncStatusText}>
                        Reports synced successfully
                      </Text>
                    </View>
                  )}
                  {syncStatus === "error" && (
                    <View style={styles.syncStatusContainer}>
                      <MaterialIcons name="error" size={16} color="#F44336" />
                      <Text style={styles.syncStatusText}>
                        Error syncing reports
                      </Text>
                    </View>
                  )}

                  <View style={styles.section}>
                    <Text style={styles.label}>Number of Calls</Text>
                    <View style={styles.readOnlyInput}>
                      <Text style={styles.readOnlyText}>{numCalls}</Text>
                    </View>

                    <Text style={styles.label}>Call Duration</Text>
                    <View style={styles.readOnlyInput}>
                      <Text style={styles.readOnlyText}>{callDuration}</Text>
                    </View>

                    <Text style={styles.label}>
                      Positive Leads from Calls{" "}
                      <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        errors.positiveLeadsFromCalls
                          ? styles.inputError
                          : null,
                      ]}
                      placeholder="Enter Positive Leads"
                      value={positiveLeadsFromCalls}
                      onChangeText={(text) => {
                        setPositiveLeadsFromCalls(text);
                        if (errors.positiveLeadsFromCalls) {
                          setErrors((prev) => ({
                            ...prev,
                            positiveLeadsFromCalls: "",
                          }));
                        }
                      }}
                      keyboardType="numeric"
                    />
                    {errors.positiveLeadsFromCalls && (
                      <Text style={styles.errorText}>
                        {errors.positiveLeadsFromCalls}
                      </Text>
                    )}
                  </View>

                  <View style={styles.separator} />

                  <View style={styles.section}>
                    <Text style={styles.label}>Number of Meetings</Text>
                    <View style={styles.readOnlyInput}>
                      <Text style={styles.readOnlyText}>{numMeetings}</Text>
                    </View>

                    <Text style={styles.label}>Meeting Duration</Text>
                    <View style={styles.readOnlyInput}>
                      <Text style={styles.readOnlyText}>
                        {(() => {
                          const totalMinutes = meetings.reduce((acc, m) => {
                            const start = m.startTime;
                            const end = m.endTime;

                            if (start && end) {
                              const startDate = new Date(
                                `1970-01-01T${convertTo24Hr(start)}:00`
                              );
                              const endDate = new Date(
                                `1970-01-01T${convertTo24Hr(end)}:00`
                              );
                              const diffMs =
                                endDate.getTime() - startDate.getTime();
                              const minutes = diffMs / (1000 * 60);
                              return acc + (minutes > 0 ? minutes : 0); // avoid negatives
                            }

                            return acc;
                          }, 0);

                          const hours = Math.floor(totalMinutes / 60);
                          const minutes = Math.round(totalMinutes % 60);

                          return totalMinutes > 0
                            ? `${hours} hr ${minutes} min`
                            : "0 hr 0 min";
                        })()}
                      </Text>
                    </View>

                    {/* Dynamic Meetings List */}
                    {meetings.map((meeting, idx) => (
                      <View key={idx} style={styles.meetingCard}>
                        <TouchableOpacity
                          style={styles.meetingRow}
                          onPress={() =>
                            setExpandedMeetingIndex(
                              expandedMeetingIndex === idx ? null : idx
                            )
                          }
                          activeOpacity={0.8}
                        >
                          <View style={styles.meetingIcon}>
                            <MaterialIcons
                              name="person"
                              size={24}
                              color="#B48A00"
                            />
                          </View>
                          <Text style={styles.meetingName}>
                            {meeting.name || "Unnamed"}
                          </Text>

                          <Text style={styles.meetingDuration}>
                            {(() => {
                              if (meeting.startTime && meeting.endTime) {
                                try {
                                  const start = new Date(
                                    `1970-01-01T${convertTo24Hr(
                                      meeting.startTime
                                    )}:00`
                                  );
                                  const end = new Date(
                                    `1970-01-01T${convertTo24Hr(
                                      meeting.endTime
                                    )}:00`
                                  );
                                  const diffMin =
                                    (end.getTime() - start.getTime()) /
                                    (1000 * 60);
                                  if (diffMin > 0) {
                                    const hr = Math.floor(diffMin / 60);
                                    const min = Math.round(diffMin % 60);
                                    return `${hr} hr ${min} min`;
                                  }
                                } catch (error) {
                                  // console.log(
                                  //   "Error calculating duration:",
                                  //   error
                                  // );
                                }
                              }
                              return "N/A";
                            })()}
                          </Text>
                          <MaterialIcons
                            name={
                              expandedMeetingIndex === idx
                                ? "keyboard-arrow-up"
                                : "keyboard-arrow-down"
                            }
                            size={28}
                            color="#666"
                          />
                        </TouchableOpacity>
                        {expandedMeetingIndex === idx && (
                          <View style={styles.meetingDetails}>
                            <Text style={styles.meetingDetailText}>
                              <Text style={styles.meetingDetailLabel}>
                                Location URL -{" "}
                              </Text>
                              {meeting.locationUrl || "N/A"}
                            </Text>
                            <Text style={styles.meetingDetailText}>
                              <Text style={styles.meetingDetailLabel}>
                                Location Reach Time -{" "}
                              </Text>
                              {meeting.locationReachTime || "N/A"}
                            </Text>
                            <Text style={styles.meetingDetailText}>
                              <Text style={styles.meetingDetailLabel}>
                                Meeting Start Time -{" "}
                              </Text>
                              {meeting.startTime || "N/A"}
                            </Text>
                            <Text style={styles.meetingDetailText}>
                              <Text style={styles.meetingDetailLabel}>
                                Meeting End Time -{" "}
                              </Text>
                              {meeting.endTime || "N/A"}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                    <Text style={styles.label}>
                      Positive Leads from Meeting{" "}
                      <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        errors.positiveLeadsFromMeetings
                          ? styles.inputError
                          : null,
                      ]}
                      placeholder="Enter Positive Leads"
                      value={positiveLeadsFromMeetings}
                      onChangeText={(text) => {
                        setPositiveLeadsFromMeetings(text);
                        if (errors.positiveLeadsFromMeetings) {
                          setErrors((prev) => ({
                            ...prev,
                            positiveLeadsFromMeetings: "",
                          }));
                        }
                      }}
                      keyboardType="numeric"
                    />
                    {errors.positiveLeadsFromMeetings && (
                      <Text style={styles.errorText}>
                        {errors.positiveLeadsFromMeetings}
                      </Text>
                    )}
                  </View>

                  <View style={styles.separator} />

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Closing Details</Text>

                    {closingDetails.map((detail, index) => (
                      <View key={index} style={styles.closingDetailContainer}>
                        {index > 0 && (
                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeClosingDetail(index)}
                          >
                            <MaterialIcons
                              name="remove-circle"
                              size={24}
                              color="#FF5252"
                            />
                          </TouchableOpacity>
                        )}

                        <Text style={styles.label}>
                          Type of Product{" "}
                          <Text style={styles.requiredStar}>*</Text>
                        </Text>

                        <TouchableOpacity
                          style={styles.dropdownButton}
                          onPress={() => toggleProductDropdown(index)}
                        >
                          <Text style={styles.dropdownButtonText}>
                            {selectedProducts[index] || "Select product"}
                          </Text>
                          <MaterialIcons
                            name={
                              showProductDropdown === index
                                ? "arrow-drop-up"
                                : "arrow-drop-down"
                            }
                            size={24}
                            color="#666"
                          />
                        </TouchableOpacity>

                        {errors[`closing_${index}_productType`] && (
                          <Text style={styles.errorText}>
                            {errors[`closing_${index}_productType`]}
                          </Text>
                        )}

                        {showProductDropdown === index && (
                          <View style={styles.dropdownContainer}>
                            <View style={styles.searchContainer}>
                              <TextInput
                                style={styles.searchInput}
                                placeholder="Search products..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                              />
                              <MaterialIcons
                                name="search"
                                size={20}
                                color="#666"
                              />
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
                                    selectedProducts[index] === item
                                      ? styles.dropdownItemSelected
                                      : null,
                                  ]}
                                  onPress={() =>
                                    toggleProductSelection(index, item)
                                  }
                                >
                                  <Text
                                    style={[
                                      styles.dropdownItemText,
                                      selectedProducts[index] === item
                                        ? styles.dropdownItemTextSelected
                                        : null,
                                    ]}
                                  >
                                    {item}
                                  </Text>
                                  {selectedProducts[index] === item && (
                                    <MaterialIcons
                                      name="check"
                                      size={20}
                                      color="#FFFFFF"
                                    />
                                  )}
                                </TouchableOpacity>
                              )}
                              ListEmptyComponent={
                                <Text style={styles.noResultsText}>
                                  No products found
                                </Text>
                              }
                            />

                            {showOtherInput === index && (
                              <View style={styles.otherProductContainer}>
                                <TextInput
                                  style={styles.otherProductInput}
                                  placeholder="Enter custom product name"
                                  value={otherProductInput}
                                  onChangeText={setOtherProductInput}
                                />
                                <TouchableOpacity
                                  style={styles.addCustomButton}
                                  onPress={() => addCustomProduct(index)}
                                >
                                  <Text style={styles.addCustomButtonText}>
                                    Add
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}

                            <TouchableOpacity
                              style={styles.closeDropdownButton}
                              onPress={() => {
                                setShowProductDropdown(null);
                                setShowOtherInput(null);
                                setOtherProductInput("");
                              }}
                            >
                              <Text style={styles.closeDropdownText}>Done</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        <Text style={styles.label}>
                          Closing Amount{" "}
                          <Text style={styles.requiredStar}>*</Text>
                        </Text>
                        <View style={styles.amountInputContainer}>
                          <Text style={styles.currencySymbol}>₹</Text>
                          <TextInput
                            style={[
                              styles.amountInput,
                              errors[`closing_${index}_closingAmount`]
                                ? styles.inputError
                                : null,
                            ]}
                            placeholder="Enter Amount"
                            value={
                              detail.closingAmount
                                ? detail.closingAmount.toString()
                                : ""
                            }
                            onChangeText={(text) =>
                              updateClosingDetail(index, "closingAmount", text)
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
                            errors[`closing_${index}_description`]
                              ? styles.inputError
                              : null,
                          ]}
                          placeholder="Enter description product wise, if multiple products are selected"
                          value={detail.description}
                          onChangeText={(text) =>
                            updateClosingDetail(index, "description", text)
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

                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={addClosingDetail}
                    >
                      <MaterialIcons name="add" size={24} color="#FF8447" />
                      <Text style={styles.addButtonText}>
                        Add Another Closing
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.totalContainer}>
                      <Text style={styles.totalLabel}>
                        Total Closing Amount{" "}
                        <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <View style={styles.totalAmountContainer}>
                        <Text style={styles.totalCurrencySymbol}>₹</Text>
                        <Text style={styles.totalAmount}>
                          {totalAmount.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitText}>Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </View>
      </BDMMainLayout>

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
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1 },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    marginHorizontal: 10,
  },
  contentContainer: { padding: 20 },
  dateText: {
    fontSize: 20,
    color: "#FF8447",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "LexendDeca_500Medium",
  },
  section: { marginBottom: 20 },
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
  requiredStar: { color: "#FF5252" },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#F9F9F9",
    fontFamily: "LexendDeca_400Regular",
    fontSize: 16,
  },
  inputError: { borderColor: "#FF5252" },
  errorText: {
    color: "#FF5252",
    fontSize: 12,
    marginTop: 4,
    fontFamily: "LexendDeca_400Regular",
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
  dropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    backgroundColor: "#F9F9F9",
    padding: 12,
    marginBottom: 15,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#333",
    fontFamily: "LexendDeca_400Regular",
    flex: 1,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    marginBottom: 15,
    elevation: 3,
    maxHeight: 300,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    padding: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 8,
    fontFamily: "LexendDeca_400Regular",
  },
  dropdownList: { maxHeight: 200 },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  dropdownItemSelected: { backgroundColor: "#FFF5E6" },
  dropdownItemText: {
    fontSize: 16,
    color: "#333",
    fontFamily: "LexendDeca_400Regular",
    flex: 1,
  },
  dropdownItemTextSelected: { color: "#FF8447" },
  noResultsText: {
    padding: 16,
    textAlign: "center",
    color: "#999",
    fontFamily: "LexendDeca_400Regular",
  },
  closeDropdownButton: {
    padding: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    backgroundColor: "#FAFAFA",
  },
  closeDropdownText: {
    fontSize: 16,
    color: "#FF8447",
    fontFamily: "LexendDeca_500Medium",
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
  syncStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  syncStatusText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
  },
  otherProductContainer: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    backgroundColor: "#FAFAFA",
  },
  otherProductInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    fontFamily: "LexendDeca_400Regular",
  },
  addCustomButton: {
    marginLeft: 8,
    backgroundColor: "#FF8447",
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  addCustomButtonText: {
    color: "#FFFFFF",
    fontFamily: "LexendDeca_500Medium",
  },
  meetingCard: {
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 10,
    backgroundColor: "#FFF",
    marginBottom: 12,
    overflow: "hidden",
  },
  meetingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  meetingIcon: {
    backgroundColor: "#FFE28A",
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  meetingName: {
    flex: 1,
    fontSize: 16,
    color: "#444",
    fontFamily: "LexendDeca_500Medium",
  },
  meetingDuration: {
    fontSize: 15,
    color: "#444",
    fontFamily: "LexendDeca_500Medium",
    marginRight: 8,
  },
  meetingDetails: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    backgroundColor: "#FAFAFA",
  },
  meetingDetailText: {
    fontSize: 14,
    color: "#444",
    marginBottom: 4,
    fontFamily: "LexendDeca_400Regular",
  },
  meetingDetailLabel: {
    fontWeight: "bold",
    color: "#444",
  },
});

export default BDMReportScreen;
