import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Animated, Modal, Platform, NativeScrollEvent, NativeSyntheticEvent, ActivityIndicator, PermissionsAndroid, PanResponder, Dimensions, AppState, AppStateStatus } from "react-native";
import { ProgressBar } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import * as Linking from 'expo-linking';
import AppGradient from "@/app/components/AppGradient";
import { Audio } from 'expo-av';
import { collection, addDoc, query, where, orderBy, onSnapshot, getDocs, getDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Alert } from 'react-native';
import { auth, db } from "@/firebaseConfig";
import CallLogModule from 'react-native-call-log';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/app/services/api';
import { useProfile } from '@/app/context/ProfileContext';
import TelecallerAddContactModal from '@/app/Screens/Telecaller/TelecallerAddContactModal';
// import { getCurrentWeekAchievements } from "@/app/services/targetService";
import targetService from "@/app/services/targetService";
import Dialer, { Contact as DialerContact } from '@/app/components/Dialer/Dialer';
import { startOfWeek, endOfWeek } from 'date-fns';
import { Timestamp } from 'firebase/firestore';


// Define navigation types
type RootStackParamList = {
  TelecallerCallNoteDetails: { meeting: CallLogModule };
  AddContactModal: { phone: string };
  CallHistory: { call: CallLogModule };
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

interface SimCallLog {
  id: string;
  phoneNumber: string;
  type: 'incoming' | 'outgoing' | 'missed' | 'rejected';
  timestamp: number;
  duration: number;
  contactName?: string;
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
}

const CALL_LOGS_STORAGE_KEY = 'device_call_logs';
const CALL_LOGS_LAST_UPDATE = 'call_logs_last_update';
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
  const [hasCallLogPermission, setHasCallLogPermission] = useState<boolean | null>(null);
  const [contacts, setContacts] = useState<DialerContact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [rawCallLogs, setRawCallLogs] = useState<CallLog[]>([]);
  const appState = useRef<AppStateStatus>(AppState.currentState as AppStateStatus);

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
          closeDialer();
        } else {
          Animated.spring(dialerY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const isNumberSaved = useCallback((phoneNumber: string) => {
    return savedContacts[phoneNumber] || false;
  }, [savedContacts]);

  // Utility to normalize phone numbers (remove spaces, dashes, country code if needed)
  const normalizePhoneNumber = (number: string) => {
    if (!number) return '';
    // Remove spaces, dashes, parentheses, and leading +91 or 0 (for India, adjust as needed)
    let normalized = number.replace(/[^\d]/g, '');
    if (normalized.length > 10 && normalized.startsWith('91')) normalized = normalized.slice(2);
    if (normalized.length > 10 && normalized.startsWith('0')) normalized = normalized.slice(1);
    return normalized;
  };

  // Fix: Move handleContactSaved below fetchContacts and fetchCallLogs so they are defined before use.
  // Also, add guards in case fetchContacts or fetchCallLogs are undefined.
  const handleContactSaved = useCallback(
    async (contact: { id: string; firstName: string; lastName: string; phoneNumber: string; email?: string; favorite?: boolean }) => {
      try {
        const contactWithFavorite: DialerContact = {
          ...contact,
          favorite: contact.favorite ?? false
        };
        setSavedContacts(prev => ({ ...prev, [normalizePhoneNumber(contact.phoneNumber)]: true }));
        setContacts(prev => {
          const normalized = normalizePhoneNumber(contact.phoneNumber);
          const existingIndex = prev.findIndex(c => normalizePhoneNumber(c.phoneNumber) === normalized);
          if (existingIndex !== -1) {
            const updated = [...prev];
            updated[existingIndex] = contactWithFavorite;
            return updated;
          }
          return [...prev, contactWithFavorite];
        });
        if (typeof fetchContacts === "function") {
          await fetchContacts();
        }
        if (typeof fetchCallLogs === "function") {
          await fetchCallLogs();
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to save contact');
      }
    },
    [ normalizePhoneNumber]
  );

  const loadSavedContacts = useCallback(async () => {
    try {
      const storedContacts = await AsyncStorage.getItem('contacts');
      if (storedContacts) {
        const contacts = JSON.parse(storedContacts);
        const contactsMap = contacts.reduce((acc: {[key: string]: boolean}, contact: DialerContact) => {
          if (contact.phoneNumber) {
            acc[contact.phoneNumber] = true;
          }
          return acc;
        }, {});
        setSavedContacts(contactsMap);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load saved contacts');
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      setIsLoadingContacts(true);
      const storedContacts = await AsyncStorage.getItem('contacts');
      if (storedContacts) {
        const parsedContacts = JSON.parse(storedContacts) as DialerContact[];
        const normalizedContacts = parsedContacts.map(contact => ({
          ...contact,
          favorite: contact.favorite ?? false
        }));
        setContacts(normalizedContacts);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch contacts');
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  const checkFirstTimeUser = useCallback(async () => {
    try {
      const isFirstTime = await AsyncStorage.getItem('isFirstTimeUser');
      if (isFirstTime === null) {
        await AsyncStorage.setItem('isFirstTimeUser', 'false');
        setIsFirstTimeUser(true);
        return true;
      }
      setIsFirstTimeUser(false);
      return false;
    } catch (error) {
      setIsFirstTimeUser(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        await checkFirstTimeUser();

        if (userProfile?.firstName) {
          setUserName(userProfile.firstName);
          setIsLoading(false);
          return;
        }

        const userData = await api.getUserProfile(userId);
        if (userData) {
          setUserName(userData.firstName || userData.name || 'User');
          updateProfile(userData);
        }
      } catch (error) {
        setUserName('User');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserDetails();
  }, [userProfile, updateProfile, checkFirstTimeUser]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);





const fetchCallLogs = useCallback(async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const now = new Date();
      const startOfToday = new Date(now.setHours(0, 0, 0, 0));

      const callLogsRef = collection(db, 'callLogs');
      const logsQuery = query(
        callLogsRef,
        where('userId', '==', userId),
        where('timestamp', '>=', startOfToday),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(logsQuery, async (snapshot) => {
        try {
          const logs = await processCallLogs(snapshot);
          updateCallLogsState(logs, 'current');
        } catch (error) {
          console.error('Error processing call logs:', error);
        }
      }, (error) => {
        console.error('Firestore query error:', error);
        if (error.message?.includes('requires an index')) {
          Alert.alert(
            'Index Required',
            'Please wait a few minutes while we set up the required database index. The call logs will appear automatically once it\'s ready.',
            [{ text: 'OK' }]
          );
        }
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error in fetchCallLogs:', error);
      Alert.alert('Error', 'Failed to fetch call logs');
    }
  }, []);

  const processCallLogs = useCallback(async (snapshot: any) => {
    const logs: CallLog[] = [];
    
    try {
      for (const docSnapshot of snapshot.docs) {
        try {
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
                const contactData = contactDoc.data() as ContactData;
                log.contactName = contactData.name || '';
              }
            } catch (contactError) {
              console.error('Error fetching contact:', contactError);
            }
          }

          logs.push(log);
        } catch (docError) {
          console.error('Error processing document:', docError);
        }
      }
    } catch (error) {
      console.error('Error in processCallLogs:', error);
    }

    return logs;
  }, []);

  const updateCallLogsState = useCallback((newLogs: CallLog[], type: 'current' | 'older' | 'all') => {
    setCallLogs(prevLogs => {
      let updatedLogs: CallLog[];
      
      if (type === 'current') {
        const olderLogs = prevLogs.filter(log => {
          const logDate = new Date(log.timestamp);
          const startOfToday = new Date().setHours(0, 0, 0, 0);
          return logDate.getTime() < startOfToday;
        });
        updatedLogs = [...newLogs, ...olderLogs];
      } else if (type === 'older') {
        const currentDayLogs = prevLogs.filter(log => {
          const logDate = new Date(log.timestamp);
          const startOfToday = new Date().setHours(0, 0, 0, 0);
          return logDate.getTime() >= startOfToday;
        });
        updatedLogs = [...currentDayLogs, ...newLogs];
      } else {
        updatedLogs = newLogs;
      }

      updatedLogs.sort((a, b) => {
        const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return bTime - aTime;
      });

      setRawCallLogs(updatedLogs);
      return groupCallLogs(updatedLogs);
    });
  }, []);

  const calculateTotalDuration = useCallback((date: string) => {
    let totalSeconds = 0;
    rawCallLogs.forEach(log => {
      const logDate = new Date(log.timestamp).toLocaleDateString();
      if (logDate === date && log.status === 'completed') {
        totalSeconds += log.duration;
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
  }, [rawCallLogs]);

  const formatDuration = useCallback((seconds: number) => {
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
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleCardClick = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCallId(prev => prev === id ? null : id);
  }, []);

  const handleCall = useCallback(async (phoneNumber: string) => {
    try {
      if (Platform.OS === 'android' && hasCallLogPermission === false) {
        const hasPermission = await requestCallLogPermission();
        setHasCallLogPermission(hasPermission);
        if (!hasPermission) return;
      }

      const url = `tel:${phoneNumber}`;
      await Linking.openURL(url);
      setDialerVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to initiate call');
    }
  }, [hasCallLogPermission]);

  const handleCallFromLogs = useCallback(async (phoneNumber: string) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const startTime = new Date();
      const callLogRef = await addDoc(collection(db, 'callLogs'), {
        userId,
        phoneNumber,
        timestamp: startTime,
        startTime: startTime,
        type: 'outgoing',
        status: 'in-progress',
        duration: 0
      });

      startCallTimer();

      const phoneUrl = Platform.select({
        ios: `telprompt:${phoneNumber}`,
        android: `tel:${phoneNumber}`
      });

      if (phoneUrl && await Linking.canOpenURL(phoneUrl)) {
        await Linking.openURL(phoneUrl);
        setCallActive(true);
        if (isDialerVisible) {
          setPhoneNumber('');
          closeDialer();
        }
      } else {
        throw new Error('Cannot make phone call');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to initiate call. Please check phone permissions.');
      setCallActive(false);
      stopCallTimer();
    }
  }, [isDialerVisible]);

  const fetchDeviceCallLogs = useCallback(async () => {
    try {
      setIsLoadingSimLogs(true);
      const lastUpdate = await AsyncStorage.getItem(CALL_LOGS_LAST_UPDATE);
      const storedLogs = await AsyncStorage.getItem(CALL_LOGS_STORAGE_KEY);
      const now = Date.now();
      const thirtyDaysAgo = new Date(now - THIRTY_DAYS_MS);
      if (storedLogs && lastUpdate && (now - parseInt(lastUpdate)) < 60000) {
        try {
          const parsedLogs = JSON.parse(storedLogs);
          const recentLogs = parsedLogs.filter((log: any) => {
            const logTimestamp = new Date(log.timestamp).getTime();
            return logTimestamp >= thirtyDaysAgo.getTime();
          });
          setRawCallLogs(recentLogs);
          setCallLogs(groupCallLogs(recentLogs));
        } catch (error) {
          await fetchFreshLogs();
        }
        return;
      }
      await fetchFreshLogs();
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch call logs');
      try {
        const storedLogs = await AsyncStorage.getItem(CALL_LOGS_STORAGE_KEY);
        if (storedLogs) {
          const parsedLogs = JSON.parse(storedLogs);
          setRawCallLogs(parsedLogs);
          setCallLogs(groupCallLogs(parsedLogs));
        }
      } catch (storageError) {}
    } finally {
      setIsLoadingSimLogs(false);
    }
  }, []);

  // Helper: Generate unique key for a call log (userId + phoneNumber + timestamp + duration)
  const getLogUniqueKey = (log: { userId: string; phoneNumber: string; timestamp: any; duration: number }) => {
    const ts = log.timestamp instanceof Date ? log.timestamp.getTime() : (typeof log.timestamp === 'string' ? parseInt(log.timestamp) : log.timestamp);
    return `${log.userId}_${log.phoneNumber}_${ts}_${log.duration}`;
  };

  // In saveCallLogsToFirebase, deduplicate before saving
  const saveCallLogsToFirebase = useCallback(async (logs: any[]) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      // Get user profile data
      let userName = 'Unknown User';
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          userName = userData.firstName || userData.name || 'Unknown User';
        }
      } catch (error) {
        userName = userProfile?.firstName || userProfile?.name || 'Unknown User';
      }

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

      // Delete logs older than 30 days
      const callLogsRef = collection(db, 'telecaller_call_logs');
      const oldLogsQuery = query(
        callLogsRef,
        where('userId', '==', userId),
        where('timestamp', '<', thirtyDaysAgo)
      );

      try {
        const oldLogsSnapshot = await getDocs(oldLogsQuery);
        const deleteOldPromises = oldLogsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deleteOldPromises);
      } catch (deleteError) {
        // Alert.alert('Error', 'Failed to clean up old logs');
      }

      // Fetch existing logs for today from Firestore (for deduplication)
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      const todayQuery = query(
        callLogsRef,
        where('userId', '==', userId),
        where('timestamp', '>=', startOfToday),
        where('timestamp', '<=', endOfToday)
      );
      let existingKeys = new Set<string>();
      try {
        const querySnapshot = await getDocs(todayQuery);
        existingKeys = new Set(
          querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return getLogUniqueKey({
              userId,
              phoneNumber: data.phoneNumber,
              timestamp: data.timestamp?.toMillis?.() || data.timestamp,
              duration: data.duration || 0
            });
          })
        );
      } catch (fetchError) {
        // If deduplication fetch fails, just proceed without showing an error
      }

      // Save only new logs (unique by userId, phoneNumber, timestamp, duration)
      const savePromises = logs
        .map(log => {
          let timestamp;
          try {
            const timestampValue = typeof log.timestamp === 'string' ? 
              parseInt(log.timestamp) : 
              log.timestamp;
            if (isNaN(timestampValue) || timestampValue <= 0) {
              timestamp = Timestamp.now();
            } else {
              const milliseconds = timestampValue < 10000000000 ? timestampValue * 1000 : timestampValue;
              timestamp = Timestamp.fromMillis(milliseconds);
            }
          } catch (error) {
            timestamp = Timestamp.now();
          }
          const duration = parseInt(log.duration) || 0;
          const logData = {
            userId,
            userName: userName,
            phoneNumber: log.phoneNumber || '',
            contactName: log.contactName || log.phoneNumber || '',
            timestamp: timestamp,
            duration: duration,
            type: (log.type || 'OUTGOING').toLowerCase(),
            status: (log.type === 'MISSED' ? 'missed' : 'completed'),
            createdAt: Timestamp.now()
          };
          const uniqueKey = getLogUniqueKey({ userId, phoneNumber: logData.phoneNumber, timestamp, duration });
          if (!existingKeys.has(uniqueKey)) {
            return addDoc(callLogsRef, logData);
          }
          return null;
        })
        .filter(Boolean);

      await Promise.all(savePromises);
    } catch (error) {
      Alert.alert('Error', 'Failed to save call logs to telecaller_call_logs');
    }
  }, [userProfile]);

  const fetchFreshLogs = useCallback(async () => {
    if (Platform.OS !== 'android' || hasCallLogPermission === false) return;

    const hasPermission = await requestCallLogPermission();
    setHasCallLogPermission(hasPermission);
    if (!hasPermission) return;

    try {
      const logs = await CallLogModule.loadAll();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentLogs = logs.filter((log: any) => {
        try {
          const logTimestamp = typeof log.timestamp === 'string' ? 
            parseInt(log.timestamp) : 
            log.timestamp;
          const milliseconds = logTimestamp < 10000000000 ? logTimestamp * 1000 : logTimestamp;
          return !isNaN(milliseconds) && milliseconds > 0 && milliseconds >= thirtyDaysAgo.getTime();
        } catch (error) {
          return false;
        }
      });

      const formattedLogs = recentLogs.map((log: any) => {
        let timestamp;
        try {
          const timestampValue = typeof log.timestamp === 'string' ? 
            parseInt(log.timestamp) : 
            log.timestamp;
          
          const milliseconds = timestampValue < 10000000000 ? timestampValue * 1000 : timestampValue;
          
          if (isNaN(milliseconds) || milliseconds <= 0) {
            timestamp = new Date();
          } else {
            timestamp = new Date(milliseconds);
          }
        } catch (error) {
          timestamp = new Date();
        }

        return {
          id: String(log.timestamp || Date.now()),
          phoneNumber: log.phoneNumber || '',
          contactName: log.name && log.name !== "Unknown" && log.name !== log.phoneNumber ? log.name : '',
          timestamp: timestamp,
          duration: parseInt(log.duration) || 0,
          type: (log.type || 'OUTGOING').toLowerCase() as 'incoming' | 'outgoing' | 'missed',
          status: (log.type === 'MISSED' ? 'missed' : 'completed') as 'missed' | 'completed' | 'in-progress'
        };
      });

      // Save today's logs to telecaller_call_logs
      const todayLogs = formattedLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        const today = new Date();
        return logDate.toDateString() === today.toDateString();
      });

      if (todayLogs.length > 0) {
        await saveCallLogsToFirebase(todayLogs);
      }

    await AsyncStorage.setItem(CALL_LOGS_STORAGE_KEY, JSON.stringify(formattedLogs));
    await AsyncStorage.setItem(CALL_LOGS_LAST_UPDATE, String(Date.now()));
    updateCallLogsState(formattedLogs, 'all');
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch call logs');
    }
  }, [hasCallLogPermission, updateCallLogsState, saveCallLogsToFirebase]);

  const groupCallLogs = useCallback((logs: CallLog[]): GroupedCallLog[] => {
    const contactMap: { [normalized: string]: string } = {};
    contacts.forEach(contact => {
      contactMap[normalizePhoneNumber(contact.phoneNumber)] = `${contact.firstName} ${contact.lastName}`.trim();
    });
    const groupedByPhone: { [key: string]: CallLog[] } = {};
    const monthlyHistory: { [key: string]: MonthlyCallHistory } = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    logs.forEach(log => {
      const normalized = normalizePhoneNumber(log.phoneNumber);
      if (!normalized) return;
      const logDate = new Date(log.timestamp);
      if (logDate >= thirtyDaysAgo) {
        if (!monthlyHistory[normalized]) {
          monthlyHistory[normalized] = {
            phoneNumber: log.phoneNumber,
            totalCalls: 0,
            lastCallDate: logDate,
            callTypes: { incoming: 0, outgoing: 0, missed: 0, rejected: 0 },
            totalDuration: 0,
            todayCalls: { count: 0, duration: 0 }
          };
        }
        monthlyHistory[normalized].totalCalls++;
        monthlyHistory[normalized].totalDuration += log.duration || 0;
        if (log.type === 'incoming') monthlyHistory[normalized].callTypes.incoming++;
        else if (log.type === 'outgoing') monthlyHistory[normalized].callTypes.outgoing++;
        else if (log.type === 'missed') monthlyHistory[normalized].callTypes.missed++;
        else if (log.type === 'rejected') monthlyHistory[normalized].callTypes.rejected++;
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (logDate >= startOfToday) {
          monthlyHistory[normalized].todayCalls.count++;
          monthlyHistory[normalized].todayCalls.duration += log.duration || 0;
        }
        if (logDate > monthlyHistory[normalized].lastCallDate) {
          monthlyHistory[normalized].lastCallDate = logDate;
        }
      }
      if (!groupedByPhone[normalized]) groupedByPhone[normalized] = [];
      
      // Determine the best contact name to display
      let bestContactName = log.phoneNumber; // Default to phone number
      
      // First priority: Saved contact name
      if (contactMap[normalized]) {
        bestContactName = contactMap[normalized];
      }
      // Second priority: Contact name from device call log (if not "Unknown")
      else if (log.contactName && log.contactName !== "Unknown" && log.contactName !== log.phoneNumber) {
        bestContactName = log.contactName;
      }
      
      groupedByPhone[normalized].push({
        ...log,
        contactName: bestContactName
      });
    });
    return Object.entries(groupedByPhone).map(([normalized, calls]) => {
      const sortedCalls = [...calls].sort((a, b) => {
        const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return bTime - aTime;
      });
      const latestCall = sortedCalls[0];
      return {
        ...latestCall,
        callCount: monthlyHistory[normalized]?.totalCalls || 0,
        allCalls: sortedCalls,
        monthlyHistory: monthlyHistory[normalized]
      };
    }).sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });
  }, [contacts]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let isMounted = true;
    
    const initializeLogs = async () => {
      try {
        if (!isMounted) return;
        const unsubscribe = await fetchCallLogs();
        if (unsubscribe && isMounted) {
          cleanup = unsubscribe;
        }
      } catch (error) {
        console.error('Error initializing logs:', error);
      }
    };

    initializeLogs();

    return () => {
      isMounted = false;
      if (cleanup) {
        try {
          cleanup();
        } catch (error) {
          console.error('Error cleaning up logs listener:', error);
        }
      }
    };
  }, [fetchCallLogs]);

  useEffect(() => {
    const checkAndRequestPermissions = async () => {
      if (Platform.OS === 'android' && hasCallLogPermission === null) {
        const hasPermission = await requestCallLogPermission();
        setHasCallLogPermission(hasPermission);
        if (hasPermission) {
          fetchDeviceCallLogs();
        }
      }
    };

    checkAndRequestPermissions();
  }, [fetchDeviceCallLogs, hasCallLogPermission]);

  const handleEndCall = useCallback(async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      stopCallTimer();

      const callLogsRef = collection(db, 'callLogs');
      try {
        // First try with the complex query
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
        console.error('Primary query failed:', error);
        
        // Fallback to simpler query if index is missing
        if (error.message?.includes('requires an index') || error.message?.includes('INTERNAL ASSERTION FAILED')) {
          try {
            const fallbackQuery = query(
              callLogsRef,
              where('userId', '==', userId),
              orderBy('timestamp', 'desc')
            );
            const querySnapshot = await getDocs(fallbackQuery);
            const lastCallLog = querySnapshot.docs.find(doc => 
              doc.data().status === 'in-progress'
            );

            if (lastCallLog) {
              await updateCallLog(lastCallLog.id);
            }
          } catch (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
            throw fallbackError;
          }
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error in handleEndCall:', error);
      Alert.alert('Error', 'Failed to update call log. Please try again.');
    }
  }, []);

  // Function to save or update a single call log in telecaller_call_logs
  const saveOrUpdateCallLogToFirebase = useCallback(
    async (log: Record<string, any>) => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        const callLogsRef = collection(db, 'telecaller_call_logs');
        const logTimestamp = log.timestamp instanceof Date ? log.timestamp : (log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp));
        const duration = typeof log.duration === 'string' ? parseInt(log.duration) || 0 : log.duration || 0;
        // Query for existing log with same userId, phoneNumber, timestamp, duration
        const start = new Date(logTimestamp);
        start.setMilliseconds(0);
        const end = new Date(start);
        end.setSeconds(end.getSeconds() + 1);
        const q = query(
          callLogsRef,
          where('userId', '==', userId),
          where('phoneNumber', '==', log.phoneNumber),
          where('timestamp', '>=', start),
          where('timestamp', '<', end),
          where('duration', '==', duration)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          // Update the first found log
          const docRef = snapshot.docs[0].ref;
          await updateDoc(docRef, log);
        } else {
          // Add as new log
          await addDoc(callLogsRef, log);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to save updated call log');
      }
    }, []);

  const updateCallLog = useCallback(async (callLogId: string) => {
    try {
      const endTime = new Date();
      const callLogRef = doc(db, 'callLogs', callLogId);
      const callLogDoc = await getDoc(callLogRef);
      if (callLogDoc.exists()) {
        const data = callLogDoc.data();
        const startTime = data.startTime?.toDate() || new Date();
        const durationInSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        const updatedLog = {
          endTime: endTime,
          duration: durationInSeconds,
          status: 'completed',
          lastUpdated: endTime
        };
        await updateDoc(callLogRef, updatedLog);
        // Immediately save/update only this log in telecaller_call_logs
        await saveOrUpdateCallLogToFirebase({
          ...data,
          ...updatedLog,
          id: callLogId,
          userId: data.userId,
          phoneNumber: data.phoneNumber,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp,
        });
        setCallActive(false);
        stopCallTimer();
        setPhoneNumber('');
        setDialerVisible(false);
        setRecording(null);
        fetchCallLogs();
        Alert.alert('Call Ended', 'Call log has been updated successfully.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update call log');
    }
  }, [fetchCallLogs, saveOrUpdateCallLogToFirebase]);

  const handleCallStateChange = useCallback(async (state: string) => {
    if (state === 'ended' || state === 'disconnected') {
      await handleEndCall();
    }
  }, [handleEndCall]);

  const playRecording = useCallback(async (recordingUrl: string) => {
    try {
      const sound = new Audio.Sound();
      await sound.loadAsync({ uri: recordingUrl });
      await sound.playAsync();
    } catch (error) {
      Alert.alert('Error', 'Failed to play recording');
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCallTimer();
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const hasPermission = await requestCallLogPermission();
        setHasCallLogPermission(hasPermission);
        if (hasPermission) {
          setIsLoadingSimLogs(true);
          
          const logs = await CallLogModule.loadAll();
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const recentLogs = logs.filter((log: any) => {
            const logTimestamp = parseInt(log.timestamp);
            return logTimestamp >= thirtyDaysAgo.getTime();
          });

          const formattedLogs = recentLogs.map((log: any) => ({
            id: String(log.timestamp),
            phoneNumber: log.phoneNumber,
            contactName: log.name && log.name !== "Unknown" && log.name !== log.phoneNumber ? log.name : '',
            timestamp: new Date(parseInt(log.timestamp)),
            duration: parseInt(log.duration) || 0,
            type: (log.type || 'OUTGOING').toLowerCase() as 'incoming' | 'outgoing' | 'missed',
            status: (log.type === 'MISSED' ? 'missed' : 'completed') as 'missed' | 'completed' | 'in-progress'
          }));

          // Save today's logs to telecaller_call_logs
          const todayLogs = formattedLogs.filter(log => {
            const logDate = new Date(log.timestamp);
            const today = new Date();
            return logDate.toDateString() === today.toDateString();
          });

          if (todayLogs.length > 0) {
            console.log(`Found ${todayLogs.length} today's logs to save`);
            await saveCallLogsToFirebase(todayLogs);
          } else {
            console.log('No today\'s logs found to save');
          }

          await AsyncStorage.setItem(CALL_LOGS_STORAGE_KEY, JSON.stringify(formattedLogs));
          await AsyncStorage.setItem(CALL_LOGS_LAST_UPDATE, String(Date.now()));
          updateCallLogsState(formattedLogs, 'all');
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
      console.error('Error in handleRefresh:', error);
      Alert.alert('Error', 'Failed to refresh call logs');
    } finally {
      setIsLoadingSimLogs(false);
    }
  }, [updateCallLogsState, saveCallLogsToFirebase]);
  useEffect(() => {
  const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      await handleRefresh(); // fetch latest logs when user returns to app
    }
  });

  return () => {
    subscription.remove(); // cleanup
  };
}, [handleRefresh]);

  const renderCallCard = ({ item, index }: { item: GroupedCallLog; index: number }) => {
    const isNewDate = index === 0 || 
      formatDate(new Date(item.timestamp)) !== formatDate(new Date(callLogs[index - 1].timestamp));
    const normalized = normalizePhoneNumber(item.phoneNumber);
    const contactName = contacts.find(c => normalizePhoneNumber(c.phoneNumber) === normalized);
    
    // Use the contactName from the item (which is already processed in groupCallLogs)
    // or fall back to saved contact name, or finally to phone number
    const displayName = item.contactName && item.contactName !== item.phoneNumber 
      ? item.contactName 
      : (contactName ? `${contactName.firstName} ${contactName.lastName}`.trim() : item.phoneNumber);
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
                    firstName: contactName ? contactName.firstName : '',
                    lastName: contactName ? contactName.lastName : '',
                    phoneNumber: item.phoneNumber,
                    isNewContact: !contactName
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

  const renderCallActions = useCallback((call: GroupedCallLog) => {
    const isNumberSaved = call.contactName && call.contactName !== call.phoneNumber;

    return (
      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleCallFromLogs(call.phoneNumber)}
        >
          <MaterialIcons name="phone" size={24} color="#FF8447" />
          <Text style={styles.actionText}>Call</Text>
        </TouchableOpacity>
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
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => {
            if (isNumberSaved) {
              navigation.navigate('TelecallerCallNoteDetails', { meeting: call });
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
  }, [handleCallFromLogs, navigation]);

  const dialPad = useMemo(() => [
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
  ], []);

  const handleDialPress = useCallback((digit: string) => {
    setPhoneNumber(prev => prev + digit);
  }, []);

  useEffect(() => {
    (async () => {
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      if (audioStatus !== 'granted') {
        Alert.alert('Permission Required', 'Audio recording permission is required for calls.');
      }
    })();  
  }, []);

  const handleBackspace = useCallback(() => {
    setPhoneNumber(prev => prev.slice(0, -1));
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    event.persist();
    const velocity = event.nativeEvent?.velocity?.y;
    const scrolling = velocity !== undefined && velocity !== 0;
    
    if (scrolling && !isScrolling) {
      setIsScrolling(true);
      Animated.timing(dialerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start();
    }
  }, [isScrolling]);

  const handleScrollEnd = useCallback(() => {
    setIsScrolling(false);
    Animated.timing(dialerOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true
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

      const callLogsRef = collection(db, 'callLogs');
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
          await updateDoc(doc(db, 'callLogs', lastCallLog.id), {
            duration: duration,
            lastUpdated: new Date()
          });
        }
      } catch (error: any) {
        console.error('Error updating call duration:', error);
        
        // Fallback to simpler query if index is missing
        if (error.message?.includes('requires an index') || error.message?.includes('INTERNAL ASSERTION FAILED')) {
          try {
            const fallbackQuery = query(
              callLogsRef,
              where('userId', '==', userId),
              orderBy('timestamp', 'desc')
            );
            const querySnapshot = await getDocs(fallbackQuery);
            const lastCallLog = querySnapshot.docs.find(doc => 
              doc.data().status === 'in-progress'
            );

            if (lastCallLog) {
              await updateDoc(doc(db, 'callLogs', lastCallLog.id), {
                duration: duration,
                lastUpdated: new Date()
              });
            }
          } catch (fallbackError) {
            console.error('Fallback duration update failed:', fallbackError);
          }
        }
      }
    } catch (error) {
      console.error('Error in updateCallDurationInFirestore:', error);
    }
  }, []);

  const requestCallLogPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return false;

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
      return false;
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
        toValue: Dimensions.get('window').height,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setDialerVisible(false));
  }, []);

  const fetchWeeklyAchievements = useCallback(async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      const achievementsRef = collection(db, 'telecaller_achievements');
      const q = query(
        achievementsRef,
        where('userId', '==', userId),
        where('weekStart', '==', Timestamp.fromDate(weekStart)),
        where('weekEnd', '==', Timestamp.fromDate(weekEnd))
      );

      try {
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const achievementData = querySnapshot.docs[0].data();
          setWeeklyAchievement({
            percentageAchieved: achievementData.percentageAchieved || 0,
            isLoading: false
          });
        } else {
          const achievements = await targetService.getCurrentWeekAchievements(userId);
          setWeeklyAchievement({
            percentageAchieved: achievements.percentageAchieved,
            isLoading: false
          });
        }
      } catch (queryError: any) {
        console.error('Error fetching weekly achievements:', queryError);
        
        // If the complex query fails, try a simpler approach
        if (queryError.message?.includes('requires an index') || queryError.message?.includes('INTERNAL ASSERTION FAILED')) {
          try {
            const achievements = await targetService.getCurrentWeekAchievements(userId);
            setWeeklyAchievement({
              percentageAchieved: achievements.percentageAchieved,
              isLoading: false
            });
          } catch (fallbackError) {
            console.error('Fallback achievement fetch failed:', fallbackError);
            setWeeklyAchievement({
              percentageAchieved: 0,
              isLoading: false
            });
          }
        } else {
          setWeeklyAchievement({
            percentageAchieved: 0,
            isLoading: false
          });
        }
      }
    } catch (error) {
      console.error('Error in fetchWeeklyAchievements:', error);
      setWeeklyAchievement({
        percentageAchieved: 0,
        isLoading: false
      });
    }
  }, []);

  useEffect(() => {
    fetchWeeklyAchievements();
    const interval = setInterval(fetchWeeklyAchievements, 60000);
    return () => clearInterval(interval);
  }, [fetchWeeklyAchievements]);

  const sortedCallLogs = useMemo(() => {
    return callLogs.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });
  }, [callLogs]);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 80, // Approximate height of each call card
    offset: 80 * index,
    index
  }), []);

  // Listen to AppState changes to reload contacts and call logs
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      try {
        if (
          (appState.current === 'inactive' || appState.current === 'background') &&
          nextAppState === 'active'
        ) {
          // App has come to the foreground, reload contacts and call logs
          await fetchContacts();
          if (Platform.OS === 'android' && hasCallLogPermission) {
            await fetchDeviceCallLogs();
          } else {
            await fetchCallLogs();
          }
        }
        appState.current = nextAppState;
      } catch (error) {
        console.error('Error handling app state change:', error);
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      try {
        subscription.remove();
      } catch (error) {
        console.error('Error removing app state listener:', error);
      }
    };
  }, [fetchContacts, fetchCallLogs, fetchDeviceCallLogs, hasCallLogPermission]);

  // Re-group and re-map call logs after contacts are loaded
  useEffect(() => {
    console.log('Regrouping call logs. Raw logs:', rawCallLogs.length, 'Contacts:', contacts.length);
    const grouped = groupCallLogs(rawCallLogs);
    console.log('Grouped call logs:', grouped.length);
    setCallLogs(grouped);
  }, [contacts, rawCallLogs, groupCallLogs]);

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBottomTabs={true} showBackButton={false}>
        <View style={styles.container}>
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

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Call Logs</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                onPress={handleRefresh}
                style={styles.refreshButton}
              >
                <MaterialIcons name="refresh" size={24} color="#FF8447" />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={async () => {
                  try {
                    const logs = await CallLogModule.loadAll();
                    const today = new Date();
                    const todayLogs = logs.filter((log: any) => {
                      const logDate = new Date(parseInt(log.timestamp));
                      return logDate.toDateString() === today.toDateString();
                    });
                    console.log('Manual save - Today\'s logs:', todayLogs.length);
                    if (todayLogs.length > 0) {
                      const formattedTodayLogs = todayLogs.map((log: any) => ({
                        id: String(log.timestamp),
                        phoneNumber: log.phoneNumber,
                        contactName: log.name && log.name !== "Unknown" && log.name !== log.phoneNumber ? log.name : '',
                        timestamp: new Date(parseInt(log.timestamp)),
                        duration: parseInt(log.duration) || 0,
                        type: (log.type || 'OUTGOING').toLowerCase() as 'incoming' | 'outgoing' | 'missed',
                        status: (log.type === 'MISSED' ? 'missed' : 'completed') as 'missed' | 'completed' | 'in-progress'
                      }));
                      await saveCallLogsToFirebase(formattedTodayLogs);
                      Alert.alert('Success', `Saved ${formattedTodayLogs.length} today's logs to telecaller_call_logs`);
                    } else {
                      Alert.alert('Info', 'No today\'s logs found');
                    }
                  } catch (error) {
                    console.error('Manual save error:', error);
                    Alert.alert('Error', 'Failed to manually save logs');
                  }
                }}
                style={styles.refreshButton}
              >
                <MaterialIcons name="save" size={24} color="#FF8447" />
              </TouchableOpacity>
            </View>
          </View>
          
          {isLoadingSimLogs || isLoadingContacts ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF8447" />
            </View>
          ) : (
            <FlatList
              data={sortedCallLogs}
              keyExtractor={item => item.id}
              onScroll={handleScroll}
              onScrollEndDrag={handleScrollEnd}
              onMomentumScrollEnd={handleScrollEnd}
              renderItem={renderCallCard}
              getItemLayout={getItemLayout}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={21}
            />
          )}
        </View>

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
          onContactSaved={(contact: { id: string; firstName: string; lastName: string; phoneNumber: string; email?: string; favorite?: boolean }) => {
            handleContactSaved(contact);
          }}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
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