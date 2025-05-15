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
    Animated,
    Easing,
  } from "react-native";
  import { useNavigation } from "@react-navigation/native";
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc, getDocs, query, where, Timestamp, orderBy, onSnapshot, getDoc, updateDoc, increment, setDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import AppGradient from "@/app/components/AppGradient";
import BDMMainLayout from '@/app/components/BDMMainLayout';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import AnimatedReanimated, { useAnimatedStyle, withRepeat, withSequence, withTiming, useSharedValue, withDelay } from 'react-native-reanimated';
import CallLog from 'react-native-call-log';
import { format, startOfDay, endOfDay } from 'date-fns';

// Interfaces
interface Product {
    id: string;
    label: string;
    value: string;
    active: boolean;
    createdAt: any;
  }
  
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
    rejectedLeads?: number;
    notAttendedCalls?: number;
    closingLeads?: number;
    closingDetails: ClosingDetail[];
    totalClosingAmount: number;
  }
  
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

  // Storage keys
const STORAGE_KEYS = {
    DRAFT_REPORT: (userType: string) => `${userType.toLowerCase()}_report_draft`,
    LAST_REPORT: (userType: string) => `${userType.toLowerCase()}_last_report`,
    PENDING_REPORTS: (userType: string) => `${userType.toLowerCase()}_pending_reports`,
  };

  // Wave Skeleton Component
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
  
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    return (
        <View style={[{ width, height, backgroundColor: '#E5E7EB', overflow: 'hidden' }, style]}>
          <AnimatedReanimated.View
            style={[{ width: '100%', height: '100%', backgroundColor: 'transparent' }, animatedStyle]}
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

    // Form Skeleton Component
const FormSkeleton = () => (
    <View style={styles.skeletonContainer}>
      <WaveSkeleton width="60%" height={24} style={styles.skeletonTitle} />
      <WaveSkeleton width="100%" height={48} style={styles.skeletonInput} />
      <WaveSkeleton width="100%" height={48} style={styles.skeletonInput} />
      <WaveSkeleton width="100%" height={48} style={styles.skeletonInput} />
      <WaveSkeleton width="100%" height={120} style={styles.skeletonTextArea} />
      <WaveSkeleton width="100%" height={48} style={styles.skeletonButton} />
    </View>
  );
  interface DailyReportScreenProps {
    userType: 'BDM' | 'Telecaller';
  }
  const DailyReportScreen: React.FC<DailyReportScreenProps> = ({ userType }) => {
    const navigation = useNavigation();
    const [isLoading, setIsLoading] = useState(true);
    const [waveAnimation] = useState(new Animated.Value(0));
    const [callLogs, setCallLogs] = useState<CallLog[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [productList, setProductList] = useState<Product[]>([]);
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
      showOtherInput: false,
    }]);
    const [totalClosingAmount, setTotalClosingAmount] = useState(0);
    const [currentDate, setCurrentDate] = useState('');
    const [todayCalls, setTodayCalls] = useState(0);
    const [todayDuration, setTodayDuration] = useState(0);
    const [dropdownVisible, setDropdownVisible] = useState<number | null>(null);
  
    // Fetch products from Firestore
    useEffect(() => {
      const fetchProducts = async () => {
        try {
          const productsRef = collection(db, 'products');
          const q = query(productsRef, where('active', '==', true));
          const querySnapshot = await getDocs(q);
          const products = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as Product[];
          setProductList(products);
          setFilteredProducts(products);
        } catch (error) {
          console.error('Error fetching products:', error);
          Alert.alert('Error', 'Failed to load product list');
        }
      };
      fetchProducts();
    }, []);
  
    // Filter products based on search query
    useEffect(() => {
      if (searchQuery.trim() === '') {
        setFilteredProducts(productList);
      } else {
        const filtered = productList.filter(product =>
          product.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredProducts(filtered);
      }
    }, [searchQuery, productList]);
  
    // Format current date
    useEffect(() => {
      const date = new Date();
      const formattedDate = format(date, 'dd MMMM (EEEE)');
      setCurrentDate(formattedDate);
    }, []);
  
    // Fetch call logs
    useEffect(() => {
      let unsubscribe: (() => void) | undefined;
  
      const setupCallLogsListener = async () => {
        try {
          const userId = auth.currentUser?.uid;
          if (!userId) return;
  
          const today = startOfDay(new Date());
          const callLogsRef = collection(db, 'callLogs');
          const q = query(
            callLogsRef,
            where('userId', '==', userId),
            where('timestamp', '>=', today),
            orderBy('timestamp', 'desc')
          );
  
          unsubscribe = onSnapshot(q, async (snapshot) => {
            const logs = await processCallLogs(snapshot);
            setCallLogs(logs);
            updateMeetingDuration(logs);
          });
  
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
        if (unsubscribe) unsubscribe();
      };
    }, []);
  
    // Periodic call data refresh
    useEffect(() => {
      fetchTodayCallData();
      const interval = setInterval(fetchTodayCallData, 10000);
      return () => clearInterval(interval);
    }, []);
  
    // Wave animation
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
  
    // Auto-save draft
    useEffect(() => {
      const autoSaveTimer = setTimeout(saveDraftData, 1000);
      return () => clearTimeout(autoSaveTimer);
    }, [numMeetings, meetingDuration, positiveLeads, rejectedLeads, notAttendedCalls, closingLeads, closingDetails, totalClosingAmount]);
  
    // Load draft data
    useEffect(() => {
      loadDraftData();
    }, []);
  
    // Periodic Firebase sync
    useEffect(() => {
      syncLocalWithFirebase();
      const interval = setInterval(syncLocalWithFirebase, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }, []);
  
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
          contactName: data.contactName || '',
        };
  
        if (data.contactId) {
          try {
            const contactDocRef = doc(db, 'contacts', data.contactId);
            const contactDoc = await getDoc(contactDocRef);
            if (contactDoc.exists()) {
              log.contactName = contactDoc.data().name || '';
            }
          } catch (err) {
            console.error('Error fetching contact:', err);
          }
        }
        logs.push(log);
      }
      return logs;
    };
  
    const updateMeetingDuration = (logs: CallLog[]) => {
      const totalDuration = logs.reduce((sum, log) => sum + (log.duration || 0), 0);
      setMeetingDuration(formatDuration(totalDuration));
      setNumMeetings(logs.length.toString());
    };
  
    const fetchDeviceCallLogs = async () => {
      if (Platform.OS === 'android') {
        try {
          const logs = await CallLog.loadAll();
          const today = startOfDay(new Date());
          const todayLogs = logs.filter((log: any) => parseInt(log.timestamp) >= today.getTime());
          const formattedLogs = todayLogs.map((log: any) => ({
            id: String(log.timestamp),
            phoneNumber: log.phoneNumber,
            contactName: log.name && log.name !== "Unknown" ? log.name : log.phoneNumber,
            timestamp: new Date(parseInt(log.timestamp)),
            duration: parseInt(log.duration) || 0,
            type: (log.type || 'OUTGOING').toLowerCase() as 'incoming' | 'outgoing' | 'missed',
            status: (log.type === 'MISSED' ? 'missed' : 'completed') as 'missed' | 'completed' | 'in-progress',
          }));
          setCallLogs(formattedLogs);
          updateMeetingDuration(formattedLogs);
        } catch (error) {
          console.error('Error fetching device call logs:', error);
        }
      }
    };
  
    const fetchTodayCallData = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
  
        const today = new Date();
        const startOfToday = startOfDay(today);
        const endOfToday = endOfDay(today);
  
        const storedLogs = await AsyncStorage.getItem('device_call_logs');
        const lastUpdate = await AsyncStorage.getItem('call_logs_last_update');
        const now = Date.now();
  
        if (storedLogs && lastUpdate && (now - parseInt(lastUpdate)) < 5 * 60 * 1000) {
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
              if (log.duration) totalDuration += Number(log.duration);
            }
          });
  
          setTodayCalls(totalCalls);
          setTodayDuration(totalDuration);
          setNumMeetings(totalCalls.toString());
          setMeetingDuration(formatDuration(totalDuration));
          return;
        }
  
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
            if (data.duration) totalDuration += Number(data.duration);
          }
        });
  
        setTodayCalls(totalCalls);
        setTodayDuration(totalDuration);
        setNumMeetings(totalCalls.toString());
        setMeetingDuration(formatDuration(totalDuration));
  
        await AsyncStorage.setItem('device_call_logs', JSON.stringify(querySnapshot.docs.map(doc => doc.data())));
        await AsyncStorage.setItem('call_logs_last_update', now.toString());
      } catch (error) {
        console.error('Error fetching today\'s call data:', error);
        Alert.alert('Error', 'Failed to fetch today\'s call data');
      }
    };
  
    const formatDuration = (seconds: number) => {
      if (!seconds) return '00:00:00';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };
  
    const saveDraftData = async () => {
        if (!userType) {
          console.error('userType is undefined, cannot save draft');
          return;
        }
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
            date: new Date().toISOString(),
          };
          await AsyncStorage.setItem(STORAGE_KEYS.DRAFT_REPORT(userType), JSON.stringify(draftData));
        } catch (error) {
          console.error('Error saving draft:', error);
        }
      };
  
    const loadDraftData = async () => {
      try {
        const draftDataString = await AsyncStorage.getItem(STORAGE_KEYS.DRAFT_REPORT(userType));
        if (draftDataString) {
          const draftData = JSON.parse(draftDataString);
          const draftDate = new Date(draftData.date);
          const today = startOfDay(new Date());
          if (draftDate.toDateString() === today.toDateString()) {
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
              showOtherInput: false,
            }]);
            setTotalClosingAmount(draftData.totalClosingAmount || 0);
          } else {
            await AsyncStorage.removeItem(STORAGE_KEYS.DRAFT_REPORT(userType));
          }
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    };
  
    const validateForm = (): boolean => {
      const newErrors: { [key: string]: string } = {};
  
      if (!numMeetings.trim()) {
        newErrors.numMeetings = "Number of meetings/calls is required";
      } else if (isNaN(Number(numMeetings)) || Number(numMeetings) < 0) {
        newErrors.numMeetings = "Please enter a valid number";
      }
  
      if (!meetingDuration.trim()) {
        newErrors.meetingDuration = "Meeting/call duration is required";
      }
  
      if (!positiveLeads.trim()) {
        newErrors.positiveLeads = "Positive leads is required";
      } else if (isNaN(Number(positiveLeads)) || Number(positiveLeads) < 0) {
        newErrors.positiveLeads = "Please enter a valid number";
      }
  
      if (userType === 'Telecaller') {
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
      }
  
      closingDetails.forEach((detail, index) => {
        if (detail.selectedProducts.length === 0) {
          newErrors[`closing_${index}_products`] = "Please select at least one product";
        }
        if (!detail.amount.trim()) {
          newErrors[`closing_${index}_amount`] = "Amount is required";
        } else if (isNaN(Number(detail.amount)) || Number(detail.amount) < 0) {
          newErrors[`closing_${index}_amount`] = "Please enter a valid amount";
        }
        if (!detail.description.trim()) {
          newErrors[`closing_${index}_description`] = "Description is required";
        }
        if (detail.selectedProducts.includes('other') && !detail.otherProduct.trim()) {
          newErrors[`closing_${index}_otherProduct`] = "Custom product name is required";
        }
      });
  
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };
  
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
        const month = now.getMonth() + 1;
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
          ...(userType === 'Telecaller' && {
            rejectedLeads: Number(rejectedLeads),
            notAttendedCalls: Number(notAttendedCalls),
            closingLeads: Number(closingLeads),
          }),
          closingDetails: closingDetails.map(detail => ({
            products: detail.selectedProducts,
            otherProduct: detail.otherProduct,
            amount: Number(detail.amount),
            description: detail.description,
          })),
          totalClosingAmount,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          synced: false,
        };
  
        await saveReportLocally(reportData);
        try {
          await syncReportToFirebase(reportData);
        } catch (error) {
          console.error("Error syncing report to Firebase:", error);
        }
  
        await AsyncStorage.removeItem(STORAGE_KEYS.DRAFT_REPORT(userType));
        setModalVisible(true);
        setTimeout(() => {
          setModalVisible(false);
          setPositiveLeads('');
          setRejectedLeads('');
          setNotAttendedCalls('');
          setClosingLeads('');
          setClosingDetails([{ selectedProducts: [], otherProduct: '', amount: '', description: '', showOtherInput: false }]);
          setTotalClosingAmount(0);
        }, 2000);
      } catch (error) {
        console.error("Error submitting report:", error);
        Alert.alert("Error", "Failed to submit report. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    };
  
    const saveReportLocally = async (reportData: any) => {
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_REPORT(userType), JSON.stringify(reportData));
        const structuredKey = `${userType.toLowerCase()}_reports_${reportData.year}_${reportData.month}_${reportData.weekNumber}_${reportData.day}`;
        const existingReportsString = await AsyncStorage.getItem(structuredKey);
        const existingReports = existingReportsString ? JSON.parse(existingReportsString) : [];
        existingReports.push(reportData);
        await AsyncStorage.setItem(structuredKey, JSON.stringify(existingReports));
  
        if (!reportData.synced) {
          const pendingReportsString = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_REPORTS(userType));
          const pendingReports = pendingReportsString ? JSON.parse(pendingReportsString) : [];
          pendingReports.push(reportData);
          await AsyncStorage.setItem(STORAGE_KEYS.PENDING_REPORTS(userType), JSON.stringify(pendingReports));
        }
  
        await updateWeeklySummary(reportData);
      } catch (error) {
        console.error("Error saving report locally:", error);
        throw error;
      }
    };
  
    const updateWeeklySummary = async (reportData: any) => {
      try {
        const { year, month, weekNumber } = reportData;
        const weeklyKey = `${userType.toLowerCase()}_weekly_summary_${year}_${month}_${weekNumber}`;
        const existingSummaryString = await AsyncStorage.getItem(weeklyKey);
        const existingSummary = existingSummaryString ? JSON.parse(existingSummaryString) : {
          year,
          month,
          weekNumber,
          totalMeetings: 0,
          totalDuration: 0,
          totalPositiveLeads: 0,
          totalClosingAmount: 0,
          ...(userType === 'Telecaller' && {
            totalRejectedLeads: 0,
            totalNotAttendedCalls: 0,
            totalClosingLeads: 0,
          }),
          reports: [],
        };
  
        existingSummary.totalMeetings += reportData.numMeetings;
        existingSummary.totalPositiveLeads += reportData.positiveLeads;
        existingSummary.totalClosingAmount += reportData.totalClosingAmount;
        if (userType === 'Telecaller') {
          existingSummary.totalRejectedLeads += reportData.rejectedLeads;
          existingSummary.totalNotAttendedCalls += reportData.notAttendedCalls;
          existingSummary.totalClosingLeads += reportData.closingLeads;
        }
  
        const durationStr = reportData.meetingDuration || '';
        const [hours, minutes, seconds] = durationStr.split(':').map(Number);
        existingSummary.totalDuration += hours + (minutes / 60) + (seconds / 3600);
  
        if (!existingSummary.reports.some((r: any) => r.id === reportData.id)) {
          existingSummary.reports.push(reportData);
        }
  
        await AsyncStorage.setItem(weeklyKey, JSON.stringify(existingSummary));
      } catch (error) {
        console.error("Error updating weekly summary:", error);
      }
    };
  
    const syncReportToFirebase = async (reportData: any) => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error("User not authenticated");
  
        const formattedDuration = reportData.meetingDuration;
        const reportsRef = collection(db, `${userType.toLowerCase()}_reports`);
        const docRef = await addDoc(reportsRef, {
          ...reportData,
          meetingDuration: formattedDuration,
          synced: true,
          syncedAt: Timestamp.fromDate(new Date()),
        });
  
        const weeklySummaryRef = doc(db, `${userType.toLowerCase()}_weekly_summaries`, `${userId}_${reportData.year}_${reportData.month}_${reportData.weekNumber}`);
        const weeklySummaryDoc = await getDoc(weeklySummaryRef);
  
        const [hours, minutes, seconds] = formattedDuration.split(':').map(Number);
        const totalDurationHours = hours + (minutes / 60) + (seconds / 3600);
  
        if (weeklySummaryDoc.exists()) {
          await updateDoc(weeklySummaryRef, {
            totalMeetings: increment(reportData.numMeetings),
            totalPositiveLeads: increment(reportData.positiveLeads),
            totalClosingAmount: increment(reportData.totalClosingAmount),
            ...(userType === 'Telecaller' && {
              totalRejectedLeads: increment(reportData.rejectedLeads),
              totalNotAttendedCalls: increment(reportData.notAttendedCalls),
              totalClosingLeads: increment(reportData.closingLeads),
            }),
            totalDuration: increment(totalDurationHours),
            updatedAt: Timestamp.fromDate(new Date()),
          });
        } else {
          await setDoc(weeklySummaryRef, {
            userId,
            year: reportData.year,
            month: reportData.month,
            weekNumber: reportData.weekNumber,
            totalMeetings: reportData.numMeetings,
            totalPositiveLeads: reportData.positiveLeads,
            totalClosingAmount: reportData.totalClosingAmount,
            ...(userType === 'Telecaller' && {
              totalRejectedLeads: reportData.rejectedLeads,
              totalNotAttendedCalls: reportData.notAttendedCalls,
              totalClosingLeads: reportData.closingLeads,
            }),
            totalDuration: totalDurationHours,
            createdAt: Timestamp.fromDate(new Date()),
            updatedAt: Timestamp.fromDate(new Date()),
          });
        }
  
        const pendingReportsString = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_REPORTS(userType));
        if (pendingReportsString) {
          const pendingReports = JSON.parse(pendingReportsString);
          const updatedPendingReports = pendingReports.filter((report: any) => report.id !== reportData.id);
          await AsyncStorage.setItem(STORAGE_KEYS.PENDING_REPORTS(userType), JSON.stringify(updatedPendingReports));
        }
      } catch (error) {
        console.error("Error syncing report to Firebase:", error);
        throw error;
      }
    };
  
    const syncLocalWithFirebase = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
  
        const pendingReportsString = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_REPORTS(userType));
        if (!pendingReportsString) return;
  
        const pendingReports = JSON.parse(pendingReportsString);
        if (pendingReports.length === 0) return;
  
        setSyncStatus('syncing');
        const reportsByWeek: { [key: string]: any[] } = {};
  
        pendingReports.forEach((report: any) => {
          const { year, month, weekNumber } = report;
          const weekKey = `${year}_${month}_${weekNumber}`;
          if (!reportsByWeek[weekKey]) reportsByWeek[weekKey] = [];
          reportsByWeek[weekKey].push(report);
        });
  
        for (const weekKey in reportsByWeek) {
          const reports = reportsByWeek[weekKey];
          const [year, month, weekNumber] = weekKey.split('_').map(Number);
  
          for (const report of reports) {
            try {
              const formattedDuration = report.meetingDuration;
              const docRef = await addDoc(collection(db, `${userType.toLowerCase()}_reports`), {
                ...report,
                meetingDuration: formattedDuration,
                synced: true,
                syncedAt: Timestamp.fromDate(new Date()),
              });
            } catch (error) {
              console.error("Error syncing report:", error);
            }
          }
  
          const weeklySummaryRef = doc(db, `${userType.toLowerCase()}_weekly_summaries`, `${userId}_${year}_${month}_${weekNumber}`);
          const weeklySummaryDoc = await getDoc(weeklySummaryRef);
  
          let totalMeetings = 0;
          let totalDuration = 0;
          let totalPositiveLeads = 0;
          let totalClosingAmount = 0;
          let totalRejectedLeads = 0;
          let totalNotAttendedCalls = 0;
          let totalClosingLeads = 0;
  
          reports.forEach((report: any) => {
            totalMeetings += report.numMeetings || 0;
            totalPositiveLeads += report.positiveLeads || 0;
            totalClosingAmount += report.totalClosingAmount || 0;
            if (userType === 'Telecaller') {
              totalRejectedLeads += report.rejectedLeads || 0;
              totalNotAttendedCalls += report.notAttendedCalls || 0;
              totalClosingLeads += report.closingLeads || 0;
            }
  
            const durationStr = report.meetingDuration || '';
            const [hours, minutes, seconds] = durationStr.split(':').map(Number);
            totalDuration += hours + (minutes / 60) + (seconds / 3600);
          });
  
          if (weeklySummaryDoc.exists()) {
            await updateDoc(weeklySummaryRef, {
              totalMeetings: increment(totalMeetings),
              totalPositiveLeads: increment(totalPositiveLeads),
              totalClosingAmount: increment(totalClosingAmount),
              ...(userType === 'Telecaller' && {
                totalRejectedLeads: increment(totalRejectedLeads),
                totalNotAttendedCalls: increment(totalNotAttendedCalls),
                totalClosingLeads: increment(totalClosingLeads),
              }),
              totalDuration: increment(totalDuration),
              updatedAt: Timestamp.fromDate(new Date()),
            });
          } else {
            await setDoc(weeklySummaryRef, {
              userId,
              year,
              month,
              weekNumber,
              totalMeetings,
              totalPositiveLeads,
              totalClosingAmount,
              ...(userType === 'Telecaller' && {
                totalRejectedLeads,
                totalNotAttendedCalls,
                totalClosingLeads,
              }),
              totalDuration,
              createdAt: Timestamp.fromDate(new Date()),
              updatedAt: Timestamp.fromDate(new Date()),
            });
          }
        }
  
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_REPORTS(userType), JSON.stringify([]));
        setSyncStatus('synced');
      } catch (error) {
        console.error("Error syncing with Firebase:", error);
        setSyncStatus('error');
      }
    };
  
    const addClosingDetail = () => {
      setClosingDetails([...closingDetails, {
        selectedProducts: [],
        otherProduct: '',
        amount: '',
        description: '',
        showOtherInput: false,
      }]);
    };
  
    const removeClosingDetail = (index: number) => {
      const newClosingDetails = closingDetails.filter((_, i) => i !== index);
      setClosingDetails(newClosingDetails);
      updateTotalAmount(newClosingDetails);
    };
  
    const updateClosingDetail = (index: number, field: keyof ClosingDetail, value: any) => {
      const newClosingDetails = [...closingDetails];
      newClosingDetails[index] = { ...newClosingDetails[index], [field]: value };
      setClosingDetails(newClosingDetails);
      if (field === 'amount') updateTotalAmount(newClosingDetails);
    };
  
    const updateTotalAmount = (details: ClosingDetail[]) => {
      const total = details.reduce((sum, detail) => {
        const amount = Number(detail.amount.replace(/[^0-9]/g, '')) || 0;
        return sum + amount;
      }, 0);
      setTotalClosingAmount(total);
    };
  
    const toggleProductSelection = (index: number, productValue: string, isDeselect: boolean = false) => {
      const newClosingDetails = [...closingDetails];
      const selectedProducts = [...newClosingDetails[index].selectedProducts];
  
      if (isDeselect) {
        const productIndex = selectedProducts.indexOf(productValue);
        if (productIndex !== -1) selectedProducts.splice(productIndex, 1);
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
        showOtherInput: selectedProducts.includes('other'),
      };
      setClosingDetails(newClosingDetails);
    };
  
    const renderLayout = () => {
      if (userType === 'BDM') {
        return (
          <BDMMainLayout title="Daily Report" showBackButton>
            {renderContent()}
          </BDMMainLayout>
        );
      }
      return (
        <TelecallerMainLayout showDrawer showBackButton={true} title="Daily Report">
          {renderContent()}
        </TelecallerMainLayout>
      );
    };
  
    const renderContent = () => (
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
  
                <View style={styles.section}>
                  <Text style={styles.label}>Number of {userType === 'BDM' ? 'Meetings' : 'Calls'}</Text>
                  <View style={styles.readOnlyInput}>
                    <Text style={styles.readOnlyText}>{numMeetings}</Text>
                  </View>
  
                  <Text style={styles.label}>{userType === 'BDM' ? 'Meeting' : 'Call'} Duration</Text>
                  <View style={styles.readOnlyInput}>
                    <Text style={styles.readOnlyText}>{meetingDuration}</Text>
                  </View>
  
                  <Text style={styles.label}>
                    {userType === 'BDM' ? 'Prospective No. of Meetings' : 'Positive Leads'} <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, errors.positiveLeads ? styles.inputError : null]}
                    placeholder={userType === 'BDM' ? "Enter prospective number of meetings" : "Enter positive leads"}
                    value={positiveLeads}
                    onChangeText={(text) => {
                      setPositiveLeads(text);
                      if (errors.positiveLeads) {
                        const newErrors = { ...errors };
                        delete newErrors.positiveLeads;
                        setErrors(newErrors);
                      }
                    }}
                    keyboardType="numeric"
                  />
                  {errors.positiveLeads && <Text style={styles.errorText}>{errors.positiveLeads}</Text>}
  
                  {userType === 'Telecaller' && (
                    <>
                      <Text style={styles.label}>Rejected Leads <Text style={styles.requiredStar}>*</Text></Text>
                      <TextInput
                        style={[styles.input, errors.rejectedLeads ? styles.inputError : null]}
                        placeholder="Enter rejected leads"
                        value={rejectedLeads}
                        onChangeText={(text) => {
                          setRejectedLeads(text);
                          if (errors.rejectedLeads) {
                            const newErrors = { ...errors };
                            delete newErrors.rejectedLeads;
                            setErrors(newErrors);
                          }
                        }}
                        keyboardType="numeric"
                      />
                      {errors.rejectedLeads && <Text style={styles.errorText}>{errors.rejectedLeads}</Text>}
  
                      <Text style={styles.label}>Not Attended Calls <Text style={styles.requiredStar}>*</Text></Text>
                      <TextInput
                        style={[styles.input, errors.notAttendedCalls ? styles.inputError : null]}
                        placeholder="Enter not attended calls"
                        value={notAttendedCalls}
                        onChangeText={(text) => {
                          setNotAttendedCalls(text);
                          if (errors.notAttendedCalls) {
                            const newErrors = { ...errors };
                            delete newErrors.notAttendedCalls;
                            setErrors(newErrors);
                          }
                        }}
                        keyboardType="numeric"
                      />
                      {errors.notAttendedCalls && <Text style={styles.errorText}>{errors.notAttendedCalls}</Text>}
  
                      <Text style={styles.label}>Closing Leads <Text style={styles.requiredStar}>*</Text></Text>
                      <TextInput
                        style={[styles.input, errors.closingLeads ? styles.inputError : null]}
                        placeholder="Enter closing leads"
                        value={closingLeads}
                        onChangeText={(text) => {
                          setClosingLeads(text);
                          if (errors.closingLeads) {
                            const newErrors = { ...errors };
                            delete newErrors.closingLeads;
                            setErrors(newErrors);
                          }
                        }}
                        keyboardType="numeric"
                      />
                      {errors.closingLeads && <Text style={styles.errorText}>{errors.closingLeads}</Text>}
                    </>
                  )}
                </View>
  
                <View style={styles.separator} />
  
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Closing Details</Text>
  
                  {closingDetails.map((detail, index) => (
                    <View key={index} style={styles.closingDetailContainer}>
                      {index > 0 && (
                        <TouchableOpacity style={styles.removeButton} onPress={() => removeClosingDetail(index)}>
                          <MaterialIcons name="remove-circle" size={24} color="#FF5252" />
                        </TouchableOpacity>
                      )}
  
                      <Text style={styles.label}>Type of Product <Text style={styles.requiredStar}>*</Text></Text>
  
                      <View style={styles.selectedProductsContainer}>
                        {detail.selectedProducts.map((product, productIndex) => (
                          <View key={productIndex} style={styles.selectedProductChip}>
                            <Text style={styles.selectedProductText}>
                              {product === 'other' ? detail.otherProduct : productList.find(p => p.value === product)?.label || product}
                            </Text>
                            <TouchableOpacity
                              onPress={() => toggleProductSelection(index, product, true)}
                              style={styles.removeProductButton}
                            >
                              <MaterialIcons name="close" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
  
                      <TouchableOpacity
                        style={styles.dropdownButton}
                        onPress={() => setDropdownVisible(dropdownVisible === index ? null : index)}
                      >
                        <Text style={styles.dropdownButtonText}>
                          {detail.selectedProducts.length > 0
                            ? `${detail.selectedProducts.length} product(s) selected`
                            : 'Select products'}
                        </Text>
                        <MaterialIcons
                          name={dropdownVisible === index ? "arrow-drop-up" : "arrow-drop-down"}
                          size={24}
                          color="#666"
                        />
                      </TouchableOpacity>
  
                      {dropdownVisible === index && (
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
                            keyExtractor={(item) => item.value}
                            style={styles.dropdownList}
                            nestedScrollEnabled
                            renderItem={({ item }) => (
                              <TouchableOpacity
                                style={[
                                  styles.dropdownItem,
                                  detail.selectedProducts.includes(item.value) && styles.dropdownItemSelected,
                                ]}
                                onPress={() => toggleProductSelection(index, item.value)}
                              >
                                <Text
                                  style={[
                                    styles.dropdownItemText,
                                    detail.selectedProducts.includes(item.value) && styles.dropdownItemTextSelected,
                                  ]}
                                >
                                  {item.label}
                                </Text>
                                {detail.selectedProducts.includes(item.value) && (
                                  <MaterialIcons name="check" size={20} color="#FFFFFF" />
                                )}
                              </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={styles.noResultsText}>No products found</Text>}
                          />
  
                          {detail.showOtherInput && (
                            <View style={styles.otherProductContainer}>
                              <TextInput
                                style={styles.otherProductInput}
                                placeholder="Enter custom product name"
                                value={detail.otherProduct}
                                onChangeText={(text) => updateClosingDetail(index, 'otherProduct', text)}
                              />
                              <TouchableOpacity
                                style={styles.addCustomButton}
                                onPress={() => {
                                  if (detail.otherProduct.trim()) {
                                    updateClosingDetail(index, 'showOtherInput', false);
                                  }
                                }}
                              >
                                <Text style={styles.addCustomButtonText}>Add</Text>
                              </TouchableOpacity>
                            </View>
                          )}
  
                          <TouchableOpacity
                            style={styles.closeDropdownButton}
                            onPress={() => {
                              setDropdownVisible(null);
                              setSearchQuery('');
                            }}
                          >
                            <Text style={styles.closeDropdownText}>Done</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {errors[`closing_${index}_products`] && (
                        <Text style={styles.errorText}>{errors[`closing_${index}_products`]}</Text>
                      )}
                      {errors[`closing_${index}_otherProduct`] && (
                        <Text style={styles.errorText}>{errors[`closing_${index}_otherProduct`]}</Text>
                      )}
  
                      <Text style={styles.label}>Closing Amount <Text style={styles.requiredStar}>*</Text></Text>
                      <View style={styles.amountInputContainer}>
                        <Text style={styles.currencySymbol}>₹</Text>
                        <TextInput
                          style={[styles.amountInput, errors[`closing_${index}_amount`] ? styles.inputError : null]}
                          placeholder="Enter Amount"
                          value={detail.amount}
                          onChangeText={(text) => updateClosingDetail(index, 'amount', text)}
                          keyboardType="numeric"
                        />
                      </View>
                      {errors[`closing_${index}_amount`] && (
                        <Text style={styles.errorText}>{errors[`closing_${index}_amount`]}</Text>
                      )}
  
                      <Text style={styles.label}>Description <Text style={styles.requiredStar}>*</Text></Text>
                      <TextInput
                        style={[styles.textArea, errors[`closing_${index}_description`] ? styles.inputError : null]}
                        placeholder="Enter description product wise, if multiple products are selected"
                        value={detail.description}
                        onChangeText={(text) => updateClosingDetail(index, 'description', text)}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                      />
                      {errors[`closing_${index}_description`] && (
                        <Text style={styles.errorText}>{errors[`closing_${index}_description`]}</Text>
                      )}
                    </View>
                  ))}
  
                  <TouchableOpacity style={styles.addButton} onPress={addClosingDetail}>
                    <MaterialIcons name="add" size={24} color="#FF8447" />
                    <Text style={styles.addButtonText}>Add Another Closing</Text>
                  </TouchableOpacity>
  
                  <View style={styles.totalContainer}>
                    <Text style={styles.totalLabel}>Total Closing Amount <Text style={styles.requiredStar}>*</Text></Text>
                    <View style={styles.totalAmountContainer}>
                      <Text style={styles.totalCurrencySymbol}>₹</Text>
                      <Text style={styles.totalAmount}>{totalClosingAmount.toLocaleString()}</Text>
                    </View>
                  </View>
                </View>
  
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  <LinearGradient
                    colors={['#FF8447', '#FF6D24']}
                    style={styles.submitGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitText}>Submit Report</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
  
        <Modal
          transparent={true}
          visible={modalVisible}
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {userType === 'BDM' ? (
                <>
                  <MaterialIcons name="check-circle" size={60} color="#4CAF50" />
                  <Text style={styles.modalTitle}>Report Submitted!</Text>
                  <Text style={styles.modalSubtitle}>Your daily report has been successfully submitted.</Text>
                </>
              ) : (
                <>
                  <Image
                    source={require("@/assets/images/mail.gif")}
                    style={styles.gif}
                    contentFit="contain"
                  />
                  <Text style={styles.modalTitle}>Report Submitted Successfully!</Text>
                  <Text style={styles.modalSubtitle}>Your report has been recorded. Keep up the great work!</Text>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  
    return <AppGradient>{renderLayout()}</AppGradient>;
  };
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#FFFFFF",
      borderRadius: 15,
      marginHorizontal: 10,
    },
    scrollContainer: {
      flexGrow: 1,
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
    readOnlyInput: {
      borderWidth: 1,
      borderColor: "#E0E0E0",
      borderRadius: 8,
      padding: 12,
      backgroundColor: "#F5F5F5",
      marginBottom: 15,
    },
    readOnlyText: {
      fontSize: 16,
      color: "#333",
      fontFamily: "LexendDeca_500Medium",
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
      marginTop: 30,
      marginBottom: 40,
      borderRadius: 8,
      overflow: "hidden",
    },
    submitGradient: {
      paddingVertical: 15,
      alignItems: "center",
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
    gif: {
      width: 100,
      height: 100,
      marginBottom: 20,
    },
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
    otherProductContainer: {
      flexDirection: 'row',
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: '#EEEEEE',
      backgroundColor: '#FAFAFA',
    },
    otherProductInput: {
      flex: 1,
      height: 40,
      borderWidth: 1,
      borderColor: '#E0E0E0',
      borderRadius: 8,
      paddingHorizontal: 12,
      backgroundColor: '#FFFFFF',
      fontFamily: 'LexendDeca_400Regular',
    },
    addCustomButton: {
      marginLeft: 8,
      backgroundColor: '#FF8447',
      borderRadius: 8,
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    addCustomButtonText: {
      color: '#FFFFFF',
      fontFamily: 'LexendDeca_500Medium',
    },
  });
  
  export default DailyReportScreen;