import React, { useState, useRef, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Animated, Modal, Platform, NativeScrollEvent, NativeSyntheticEvent, ActivityIndicator, PermissionsAndroid, NativeModules } from "react-native";
import { ProgressBar } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import { LinearGradient } from 'expo-linear-gradient';
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

// Define navigation types
type RootStackParamList = {
  TelecallerCallNoteDetails: { meeting: CallLog };
  AddContactModal: { phone: string };
  CallHistory: { call: CallLog };
  ContactInfo: { contact: CallLog & { isNewContact: boolean } };
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

interface Contact {
  firstName: string;
  lastName: string;
  phoneNumbers?: Array<{
    number: string;
  }>;
}

// Add this interface for grouped calls
interface GroupedCallLog extends CallLog {
  callCount: number;
  allCalls: CallLog[];
}

// Add these constants at the top level
const CALL_LOGS_STORAGE_KEY = 'device_call_logs';
const CALL_LOGS_LAST_UPDATE = 'call_logs_last_update';
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

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

  // Add function to check if number is saved
  const isNumberSaved = (phoneNumber: string) => {
    return savedContacts[phoneNumber] || false;
  };

  // Add function to load saved contacts
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

  // Update useEffect to load contacts
  useEffect(() => {
    loadSavedContacts();
  }, []);

  // Add this useEffect to fetch user details
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          console.log('No user ID found');
          return;
        }

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

  // Update the fetchCallLogs function
  const fetchCallLogs = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log('No user ID found for call logs');
        return;
      }

      const callLogsRef = collection(db, 'callLogs');
      const q = query(
        callLogsRef,
        where('userId', '==', userId),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(q, async (snapshot) => {
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
                const contactData = contactDoc.data() as ContactData;
                log.contactName = contactData.name || '';
              }
            } catch (err: unknown) {
              const error = err as Error;
              console.error('Error fetching contact:', error);
            }
          }

          logs.push(log);
        }

        // Sort logs by timestamp in descending order
        logs.sort((a, b) => {
          const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          return bTime - aTime;
        });

        // Group the logs by phone number
        const groupedLogs = groupCallLogs(logs);
        setCallLogs(groupedLogs);
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

  // Update the useEffect for call logs
  useEffect(() => {
    let unsubscribeFunction: (() => void) | undefined;
    
    fetchCallLogs().then(unsub => {
      unsubscribeFunction = unsub;
    });

    return () => {
      if (unsubscribeFunction) {
        unsubscribeFunction();
      }
    };
  }, []);

  // Function to calculate total duration per date
  const calculateTotalDuration = (date: string) => {
    const dayLogs = [...callLogs, ...simCallLogs].filter(log => {
      const logDate = new Date(log.timestamp).toLocaleDateString();
      return logDate === date;
    });

    let totalSeconds = 0;
    dayLogs.forEach(log => {
      if (log.duration) {
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
          // Proceed with making the call
          const url = `tel:${phoneNumber}`;
          await Linking.openURL(url);
        }
      } else {
        // For iOS, directly open the dialer
        const url = `tel:${phoneNumber}`;
        await Linking.openURL(url);
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

      // If we have stored logs and they're recent, use them
      if (storedLogs && lastUpdate && (now - parseInt(lastUpdate)) < UPDATE_INTERVAL) {
        try {
          const parsedLogs = JSON.parse(storedLogs);
          // Ensure timestamps are properly formatted
          const formattedLogs = parsedLogs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp).toISOString(),
            duration: parseInt(log.duration) || 0,
            type: log.type || 'outgoing',
            status: log.status || 'completed'
          }));
          const groupedLogs = groupCallLogs(formattedLogs);
          setCallLogs(groupedLogs);
        } catch (error) {
          console.error('Error parsing stored logs:', error);
          // If there's an error parsing stored logs, fetch fresh logs
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
          const groupedLogs = groupCallLogs(formattedLogs);
          setCallLogs(groupedLogs);
        }
      } catch (storageError) {
        console.error('Error reading from storage:', storageError);
      }
    } finally {
      setIsLoadingSimLogs(false);
    }
  };

  // Update the fetchFreshLogs function to handle device call logs better
  const fetchFreshLogs = async () => {
    if (Platform.OS === 'android') {
      const hasPermission = await requestCallLogPermission();
      
      if (hasPermission) {
        const logs = await CallLog.loadAll();
        console.log('Device call logs:', logs);

        const formattedLogs = logs.map((log: any) => ({
          id: String(log.timestamp),
          phoneNumber: log.phoneNumber,
          // Only use name if it exists and isn't "Unknown"
          contactName: log.name && log.name !== "Unknown" ? log.name : log.phoneNumber,
          timestamp: new Date(parseInt(log.timestamp)),
          duration: parseInt(log.duration) || 0,
          type: (log.type || 'OUTGOING').toLowerCase() as 'incoming' | 'outgoing' | 'missed',
          status: (log.type === 'MISSED' ? 'missed' : 'completed') as 'missed' | 'completed' | 'in-progress'
        }));

        // Store logs in AsyncStorage
        await AsyncStorage.setItem(CALL_LOGS_STORAGE_KEY, JSON.stringify(formattedLogs));
        await AsyncStorage.setItem(CALL_LOGS_LAST_UPDATE, String(Date.now()));

        // Group the logs by phone number
        const groupedLogs = groupCallLogs(formattedLogs);
        setCallLogs(groupedLogs);
      }
    }
  };

  // Update the groupCallLogs function
  const groupCallLogs = (logs: CallLog[]): GroupedCallLog[] => {
    const groupedByPhone: { [key: string]: CallLog[] } = {};
    
    // Group calls by phone number
    logs.forEach(log => {
      if (!log.phoneNumber) return; // Skip logs without phone numbers
      
      if (!groupedByPhone[log.phoneNumber]) {
        groupedByPhone[log.phoneNumber] = [];
      }
      groupedByPhone[log.phoneNumber].push(log);
    });

    // Convert grouped calls to array and sort by latest timestamp
    return Object.entries(groupedByPhone).map(([phoneNumber, calls]) => {
      // Sort calls by timestamp descending (latest first)
      const sortedCalls = [...calls].sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bTime - aTime;
      });
      
      // Use the most recent call as the main log
      const latestCall = sortedCalls[0];
      
      return {
        ...latestCall,
        callCount: calls.length,
        allCalls: sortedCalls
      };
    }).sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });
  };

  // Add useEffect to fetch SIM logs periodically
  useEffect(() => {
    fetchDeviceCallLogs();
    const interval = setInterval(fetchDeviceCallLogs, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
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

  // Add this function to handle refresh after permission granted
  const handleRefresh = async () => {
    const hasPermission = await requestCallLogPermission();
    if (hasPermission) {
      fetchDeviceCallLogs();
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
    const displayName = isNumberSaved(item.phoneNumber) ? 
      item.contactName : 
      item.phoneNumber;

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
              <View style={styles.avatarContainer}>
                <MaterialIcons 
                  name="person" 
                  size={24} 
                  color="#FF8447"
                  onPress={() => {
                    if (isNumberSaved(item.phoneNumber)) {
                      navigation.navigate('ContactInfo', {
                        contact: {
                          ...item,
                          isNewContact: false
                        }
                      });
                    } else {
                      navigation.navigate('AddContactModal', { 
                        phoneNumber: item.phoneNumber,
                        onContactSaved: () => {
                          loadSavedContacts();
                          fetchCallLogs();
                        }
                      });
                    }
                  }}
                />
              </View>
              <View style={styles.callDetails}>
                <View style={styles.nameContainer}>
                  <Text style={[
                    styles.callName,
                    { color: item.type === 'missed' ? '#DC2626' : '#333' }
                  ]}>
                    {displayName}
                  </Text>
                  {!isNumberSaved(item.phoneNumber) && (
                    <TouchableOpacity
                      style={styles.addContactButton}
                      onPress={() => navigation.navigate('AddContactModal', { 
                        phoneNumber: item.phoneNumber,
                        onContactSaved: () => {
                          loadSavedContacts();
                          fetchCallLogs();
                        }
                      })}
                    >
                      <MaterialIcons name="person-add" size={16} color="#FF8447" />
                      <Text style={styles.addContactText}>Add Contact</Text>
                    </TouchableOpacity>
                  )}
                  {item.callCount > 1 && (
                    <Text style={styles.callCount}>({item.callCount})</Text>
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
  };

  // Update the renderCallActions function
  const renderCallActions = (call: GroupedCallLog) => {
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
            if (call.status === 'completed') {
              navigation.navigate('TelecallerCallNoteDetails', { meeting: call });
            } else {
              navigation.navigate('AddContactModal', { phone: call.phoneNumber });
            }
          }}
        >
          <MaterialIcons 
            name={call.status === 'completed' ? "note-add" : "person-add"} 
            size={24} 
            color="#FF8447" 
          />
          <Text style={styles.actionText}>
            {call.status === 'completed' ? 'Add Notes' : 'Add Contact'}
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

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBottomTabs={true} showBackButton={false}>
        <View style={styles.container}>
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Welcome,👋👋</Text>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FF8447" />
            ) : (
              <Text style={styles.nameText}>
                {userName || 'User'}
              </Text>
            )}
            {/* Progress Section */}
            <View style={styles.progressSection}>
              <ProgressBar 
                progress={0.4} 
                color="#FF8447" 
                style={styles.progressBar} 
              />
              <Text style={styles.progressText}>
                Great job! You've completed <Text style={styles.progressHighlight}>40%</Text> of your target
              </Text>
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
            onPress={() => setDialerVisible(true)}
          >
            <MaterialIcons name="dialpad" size={24} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* Dialer Modal */}
        <Modal
          visible={isDialerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setDialerVisible(false)}
        >
          <TouchableOpacity 
            style={styles.modalContainer} 
            activeOpacity={1} 
            onPress={() => setDialerVisible(false)}
          >
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={e => e.stopPropagation()}
            >
              <View style={styles.dialerContent}>
                <View style={styles.dialerHeader}>
                  <Text style={styles.phoneNumberDisplay}>
                    {phoneNumber || ''}
                  </Text>
                  <View style={styles.dialerActions}>
                    {phoneNumber.length > 0 && !isNumberSaved(phoneNumber) && (
                      <TouchableOpacity
                        style={styles.addContactButtonDialer}
                        onPress={() => {
                          setDialerVisible(false);
                          navigation.navigate('AddContactModal', { 
                            phoneNumber: phoneNumber,
                            onContactSaved: () => {
                              loadSavedContacts();
                              setPhoneNumber('');
                            }
                          });
                        }}
                      >
                        <MaterialIcons name="person-add" size={24} color="#FF8447" />
                      </TouchableOpacity>
                    )}
                    {phoneNumber.length > 0 && (
                      <TouchableOpacity
                        onPress={handleBackspace}
                        style={styles.backspaceButton}
                      >
                        <MaterialIcons name="backspace" size={24} color="#666" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.dialPad}>
                  {Array.from({ length: 4 }, (_, rowIndex) => (
                    <View key={rowIndex} style={styles.dialRow}>
                      {dialPad.slice(rowIndex * 3, (rowIndex + 1) * 3).map((item) => (
                        <TouchableOpacity
                          key={item.num}
                          style={styles.dialButton}
                          onPress={() => {
                            handleDialPress(item.num);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                        >
                          <Text style={styles.dialButtonNumber}>{item.num}</Text>
                          <Text style={styles.dialButtonAlpha}>{item.alpha}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.callButton, isCallActive && styles.endCall]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    isCallActive ? handleEndCall() : handleCall(phoneNumber);
                  }}
                >
                  <MaterialIcons 
                    name={isCallActive ? "call-end" : "call"} 
                    size={32} 
                    color="#FFF" 
                  />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
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
    // flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    // alignItems: 'center',
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
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dialerContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dialerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    paddingTop: 20,
    position: 'relative',
  },
  phoneNumberDisplay: {
    fontSize: 32,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    letterSpacing: 2,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  backspaceButton: {
    position: 'absolute',
    right: 0,
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  endCall: {
    backgroundColor: '#F44336',
  },
  dialerFAB: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    backgroundColor: '#FF8447',
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
  dialerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    right: 0,
  },
  addContactButtonDialer: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#FFF5E6',
    marginRight: 8,
  },
});

export default HomeScreen;