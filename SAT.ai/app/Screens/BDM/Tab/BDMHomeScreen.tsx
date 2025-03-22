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
import { collection, query, where, getDocs, doc, getDoc, setDoc, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppGradient from "@/app/components/AppGradient";

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

interface GroupedCallLog extends CallLog {
  callCount: number;
  allCalls: CallLog[];
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

const CALL_LOGS_STORAGE_KEY = 'bdm_device_call_logs';
const CALL_LOGS_LAST_UPDATE = 'bdm_call_logs_last_update';
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
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
  
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
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
        
        // Set user name - no need to wait for this
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
      duration: 500, // Reduced from 1000ms to 500ms
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
      // Try to load from AsyncStorage
      const cachedContacts = await AsyncStorage.getItem('bdm_contacts');
      if (cachedContacts) {
        setContacts(JSON.parse(cachedContacts));
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const fetchCallLogs = async () => {
    try {
      // Check last update time
      const lastUpdate = await AsyncStorage.getItem(CALL_LOGS_LAST_UPDATE);
      const storedLogs = await AsyncStorage.getItem(CALL_LOGS_STORAGE_KEY);
      const now = Date.now();

      // If we have stored logs and they're recent, use them
      if (storedLogs && lastUpdate && (now - parseInt(lastUpdate)) < UPDATE_INTERVAL) {
        try {
          const parsedLogs = JSON.parse(storedLogs);
          const formattedLogs = parsedLogs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp),
            duration: parseInt(log.duration) || 0,
            type: log.type || 'outgoing',
            status: log.status || 'completed'
          }));
          
          processedLogs.current = formattedLogs;
          const groupedLogs = groupCallLogs(formattedLogs);
          setCallLogs(groupedLogs);
          return;
        } catch (error) {
          console.error('Error parsing stored logs:', error);
          // If there's an error parsing stored logs, fetch fresh logs
        }
      }

      // Get call logs from device
      const hasPermission = await requestCallLogPermission();
      if (!hasPermission) {
        return;
      }
      
      const logs = await CallLog.loadAll();
      
      // Process logs efficiently - prevent unnecessary recomputation
      if (!refreshing) {
        // Process logs in a faster way - do the mapping once
        const phoneNumbers = new Set();
        const processedLogsArray: CallLog[] = [];
        
        for (let i = 0; i < logs.length; i++) {
          const log: CallLogEntry = logs[i];
          
          // Determine call type
          let type: 'incoming' | 'outgoing' | 'missed' = 'incoming';
          if (log.type === 'OUTGOING') {
            type = 'outgoing';
          } else if (log.type === 'MISSED' || log.type === 'REJECTED') {
            type = 'missed';
          }
          
          // Determine status
          let status: 'completed' | 'missed' | 'in-progress' = 'completed';
          if (log.type === 'MISSED' || log.type === 'REJECTED') {
            status = 'missed';
          }
          
          // Get contact information
          const phoneNumber = log.phoneNumber.replace(/[^\d+]/g, '');
          phoneNumbers.add(phoneNumber);
          
          // Try to get contact name from the contacts object
          let contactName = log.name || '';
          let contactType: 'person' | 'company' = 'person';
          let companyInfo: Company | undefined;
          
          if (contacts[phoneNumber]) {
            const contact = contacts[phoneNumber];
            
            if (contact.company) {
              contactName = contact.company;
              contactType = 'company';
            } else {
              contactName = (contact.firstName && contact.lastName) 
                ? `${contact.firstName} ${contact.lastName}`
                : contact.firstName || contact.lastName || contactName;
            }
          } else {
            // Try to detect if this is a company based on the number or name
            const companyDetection = detectCompany(phoneNumber, contactName);
            
            if (companyDetection.isCompany && companyDetection.company) {
              contactType = 'company';
              contactName = companyDetection.company.name;
              companyInfo = companyDetection.company;
            }
          }
          
          processedLogsArray.push({
            id: log.id || String(parseInt(String(log.timestamp))),
            phoneNumber,
            timestamp: new Date(parseInt(String(log.timestamp))),
            duration: parseInt(String(log.duration)) || 0,
            type,
            status,
            contactName: contactName || phoneNumber,
            contactType,
            isNewContact: !contacts[phoneNumber] && !log.name,
            companyInfo
          });
        }
        
        // Save logs to ref to avoid unnecessary rerenders
        processedLogs.current = processedLogsArray;
        
        // Store logs in AsyncStorage for faster loading next time
        await AsyncStorage.setItem(CALL_LOGS_STORAGE_KEY, JSON.stringify(processedLogsArray));
        await AsyncStorage.setItem(CALL_LOGS_LAST_UPDATE, String(Date.now()));
        
        // Group logs by date and contact
        const groupedLogs = groupCallLogs(processedLogsArray);
        setCallLogs(groupedLogs);
      } else {
        // Simplified processing for refresh - reuse previous logic
        // This is only used when the user manually refreshes
        const processedLogsArray: CallLog[] = logs.map((log: any) => {
          // Determine call type
          let type: 'incoming' | 'outgoing' | 'missed' = 'incoming';
          if (log.type === 'OUTGOING') {
            type = 'outgoing';
          } else if (log.type === 'MISSED' || log.type === 'REJECTED') {
            type = 'missed';
          }
          
          // Determine status
          let status: 'completed' | 'missed' | 'in-progress' = 'completed';
          if (log.type === 'MISSED' || log.type === 'REJECTED') {
            status = 'missed';
          }
          
          // Get contact information
          const phoneNumber = log.phoneNumber.replace(/[^\d+]/g, '');
          
          // Try to get contact name from the contacts object
          let contactName = log.name || '';
          let contactType: 'person' | 'company' = 'person';
          
          if (contacts[phoneNumber]) {
            const contact = contacts[phoneNumber];
            
            if (contact.company) {
              contactName = contact.company;
              contactType = 'company';
            } else {
              contactName = (contact.firstName && contact.lastName) 
                ? `${contact.firstName} ${contact.lastName}`
                : contact.firstName || contact.lastName || contactName;
            }
          }
          
          return {
            id: log.id || String(parseInt(String(log.timestamp))),
            phoneNumber,
            timestamp: new Date(parseInt(String(log.timestamp))),
            duration: parseInt(String(log.duration)) || 0,
            type,
            status,
            contactName: contactName || phoneNumber,
            contactType,
            isNewContact: !contacts[phoneNumber] && !log.name
          };
        });
        
        // Store logs in AsyncStorage for faster loading next time
        await AsyncStorage.setItem(CALL_LOGS_STORAGE_KEY, JSON.stringify(processedLogsArray));
        await AsyncStorage.setItem(CALL_LOGS_LAST_UPDATE, String(Date.now()));
        
        // Group logs by date and contact
        const groupedLogs = groupCallLogs(processedLogsArray);
        setCallLogs(groupedLogs);
      }
    } catch (error) {
      console.error('Error fetching call logs:', error);
      Alert.alert('Error', 'Failed to load call logs. Please check permissions.');
      
      // Try to use stored logs as fallback
      try {
        const storedLogs = await AsyncStorage.getItem(CALL_LOGS_STORAGE_KEY);
        if (storedLogs) {
          const parsedLogs = JSON.parse(storedLogs);
          const formattedLogs = parsedLogs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp),
            duration: parseInt(log.duration) || 0,
            type: log.type || 'outgoing',
            status: log.status || 'completed'
          }));
          const groupedLogs = groupCallLogs(formattedLogs);
          setCallLogs(groupedLogs);
        }
      } catch (storageError) {
        console.error('Error reading from storage:', storageError);
      }
    }
  };

  const fetchWeeklyAchievement = async () => {
    try {
      // Check if we have cached achievements
      const cachedAchievements = await AsyncStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
      const now = Date.now();
      
      // If we have cached data from today, use it
      if (cachedAchievements) {
        const { data, timestamp } = JSON.parse(cachedAchievements);
        // If cache is from today, use it
        if (new Date(timestamp).toDateString() === new Date().toDateString()) {
          setProgress(data.progress);
          setProgressText(data.progressText);
          return;
        }
      }
      
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      
      // Get current week's targets and achievements
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      
      // Fetch targets from Firestore
      const targetsRef = doc(db, 'targets', userId);
      const targetsDoc = await getDoc(targetsRef);
      
      if (targetsDoc.exists()) {
        const targetData = targetsDoc.data();
        const weeklyTarget = targetData.weeklyTarget || 100;
        
        // Fetch achievements
        const achievementsRef = collection(db, 'achievements');
        const q = query(
          achievementsRef,
          where('userId', '==', userId),
          where('date', '>=', startOfWeek),
          where('date', '<=', endOfWeek)
        );
        
        const achievementsSnapshot = await getDocs(q);
        let totalAchieved = 0;
        
        achievementsSnapshot.forEach((doc) => {
          const data = doc.data();
          totalAchieved += data.value || 0;
        });
        
        // Calculate progress
        const calculatedProgress = Math.min(totalAchieved / weeklyTarget, 1);
        const progressPercentage = Math.round(calculatedProgress * 100);
        
        setProgress(calculatedProgress);
        setProgressText(`${progressPercentage}%`);
        
        // Cache the results
        await AsyncStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify({
          data: {
            progress: calculatedProgress,
            progressText: `${progressPercentage}%`
          },
          timestamp: now
        }));
      }
    } catch (error) {
      console.error('Error fetching weekly achievement:', error);
    }
  };

  const groupCallLogs = (logs: CallLog[]): GroupedCallLog[] => {
    // First, sort logs by timestamp (newest first)
    const sortedLogs = [...logs].sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
    
    // Group by date and contact
    const groupedByDate: Record<string, Record<string, CallLog[]>> = {};
    
    sortedLogs.forEach(log => {
      const dateKey = formatDate(log.timestamp);
      const contactKey = log.contactName || log.phoneNumber;
      
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = {};
      }
      
      if (!groupedByDate[dateKey][contactKey]) {
        groupedByDate[dateKey][contactKey] = [];
      }
      
      groupedByDate[dateKey][contactKey].push(log);
    });
    
    // Convert to array of grouped logs
    const result: GroupedCallLog[] = [];
    
    Object.entries(groupedByDate).forEach(([dateKey, contactGroups]) => {
      Object.entries(contactGroups).forEach(([contactKey, logs]) => {
        if (logs.length > 0) {
          const latestLog = logs[0];
          result.push({
            ...latestLog,
            callCount: logs.length,
            allCalls: logs,
            date: dateKey, // Add the date as a property
            companyInfo: latestLog.companyInfo
          } as GroupedCallLog);
        }
      });
    });
    
    return result;
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const inputDate = new Date(date);
    inputDate.setHours(0, 0, 0, 0);
    
    if (inputDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (inputDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      // Format as "Jan 15th"
      const day = date.getDate();
      const month = date.toLocaleString('default', { month: 'short' });
      return `${month} ${day}${getDaySuffix(day)}`;
    }
  };

  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12
    
    const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
    
    return `${hours}:${minutesStr} ${ampm}`;
  };

  const formatDuration = (seconds: number | string): string => {
    // Convert to number if it's a string
    const secs = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
    
    if (!secs) return '0 mins';
    
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    
    if (hours > 0 && minutes > 0) {
      return `${hours} hr ${minutes} mins`;
    } else if (hours > 0) {
      return `${hours} hr`;
    } else {
      return `${minutes} mins`;
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

  const calculateTotalDuration = (date: string) => {
    const dayMeetings = callLogs.filter(log => formatDate(log.timestamp) === date);
    let totalSeconds = 0;

    dayMeetings.forEach(meeting => {
      totalSeconds += meeting.duration || 0;
    });

    // Convert seconds to hours and minutes
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      if (minutes > 0) {
      return `${hours} hr ${minutes} mins`;
      }
      return `${hours} hr`;
    } else if (minutes > 0) {
      return `${minutes} mins`;
    }
    return `${seconds} secs`;
  };

  const handleCardClick = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Only update state if it's changing
    if (expandedCardId !== id) {
      setExpandedCardId(id);
    } else {
      setExpandedCardId(null);
    }
  };

  const navigateToCallHistory = (callItem: GroupedCallLog) => {
    navigation.navigate('BDMCallHistory' as any, {
      customerName: callItem.contactName || callItem.phoneNumber,
      phoneNumber: callItem.phoneNumber,
      meetings: callItem.allCalls.map(call => ({
        date: formatDate(new Date(call.timestamp)),
        time: formatTime(new Date(call.timestamp)),
        duration: formatDuration(call.duration || 0),
        type: call.type,
        status: call.status === 'completed' ? 'Prospect' : 
                call.status === 'missed' ? 'Missed' : 'In-progress',
        notes: call.notes || []
      })),
      isCompany: callItem.contactType === 'company',
      companyInfo: callItem.companyInfo
    });
  };

  // Add new function to navigate to contact details
  const navigateToContactDetails = (callItem: GroupedCallLog) => {
    if (callItem.contactType === 'company') {
      // Navigate to company details
      navigation.navigate('BDMCompanyDetails' as any, {
        company: {
          name: callItem.contactName || callItem.phoneNumber
          // Additional properties will be passed from the interface definition
        }
      });
    } else {
      // Navigate to contact details
      navigation.navigate('BDMContactDetails' as any, {
        contact: {
          name: callItem.contactName || callItem.phoneNumber,
          phone: callItem.phoneNumber,
          email: '' // We don't have email in the call log, could be added later
        }
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchWeeklyAchievement(),
      fetchCallLogs()
    ]);
    setRefreshing(false);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Get scroll position and update Animated.Value
    scrollY.current.setValue(event.nativeEvent.contentOffset.y);
  };

  // Memoize the meeting card render function to prevent unnecessary re-renders
  const renderMeetingCard = React.useCallback(({ item, index }: { item: GroupedCallLog; index: number }) => {
    const isFirstOfDate = index === 0 || 
      formatDate(callLogs[index - 1].timestamp) !== formatDate(item.timestamp);
    const isExpanded = expandedCardId === item.id;
    const isCompany = item.contactType === 'company';

    return (
      <>
        {isFirstOfDate && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateText}>
              {formatDate(item.timestamp)} 
              {formatDate(item.timestamp) === 'Today' && `(${new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short' })})`}
              {formatDate(item.timestamp) === 'Yesterday' && `(${new Date(Date.now() - 86400000).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })})`}
            </Text>
            <Text style={styles.durationText}>
              {calculateTotalDuration(formatDate(item.timestamp))}
            </Text>
          </View>
        )}
        
        <Card style={styles.meetingCard}>
          <TouchableOpacity 
            onPress={() => handleCardClick(item.id)}
            activeOpacity={0.7} // Make touch feedback faster
          >
            <View style={styles.meetingInfo}>
              <TouchableOpacity 
                style={[
                  styles.iconContainer,
                  isCompany ? styles.companyIconContainer : null,
                  {backgroundColor: item.type === 'missed' ? '#FFEEEE' : isCompany ? '#E6F7FF' : '#FFF5E6'}
                ]}
                onPress={() => navigateToContactDetails(item)}
              >
                <MaterialIcons 
                  name={isCompany ? "business" : "person"} 
                  size={24} 
                  color={item.type === 'missed' ? '#FF3B30' : isCompany ? '#0078D7' : '#FF8447'} 
                />
              </TouchableOpacity>
              <View style={styles.meetingDetails}>
                <Text style={styles.meetingName}>
                  {item.contactName || item.phoneNumber}
                  {item.callCount > 1 && 
                    <Text style={styles.callCountBadge}> ({item.callCount})</Text>
                  }
                </Text>
                {isCompany && item.companyInfo?.industry && (
                  <Text style={styles.industryText}>{item.companyInfo.industry}</Text>
                )}
                <Text style={styles.meetingTime}>
                  {formatTime(item.timestamp)} • {formatDuration(item.duration)}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.chevronButton}
                onPress={() => navigation.navigate('BDMCallNoteDetailsScreen' as any, {
                  meeting: {
                    name: item.contactName || item.phoneNumber,
                    time: formatTime(item.timestamp),
                    duration: formatDuration(item.duration),
                    phoneNumber: item.phoneNumber,
                    date: formatDate(item.timestamp),
                    type: item.type,
                    contactType: item.contactType
                  }
                })}
              >
                <MaterialIcons name="chevron-right" size={30} color="#BBBBBB" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          
          {/* Expanded Actions */}
          {isExpanded && (
            <View style={styles.expandedActionsContainer}>
              <TouchableOpacity 
                style={styles.expandedAction}
                onPress={() => {
                  if (isCompany) {
                    navigation.navigate('BDMCompanyDetails' as any, { 
                      company: {
                        name: item.contactName || item.phoneNumber,
                        industry: item.companyInfo?.industry,
                        domain: item.companyInfo?.domain
                      }
                    });
                  } else {
                    navigation.navigate('BDMContactDetails' as any, { 
                      contact: {
                        name: item.contactName || 'Unknown',
                        phone: item.phoneNumber,
                        email: item.contactName ? `${item.contactName.toLowerCase().replace(/\s+/g, '')}@example.com` : ''
                      }
                    });
                  }
                }}
              >
                <MaterialIcons 
                  name={isCompany ? "business" : "person"} 
                  size={20} 
                  color="#FF8447" 
                />
                <Text style={styles.actionText}>{isCompany ? 'View Company' : 'View Contact'}</Text>
              </TouchableOpacity>
              
              <View style={styles.actionDivider} />
              
              <TouchableOpacity 
                style={styles.expandedAction}
                onPress={() => navigateToCallHistory(item)}
              >
                <MaterialIcons name="history" size={20} color="#FF8447" />
                <Text style={styles.actionText}>History</Text>
              </TouchableOpacity>
              
              <View style={styles.actionDivider} />
            </View>
          )}
        </Card>
      </>
    );
  }, [callLogs, expandedCardId, navigation]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="phone-missed" size={64} color="#DDDDDD" />
      <Text style={styles.emptyTitle}>No Call History Yet</Text>
      <Text style={styles.emptyMessage}>
        Your recent calls will appear here once you start making or receiving calls.
      </Text>
    </View>
  );

  return (
    <AppGradient>
    <BDMMainLayout showBackButton={false} showBottomTabs>
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF8447" />
            <Text style={styles.loadingText}>Loading your meetings...</Text>
          </View>
        ) : (
          <>
            {/* Welcome Section */}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>Welcome, 👋</Text>
              <Text style={styles.nameText}>{userName}</Text>
              
              {/* Progress Section */}
              <View style={styles.progressSection}>
                <ProgressBar 
                  progress={progress} 
                  color="#FF8447" 
                  style={styles.progressBar} 
                />
                <Text style={styles.progressText}>
                  Great job! You've completed <Text style={styles.progressHighlight}>{progressText}</Text> of your target
                </Text>
              </View>
            </View>

            {/* Meetings Section */}
            <Text style={styles.sectionTitle}>Meetings History</Text>
            
            <FlatList
              data={callLogs}
              keyExtractor={(item) => item.id}
              renderItem={renderMeetingCard}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={callLogs.length === 0 ? {flex: 1} : null}
              ListEmptyComponent={renderEmptyState}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={10}
              removeClippedSubviews={true}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={handleRefresh} 
                  colors={["#FF8447"]}
                  tintColor="#FF8447"
                />
              }
            />
          </>
        )}
      </View>
    </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  content: {
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
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 16,
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
  meetingCard: {
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
  meetingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  meetingDetails: {
    flex: 1,
  },
  meetingName: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  callCountBadge: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#888',
  },
  meetingTime: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
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
  actionButtonContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  viewContactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  historyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonDivider: {
    width: 1,
    backgroundColor: '#EEEEEE',
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  expandedActionsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingVertical: 8,
    marginTop: 8,
    justifyContent: 'space-around',
  },
  expandedAction: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 8,
    flex: 1,
  },
  actionText: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#555',
    textAlign: 'center',
  },
  actionDivider: {
    width: 1,
    backgroundColor: '#EEEEEE',
    marginHorizontal: 4,
  },
  chevronButton: {
    padding: 8,
  },
  companyIconContainer: {
    backgroundColor: '#E6F7FF',
  },
  industryText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#0078D7',
    marginTop: -2,
    marginBottom: 2,
  },
});

export default BDMHomeScreen;