import React, { useState, useRef, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Animated, Modal, Platform, NativeScrollEvent, NativeSyntheticEvent, ActivityIndicator, PermissionsAndroid, NativeModules, PanResponder, Dimensions } from "react-native";
import { ProgressBar } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import * as Linking from 'expo-linking';
import AppGradient from "@/app/components/AppGradient";
import { Audio } from 'expo-av';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, getDocs, getDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Alert } from 'react-native';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db } from "@/firebaseConfig";
import CallLog from 'react-native-call-log';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/app/services/api';
import { useProfile } from '@/app/context/ProfileContext';
import TelecallerAddContactModal from '@/app/Screens/Telecaller/TelecallerAddContactModal';
import { getCurrentWeekAchievements } from "@/app/services/targetService";
import targetService from "@/app/services/targetService";
import Dialer from '@/app/components/Dialer/Dialer';
import { startOfWeek, endOfWeek } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { Contact } from '../../../components/Dialer/Dialer';

// Define navigation types
type RootStackParamList = {
  TelecallerCallNoteDetails: { meeting: CallLog };
  AddContactModal: { phone: string };
  CallHistory: { call: CallLog };
  ContactInfo: { 
    contact: {
      id: string;
      firstName: string;
      lastName: string;
      phoneNumber: string;
      isNewContact: boolean;
      email?: string;
    } 
  };
  TelecallerIdleTimer: undefined;
};

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
}

interface UserProfile {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  designation?: string;
}

interface ContactData {
  name: string;
  [key: string]: any;
}

// Add new interface for SIM call logs
interface SimCallLog {
  id: string;
  phoneNumber: string;
  type: 'incoming' | 'outgoing' | 'missed' | 'rejected';
  timestamp: number;
  duration: number;
  contactName?: string;
}

// Update the MonthlyCallHistory interface
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

// Update the GroupedCallLog interface
interface GroupedCallLog extends CallLog {
  callCount: number;
  allCalls: CallLog[];
  monthlyHistory?: MonthlyCallHistory;
}

// Add these constants at the top level
const CALL_LOGS_STORAGE_KEY = 'device_call_logs';
const CALL_LOGS_LAST_UPDATE = 'call_logs_last_update';
const OLDER_LOGS_UPDATE_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [isDialerVisible, setDialerVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCallActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [callTimer, setCallTimer] = useState<NodeJS.Timeout | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [callLogs, setCallLogs] = useState<GroupedCallLog[]>([]);
  const { userProfile, updateProfile } = useProfile();
  const dialerOpacity = useRef(new Animated.Value(1)).current;
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [simCallLogs, setSimCallLogs] = useState<SimCallLog[]>([]);
  const [isLoadingSimLogs, setIsLoadingSimLogs] = useState(false);
  const [savedContacts, setSavedContacts] = useState<{[key: string]: boolean}>({});
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [dialerHeight] = useState(new Animated.Value(0));
  const [dialerY] = useState(new Animated.Value(Dimensions.get('window').height));
  const [selectedNumber, setSelectedNumber] = useState('');
  const [addContactModalVisible, setAddContactModalVisible] = useState(false);
  const [weeklyAchievement, setWeeklyAchievement] = useState({
    percentageAchieved: 0,
    isLoading: true
  });
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(true);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dialerY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          // Close dialer if dragged down more than 100 units
          closeDialer();
        } else {
          // Snap back to original position
          Animated.spring(dialerY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  // Add function to check if number is saved
  const isNumberSaved = (phoneNumber: string) => {
    return savedContacts[phoneNumber] || false;
  };

  // Update the handleContactSaved function
  const handleContactSaved = async (contact: Contact) => {
    try {
      // Update saved contacts state
      setSavedContacts(prev => ({
        ...prev,
        [contact.phoneNumber]: true
      }));

      // Update contacts list
      setContacts(prev => {
        const existingIndex = prev.findIndex(c => c.phoneNumber === contact.phoneNumber);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = contact;
          return updated;
        }
        return [...prev, contact];
      });

      // Refresh call logs to show updated contact name
      await fetchCallLogs();
    } catch (error) {
      console.error('Error handling saved contact:', error);
    }
  };

  // Update the loadSavedContacts function
  const loadSavedContacts = async () => {
    try {
      const storedContacts = await AsyncStorage.getItem('contacts');
      if (storedContacts) {
        const contacts = JSON.parse(storedContacts);
        const contactsMap = contacts.reduce((acc: {[key: string]: boolean}, contact: Contact) => {
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

  // Update the fetchContacts function
  const fetchContacts = async () => {
    try {
      setIsLoadingContacts(true);
      const storedContacts = await AsyncStorage.getItem('contacts');
      if (storedContacts) {
        const parsedContacts = JSON.parse(storedContacts) as Contact[];
        // Ensure all contacts have the favorite property
        const normalizedContacts = parsedContacts.map(contact => ({
          ...contact,
          favorite: contact.favorite ?? false
        }));
        setContacts(normalizedContacts);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  // Update the checkFirstTimeUser function
  const checkFirstTimeUser = async () => {
    try {
      const isFirstTime = await AsyncStorage.getItem('isFirstTimeUser');
      if (isFirstTime === null) {
        // First time user
        await AsyncStorage.setItem('isFirstTimeUser', 'false');
        setIsFirstTimeUser(true);
        return true;
      }
      setIsFirstTimeUser(false);
      return false;
    } catch (error) {
      console.error('Error checking first time user:', error);
      setIsFirstTimeUser(false);
      return false;
    }
  };

  // Update useEffect for user details
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          console.log('No user ID found');
          return;
        }

        // Check if first time user first
        await checkFirstTimeUser();

        // First try to get from context
        if (userProfile?.firstName) {
          setUserName(userProfile.firstName);
          setIsLoading(false);
          return;
        }

        // If not in context, fetch from API
        const userData = await api.getUserProfile(userId);
        if (userData) {
          setUserName(userData.firstName || userData.name || 'User');
          // Update context
          updateProfile(userData);
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
        setUserName('User');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserDetails();
  }, [userProfile]);

  // Add useEffect to fetch contacts
  useEffect(() => {
    fetchContacts();
  }, []);

  // Update the fetchCallLogs function
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

  // Add helper function to process call logs
  const processCallLogs = async (snapshot: any) => {
    const logs: CallLog[] = [];
    
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      
      const log: CallLog = {
        id: docSnapshot.id,
        phoneNumber: data.phoneNumber || '',
        timestamp: data.timestamp?.toDate() || new Date(),
        duration: data.duration|| 0,
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
            const contactData = contactDoc.data() as ContactData;
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

  // Add helper function to update call logs state
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

  // Update the calculateTotalDuration function
  const calculateTotalDuration = (date: string) => {
    const dayLogs = callLogs.filter(log => {
      const logDate = new Date(log.timestamp).toLocaleDateString();
      return logDate === date;
    });

    let totalSeconds = 0;
    dayLogs.forEach(log => {
      totalSeconds += log.duration;
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

  // Format call duration
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

  // Format date for display
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

  // Helper function for day suffix
  const getDaySuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // Fade-in animation for call logs
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleCardClick = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCallId(expandedCallId === id ? null : id);
  };

  // Update the handleCall function
  const handleCall = async (phoneNumber: string) => {
    try {
      if (Platform.OS === 'android') {
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
      console.error('Error making call:', error);
      Alert.alert('Error', 'Failed to initiate call');
    }
  };

  // Function to handle call from call logs
  const handleCallFromLogs = async (phoneNumber: string) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const startTime = new Date();
      // Create call log entry with initial state
      const callLogRef = await addDoc(collection(db, 'callLogs'), {
        userId,
        phoneNumber,
        timestamp: startTime,
        startTime: startTime,
        type: 'outgoing',
        status: 'in-progress',
        duration: 0
      });

      // Start call duration timer
      startCallTimer();

      // Make the actual phone call
      const phoneUrl = Platform.select({
        ios: `telprompt:${phoneNumber}`,
        android: `tel:${phoneNumber}`
      });

      if (phoneUrl && await Linking.canOpenURL(phoneUrl)) {
        await Linking.openURL(phoneUrl);
        setCallActive(true);
        // Clear the phone number if dialer is open
        if (isDialerVisible) {
          setPhoneNumber('');
          closeDialer();
        }
      } else {
        throw new Error('Cannot make phone call');
      }

    } catch (error) {
      console.error('Call Error:', error);
      Alert.alert('Error', 'Failed to initiate call. Please check phone permissions.');
      setCallActive(false);
      stopCallTimer();
    }
  };

  // Update the fetchDeviceCallLogs function
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

  // Update the fetchFreshLogs function
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

  // Update the groupCallLogs function
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

  // Update the useEffect for call logs
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    const initializeLogs = async () => {
      const unsubscribe = await fetchCallLogs();
      if (unsubscribe) {
        cleanup = unsubscribe;
      }
    };

    initializeLogs();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  // Add this useEffect for initial permission check
  useEffect(() => {
    const checkAndRequestPermissions = async () => {
      try {
        if (Platform.OS === 'android') {
          const hasPermission = await requestCallLogPermission();
          if (hasPermission) {
            console.log('Permissions granted, fetching call logs');
            fetchDeviceCallLogs();
          } else {
            console.log('Permissions not granted');
          }
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
      }
    };

    checkAndRequestPermissions();
  }, []);

  const handleEndCall = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Stop the call timer
      stopCallTimer();

      // Get the most recent call log for this user
      const callLogsRef = collection(db, 'callLogs');
      
      // First try with the optimized query
      try {
        const q = query(
          callLogsRef,
          where('userId', '==', userId),
          where('status', '==', 'in-progress'),
          orderBy('timestamp', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const lastCallLog = querySnapshot.docs[0];

        if (lastCallLog) {
          await updateCallLog(lastCallLog.id);
        }
      } catch (error: any) {
        // If index is not ready, fall back to a simpler query
        if (error.message.includes('requires an index')) {
          console.log('Index not ready, using fallback query');
          const fallbackQuery = query(
            callLogsRef,
            where('userId', '==', userId),
            orderBy('timestamp', 'desc')
          );
          const querySnapshot = await getDocs(fallbackQuery);
          
          // Find the first in-progress call
          const lastCallLog = querySnapshot.docs.find(doc => 
            doc.data().status === 'in-progress'
          );

          if (lastCallLog) {
            await updateCallLog(lastCallLog.id);
          }
        } else {
          throw error;
        }
      }

    } catch (error) {
      console.error('Error ending call:', error);
      Alert.alert('Error', 'Failed to update call log. Please try again.');
    }
  };

  // Update the updateCallLog function
  const updateCallLog = async (callLogId: string) => {
    try {
      const endTime = new Date();
      const callLogRef = doc(db, 'callLogs', callLogId);
      const callLogDoc = await getDoc(callLogRef);
      
      if (callLogDoc.exists()) {
        const data = callLogDoc.data();
        const startTime = data.startTime?.toDate() || new Date();
        const durationInSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

        // Update the call log with duration and status
        await updateDoc(callLogRef, {
          endTime: endTime,
          duration: durationInSeconds,
          status: 'completed',
          lastUpdated: endTime
        });

        // Reset all states
        setCallActive(false);
        stopCallTimer();
        setPhoneNumber('');
        setDialerVisible(false);
        setRecording(null);

        // Refresh call logs immediately after updating
        fetchCallLogs();

        // Show success message
        Alert.alert('Call Ended', 'Call log has been updated successfully.');
      }
    } catch (error) {
      console.error('Error updating call log:', error);
      throw error;
    }
  };

  // Add a new function to handle call state changes
  const handleCallStateChange = async (state: string) => {
    if (state === 'ended' || state === 'disconnected') {
      await handleEndCall();
    }
  };

  const playRecording = async (recordingUrl: string) => {
    try {
      const sound = new Audio.Sound();
      await sound.loadAsync({ uri: recordingUrl });
      await sound.playAsync();
    } catch (error) {
      console.error('Error playing recording:', error);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCallTimer();
    };
  }, []);

  // Update the handleRefresh function
  const handleRefresh = async () => {
    try {
      if (Platform.OS === 'android') {
        const hasPermission = await requestCallLogPermission();
        if (hasPermission) {
          // Show loading indicator
          setIsLoadingSimLogs(true);
          
          // Fetch fresh device logs
          const logs = await CallLog.loadAll();
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

          // Update AsyncStorage with fresh logs
          await AsyncStorage.setItem(CALL_LOGS_STORAGE_KEY, JSON.stringify(formattedLogs));
          await AsyncStorage.setItem(CALL_LOGS_LAST_UPDATE, String(Date.now()));

          // Update logs in state
          updateCallLogsState(formattedLogs, 'all');

          // Trigger haptic feedback
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          Alert.alert(
            'Permission Required',
            'Call log permissions are required to view call history.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error refreshing call logs:', error);
      Alert.alert('Error', 'Failed to refresh call logs');
    } finally {
      setIsLoadingSimLogs(false);
    }
  };

  // Remove or modify the resetPermissions function since it's no longer needed
  // Only keep it for development purposes if desired
  const resetPermissions = async () => {
    if (__DEV__) {
      Alert.alert(
        'Dev: Reset Permissions',
        'Do you want to open settings to reset permissions?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings',
            onPress: () => Linking.openSettings()
          }
        ]
      );
    }
  };

  // Update the renderCallCard function
  const renderCallCard = ({ item, index }: { item: GroupedCallLog; index: number }) => {
    const isNewDate = index === 0 || 
      formatDate(new Date(item.timestamp)) !== formatDate(new Date(callLogs[index - 1].timestamp));

    // Display name logic: show saved name or just the number
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
                onPress={() => navigation.navigate('ContactInfo', {
                  contact: {
                    id: item.id,
                    firstName: item.contactName || '',
                    lastName: '',
                    phoneNumber: item.phoneNumber,
                    isNewContact: !isNumberSaved
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
                  </Text>
                  {item.duration > 0 && (
                    <Text style={styles.durationText}>
                      {` • ${formatDuration(item.duration)}`}
                    </Text>
                  )}
                </View>
              </View>
            </View>
            {expandedCallId === item.id && renderCallActions(item)}
          </View>
        </TouchableOpacity>
      </>
    );
  };

  // Update the renderCallActions function to show call history
  const renderCallActions = (call: GroupedCallLog) => {
    const isNumberSaved = call.contactName && call.contactName !== call.phoneNumber;

    return (
      <View style={styles.actionContainer}>
        {/* Call Button - Always show */}
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleCallFromLogs(call.phoneNumber)}
        >
          <MaterialIcons name="phone" size={24} color="#FF8447" />
          <Text style={styles.actionText}>Call</Text>
        </TouchableOpacity>

        {/* History Button - Always show */}
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('CallHistory', { 
            call: call.allCalls.map(c => ({
              ...c,
              timestamp: new Date(c.timestamp),
              duration: c.duration || 0,
              type: c.type || 'outgoing',
              status: c.status || 'completed',
              contactName: c.contactName || '',
              notes: c.notes || []
            })),
            phoneNumber: call.phoneNumber,
            contactName: call.contactName,
            contactInfo: {
              name: call.contactName || call.phoneNumber,
              phoneNumber: call.phoneNumber,
              timestamp: call.timestamp,
              duration: call.duration
            }
          })}
        >
          <MaterialIcons name="history" size={24} color="#FF8447" />
          <Text style={styles.actionText}>History ({call.callCount})</Text>
        </TouchableOpacity>

        {/* Conditional third button based on contact status */}
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => {
            if (isNumberSaved) {
              // For saved contacts - Add Notes
              navigation.navigate('TelecallerCallNoteDetails', { meeting: call });
            } else {
              // For unsaved contacts - Show Add Contact Modal
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

  const dialPad = [
    { num: '1', alpha: '' },
    { num: '2', alpha: 'ABC' },
    { num: '3', alpha: 'DEF' },
    { num: '4', alpha: 'GHI' },
    { num: '5', alpha: 'JKL' },
    { num: '6', alpha: 'MNO' },
    { num: '7', alpha: 'PQRS' },
    { num: '8', alpha: 'TUV' },
    { num: '9', alpha: 'WXYZ' },
    { num: '*', alpha: '' },
    { num: '0', alpha: '+' },
    { num: '#', alpha: '' }
  ];

  const handleDialPress = (digit: string) => {
    setPhoneNumber(prev => prev + digit);
  };

  useEffect(() => {
    (async () => {
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      if (audioStatus !== 'granted') {
        Alert.alert('Permission Required', 'Audio recording permission is required for calls.');
      }
    })();  
  }, []);

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const velocity = event.nativeEvent.velocity?.y;
    const scrolling = velocity !== undefined && velocity !== 0;
    
    if (scrolling && !isScrolling) {
      setIsScrolling(true);
      Animated.timing(dialerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start();
    }
  };

  const handleScrollEnd = () => {
    setIsScrolling(false);
    Animated.timing(dialerOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true
    }).start();
  };

  // Function to start call duration timer
  const startCallTimer = () => {
    const startTime = new Date();
    setCallStartTime(startTime);
    
    // Update duration every second
    const timer = setInterval(() => {
      const currentTime = new Date();
      const durationInSeconds = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);
      setCallDuration(durationInSeconds);

      // Update the call log in Firestore with current duration
      updateCallDurationInFirestore(durationInSeconds);
    }, 1000);
    
    setCallTimer(timer);
  };

  // Function to stop call duration timer
  const stopCallTimer = () => {
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }
    setCallStartTime(null);
    setCallDuration(0);
  };

  // Function to update call duration in Firestore
  const updateCallDurationInFirestore = async (duration: number) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const callLogsRef = collection(db, 'callLogs');
      const q = query(
        callLogsRef,
        where('userId', '==', userId),
        where('status', '==', 'in-progress'),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const lastCallLog = querySnapshot.docs[0];

      if (lastCallLog) {
        await updateDoc(doc(db, 'callLogs', lastCallLog.id), {
          duration: duration,
          lastUpdated: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating call duration:', error);
    }
  };

  // Update the requestCallLogPermission function
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

  // Add these functions to handle dialer animations
  const openDialer = () => {
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
  };

  const closeDialer = () => {
    Animated.parallel([
      Animated.timing(dialerHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(dialerY, {
        toValue: Dimensions.get('window').height,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setDialerVisible(false));
  };

  // Function to fetch weekly achievements
  const fetchWeeklyAchievements = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log('No user ID found for fetching achievements');
        return;
      }

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Query the telecaller_achievements collection
      const achievementsRef = collection(db, 'telecaller_achievements');
      const q = query(
        achievementsRef,
        where('userId', '==', userId),
        where('weekStart', '==', Timestamp.fromDate(weekStart)),
        where('weekEnd', '==', Timestamp.fromDate(weekEnd))
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
        // If no achievement record exists, calculate it using targetService
        console.log('No achievement record found, calculating from daily reports');
        const achievements = await targetService.getCurrentWeekAchievements(userId);
        setWeeklyAchievement({
          percentageAchieved: achievements.percentageAchieved,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('Error fetching weekly achievements:', error);
      setWeeklyAchievement({
        percentageAchieved: 0,
        isLoading: false
      });
    }
  };

  // Use effect to fetch achievements on mount and set interval for updates
  useEffect(() => {
    console.log('Setting up weekly achievements fetch');
    fetchWeeklyAchievements();
    const interval = setInterval(() => {
      console.log('Fetching weekly achievements (interval)');
      fetchWeeklyAchievements();
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBottomTabs={true} showBackButton={false}>
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
                    onPress={() => navigation.navigate('Target')}
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
            <Text style={styles.sectionTitle}>Call Logs</Text>
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
              onScroll={handleScroll}
              onScrollEndDrag={handleScrollEnd}
              onMomentumScrollEnd={handleScrollEnd}
              renderItem={renderCallCard}
            />
          )}
        </View>

        {/* Floating Dialer Button */}
        <Animated.View style={[
          styles.dialerFAB,
          { opacity: dialerOpacity }
        ]}>
          <TouchableOpacity
            onPress={openDialer}
          >
            <MaterialIcons name="dialpad" size={30} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* Dialer Modal */}
        <Dialer
          visible={isDialerVisible}
          onClose={() => setDialerVisible(false)}
          onCallPress={handleCall}
          contacts={contacts}
          isLoading={isLoadingContacts}
        />

        <TelecallerAddContactModal
          visible={addContactModalVisible}
          onClose={() => setAddContactModalVisible(false)}
          phoneNumber={selectedNumber}
          onContactSaved={(contact: Contact) => handleContactSaved(contact as Contact & {favorite: boolean})}
        />
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  welcomeSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  welcomeText: {
    fontFamily: "LexendDeca_600SemiBold",
    fontSize: 22,
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
  viewTargetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  viewTargetText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF8447',
    marginRight: 4,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 2,
  },
  callIcon: {
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dialerContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  dialerContent: {
    paddingHorizontal: 20,
  },
  dialerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  phoneNumberDisplay: {
    fontSize: 28,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    flex: 1,
  },
  dialerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    right: 0,
  },
  dialPad: {
    marginBottom: 32,
  },
  dialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  dialButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dialButtonNumber: {
    fontSize: 28,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  dialButtonAlpha: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 2,
  },
  callButton: {
    backgroundColor: '#4CAF50',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  endCall: {
    backgroundColor: '#F44336',
  },
  dialerFAB: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    backgroundColor: '#4CAF50',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 1000,
  },
  simCallCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF8447',
  },
  simIndicator: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#FF8447',
    marginLeft: 4,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callCount: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  addContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  addContactText: {
    fontSize: 12,
    color: '#FF8447',
    marginLeft: 4,
    fontFamily: 'LexendDeca_500Medium',
  },
  addContactButtonDialer: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#FFF5E6',
    marginRight: 8,
  },
  backspaceButton: {
    position: 'absolute',
    right: 0,
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  monthlyCallCount: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  durationText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginLeft: 6,
  },
  achievementContainer: {
    padding: 16,
    backgroundColor: '#FFF5E6',
    borderRadius: 8,
    marginBottom: 16,
  },
  achievementText: {
    fontSize: 16,
    color: '#FF8447',
    fontFamily: 'LexendDeca_500Medium',
  },
});

export default HomeScreen;