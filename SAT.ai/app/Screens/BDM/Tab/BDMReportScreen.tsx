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
  FlatList,
  TouchableWithoutFeedback,
  Easing,
  Animated
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import BDMMainLayout from '@/app/components/BDMMainLayout';
import { auth, db } from '@/firebaseConfig';
import { collection, addDoc, getDocs, query, where, Timestamp, orderBy, limit, doc, onSnapshot, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppGradient from "@/app/components/AppGradient";
import AnimatedReanimated, { 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming,
  useSharedValue,
  withDelay
} from 'react-native-reanimated';
import CallLog from 'react-native-call-log';

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

// Define CallLog interface
interface CallLog {
  id: string;
  phoneNumber: string;
  timestamp: Date;
  duration: number;
  type: 'incoming' | 'outgoing' | 'missed';
  status: 'completed' | 'missed' | 'in-progress';
  contactId?: string;
  contactName?: string;
}

// Add this new component for the wave skeleton
const WaveSkeleton = ({ width, height, style }: { width: number | string; height: number; style?: any }) => {
  const translateX = useSharedValue(typeof width === 'number' ? -width : -100);

  React.useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(typeof width === 'number' ? width : 100, { duration: 1000 }),
        withDelay(500, withTiming(typeof width === 'number' ? -width : -100, { duration: 0 }))
      ),
      -1
    );
  }, [width]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <View style={[{ width, height, backgroundColor: '#E5E7EB', overflow: 'hidden' }, style]}>
      <AnimatedReanimated.View
        style={[
          {
            width: '100%',
            height: '100%',
            backgroundColor: 'transparent',
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255, 255, 255, 0.3)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: '100%', height: '100%' }}
        />
      </AnimatedReanimated.View>
    </View>
  );
};

// Add this new component for the form skeleton
const FormSkeleton = () => {
  return (
    <View style={styles.skeletonContainer}>
      <WaveSkeleton width="60%" height={24} style={styles.skeletonTitle} />
      <WaveSkeleton width="100%" height={48} style={styles.skeletonInput} />
      <WaveSkeleton width="100%" height={48} style={styles.skeletonInput} />
      <WaveSkeleton width="100%" height={48} style={styles.skeletonInput} />
      <WaveSkeleton width="100%" height={120} style={styles.skeletonTextArea} />
      <WaveSkeleton width="100%" height={48} style={styles.skeletonButton} />
    </View>
  );
};

const BDMReportScreen = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [waveAnimation] = useState(new Animated.Value(0));
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [selectedProducts, setSelectedProducts] = useState<{[key: number]: string[]}>({
    0: ["Health Insurance"]
  });
  const [showProductDropdown, setShowProductDropdown] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<string[]>([]);
  
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
  
  // Add state for today's call data
  const [todayCalls, setTodayCalls] = useState(0);
  const [todayDuration, setTodayDuration] = useState(0);

  // Add real-time listener for call logs
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupCallLogsListener = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const callLogsRef = collection(db, 'callLogs');
        const q = query(
          callLogsRef,
          where('userId', '==', userId),
          where('timestamp', '>=', today),
          orderBy('timestamp', 'desc')
        );

        // Set up real-time listener
        unsubscribe = onSnapshot(q, async (snapshot) => {
          const logs = await processCallLogs(snapshot);
          setCallLogs(logs);
          updateMeetingDuration(logs);
        });

        // Initial fetch of device call logs
        if (Platform.OS === 'android') {
          await fetchDeviceCallLogs();
        }
      } catch (error) {
        console.error('Error setting up call logs listener:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setupCallLogsListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Add useEffect for periodic refresh of call data
  useEffect(() => {
    // Fetch immediately on mount
    fetchTodayCallData();
    
    // Set up interval to fetch every 10 seconds
    const interval = setInterval(fetchTodayCallData, 10000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  // Add function to fetch today's call data
  const fetchTodayCallData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log('No user ID found');
        return;
      }

      const today = new Date();
      const startOfToday = new Date(today);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

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

      // Update state with fetched data
      setTodayCalls(totalCalls);
      setTodayDuration(totalDuration);
      setNumMeetings(totalCalls.toString());
      setMeetingDuration(formatDuration(totalDuration));

      // Store in AsyncStorage for faster future access
      await AsyncStorage.setItem('device_call_logs', JSON.stringify(querySnapshot.docs.map(doc => doc.data())));
      await AsyncStorage.setItem('call_logs_last_update', now.toString());

    } catch (error) {
      console.error('Error fetching today\'s call data:', error);
      Alert.alert('Error', 'Failed to fetch today\'s call data');
    }
  };

  // Process call logs
  const processCallLogs = async (snapshot: any) => {
    const logs: CallLog[] = [];
    
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      
      const log: CallLog = {
        id: docSnapshot.id,
        phoneNumber: data.phoneNumber || '',
        timestamp: data.timestamp?.toDate() || new Date(),
        duration: data.duration || 0,
        type: data.type || 'outgoing',
        status: data.status || 'completed',
        contactId: data.contactId,
        contactName: data.contactName || ''
      };

      if (data.contactId) {
        try {
          const contactDocRef = doc(db, 'contacts', data.contactId);
          const contactDoc = await getDoc(contactDocRef);
          if (contactDoc.exists()) {
            const contactData = contactDoc.data();
            log.contactName = contactData.name || '';
          }
        } catch (err) {
          console.error('Error fetching contact:', err);
        }
      }

      logs.push(log);
    }

    return logs;
  };

  // Update meeting duration based on call logs
  const updateMeetingDuration = (logs: CallLog[]) => {
    const totalDuration = logs.reduce((sum, log) => sum + (log.duration || 0), 0);
    setMeetingDuration(formatDuration(totalDuration));
    setNumMeetings(logs.length.toString());
  };

  // Fetch device call logs
  const fetchDeviceCallLogs = async () => {
    if (Platform.OS === 'android') {
      try {
        const logs = await CallLog.loadAll();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Filter logs from today
        const todayLogs = logs.filter((log: any) => {
          const logTimestamp = parseInt(log.timestamp);
          return logTimestamp >= today.getTime();
        });

        const formattedLogs = todayLogs.map((log: any) => ({
          id: String(log.timestamp),
          phoneNumber: log.phoneNumber,
          contactName: log.name && log.name !== "Unknown" ? log.name : log.phoneNumber,
          timestamp: new Date(parseInt(log.timestamp)),
          duration: parseInt(log.duration) || 0,
          type: (log.type || 'OUTGOING').toLowerCase() as 'incoming' | 'outgoing' | 'missed',
          status: (log.type === 'MISSED' ? 'missed' : 'completed') as 'missed' | 'completed' | 'in-progress'
        }));

        setCallLogs(formattedLogs);
        updateMeetingDuration(formattedLogs);
      } catch (error) {
        console.error('Error fetching device call logs:', error);
      }
    }
  };

  // Add wave animation effect
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

  // Format duration helper function
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

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

  // Add storage keys
  const STORAGE_KEYS = {
    DRAFT_REPORT: 'bdm_report_draft',
    LAST_REPORT: 'bdm_last_report',
    PENDING_REPORTS: 'bdm_pending_reports'
  };

  // Save draft data
  const saveDraftData = async () => {
    try {
      const draftData = {
        numMeetings,
        meetingDuration,
        positiveLeads,
        closingDetails,
        totalAmount,
        date: new Date().toISOString()
      };
      await AsyncStorage.setItem(STORAGE_KEYS.DRAFT_REPORT, JSON.stringify(draftData));
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  };

  // Load draft data
  const loadDraftData = async () => {
    try {
      const draftDataString = await AsyncStorage.getItem(STORAGE_KEYS.DRAFT_REPORT);
      if (draftDataString) {
        const draftData = JSON.parse(draftDataString);
        
        // Check if draft is from today
        const draftDate = new Date(draftData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (draftDate.getTime() === today.getTime()) {
          setNumMeetings(draftData.numMeetings || '');
          setMeetingDuration(draftData.meetingDuration || '');
          setPositiveLeads(draftData.positiveLeads || '');
          setClosingDetails(draftData.closingDetails || [{
            productType: ["Health Insurance"],
            closingAmount: 0,
            description: ""
          }]);
          setTotalAmount(draftData.totalAmount || 0);
        } else {
          // If draft is not from today, clear it
          await AsyncStorage.removeItem(STORAGE_KEYS.DRAFT_REPORT);
        }
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  };

  // Check for pending reports that need to be synced
  const checkPendingReports = async () => {
    try {
      const pendingReportsString = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_REPORTS);
      if (pendingReportsString) {
        const pendingReports = JSON.parse(pendingReportsString);
        if (pendingReports.length > 0) {
          syncPendingReports(pendingReports);
        }
      }
    } catch (error) {
      console.error('Error checking pending reports:', error);
    }
  };

  // Sync pending reports to Firebase
  const syncPendingReports = async (pendingReports: any[]) => {
    try {
      setSyncStatus('syncing');
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const syncedReports: string[] = [];
      const failedReports: any[] = [];

      for (const report of pendingReports) {
        try {
          // Add to Firebase
          const docRef = await addDoc(collection(db, 'bdm_reports'), {
            ...report,
            userId,
            syncedAt: Timestamp.fromDate(new Date())
          });
          
          syncedReports.push(report.id);
          console.log("Report synced with ID:", docRef.id);
        } catch (error) {
          console.error("Error syncing report:", error);
          failedReports.push(report);
        }
      }

      // Update pending reports in AsyncStorage
      if (syncedReports.length > 0) {
        const updatedPendingReports = pendingReports.filter(
          report => !syncedReports.includes(report.id)
        );
        await AsyncStorage.setItem(
          STORAGE_KEYS.PENDING_REPORTS, 
          JSON.stringify(updatedPendingReports)
        );
      }

      setSyncStatus('synced');
    } catch (error) {
      console.error("Error syncing pending reports:", error);
      setSyncStatus('error');
    }
  };

  // Update validateForm function
  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    // No need to validate numMeetings and meetingDuration as they are auto-populated
    
    if (!positiveLeads.trim()) {
      newErrors.positiveLeads = "Positive leads is required";
    } else if (isNaN(Number(positiveLeads)) || Number(positiveLeads) < 0) {
      newErrors.positiveLeads = "Please enter a valid number";
    }
    
    // Existing closing detail validations
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

  // Update handleSubmit function
  const handleSubmit = async () => {
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
      
      const now = new Date();
      const reportId = `report_${now.getTime()}`;
      
      // Create month>week>day structure
      const month = now.getMonth() + 1; // 1-12
      const year = now.getFullYear();
      const weekNumber = Math.ceil((now.getDate() + new Date(year, now.getMonth(), 1).getDay()) / 7);
      const day = now.getDate();
      
      const reportData = {
        id: reportId,
        userId,
        date: now.toISOString(),
        month,
        year,
        weekNumber,
        day,
        numMeetings: Number(numMeetings),
        meetingDuration,
        positiveLeads: Number(positiveLeads),
        closingDetails,
        totalClosingAmount: totalAmount,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        synced: false
      };
      
      // Save to local storage first
      await saveReportLocally(reportData);
      
      // Try to sync to Firebase
      try {
        await syncReportToFirebase(reportData);
      } catch (error) {
        console.error("Error syncing report to Firebase:", error);
        // Report will be synced later
      }
      
      // Clear draft after successful submission
      await AsyncStorage.removeItem(STORAGE_KEYS.DRAFT_REPORT);
      
      setModalVisible(true);
      setTimeout(() => {
        setModalVisible(false);
        // Clear form but keep auto-populated fields
        setPositiveLeads("");
        setClosingDetails([
          { productType: ["Health Insurance"], closingAmount: 0, description: "" }
        ]);
        setTotalAmount(0);
      }, 2000);
      
    } catch (error) {
      console.error("Error submitting report:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save report to local storage
  const saveReportLocally = async (reportData: any) => {
    try {
      // Save as last report
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_REPORT, JSON.stringify(reportData));
      
      // Create structured storage key for month>week>day
      const { year, month, weekNumber, day } = reportData;
      const structuredKey = `bdm_reports_${year}_${month}_${weekNumber}_${day}`;
      
      // Get existing reports for this day
      const existingReportsString = await AsyncStorage.getItem(structuredKey);
      const existingReports = existingReportsString ? JSON.parse(existingReportsString) : [];
      
      // Add new report
      existingReports.push(reportData);
      
      // Save updated reports
      await AsyncStorage.setItem(structuredKey, JSON.stringify(existingReports));
      
      // Add to pending reports if not synced
      if (!reportData.synced) {
        const pendingReportsString = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_REPORTS);
        const pendingReports = pendingReportsString ? JSON.parse(pendingReportsString) : [];
        pendingReports.push(reportData);
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_REPORTS, JSON.stringify(pendingReports));
      }
      
      // Update weekly summary
      await updateWeeklySummary(reportData);
      
    } catch (error) {
      console.error("Error saving report locally:", error);
      throw error;
    }
  };
  
  // Update weekly summary
  const updateWeeklySummary = async (reportData: any) => {
    try {
      const { year, month, weekNumber } = reportData;
      const weeklyKey = `bdm_weekly_summary_${year}_${month}_${weekNumber}`;
      
      // Get existing weekly summary
      const existingSummaryString = await AsyncStorage.getItem(weeklyKey);
      const existingSummary = existingSummaryString ? JSON.parse(existingSummaryString) : {
        year,
        month,
        weekNumber,
        totalMeetings: 0,
        totalDuration: 0,
        totalPositiveLeads: 0,
        totalClosingAmount: 0,
        reports: []
      };
      
      // Update summary with new report data
      existingSummary.totalMeetings += reportData.numMeetings;
      existingSummary.totalPositiveLeads += reportData.positiveLeads;
      existingSummary.totalClosingAmount += reportData.totalClosingAmount;
      
      // Parse duration string (e.g., "1 hr 30 mins" -> hours)
      const durationStr = reportData.meetingDuration || '';
      const hrMatch = durationStr.match(/(\d+)\s*hr/);
      const minMatch = durationStr.match(/(\d+)\s*min/);
      const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) +
                   (minMatch ? parseInt(minMatch[1]) / 60 : 0);
      existingSummary.totalDuration += hours;
      
      // Add report to list if not already there
      if (!existingSummary.reports.some((r: any) => r.id === reportData.id)) {
        existingSummary.reports.push(reportData);
      }
      
      // Save updated summary
      await AsyncStorage.setItem(weeklyKey, JSON.stringify(existingSummary));
      
    } catch (error) {
      console.error("Error updating weekly summary:", error);
    }
  };

  // Sync report to Firebase
  const syncReportToFirebase = async (reportData: any) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Create month>week>day structure in Firebase
      const { year, month, weekNumber, day } = reportData;
      
      // Add to Firebase with structured path
      const reportsRef = collection(db, 'bdm_reports');
      const docRef = await addDoc(reportsRef, {
        ...reportData,
        synced: true,
        syncedAt: Timestamp.fromDate(new Date())
      });
      
      console.log("Report synced with ID:", docRef.id);
      
      // Update weekly summary in Firebase
      const weeklySummaryRef = doc(db, 'bdm_weekly_summaries', `${userId}_${year}_${month}_${weekNumber}`);
      const weeklySummaryDoc = await getDoc(weeklySummaryRef);
      
      if (weeklySummaryDoc.exists()) {
        // Update existing summary
        const existingSummary = weeklySummaryDoc.data();
        await updateDoc(weeklySummaryRef, {
          totalMeetings: increment(reportData.numMeetings),
          totalPositiveLeads: increment(reportData.positiveLeads),
          totalClosingAmount: increment(reportData.totalClosingAmount),
          updatedAt: Timestamp.fromDate(new Date())
        });
      } else {
        // Create new summary
        // Parse duration string (e.g., "1 hr 30 mins" -> hours)
        const durationStr = reportData.meetingDuration || '';
        const hrMatch = durationStr.match(/(\d+)\s*hr/);
        const minMatch = durationStr.match(/(\d+)\s*min/);
        const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) +
                     (minMatch ? parseInt(minMatch[1]) / 60 : 0);
        
        await setDoc(weeklySummaryRef, {
          userId,
          year,
          month,
          weekNumber,
          totalMeetings: reportData.numMeetings,
          totalDuration: hours,
          totalPositiveLeads: reportData.positiveLeads,
          totalClosingAmount: reportData.totalClosingAmount,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        });
      }
      
      // Update pending reports in AsyncStorage
      const pendingReportsString = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_REPORTS);
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
    } catch (error) {
      console.error("Error syncing report to Firebase:", error);
      throw error;
    }
  };

  // Add auto-save functionality
  useEffect(() => {
    const autoSaveTimer = setTimeout(saveDraftData, 1000);
    return () => clearTimeout(autoSaveTimer);
  }, [numMeetings, meetingDuration, positiveLeads, closingDetails, totalAmount]);

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
      
      // Calculate total amount after updating closing amount
      const newTotalAmount = newClosingDetails.reduce((sum, detail) => sum + (detail.closingAmount || 0), 0);
      setTotalAmount(newTotalAmount);
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

  // Toggle product selection
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

  // Add periodic sync function
  const syncLocalWithFirebase = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      
      // Get all pending reports
      const pendingReportsString = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_REPORTS);
      if (!pendingReportsString) return;
      
      const pendingReports = JSON.parse(pendingReportsString);
      if (pendingReports.length === 0) return;
      
      setSyncStatus('syncing');
      
      // Group reports by week for efficient syncing
      const reportsByWeek: {[key: string]: any[]} = {};
      
      pendingReports.forEach((report: any) => {
        const { year, month, weekNumber } = report;
        const weekKey = `${year}_${month}_${weekNumber}`;
        
        if (!reportsByWeek[weekKey]) {
          reportsByWeek[weekKey] = [];
        }
        
        reportsByWeek[weekKey].push(report);
      });
      
      // Sync each week's reports
      for (const weekKey in reportsByWeek) {
        const reports = reportsByWeek[weekKey];
        const [year, month, weekNumber] = weekKey.split('_').map(Number);
        
        // Sync individual reports
        for (const report of reports) {
          try {
            // Add to Firebase
            const docRef = await addDoc(collection(db, 'bdm_reports'), {
              ...report,
              synced: true,
              syncedAt: Timestamp.fromDate(new Date())
            });
            
            console.log("Report synced with ID:", docRef.id);
          } catch (error) {
            console.error("Error syncing report:", error);
          }
        }
        
        // Update weekly summary in Firebase
        const weeklySummaryRef = doc(db, 'bdm_weekly_summaries', `${userId}_${year}_${month}_${weekNumber}`);
        const weeklySummaryDoc = await getDoc(weeklySummaryRef);
        
        // Calculate totals for this week
        let totalMeetings = 0;
        let totalDuration = 0;
        let totalPositiveLeads = 0;
        let totalClosingAmount = 0;
        
        reports.forEach((report: any) => {
          totalMeetings += report.numMeetings || 0;
          totalPositiveLeads += report.positiveLeads || 0;
          totalClosingAmount += report.totalClosingAmount || 0;
          
          // Parse duration string
          const durationStr = report.meetingDuration || '';
          const hrMatch = durationStr.match(/(\d+)\s*hr/);
          const minMatch = durationStr.match(/(\d+)\s*min/);
          const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) +
                       (minMatch ? parseInt(minMatch[1]) / 60 : 0);
          totalDuration += hours;
        });
        
        if (weeklySummaryDoc.exists()) {
          // Update existing summary
          await updateDoc(weeklySummaryRef, {
            totalMeetings: increment(totalMeetings),
            totalDuration: increment(totalDuration),
            totalPositiveLeads: increment(totalPositiveLeads),
            totalClosingAmount: increment(totalClosingAmount),
            updatedAt: Timestamp.fromDate(new Date())
          });
        } else {
          // Create new summary
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
            updatedAt: Timestamp.fromDate(new Date())
          });
        }
      }
      
      // Clear pending reports after successful sync
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_REPORTS, JSON.stringify([]));
      setSyncStatus('synced');
      
    } catch (error) {
      console.error("Error syncing with Firebase:", error);
      setSyncStatus('error');
    }
  };
  
  // Add useEffect for periodic sync
  useEffect(() => {
    // Sync immediately on mount
    syncLocalWithFirebase();
    
    // Set up interval to sync every 5 minutes
    const interval = setInterval(syncLocalWithFirebase, 5 * 60 * 1000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  return (
    <AppGradient>
      <BDMMainLayout title="Daily Report" showBackButton>
        <View style={styles.container}>
          {isLoading ? (
            <View style={styles.skeletonContainer}>
              <WaveSkeleton width="60%" height={24} style={styles.skeletonTitle} />
              <WaveSkeleton width="100%" height={48} style={styles.skeletonInput} />
              <WaveSkeleton width="100%" height={48} style={styles.skeletonInput} />
              <WaveSkeleton width="100%" height={48} style={styles.skeletonInput} />
              <WaveSkeleton width="100%" height={120} style={styles.skeletonTextArea} />
              <WaveSkeleton width="100%" height={48} style={styles.skeletonButton} />
            </View>
          ) : (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
            >
              <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.contentContainer}>
                  {/* Date Header */}
                  <Text style={styles.dateText}>{currentDate}</Text>
                  
                  {/* Sync Status */}
                  {syncStatus === 'syncing' && (
                    <View style={styles.syncStatusContainer}>
                      <ActivityIndicator size="small" color="#FF8447" />
                      <Text style={styles.syncStatusText}>Syncing reports...</Text>
                    </View>
                  )}
                  {syncStatus === 'synced' && (
                    <View style={styles.syncStatusContainer}>
                      <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                      <Text style={styles.syncStatusText}>Reports synced successfully</Text>
                    </View>
                  )}
                  {syncStatus === 'error' && (
                    <View style={styles.syncStatusContainer}>
                      <MaterialIcons name="error" size={16} color="#F44336" />
                      <Text style={styles.syncStatusText}>Error syncing reports</Text>
                    </View>
                  )}
                  
                  {/* Meeting Information Section */}
                  <View style={styles.section}>
                    <Text style={styles.label}>Number of Meetings</Text>
                    <View style={styles.readOnlyInput}>
                      <Text style={styles.readOnlyText}>{numMeetings}</Text>
                    </View>

                    <Text style={styles.label}>Meeting Duration</Text>
                    <View style={styles.readOnlyInput}>
                      <Text style={styles.readOnlyText}>{meetingDuration}</Text>
                    </View>

                    <Text style={styles.label}>
                      Prospective No. of Meetings <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        errors.positiveLeads ? styles.inputError : null
                      ]}
                      placeholder="Enter prospective number of meetings"
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
                        
                        {/* Selected Products Display */}
                        <View style={styles.selectedProductsContainer}>
                          {selectedProducts[index]?.map((product, productIndex) => (
                            <View key={productIndex} style={styles.selectedProductChip}>
                              <Text style={styles.selectedProductText}>{product}</Text>
                              <TouchableOpacity
                                onPress={() => toggleProductSelection(index, product)}
                                style={styles.removeProductButton}
                              >
                                <MaterialIcons name="close" size={16} color="#FFFFFF" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                        
                        {/* Product Dropdown Button */}
                        <TouchableOpacity 
                          style={styles.dropdownButton}
                          onPress={() => toggleProductDropdown(index)}
                        >
                          <Text style={styles.dropdownButtonText}>
                            {selectedProducts[index]?.length > 0
                              ? `${selectedProducts[index].length} product(s) selected`
                              : 'Select products'}
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
                                    <MaterialIcons 
                                      name="check" 
                                      size={20} 
                                      color="#FFFFFF" 
                                    />
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
                          placeholder="Enter description product wise, if multiple products are selected"
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
    maxHeight: 300,
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
    borderRadius: 8,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  dropdownItemSelected: {
    backgroundColor: '#FFF5E6',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'LexendDeca_400Regular',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#FF8447',
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
  closeIcon: {
    marginLeft: 8,
  },
  selectedProductsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  selectedProductChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8447',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedProductText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'LexendDeca_500Medium',
    marginRight: 6,
  },
  removeProductButton: {
    padding: 2,
  },
  skeletonContainer: {
    padding: 20,
  },
  skeletonTitle: {
    marginBottom: 20,
    borderRadius: 4,
  },
  skeletonInput: {
    marginBottom: 16,
    borderRadius: 8,
  },
  skeletonTextArea: {
    marginBottom: 24,
    borderRadius: 8,
  },
  skeletonButton: {
    borderRadius: 8,
  },
  syncStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  syncStatusText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
});

export default BDMReportScreen;