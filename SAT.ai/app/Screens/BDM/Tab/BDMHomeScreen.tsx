import React, { useState, useRef, useEffect } from "react";
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Image,
  Alert,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  RefreshControl,
  PermissionsAndroid,
  ScrollView,
  Easing
} from "react-native";
import { ProgressBar, Card } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { useProfile } from '@/app/context/ProfileContext';
import { BDMStackParamList, RootStackParamList } from '@/app/index';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import CallLog from 'react-native-call-log';
import { collection, query, where, getDocs, doc, getDoc, setDoc, orderBy, limit, serverTimestamp, Timestamp, addDoc } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppGradient from "@/app/components/AppGradient";
import { getAuth } from 'firebase/auth';
import { getFirestore, onSnapshot, updateDoc } from 'firebase/firestore';
import api from '@/app/services/api';
import { getCurrentWeekAchievements } from "@/app/services/targetService";
import TelecallerAddContactModal from '@/app/Screens/Telecaller/TelecallerAddContactModal';
import { useSharedValue, withRepeat, withSequence, withTiming, withDelay, useAnimatedStyle } from 'react-native-reanimated';
import AnimatedReanimated from 'react-native-reanimated';
import { startOfWeek, endOfWeek, format } from 'date-fns';

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
  type: 'incoming' | 'outgoing' | 'missed';
  status: 'completed' | 'missed' | 'in-progress';
  contactId?: string;
  contactName?: string;
  isNewContact?: boolean;
  notes?: string[];
  contactType?: 'person' | 'company';
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
  contactType?: 'person' | 'company';
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

const CALL_LOGS_STORAGE_KEY = 'device_call_logs';
const CALL_LOGS_LAST_UPDATE = 'call_logs_last_update';
const OLDER_LOGS_UPDATE_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const ACHIEVEMENT_STORAGE_KEY = 'bdm_weekly_achievement';

// Mock company database - in a real app, this would come from a backend API or Firestore
const COMPANY_DATABASE: CompanyDatabase = {
  'google.com': {
    name: 'Google',
    domain: 'google.com',
    industry: 'Technology',
    contacts: [
      { firstName: 'John', lastName: 'Smith', id: 'gs1', contactType: 'company', company: 'Google' },
      { firstName: 'Sarah', lastName: 'Lee', id: 'gs2', contactType: 'company', company: 'Google' }
    ]
  },
  'amazon.com': {
    name: 'Amazon',
    domain: 'amazon.com',
    industry: 'E-commerce',
    contacts: [
      { firstName: 'Mike', lastName: 'Johnson', id: 'am1', contactType: 'company', company: 'Amazon' }
    ]
  },
  'microsoft.com': {
    name: 'Microsoft',
    domain: 'microsoft.com',
    industry: 'Technology',
    contacts: [
      { firstName: 'Priya', lastName: 'Patel', id: 'ms1', contactType: 'company', company: 'Microsoft' }
    ]
  }
};

// Function to detect if a phone number belongs to a company
const detectCompany = (phoneNumber: string, contactName: string): { isCompany: boolean; company?: Company } => {
  // First check if we have company information from the contact name
  if (contactName) {
    // Check against our known company names
    for (const domain in COMPANY_DATABASE) {
      const company = COMPANY_DATABASE[domain];
      if (contactName.toLowerCase().includes(company.name.toLowerCase())) {
        return { isCompany: true, company };
      }
    }
  }
  
  // Check some common company phone numbers (mock data)
  const companyPhonePatterns: Record<string, string> = {
    '+1800': 'google.com',
    '+1844': 'amazon.com',
    '+1866': 'microsoft.com',
    // Add more patterns as needed
  };

  // Check if the phone number matches any known patterns
  for (const pattern in companyPhonePatterns) {
    if (phoneNumber.startsWith(pattern)) {
      const domain = companyPhonePatterns[pattern];
      return { isCompany: true, company: COMPANY_DATABASE[domain] };
    }
  }

  return { isCompany: false };
};

const SkeletonLoader = ({ width, height, style }: { width: number | string; height: number; style?: any }) => {
  const [opacity] = useState(new Animated.Value(0.3));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: '#E5E7EB',
          borderRadius: 8,
          opacity,
        },
        style,
      ]}
    />
  );
};

const BDMHomeScreen = () => {
  const [callLogs, setCallLogs] = useState<GroupedCallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState(0.4);
  const [progressText, setProgressText] = useState("40%");
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [userName, setUserName] = useState("User");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isLoadingSimLogs, setIsLoadingSimLogs] = useState(false);
  const [savedContacts, setSavedContacts] = useState<{[key: string]: boolean}>({});
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [addContactModalVisible, setAddContactModalVisible] = useState(false);
  const [weeklyAchievement, setWeeklyAchievement] = useState({
    percentageAchieved: 0,
    isLoading: true
  });
  const [meetingStats, setMeetingStats] = useState({
    totalMeetings: 0,
    totalDuration: 0
  });
  const statsUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const [waveAnimation] = useState(new Animated.Value(0));
  
  const navigation = useNavigation<StackNavigationProp<BDMStackParamList>>();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0));
  const { userProfile } = useProfile();
  const processedLogs = useRef<CallLog[]>([]);

  useEffect(() => {
    checkAndRequestPermissions();
    
    // Load data
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        
        // Check if user is first time
        const isFirstTime = await AsyncStorage.getItem('isFirstTimeUser');
        if (isFirstTime === null) {
          // First time user
          await AsyncStorage.setItem('isFirstTimeUser', 'false');
          setIsFirstTimeUser(true);
          setShowWelcomeModal(true);
        } else {
          setIsFirstTimeUser(false);
        }
        
        // Set user name
        if (userProfile?.name) {
          setUserName(userProfile.name);
        } else if (userProfile?.firstName) {
          setUserName(`${userProfile.firstName} ${userProfile.lastName || ''}`);
        } else if (auth.currentUser?.displayName) {
          setUserName(auth.currentUser.displayName);
        }
        
        // Load data in parallel
        await Promise.all([
          loadSavedContacts(),
          fetchCallLogs(),
          fetchWeeklyAchievement()
        ]);

        // Mark as visited
        await AsyncStorage.setItem('has_visited_bdm_home', 'true');
      } catch (error) {
        console.error("Error loading initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialData();
    
    // Animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    
  }, []);

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

  const checkAndRequestPermissions = async () => {
    try {
      const hasPermission = await requestCallLogPermission();
      return hasPermission;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  };

  const requestCallLogPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        const allGranted = Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            'Permission Required',
            'Call log permissions are required to view call history.',
            [{ text: 'OK' }]
          );
        }

        return allGranted;
      } catch (err) {
        console.warn('Error requesting permissions:', err);
        return false;
      }
    }
    return false;
  };

  const loadSavedContacts = async () => {
    try {
      const storedContacts = await AsyncStorage.getItem('contacts');
      if (storedContacts) {
        const contacts = JSON.parse(storedContacts);
        const contactsMap = contacts.reduce((acc: {[key: string]: boolean}, contact: any) => {
          if (contact.phoneNumber) {
            acc[contact.phoneNumber] = true;
          }
          return acc;
        }, {});
        setSavedContacts(contactsMap);
      }
    } catch (error) {
      console.error('Error loading saved contacts:', error);
    }
  };

  const fetchCallLogs = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log('No user ID found for call logs');
        return;
      }

      const now = new Date();
      const startOfToday = new Date(now.setHours(0, 0, 0, 0));

      const callLogsRef = collection(db, 'callLogs');

      // Set up real-time listener for today's logs
      const logsQuery = query(
        callLogsRef,
        where('userId', '==', userId),
        where('timestamp', '>=', startOfToday),
        orderBy('timestamp', 'desc')
      );

      // Set up real-time listener
      const unsubscribe = onSnapshot(logsQuery, async (snapshot) => {
        const logs = await processCallLogs(snapshot);
        updateCallLogsState(logs, 'current');
        
        // Calculate total duration for today
        const totalDuration = logs.reduce((acc, log) => acc + (log.duration || 0), 0);
        console.log(`Total Duration for Today: ${formatDuration(totalDuration)}`); // Debugging line
      });

      return unsubscribe;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching call logs:', error);
    }
  };

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

  const updateCallLogsState = (logs: CallLog[], type: 'current' | 'all') => {
    // Group logs by phone number
    const groupedLogs = logs.reduce((acc: { [key: string]: GroupedCallLog }, log) => {
      // Skip logs with invalid phone numbers
      if (!log.phoneNumber) return acc;
      
      const key = log.phoneNumber;
      if (!acc[key]) {
        acc[key] = {
          ...log,
          callCount: 1,
          allCalls: [log]
        };
      } else {
        acc[key].callCount++;
        acc[key].allCalls.push(log);
        // Update the most recent call details
        // Ensure both timestamps are valid before comparing
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

    // Convert to array and sort by timestamp with proper error handling
    const sortedLogs = Object.values(groupedLogs).sort((a, b) => {
      // Ensure both timestamps are valid Date objects
      const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
      const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
      return bTime - aTime;
    });

    setCallLogs(sortedLogs);
  };

  const fetchDeviceCallLogs = async () => {
    try {
      setIsLoadingSimLogs(true);

      // Check last update time
      const lastUpdate = await AsyncStorage.getItem(CALL_LOGS_LAST_UPDATE);
      const storedLogs = await AsyncStorage.getItem(CALL_LOGS_STORAGE_KEY);
      const now = Date.now();
      const thirtyDaysAgo = new Date(now - THIRTY_DAYS_MS);

      // If we have stored logs and they're recent, use them
      if (storedLogs && lastUpdate && (now - parseInt(lastUpdate)) < 60000) { // 1 minute threshold
        try {
          const parsedLogs = JSON.parse(storedLogs);
          // Filter logs from last 30 days and deduplicate
          const recentLogs = deduplicateCallLogs(parsedLogs.filter((log: any) => {
            const logTimestamp = new Date(log.timestamp).getTime();
            return logTimestamp >= thirtyDaysAgo.getTime();
          }));
          
          // Format and update logs
          const formattedLogs = recentLogs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp).toISOString(),
            duration: parseInt(log.duration) || 0,
            type: log.type || 'outgoing',
            status: log.status || 'completed'
          }));
          
          // Update logs in state
          updateCallLogsState(formattedLogs, 'all');
        } catch (error) {
          console.error('Error parsing stored logs:', error);
          await fetchFreshLogs();
        }
        setIsLoadingSimLogs(false);
        return;
      }

      await fetchFreshLogs();
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching device call logs:', error);
      Alert.alert('Error', 'Failed to fetch call logs');
      
      // Try to use stored logs as fallback
      try {
        const storedLogs = await AsyncStorage.getItem(CALL_LOGS_STORAGE_KEY);
        if (storedLogs) {
          const parsedLogs = JSON.parse(storedLogs);
          const deduplicatedLogs = deduplicateCallLogs(parsedLogs);
          const formattedLogs = deduplicatedLogs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp).toISOString(),
            duration: parseInt(log.duration) || 0,
            type: log.type || 'outgoing',
            status: log.status || 'completed'
          }));
          updateCallLogsState(formattedLogs, 'all');
        }
      } catch (storageError) {
        console.error('Error reading from storage:', storageError);
      }
    } finally {
      setIsLoadingSimLogs(false);
    }
  };

  // Add new function to deduplicate call logs
  const deduplicateCallLogs = (logs: any[]): any[] => {
    const seen = new Set();
    return logs.filter(log => {
      // Create a unique key for each call based on timestamp and phone number
      const key = `${log.timestamp}-${log.phoneNumber}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  const fetchFreshLogs = async () => {
    if (Platform.OS === 'android') {
      const hasPermission = await requestCallLogPermission();
      
      if (hasPermission) {
        const logs = await CallLog.loadAll();
        console.log('Device call logs:', logs);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Filter logs from last 30 days
        const recentLogs = logs.filter((log: any) => {
          const logTimestamp = parseInt(log.timestamp);
          return logTimestamp >= thirtyDaysAgo.getTime();
        });

        const formattedLogs = recentLogs.map((log: any) => ({
          id: String(log.timestamp),
          phoneNumber: log.phoneNumber,
          contactName: log.name && log.name !== "Unknown" ? log.name : log.phoneNumber,
          timestamp: new Date(parseInt(log.timestamp)),
          duration: parseInt(log.duration) || 0,
          type: (log.type || 'OUTGOING').toLowerCase() as 'incoming' | 'outgoing' | 'missed',
          status: (log.type === 'MISSED' ? 'missed' : 'completed') as 'missed' | 'completed' | 'in-progress'
        }));

        // Store logs in AsyncStorage
        await AsyncStorage.setItem(CALL_LOGS_STORAGE_KEY, JSON.stringify(formattedLogs));
        await AsyncStorage.setItem(CALL_LOGS_LAST_UPDATE, String(Date.now()));

        // Update logs in state
        updateCallLogsState(formattedLogs, 'all');
      }
    }
  };

  const fetchWeeklyAchievement = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log('No user ID found for fetching achievements');
        return;
      }

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Get current month, year, and week number
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const currentWeekNumber = Math.ceil((now.getDate() + new Date(currentYear, now.getMonth(), 1).getDay()) / 7);

      console.log("Fetching achievements for week:", currentYear, currentMonth, currentWeekNumber);

      // First try to get from bdm_achievements collection
      const achievementsRef = collection(db, 'bdm_achievements');
      const q = query(
        achievementsRef,
        where('userId', '==', userId),
        where('year', '==', currentYear),
        where('month', '==', currentMonth),
        where('weekNumber', '==', currentWeekNumber)
      );

      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const achievementData = querySnapshot.docs[0].data();
        console.log('Found achievement data:', achievementData);
        
        setWeeklyAchievement({
          percentageAchieved: achievementData.percentageAchieved || 0,
          isLoading: false
        });
      } else {
        // If no achievement record exists, calculate it directly from reports
        console.log('No achievement record found, calculating from daily reports');
        
        // Query reports for the current week
        const reportsRef = collection(db, 'bdm_reports');
        const reportsQuery = query(
          reportsRef,
          where('userId', '==', userId),
          where('year', '==', currentYear),
          where('month', '==', currentMonth),
          where('weekNumber', '==', currentWeekNumber)
        );
        
        const reportsSnapshot = await getDocs(reportsQuery);
        
        let totalMeetings = 0;
        let totalAttendedMeetings = 0;
        let totalDuration = 0;
        let totalClosing = 0;
        
        reportsSnapshot.forEach(doc => {
          const data = doc.data();
          totalMeetings += data.numMeetings || 0;
          totalAttendedMeetings += data.positiveLeads || 0;
          totalClosing += data.totalClosingAmount || 0;
          
          // Parse duration string - handle both formats
          const durationStr = data.meetingDuration || '';
          
          // Check if it's in HH:MM:SS format
          if (durationStr.includes(':')) {
            const [hours, minutes, seconds] = durationStr.split(':').map(Number);
            totalDuration += (hours * 3600) + (minutes * 60) + seconds;
          } else {
            // Handle "X hr Y mins" format
            const hrMatch = durationStr.match(/(\d+)\s*hr/);
            const minMatch = durationStr.match(/(\d+)\s*min/);
            const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) +
                         (minMatch ? parseInt(minMatch[1]) / 60 : 0);
            totalDuration += hours * 3600; // Convert to seconds
          }
        });
        
        // Calculate individual percentages using the same logic as BDM Target Screen
        const meetingsPercentage = (totalMeetings / 30) * 100;
        const attendedPercentage = (totalAttendedMeetings / 30) * 100;
        const durationPercentage = (totalDuration / (20 * 3600)) * 100; // 20 hours in seconds
        const closingPercentage = (totalClosing / 50000) * 100;
        
        // Calculate overall progress as average of all percentages
        // Use the same rounding as in BDM View Full Report for consistency
        const percentageAchieved = Math.min(
          (meetingsPercentage + attendedPercentage + durationPercentage + closingPercentage) / 4,
          100
        );
        
        // Round to 1 decimal place for consistency with BDM View Full Report
        const roundedPercentage = Math.min(Math.max(Math.round(percentageAchieved * 10) / 10, 0), 100);
        
        // Store the calculated achievement in the bdm_achievements collection
        try {
          await addDoc(collection(db, 'bdm_achievements'), {
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
            createdAt: serverTimestamp()
          });
          console.log('Stored weekly achievement in database');
        } catch (error) {
          console.error('Error storing weekly achievement:', error);
        }
        
        setWeeklyAchievement({
          percentageAchieved: roundedPercentage,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('Error fetching weekly achievement:', error);
      setWeeklyAchievement({
        percentageAchieved: 0,
        isLoading: false
      });
    }
  };

  const formatDate = (date: Date) => {
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
  };

  const getDaySuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '';
    
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
  };

  const calculateTotalDuration = (date: string) => {
    // Get all logs for the specified date
    const dayLogs = callLogs.filter(log => {
      const logDate = new Date(log.timestamp).toLocaleDateString();
      return logDate === date;
    });

    // Calculate total duration for the day
    let totalSeconds = 0;
    
    // Create a map to track unique calls by phone number and timestamp
    const uniqueCalls = new Map();
    
    dayLogs.forEach(log => {
      // Create a unique key for each call based on phone number and timestamp
      const key = `${log.phoneNumber}-${new Date(log.timestamp).getTime()}`;
      
      // Only add the call if we haven't seen it before
      if (!uniqueCalls.has(key)) {
        uniqueCalls.set(key, log);
        totalSeconds += log.duration || 0;
      }
    });

    console.log(`Total duration for ${date}: ${totalSeconds} seconds`);
    return formatDuration(totalSeconds);
  };

  const handleCardClick = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCallId(expandedCallId === id ? null : id);
  };

  const navigateToCallHistory = (callItem: GroupedCallLog) => {
    if (!callItem || !callItem.allCalls) {
      console.error('Invalid call item:', callItem);
      return;
    }

    const meetings = callItem.allCalls.map(call => ({
      date: formatDate(new Date(call.timestamp)),
      time: formatTime(new Date(call.timestamp)),
      duration: formatDuration(call.duration || 0),
      notes: call.notes || [],
      type: call.type || 'unknown'
    }));

    const callStats = callItem.monthlyHistory ? {
      totalCalls: callItem.monthlyHistory.totalCalls,
      totalDuration: callItem.monthlyHistory.totalDuration,
      callTypes: callItem.monthlyHistory.callTypes,
      dailyCalls: callItem.monthlyHistory.dailyCalls
    } : undefined;

    navigation.navigate('BDMCallHistory', {
      customerName: callItem.contactName || callItem.phoneNumber,
      meetings,
      callStats
    });
  };

  const navigateToContactDetails = (callItem: GroupedCallLog) => {
    if (callItem.contactType === 'company') {
      navigation.navigate('BDMCompanyDetails', {
        company: {
          name: callItem.contactName || callItem.phoneNumber
        }
      });
    } else {
      navigation.navigate('BDMContactDetails', {
        contact: {
          name: callItem.contactName || callItem.phoneNumber,
          phone: callItem.phoneNumber,
          email: ''
        }
      });
    }
  };

  const handleRefresh = async () => {
    try {
    setRefreshing(true);
      setIsLoadingSimLogs(true);
      
      // Fetch fresh data in parallel
    await Promise.all([
      fetchWeeklyAchievement(),
        fetchDeviceCallLogs(), // This will update call logs in real-time
      fetchCallLogs()
    ]);

      // Trigger haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error refreshing data:', error);
      Alert.alert('Error', 'Failed to refresh data');
    } finally {
    setRefreshing(false);
      setIsLoadingSimLogs(false);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current.setValue(event.nativeEvent.contentOffset.y);
  };

  const renderCallCard = ({ item, index }: { item: GroupedCallLog; index: number }) => {
    const isNewDate = index === 0 || 
      formatDate(new Date(item.timestamp)) !== formatDate(new Date(callLogs[index - 1].timestamp));

    const isNumberSaved = item.contactName && item.contactName !== item.phoneNumber;
    const displayName = isNumberSaved ? item.contactName : item.phoneNumber;

    // Get the last call duration (not the total for the day)
    const lastCallDuration = item.duration || 0;

    return (
      <>
        {isNewDate && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateText}>{formatDate(new Date(item.timestamp))}</Text>
            <View style={styles.durationContainer}>
              <MaterialIcons name="access-time" size={16} color="#666" style={styles.durationIcon} />
              <Text style={styles.durationText}>
                {calculateTotalDuration(new Date(item.timestamp).toLocaleDateString())}
              </Text>
            </View>
          </View>
        )}
        <TouchableOpacity onPress={() => handleCardClick(item.id)}>
          <View style={styles.callCard}>
            <View style={styles.callInfo}>
              <TouchableOpacity 
                style={styles.avatarContainer}
                onPress={() => navigation.navigate('BDMContactDetails', {
                  contact: {
                    name: item.contactName || item.phoneNumber,
                    phone: item.phoneNumber,
                    email: ''
                  }
                })}
              >
                <MaterialIcons 
                  name="person" 
                  size={24} 
                  color="#FF8447"
                />
              </TouchableOpacity>
              <View style={styles.callDetails}>
                <View style={styles.nameContainer}>
                  <Text style={[
                    styles.callName,
                    { color: item.type === 'missed' ? '#DC2626' : '#333' }
                  ]}>
                    {displayName}
                  </Text>
                  {item.monthlyHistory && item.monthlyHistory.totalCalls > 0 && (
                    <Text style={styles.monthlyCallCount}>
                      ({item.monthlyHistory.totalCalls})
                    </Text>
                  )}
                </View>
                <View style={styles.timeContainer}>
                  <MaterialIcons 
                    name={item.type === 'outgoing' ? 'call-made' : 'call-received'} 
                    size={14} 
                    color={item.type === 'missed' ? '#DC2626' : '#059669'}
                    style={styles.callIcon}
                  />
                  <Text style={styles.callTime}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {lastCallDuration > 0 && 
                      ` • ${formatDuration(lastCallDuration)}`}
                  </Text>
                </View>
              </View>
            </View>
            {expandedCallId === item.id && renderCallActions(item)}
          </View>
        </TouchableOpacity>
      </>
    );
  };

  const renderCallActions = (call: GroupedCallLog) => {
    const isNumberSaved = call.contactName && call.contactName !== call.phoneNumber;

    return (
      <View style={styles.actionContainer}>
              <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigateToCallHistory(call)}
        >
          <MaterialIcons name="history" size={24} color="#FF8447" />
          <Text style={styles.actionText}>History ({call.callCount})</Text>
          </TouchableOpacity>
          
              <TouchableOpacity 
          style={styles.actionButton}
                onPress={() => {
            if (isNumberSaved) {
              navigation.navigate('BDMCallNoteDetailsScreen', { 
                meeting: {
                  name: call.contactName || call.phoneNumber,
                  time: formatTime(new Date(call.timestamp)),
                  duration: formatDuration(call.duration),
                  phoneNumber: call.phoneNumber,
                  date: formatDate(new Date(call.timestamp)),
                  type: call.type,
                  contactType: call.contactType
                      }
                    });
                  } else {
              setSelectedNumber(call.phoneNumber);
              setAddContactModalVisible(true);
                  }
                }}
              >
                <MaterialIcons 
            name={isNumberSaved ? "note-add" : "person-add"} 
            size={24} 
                  color="#FF8447" 
                />
          <Text style={styles.actionText}>
            {isNumberSaved ? 'Add Notes' : 'Add Contact'}
          </Text>
              </TouchableOpacity>
            </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="phone-missed" size={64} color="#DDDDDD" />
      <Text style={styles.emptyTitle}>No Call History Yet</Text>
      <Text style={styles.emptyMessage}>
        Your recent calls will appear here once you start making or receiving calls.
      </Text>
    </View>
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Add this new function to calculate meeting stats
  const calculateMeetingStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLogs = callLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= today;
    });

    const totalMeetings = todayLogs.length;
    let totalDuration = 0;

    todayLogs.forEach(log => {
      totalDuration += log.duration || 0; // Ensure this is correctly calculated
    });

    const stats = {
      totalMeetings,
      totalDuration,
      lastUpdated: new Date().toISOString()
    };

    await AsyncStorage.setItem('bdm_meeting_stats', JSON.stringify(stats));
  };

  // Add useEffect for background updates
  useEffect(() => {
    // Initial calculation
    calculateMeetingStats();

    // Set up interval for background updates
    statsUpdateInterval.current = setInterval(() => {
      calculateMeetingStats();
    }, 5000); // Update every 5 seconds

    // Cleanup interval on unmount
    return () => {
      if (statsUpdateInterval.current) {
        clearInterval(statsUpdateInterval.current);
      }
    };
  }, [callLogs]); // Re-run when callLogs change

  // Add background update interval
  useEffect(() => {
    // Initial fetch
    fetchCallLogs();
    fetchDeviceCallLogs();

    // Set up background update interval
    const backgroundInterval = setInterval(() => {
      fetchCallLogs();
      fetchDeviceCallLogs();
    }, 20000); // Update every 20 seconds

    // Cleanup interval on unmount
    return () => {
      clearInterval(backgroundInterval);
    };
  }, []);

  return (
    <AppGradient>
      <BDMMainLayout showDrawer showBottomTabs={true} showBackButton={false}>
        <View style={styles.container}>
            {/* Welcome Section */}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>
              {isFirstTimeUser ? 'Welcome,👋👋' : 'Hi,👋'}
              </Text>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FF8447" />
            ) : (
              <Text style={styles.nameText}>
                {userName || 'User'}
              </Text>
            )}
              {/* Progress Section */}
              <View style={styles.progressSection}>
              {weeklyAchievement.isLoading ? (
                <ActivityIndicator size="small" color="#FF8447" style={{marginVertical: 10}} />
              ) : (
                <>
                <ProgressBar 
                    progress={weeklyAchievement.percentageAchieved / 100} 
                  color="#FF8447" 
                  style={styles.progressBar} 
                />
                <Text style={styles.progressText}>
                    Great job! You've completed <Text style={styles.progressHighlight}>{weeklyAchievement.percentageAchieved.toFixed(1)}%</Text> of your weekly target
                </Text>
                  <TouchableOpacity 
                    onPress={() => navigation.navigate('BDMTarget')}
                    style={styles.viewTargetButton}
                  >
                    <Text style={styles.viewTargetText}>View Target Details</Text>
                    <MaterialIcons name="arrow-forward" size={16} color="#FF8447" />
                  </TouchableOpacity>
                </>
              )}
              </View>
            </View>

          {/* Call Logs Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Meeting History</Text>
            <TouchableOpacity 
              onPress={handleRefresh}
              style={styles.refreshButton}
            >
              <MaterialIcons name="refresh" size={24} color="#FF8447" />
            </TouchableOpacity>
          </View>
          
          {isLoadingSimLogs ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF8447" />
            </View>
          ) : (
            <FlatList
              data={callLogs.sort((a, b) => {
                const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return bTime - aTime;
              })}
              keyExtractor={item => `${new Date(item.timestamp).toISOString()}-${item.phoneNumber}`}
              renderItem={renderCallCard}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={handleRefresh} 
                  colors={['#FF8447']}
                  tintColor="#FF8447"
                  progressBackgroundColor="#FFF5E6"
                />
              }
            />
        )}
      </View>

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
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  welcomeText: {
    fontSize: 22,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
  },
  nameText: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#222',
    marginTop: 4,
  },
  progressSection: {
    marginTop: 16,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  progressHighlight: {
    color: '#FF8447',
    fontFamily: 'LexendDeca_600SemiBold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  dateText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationIcon: {
    marginRight: 4,
  },
  durationText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  callCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  callInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  callDetails: {
    flex: 1,
  },
  callName: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  callTime: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 2,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 12,
    paddingTop: 12,
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callIcon: {
    marginRight: 4,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthlyCallCount: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginLeft: 8,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  viewTargetButton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingVertical: 12,
  },
  viewTargetText: {
    marginRight: 8,
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#FF8447',
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
});

export default BDMHomeScreen;