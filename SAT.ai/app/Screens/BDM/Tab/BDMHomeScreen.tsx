import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  RefreshControl,
  PermissionsAndroid,
  Dimensions,
  Alert,
} from "react-native";
import { ProgressBar } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";
import { useProfile } from "@/app/context/ProfileContext";
import { BDMStackParamList } from "@/app/index";
import BDMMainLayout from "@/app/components/BDMMainLayout";
import CallLog from "react-native-call-log";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "@/firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppGradient from "@/app/components/AppGradient";
import { startOfWeek, endOfWeek, format } from "date-fns";
import Dialer from "@/app/components/Dialer/Dialer";
import * as Linking from "expo-linking";
import TelecallerAddContactModal from "@/app/Screens/Telecaller/TelecallerAddContactModal";

// Interfaces remain unchanged
interface CallLogEntry {
  phoneNumber: string;
  timestamp: string;
  type: string;
  duration: number;
  id?: string;
  name?: string;
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
  isNewContact?: boolean;
  notes?: string[];
  contactType?: "person" | "company";
  companyInfo?: Company;
}

interface MonthlyCallHistory {
  phoneNumber: string;
  totalCalls: number;
  lastCallDate: Date;
  callTypes: {
    incoming: number;
    outgoing: number;
    missed: number;
    rejected: number;
  };
  totalDuration: number;
  dailyCalls: {
    [date: string]: {
      count: number;
      duration: number;
      callTypes: {
        incoming: number;
        outgoing: number;
        missed: number;
        rejected: number;
      };
    };
  };
}

interface GroupedCallLog extends CallLog {
  callCount: number;
  allCalls: CallLog[];
  monthlyHistory?: MonthlyCallHistory;
  companyInfo?: Company;
}

interface Contact {
  firstName: string;
  lastName: string;
  id: string;
  phoneNumbers?: Array<{
    number: string;
  }>;
  company?: string;
  contactType?: "person" | "company";
}

interface Company {
  name: string;
  contacts?: Contact[];
  domain?: string;
  industry?: string;
}

interface CompanyDatabase {
  [domain: string]: Company;
}

const CALL_LOGS_STORAGE_KEY = "device_call_logs";
const CALL_LOGS_LAST_UPDATE = "call_logs_last_update";
const OLDER_LOGS_UPDATE_INTERVAL = 12 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ACHIEVEMENT_STORAGE_KEY = "bdm_weekly_achievement";

const COMPANY_DATABASE: CompanyDatabase = {
  "google.com": {
    name: "Google",
    domain: "google.com",
    industry: "Technology",
    contacts: [
      { firstName: "John", lastName: "Smith", id: "gs1", contactType: "company", company: "Google" },
      { firstName: "Sarah", lastName: "Lee", id: "gs2", contactType: "company", company: "Google" },
    ],
  },
  "amazon.com": {
    name: "Amazon",
    domain: "amazon.com",
    industry: "E-commerce",
    contacts: [{ firstName: "Mike", lastName: "Johnson", id: "am1", contactType: "company", company: "Amazon" }],
  },
  "microsoft.com": {
    name: "Microsoft",
    domain: "microsoft.com",
    industry: "Technology",
    contacts: [{ firstName: "Priya", lastName: "Patel", id: "ms1", contactType: "company", company: "Microsoft" }],
  },
};

const detectCompany = (phoneNumber: string, contactName: string): { isCompany: boolean; company?: Company } => {
  if (contactName) {
    for (const domain in COMPANY_DATABASE) {
      const company = COMPANY_DATABASE[domain];
      if (contactName.toLowerCase().includes(company.name.toLowerCase())) {
        return { isCompany: true, company };
      }
    }
  }

  const companyPhonePatterns: Record<string, string> = {
    "+1800": "google.com",
    "+1844": "amazon.com",
    "+1866": "microsoft.com",
  };

  for (const pattern in companyPhonePatterns) {
    if (phoneNumber.startsWith(pattern)) {
      const domain = companyPhonePatterns[pattern];
      return { isCompany: true, company: COMPANY_DATABASE[domain] };
    }
  }

  return { isCompany: false };
};

const SkeletonLoader = React.memo(({ width, height, style }: { width: number | string; height: number; style?: any }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return <Animated.View style={[{ width, height, backgroundColor: "#E5E7EB", borderRadius: 8, opacity }, style]} />;
});

const BDMHomeScreen = () => {
  const [callLogs, setCallLogs] = useState<GroupedCallLog[]>([]);
  const [isDialerVisible, setDialerVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callTimer, setCallTimer] = useState<NodeJS.Timeout | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [isCallActive, setCallActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState(0.4);
  const [progressText, setProgressText] = useState("40%");
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [userName, setUserName] = useState("User");
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isLoadingSimLogs, setIsLoadingSimLogs] = useState(false);
  const [savedContacts, setSavedContacts] = useState<{ [key: string]: boolean }>({});
  const [selectedNumber, setSelectedNumber] = useState("");
  const [addContactModalVisible, setAddContactModalVisible] = useState(false);
  const [weeklyAchievement, setWeeklyAchievement] = useState({
    percentageAchieved: 0,
    isLoading: true,
  });
  const [meetingStats, setMeetingStats] = useState({
    totalMeetings: 0,
    totalDuration: 0,
  });

  const navigation = useNavigation<StackNavigationProp<BDMStackParamList>>();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dialerHeight = useRef(new Animated.Value(0)).current;
  const dialerY = useRef(new Animated.Value(Dimensions.get("window").height)).current;
  const dialerOpacity = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const { userProfile } = useProfile();
  const processedLogs = useRef<CallLog[]>([]);

  const checkAndRequestPermissions = useCallback(async () => {
    try {
      const hasPermission = await requestCallLogPermission();
      return hasPermission;
    } catch (error) {
      return false;
    }
  }, []);

  const requestCallLogPermission = useCallback(async () => {
    if (Platform.OS === "android") {
      try {
        const permissions = [PermissionsAndroid.PERMISSIONS.READ_CALL_LOG, PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE];
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        const allGranted = Object.values(granted).every((permission) => permission === PermissionsAndroid.RESULTS.GRANTED);

        if (!allGranted) {
          Alert.alert("Permission Required", "Call log permissions are required to view call history.", [{ text: "OK" }]);
        }
        return allGranted;
      } catch (err) {
        return false;
      }
    }
    return false;
  }, []);

  const loadSavedContacts = useCallback(async () => {
    try {
      const storedContacts = await AsyncStorage.getItem("contacts");
      if (storedContacts) {
        const contacts = JSON.parse(storedContacts);
        const contactsMap = contacts.reduce((acc: { [key: string]: boolean }, contact: any) => {
          if (contact.phoneNumber) {
            acc[contact.phoneNumber] = true;
          }
          return acc;
        }, {});
        setSavedContacts(contactsMap);
      }
    } catch (error) {}
  }, []);

  const fetchCallLogs = useCallback(async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const now = new Date();
      const startOfToday = new Date(now.setHours(0, 0, 0, 0));
      const callLogsRef = collection(db, "callLogs");
      const logsQuery = query(callLogsRef, where("userId", "==", userId), where("timestamp", ">=", startOfToday), orderBy("timestamp", "desc"));

      return onSnapshot(logsQuery, async (snapshot) => {
        const logs = await processCallLogs(snapshot);
        updateCallLogsState(logs, "current");
      });
    } catch (error) {}
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
        try {
          const contactDocRef = doc(db, "contacts", data.contactId);
          const contactDoc = await getDoc(contactDocRef);
          if (contactDoc.exists()) {
            const contactData = contactDoc.data();
            log.contactName = contactData.name || "";
          }
        } catch (err) {}
      }

      logs.push(log);
    }

    return logs;
  }, []);

  const updateCallLogsState = useCallback((logs: CallLog[], type: "current" | "all") => {
    const groupedLogs = logs.reduce((acc: { [key: string]: GroupedCallLog }, log) => {
      if (!log.phoneNumber) return acc;
      const key = log.phoneNumber;
      if (!acc[key]) {
        acc[key] = { ...log, callCount: 1, allCalls: [log] };
      } else {
        acc[key].callCount++;
        acc[key].allCalls.push(log);
        if (log.timestamp && acc[key].timestamp && log.timestamp > acc[key].timestamp) {
          acc[key].timestamp = log.timestamp;
          acc[key].duration = log.duration;
          acc[key].type = log.type;
          acc[key].status = log.status;
          acc[key].contactName = log.contactName;
        }
      }
      return acc;
    }, {});

    const sortedLogs = Object.values(groupedLogs).sort((a, b) => {
      const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
      const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
      return bTime - aTime;
    });

    setCallLogs(sortedLogs);
  }, []);

  const fetchDeviceCallLogs = useCallback(async () => {
    try {
      setIsLoadingSimLogs(true);
      const lastUpdate = await AsyncStorage.getItem(CALL_LOGS_LAST_UPDATE);
      const storedLogs = await AsyncStorage.getItem(CALL_LOGS_STORAGE_KEY);
      const now = Date.now();
      const thirtyDaysAgo = new Date(now - THIRTY_DAYS_MS);

      if (storedLogs && lastUpdate && now - parseInt(lastUpdate) < 60000) {
        try {
          const parsedLogs = JSON.parse(storedLogs);
          const recentLogs = deduplicateCallLogs(
            parsedLogs.filter((log: any) => new Date(log.timestamp).getTime() >= thirtyDaysAgo.getTime())
          );
          const formattedLogs = recentLogs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp).toISOString(),
            duration: parseInt(log.duration) || 0,
            type: log.type || "outgoing",
            status: log.status || "completed",
          }));
          updateCallLogsState(formattedLogs, "all");
        } catch (error) {
          await fetchFreshLogs();
        }
      } else {
        await fetchFreshLogs();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to fetch call logs");
      try {
        const storedLogs = await AsyncStorage.getItem(CALL_LOGS_STORAGE_KEY);
        if (storedLogs) {
          const parsedLogs = JSON.parse(storedLogs);
          const deduplicatedLogs = deduplicateCallLogs(parsedLogs);
          const formattedLogs = deduplicatedLogs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp).toISOString(),
            duration: parseInt(log.duration) || 0,
            type: log.type || "outgoing",
            status: log.status || "completed",
          }));
          updateCallLogsState(formattedLogs, "all");
        }
      } catch (storageError) {}
    } finally {
      setIsLoadingSimLogs(false);
    }
  }, []);

  const fetchFreshLogs = useCallback(async () => {
    if (Platform.OS === "android") {
      const hasPermission = await requestCallLogPermission();
      if (hasPermission) {
        const logs = await CallLog.loadAll();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentLogs = logs.filter((log: any) => parseInt(log.timestamp) >= thirtyDaysAgo.getTime());
        const formattedLogs = recentLogs.map((log: any) => ({
          id: String(log.timestamp),
          phoneNumber: log.phoneNumber,
          contactName: log.name && log.name !== "Unknown" ? log.name : log.phoneNumber,
          timestamp: new Date(parseInt(log.timestamp)),
          duration: parseInt(log.duration) || 0,
          type: (log.type || "OUTGOING").toLowerCase() as "incoming" | "outgoing" | "missed",
          status: (log.type === "MISSED" ? "missed" : "completed") as "missed" | "completed" | "in-progress",
        }));

        await AsyncStorage.setItem(CALL_LOGS_STORAGE_KEY, JSON.stringify(formattedLogs));
        await AsyncStorage.setItem(CALL_LOGS_LAST_UPDATE, String(Date.now()));
        updateCallLogsState(formattedLogs, "all");
      }
    }
  }, [requestCallLogPermission, updateCallLogsState]);

  const fetchWeeklyAchievement = useCallback(async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const currentWeekNumber = Math.ceil((now.getDate() + new Date(currentYear, now.getMonth(), 1).getDay()) / 7);

      const achievementsRef = collection(db, "bdm_achievements");
      const q = query(
        achievementsRef,
        where("userId", "==", userId),
        where("year", "==", currentYear),
        where("month", "==", currentMonth),
        where("weekNumber", "==", currentWeekNumber)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const achievementData = querySnapshot.docs[0].data();
        setWeeklyAchievement({
          percentageAchieved: achievementData.percentageAchieved || 0,
          isLoading: false,
        });
      } else {
        const reportsRef = collection(db, "bdm_reports");
        const reportsQuery = query(
          reportsRef,
          where("userId", "==", userId),
          where("year", "==", currentYear),
          where("month", "==", currentMonth),
          where("weekNumber", "==", currentWeekNumber)
        );

        const reportsSnapshot = await getDocs(reportsQuery);

        let totalMeetings = 0;
        let totalAttendedMeetings = 0;
        let totalDuration = 0;
        let totalClosing = 0;

        reportsSnapshot.forEach((doc) => {
          const data = doc.data();
          totalMeetings += data.numMeetings || 0;
          totalAttendedMeetings += data.positiveLeads || 0;
          totalClosing += data.totalClosingAmount || 0;

          const durationStr = data.meetingDuration || "";
          if (durationStr.includes(":")) {
            const [hours, minutes, seconds] = durationStr.split(":").map(Number);
            totalDuration += hours * 3600 + minutes * 60 + seconds;
          } else {
            const hrMatch = durationStr.match(/(\d+)\s*hr/);
            const minMatch = durationStr.match(/(\d+)\s*min/);
            const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) + (minMatch ? parseInt(minMatch[1]) / 60 : 0);
            totalDuration += hours * 3600;
          }
        });

        const meetingsPercentage = (totalMeetings / 30) * 100;
        const attendedPercentage = (totalAttendedMeetings / 30) * 100;
        const durationPercentage = (totalDuration / (20 * 3600)) * 100;
        const closingPercentage = (totalClosing / 50000) * 100;

        const percentageAchieved = Math.min(
          (meetingsPercentage + attendedPercentage + durationPercentage + closingPercentage) / 4,
          100
        );
        const roundedPercentage = Math.min(Math.max(Math.round(percentageAchieved * 10) / 10, 0), 100);

        await addDoc(collection(db, "bdm_achievements"), {
          userId,
          year: currentYear,
          month: currentMonth,
          weekNumber: currentWeekNumber,
          weekStart: Timestamp.fromDate(weekStart),
          weekEnd: Timestamp.fromDate(weekEnd),
          percentageAchieved: roundedPercentage,
          totalMeetings,
          totalAttendedMeetings,
          totalDuration,
          totalClosingAmount: totalClosing,
          createdAt: serverTimestamp(),
        });

        setWeeklyAchievement({
          percentageAchieved: roundedPercentage,
          isLoading: false,
        });
      }
    } catch (error) {
      setWeeklyAchievement({
        percentageAchieved: 0,
        isLoading: false,
      });
    }
  }, []);

  const handleDialPress = useCallback((digit: string) => {
    setPhoneNumber((prev) => prev + digit);
  }, []);

  const handleBackspace = useCallback(() => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const velocity = event.nativeEvent.velocity?.y;
    const scrolling = velocity !== undefined && velocity !== 0;

    if (scrolling && !isScrolling) {
      setIsScrolling(true);
      Animated.timing(dialerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isScrolling]);

  const handleScrollEnd = useCallback(() => {
    setIsScrolling(false);
    Animated.timing(dialerOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  const startCallTimer = useCallback(() => {
    const startTime = new Date();
    setCallStartTime(startTime);

    const timer = setInterval(() => {
      const currentTime = new Date();
      const durationInSeconds = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);
      setCallDuration(durationInSeconds);
      updateCallDurationInFirestore(durationInSeconds);
    }, 1000);

    setCallTimer(timer);
  }, []);

  const stopCallTimer = useCallback(() => {
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }
    setCallStartTime(null);
    setCallDuration(0);
  }, [callTimer]);

  const updateCallDurationInFirestore = useCallback(async (duration: number) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const callLogsRef = collection(db, "callLogs");
      const q = query(callLogsRef, where("userId", "==", userId), where("status", "==", "in-progress"), orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      const lastCallLog = querySnapshot.docs[0];

      if (lastCallLog) {
        await updateDoc(doc(db, "callLogs", lastCallLog.id), {
          duration: duration,
          lastUpdated: new Date(),
        });
      }
    } catch (error) {}
  }, []);

  const handleCall = useCallback(async (phoneNumber: string) => {
    try {
      if (Platform.OS === "android") {
        const hasPermission = await requestCallLogPermission();
        if (hasPermission) {
          const url = `tel:${phoneNumber}`;
          await Linking.openURL(url);
          setDialerVisible(false);
        }
      } else {
        const url = `tel:${phoneNumber}`;
        await Linking.openURL(url);
        setDialerVisible(false);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to initiate call");
    }
  }, [requestCallLogPermission]);

  const handleCallFromLogs = useCallback(async (phoneNumber: string) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      const startTime = new Date();
      const callLogRef = await addDoc(collection(db, "callLogs"), {
        userId,
        phoneNumber,
        timestamp: startTime,
        startTime: startTime,
        type: "outgoing",
        status: "in-progress",
        duration: 0,
      });

      startCallTimer();

      const phoneUrl = Platform.select({
        ios: `telprompt:${phoneNumber}`,
        android: `tel:${phoneNumber}`,
      });

      if (phoneUrl && (await Linking.canOpenURL(phoneUrl))) {
        await Linking.openURL(phoneUrl);
        setCallActive(true);
        if (isDialerVisible) {
          setPhoneNumber("");
          closeDialer();
        }
      } else {
        throw new Error("Cannot make phone call");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to initiate call. Please check phone permissions.");
      setCallActive(false);
      stopCallTimer();
    }
  }, [isDialerVisible, startCallTimer, stopCallTimer]);

  const resetPermissions = useCallback(async () => {
    if (__DEV__) {
      Alert.alert("Dev: Reset Permissions", "Do you want to open settings to reset permissions?", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]);
    }
  }, []);

  const openDialer = useCallback(() => {
    setDialerVisible(true);
    Animated.parallel([
      Animated.timing(dialerHeight, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(dialerY, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const closeDialer = useCallback(() => {
    Animated.parallel([
      Animated.timing(dialerHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(dialerY, {
        toValue: Dimensions.get("window").height,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setDialerVisible(false));
  }, []);

  const deduplicateCallLogs = useCallback((logs: any[]): any[] => {
    const seen = new Set();
    return logs.filter((log) => {
      const key = `${log.timestamp}-${log.phoneNumber}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const formatDate = useCallback((date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today (${date.getDate()}${getDaySuffix(date.getDate())})`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday (${date.getDate()}${getDaySuffix(date.getDate())})`;
    } else {
      return `${date.toLocaleDateString()} (${date.getDate()}${getDaySuffix(date.getDate())})`;
    }
  }, []);

  const getDaySuffix = useCallback((day: number) => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  }, []);

  const formatDuration = useCallback((seconds: number) => {
    if (!seconds) return "";
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
  }, []);

  const calculateTotalDuration = useCallback(
    (date: string) => {
      const dayLogs = callLogs.filter((log) => new Date(log.timestamp).toLocaleDateString() === date);
      let totalSeconds = 0;
      dayLogs.forEach((log) => {
        totalSeconds += log.duration || 0;
      });

      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    },
    [callLogs]
  );

  const handleCardClick = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCallId((prev) => (prev === id ? null : id));
  }, []);

  const navigateToCallHistory = useCallback(
    (callItem: GroupedCallLog) => {
      if (!callItem || !callItem.allCalls) return;

      const meetings = callItem.allCalls.map((call) => ({
        date: formatDate(new Date(call.timestamp)),
        time: formatTime(new Date(call.timestamp)),
        duration: formatDuration(call.duration || 0),
        notes: call.notes || [],
        type: call.type || "unknown",
      }));

      const callStats = callItem.monthlyHistory
        ? {
            totalCalls: callItem.monthlyHistory.totalCalls,
            totalDuration: callItem.monthlyHistory.totalDuration,
            callTypes: callItem.monthlyHistory.callTypes,
            dailyCalls: callItem.monthlyHistory.dailyCalls,
          }
        : undefined;

      navigation.navigate("BDMCallHistory", {
        customerName: callItem.contactName || callItem.phoneNumber,
        meetings,
        callStats,
      });
    },
    [navigation, formatDate, formatDuration]
  );

  const navigateToContactDetails = useCallback(
    (callItem: GroupedCallLog) => {
      if (callItem.contactType === "company") {
        navigation.navigate("BDMCompanyDetails", {
          company: {
            name: callItem.contactName || callItem.phoneNumber,
          },
        });
      } else {
        navigation.navigate("BDMContactDetails", {
          contact: {
            name: callItem.contactName || callItem.phoneNumber,
            phone: callItem.phoneNumber,
            email: "",
          },
        });
      }
    },
    [navigation]
  );

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      setIsLoadingSimLogs(true);
      await Promise.all([fetchWeeklyAchievement(), fetchDeviceCallLogs(), fetchCallLogs()]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert("Error", "Failed to refresh data");
    } finally {
      setRefreshing(false);
      setIsLoadingSimLogs(false);
    }
  }, [fetchWeeklyAchievement, fetchDeviceCallLogs, fetchCallLogs]);

  const renderCallCard = useCallback(
    ({ item, index }: { item: GroupedCallLog; index: number }) => {
      const isNewDate =
        index === 0 || formatDate(new Date(item.timestamp)) !== formatDate(new Date(callLogs[index - 1].timestamp));
      const isNumberSaved = item.contactName && item.contactName !== item.phoneNumber;
      const displayName = isNumberSaved ? item.contactName : item.phoneNumber;

      return (
        <>
          {isNewDate && (
            <View style={styles.dateHeader}>
              <Text style={styles.dateText}>{formatDate(new Date(item.timestamp))}</Text>
              <View style={styles.durationContainer}>
                <MaterialIcons name="access-time" size={16} color="#666" style={styles.durationIcon} />
                <Text style={styles.durationText}>{calculateTotalDuration(new Date(item.timestamp).toLocaleDateString())}</Text>
              </View>
            </View>
          )}
          <TouchableOpacity onPress={() => handleCardClick(item.id)}>
            <View style={styles.callCard}>
              <View style={styles.callInfo}>
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={() => navigateToContactDetails(item)}
                >
                  <MaterialIcons name="person" size={24} color="#FF8447" />
                </TouchableOpacity>
                <View style={styles.callDetails}>
                  <View style={styles.nameContainer}>
                    <Text
                      style={[styles.callName, { color: item.type === "missed" ? "#DC2626" : "#333" }]}
                    >
                      {displayName}
                    </Text>
                    {item.monthlyHistory && item.monthlyHistory.totalCalls > 0 && (
                      <Text style={styles.monthlyCallCount}>({item.monthlyHistory.totalCalls})</Text>
                    )}
                  </View>
                  <View style={styles.timeContainer}>
                    <MaterialIcons
                      name={item.type === "outgoing" ? "call-made" : "call-received"}
                      size={14}
                      color={item.type === "missed" ? "#DC2626" : "#059669"}
                      style={styles.callIcon}
                    />
                    <Text style={styles.callTime}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {item.duration > 0 && ` • ${formatDuration(item.duration)}`}
                    </Text>
                  </View>
                </View>
              </View>
              {expandedCallId === item.id && renderCallActions(item)}
            </View>
          </TouchableOpacity>
        </>
      );
    },
    [callLogs, expandedCallId, formatDate, calculateTotalDuration, formatDuration, handleCardClick, navigateToContactDetails]
  );

  const renderCallActions = useCallback(
    (call: GroupedCallLog) => {
      const isNumberSaved = call.contactName && call.contactName !== call.phoneNumber;

      return (
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigateToCallHistory(call)}>
            <MaterialIcons name="history" size={24} color="#FF8447" />
            <Text style={styles.actionText}>History ({call.callCount})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              if (isNumberSaved) {
                navigation.navigate("BDMCallNoteDetailsScreen", {
                  meeting: {
                    name: call.contactName || call.phoneNumber,
                    time: formatTime(new Date(call.timestamp)),
                    duration: formatDuration(call.duration),
                    phoneNumber: call.phoneNumber,
                    date: formatDate(new Date(call.timestamp)),
                    type: call.type,
                    contactType: call.contactType,
                  },
                });
              } else {
                setSelectedNumber(call.phoneNumber);
                setAddContactModalVisible(true);
              }
            }}
          >
            <MaterialIcons name={isNumberSaved ? "note-add" : "person-add"} size={24} color="#FF8447" />
            <Text style={styles.actionText}>{isNumberSaved ? "Add Notes" : "Add Contact"}</Text>
          </TouchableOpacity>
        </View>
      );
    },
    [navigation, formatDate, formatDuration]
  );

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="phone-missed" size={64} color="#DDDDDD" />
      <Text style={styles.emptyTitle}>No Call History Yet</Text>
      <Text style={styles.emptyMessage}>
        Your recent calls will appear here once you start making or receiving calls.
      </Text>
    </View>
  ), []);

  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, []);

  const calculateMeetingStats = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = callLogs.filter((log) => new Date(log.timestamp) >= today);
    const totalMeetings = todayLogs.length;
    let totalDuration = 0;
    todayLogs.forEach((log) => {
      totalDuration += log.duration || 0;
    });

    const stats = { totalMeetings, totalDuration, lastUpdated: new Date().toISOString() };
    await AsyncStorage.setItem("bdm_meeting_stats", JSON.stringify(stats));
  }, [callLogs]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        const isFirstTime = await AsyncStorage.getItem("isFirstTimeUser");
        if (isFirstTime === null) {
          await AsyncStorage.setItem("isFirstTimeUser", "false");
          setIsFirstTimeUser(true);
          setShowWelcomeModal(true);
        } else {
          setIsFirstTimeUser(false);
        }

        if (userProfile?.name) {
          setUserName(userProfile.name);
        } else if (userProfile?.firstName) {
          setUserName(`${userProfile.firstName} ${userProfile.lastName || ""}`);
        } else if (auth.currentUser?.displayName) {
          setUserName(auth.currentUser.displayName);
        }

        await Promise.all([loadSavedContacts(), fetchCallLogs(), fetchWeeklyAchievement()]);
        await AsyncStorage.setItem("has_visited_bdm_home", "true");
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fetchCallLogs, fetchWeeklyAchievement, loadSavedContacts, userProfile]);

  useEffect(() => {
    calculateMeetingStats();
    const statsUpdateInterval = setInterval(() => calculateMeetingStats(), 5000);
    return () => clearInterval(statsUpdateInterval);
  }, [calculateMeetingStats]);

  useEffect(() => {
    fetchCallLogs();
    fetchDeviceCallLogs();
    const backgroundInterval = setInterval(() => {
      fetchCallLogs();
      fetchDeviceCallLogs();
    }, 20000);
    return () => clearInterval(backgroundInterval);
  }, [fetchCallLogs, fetchDeviceCallLogs]);

  const memoizedCallLogs = useMemo(() => {
    return callLogs.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });
  }, [callLogs]);

  return (
    <AppGradient>
      <BDMMainLayout showDrawer showBottomTabs={true} showBackButton={false}>
        <View style={styles.container}>
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>{isFirstTimeUser ? "Welcome,👋👋" : "Hi,👋"}</Text>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FF8447" />
            ) : (
              <Text style={styles.nameText}>{userName || "User"}</Text>
            )}
            <View style={styles.progressSection}>
              {weeklyAchievement.isLoading ? (
                <ActivityIndicator size="small" color="#FF8447" style={{ marginVertical: 10 }} />
              ) : (
                <>
                  <ProgressBar
                    progress={weeklyAchievement.percentageAchieved / 100}
                    color="#FF8447"
                    style={styles.progressBar}
                  />
                  <Text style={styles.progressText}>
                    Great job! You've completed{" "}
                    <Text style={styles.progressHighlight}>{weeklyAchievement.percentageAchieved.toFixed(1)}%</Text>{" "}
                    of your weekly target
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("BDMTarget")}
                    style={styles.viewTargetButton}
                  >
                    <Text style={styles.viewTargetText}>View Target Details</Text>
                    <MaterialIcons name="arrow-forward" size={16} color="#FF8447" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Calls & Meeting History</Text>
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
              <MaterialIcons name="refresh" size={24} color="#FF8447" />
            </TouchableOpacity>
          </View>

          {isLoadingSimLogs ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF8447" />
            </View>
          ) : (
            <FlatList
              data={memoizedCallLogs}
              keyExtractor={(item) => `${new Date(item.timestamp).toISOString()}-${item.phoneNumber}`}
              renderItem={renderCallCard}
              onScroll={handleScroll}
              onScrollEndDrag={handleScrollEnd}
              onMomentumScrollEnd={handleScrollEnd}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
            />
          )}
        </View>

        <Animated.View style={[styles.dialerFAB, { opacity: dialerOpacity }]}>
          <TouchableOpacity onPress={openDialer}>
            <MaterialIcons name="dialpad" size={30} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>

        <Dialer
          visible={isDialerVisible}
          onClose={() => setDialerVisible(false)}
          onCallPress={handleCall}
          contacts={Object.values(contacts).map(contact => ({
            ...contact,
            phoneNumber: contact.phoneNumbers?.[0]?.number || '',
            favorite: false
          }))}
          isLoading={false}
        />

        <TelecallerAddContactModal
          visible={addContactModalVisible}
          onClose={() => setAddContactModalVisible(false)}
          phoneNumber={selectedNumber}
          onContactSaved={(contact: { id: string; firstName: string; lastName: string; phoneNumber: string }) => {
            setAddContactModalVisible(false);
            loadSavedContacts();
            fetchCallLogs();
          }}
        />
      </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  welcomeSection: {
    marginBottom: 24,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  welcomeText: {
    fontSize: 22,
    fontFamily: "LexendDeca_400Regular",
    color: "#333",
  },
  nameText: {
    fontSize: 24,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#222",
    marginTop: 4,
  },
  progressSection: {
    marginTop: 16,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
  },
  progressHighlight: {
    color: "#FF8447",
    fontFamily: "LexendDeca_600SemiBold",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#333",
  },
  refreshButton: {
    padding: 8,
  },
  dialerFAB: {
    position: "absolute",
    right: 20,
    bottom: 90,
    backgroundColor: "#4CAF50",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 1000,
  },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  dateText: {
    fontSize: 14,
    fontFamily: "LexendDeca_500Medium",
    color: "#666",
  },
  durationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  durationIcon: {
    marginRight: 4,
  },
  durationText: {
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
  },
  callCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  callInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF5E6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  callDetails: {
    flex: 1,
  },
  callName: {
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: "#333",
  },
  callTime: {
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
    marginTop: 2,
  },
  actionContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 12,
    paddingTop: 12,
  },
  actionButton: {
    alignItems: "center",
    flex: 1,
  },
  actionText: {
    fontSize: 12,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
    marginTop: 4,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  callIcon: {
    marginRight: 4,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  monthlyCallCount: {
    fontSize: 12,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
    marginLeft: 8,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  viewTargetButton: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    paddingVertical: 12,
  },
  viewTargetText: {
    marginRight: 8,
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: "#FF8447",
  },
});

export default React.memo(BDMHomeScreen);