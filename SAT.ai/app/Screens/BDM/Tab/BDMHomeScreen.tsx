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
  PermissionsAndroid
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
import { collection, query, where, getDocs, doc, getDoc, setDoc, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppGradient from "@/app/components/AppGradient";
import { getAuth } from 'firebase/auth';
import { getFirestore, onSnapshot, updateDoc } from 'firebase/firestore';
import api from '@/app/services/api';
import { getCurrentWeekAchievements } from "@/app/services/targetService";
import TelecallerAddContactModal from '@/app/Screens/Telecaller/TelecallerAddContactModal';

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
  todayCalls: {
    count: number;
    duration: number;
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
      const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

      const callLogsRef = collection(db, 'callLogs');

      // Set up real-time listener for all logs in the last 30 days
      const logsQuery = query(
        callLogsRef,
        where('userId', '==', userId),
        where('timestamp', '>=', thirtyDaysAgo),
        orderBy('timestamp', 'desc')
      );

      // Set up real-time listener
      const unsubscribe = onSnapshot(logsQuery, async (snapshot) => {
        const logs = await processCallLogs(snapshot);
        updateCallLogsState(logs, 'all');
        
        // Fetch device call logs immediately when logs update
        if (Platform.OS === 'android') {
          await fetchDeviceCallLogs();
        }
      });

      return unsubscribe;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching call logs:', error);
      if (error.message?.includes('requires an index')) {
        Alert.alert(
          'Index Required',
          'Please wait a few minutes while we set up the required database index. The call logs will appear automatically once it\'s ready.',
          [{ text: 'OK' }]
        );
      }
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

  const updateCallLogsState = (newLogs: CallLog[], type: 'current' | 'older' | 'all') => {
    setCallLogs(prevLogs => {
      let updatedLogs: CallLog[];
      
      if (type === 'current') {
        // Replace only current day logs
        const olderLogs = prevLogs.filter(log => {
          const logDate = new Date(log.timestamp);
          const startOfToday = new Date().setHours(0, 0, 0, 0);
          return logDate.getTime() < startOfToday;
        });
        updatedLogs = [...newLogs, ...olderLogs];
      } else if (type === 'older') {
        // Replace only older logs
        const currentDayLogs = prevLogs.filter(log => {
          const logDate = new Date(log.timestamp);
          const startOfToday = new Date().setHours(0, 0, 0, 0);
          return logDate.getTime() >= startOfToday;
        });
        updatedLogs = [...currentDayLogs, ...newLogs];
      } else {
        updatedLogs = newLogs;
      }

      // Sort logs by timestamp in descending order
      updatedLogs.sort((a, b) => {
        const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return bTime - aTime;
      });

      // Group the logs
      return groupCallLogs(updatedLogs);
    });
  };

  const groupCallLogs = (logs: CallLog[]): GroupedCallLog[] => {
    const groupedByPhone: { [key: string]: CallLog[] } = {};
    const monthlyHistory: { [key: string]: MonthlyCallHistory } = {};
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // First, collect all calls for the last 30 days
    logs.forEach(log => {
      if (!log.phoneNumber) return;
      
      const logDate = new Date(log.timestamp);
      if (logDate >= thirtyDaysAgo) {
        if (!monthlyHistory[log.phoneNumber]) {
          monthlyHistory[log.phoneNumber] = {
            phoneNumber: log.phoneNumber,
            totalCalls: 0,
            lastCallDate: logDate,
            callTypes: {
              incoming: 0,
              outgoing: 0,
              missed: 0,
              rejected: 0
            },
            totalDuration: 0,
            todayCalls: {
              count: 0,
              duration: 0
            }
          };
        }
        
        // Update total calls and duration
        monthlyHistory[log.phoneNumber].totalCalls++;
        monthlyHistory[log.phoneNumber].totalDuration += log.duration || 0;
        
        // Update call types
        if (log.type === 'incoming') {
          monthlyHistory[log.phoneNumber].callTypes.incoming++;
        } else if (log.type === 'outgoing') {
          monthlyHistory[log.phoneNumber].callTypes.outgoing++;
        } else if (log.type === 'missed') {
          monthlyHistory[log.phoneNumber].callTypes.missed++;
        } else if (log.type === 'rejected') {
          monthlyHistory[log.phoneNumber].callTypes.rejected++;
        }

        // Update today's calls if applicable
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (logDate >= startOfToday) {
          monthlyHistory[log.phoneNumber].todayCalls.count++;
          monthlyHistory[log.phoneNumber].todayCalls.duration += log.duration || 0;
        }

        if (logDate > monthlyHistory[log.phoneNumber].lastCallDate) {
          monthlyHistory[log.phoneNumber].lastCallDate = logDate;
        }
      }
    });

    // Then group calls for display
    logs.forEach(log => {
      if (!log.phoneNumber) return;
      
      if (!groupedByPhone[log.phoneNumber]) {
        groupedByPhone[log.phoneNumber] = [];
      }
      groupedByPhone[log.phoneNumber].push(log);
    });

    // Convert grouped calls to array and sort by latest timestamp
    return Object.entries(groupedByPhone).map(([phoneNumber, calls]) => {
      // Sort calls by timestamp descending (latest first)
      const sortedCalls = [...calls].sort((a, b) => {
        const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return bTime - aTime;
      });
      
      // Use the most recent call as the main log
      const latestCall = sortedCalls[0];
          
          return {
        ...latestCall,
        callCount: monthlyHistory[phoneNumber]?.totalCalls || 0,
        allCalls: sortedCalls,
        monthlyHistory: monthlyHistory[phoneNumber]
      };
    }).sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });
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
          // Filter logs from last 30 days
          const recentLogs = parsedLogs.filter((log: any) => {
            const logTimestamp = new Date(log.timestamp).getTime();
            return logTimestamp >= thirtyDaysAgo.getTime();
          });
          
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
          const formattedLogs = parsedLogs.map((log: any) => ({
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
      if (!auth.currentUser?.uid) return;
      
      const achievements = await getCurrentWeekAchievements(auth.currentUser.uid);
      setWeeklyAchievement({
        percentageAchieved: achievements.percentageAchieved,
        isLoading: false
      });
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
    const dayLogs = callLogs.filter(log => {
      const logDate = new Date(log.timestamp).toLocaleDateString();
      return logDate === date;
    });

    let totalSeconds = 0;
    dayLogs.forEach(log => {
      if (log.monthlyHistory?.todayCalls?.duration) {
        totalSeconds += log.monthlyHistory.todayCalls.duration;
      }
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
  };

  const handleCardClick = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCallId(expandedCallId === id ? null : id);
  };

  const navigateToCallHistory = (callItem: GroupedCallLog) => {
    navigation.navigate('BDMCallHistory', {
      customerName: callItem.contactName || callItem.phoneNumber,
      meetings: callItem.allCalls.map(call => ({
        date: formatDate(new Date(call.timestamp)),
        time: formatTime(new Date(call.timestamp)),
        duration: formatDuration(call.duration || 0),
        notes: call.notes || []
      }))
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

    return (
      <>
        {isNewDate && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateText}>{formatDate(new Date(item.timestamp))}</Text>
            <Text style={styles.durationText}>
              {calculateTotalDuration(new Date(item.timestamp).toLocaleDateString())}
            </Text>
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
                    {item.monthlyHistory && item.monthlyHistory.todayCalls && item.monthlyHistory.todayCalls.duration > 0 && 
                      ` • ${formatDuration(item.monthlyHistory.todayCalls.duration)}`}
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
          onPress={() => navigation.navigate('BDMCallHistory', { 
            customerName: call.contactName || call.phoneNumber,
            meetings: call.allCalls.map(c => ({
              date: formatDate(new Date(c.timestamp)),
              time: formatTime(new Date(c.timestamp)),
              duration: formatDuration(c.duration || 0),
              notes: c.notes || []
            }))
          })}
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
              keyExtractor={item => item.id}
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
    padding: 20,
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
  },
  dateText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  viewTargetText: {
    marginRight: 8,
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#FF8447',
  },
});

export default BDMHomeScreen;