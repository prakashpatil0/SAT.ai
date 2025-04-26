import React, { useCallback, useMemo, memo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import { BDMStackParamList } from '@/app/index';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Status and Call Type Configuration
const STATUS_CONFIG = {
  prospect: { color: '#4CAF50', icon: 'check-circle' },
  suspect: { color: '#FF9800', icon: 'help-outline' },
  closing: { color: '#2196F3', icon: 'check' },
  missed: { color: '#F44336', icon: 'close' },
  default: { color: '#999999', icon: 'info' }
};

const CALL_TYPE_CONFIG = {
  incoming: { color: '#4CAF50', icon: 'call-received' },
  outgoing: { color: '#2196F3', icon: 'call-made' },
  missed: { color: '#F44336', icon: 'call-missed' },
  default: { color: '#999999', icon: 'call' }
};

// Unified Helper Functions
const getStatusColor = (status?: string): string => {
  if (!status) return STATUS_CONFIG.default.color;
  const normalizedStatus = status.toLowerCase();
  return STATUS_CONFIG[normalizedStatus as keyof typeof STATUS_CONFIG]?.color || STATUS_CONFIG.default.color;
};

const getCallTypeIcon = (type?: string): React.ReactNode => {
  if (!type) return null;
  const normalizedType = type.toLowerCase();
  const config = CALL_TYPE_CONFIG[normalizedType as keyof typeof CALL_TYPE_CONFIG] || CALL_TYPE_CONFIG.default;
  
  return (
    <MaterialIcons 
      name={config.icon as any} 
      size={20} 
      color={config.color} 
      style={styles.callIcon} 
    />
  );
};

type Meeting = {
  date: string;
  time: string;
  duration: string;
  notes?: string[];
  status?: string;
  type?: 'incoming' | 'outgoing' | 'missed';
  id?: string;
  phoneNumber?: string;
  name?: string;
};

type Company = {
  name: string;
  domain?: string;
  industry?: string;
  contacts?: any[];
};

// Update BDMStackParamList for CallHistory
type CallHistoryParams = {
  customerName: string;
  phoneNumber?: string;
  meetings: Meeting[];
  isCompany?: boolean;
  companyInfo?: Company;
};

type CallHistoryScreenProps = {
  route: RouteProp<{ params: CallHistoryParams }, 'params'>;
};

// Memoized components
const CustomerCard = memo(({ 
  customerName, 
  phoneNumber, 
  isCompany, 
  companyInfo 
}: { 
  customerName: string;
  phoneNumber?: string;
  isCompany?: boolean;
  companyInfo?: Company;
}) => (
  <View style={styles.customerCard}>
    <View style={[
      styles.avatarContainer, 
      { backgroundColor: isCompany ? '#E6F7FF' : '#FFF5E6' }
    ]}>
      <MaterialIcons 
        name={isCompany ? "business" : "person"} 
        size={28} 
        color={isCompany ? "#0078D7" : "#FF8447"} 
      />
    </View>
    <View style={styles.customerInfo}>
      <Text style={styles.customerName}>{customerName}</Text>
      {phoneNumber && <Text style={styles.customerDetail}>{phoneNumber}</Text>}
      {isCompany && companyInfo?.industry && (
        <Text style={styles.industryText}>{companyInfo.industry}</Text>
      )}
      {isCompany && companyInfo?.domain && (
        <Text style={styles.domainText}>{companyInfo.domain}</Text>
      )}
    </View>
  </View>
));

const MeetingItem = memo(({ 
  meeting, 
  onPress,
  getCallTypeIcon,
  getStatusColor
}: { 
  meeting: Meeting;
  onPress: () => void;
  getCallTypeIcon: (type?: string) => React.ReactNode;
  getStatusColor: (status?: string) => string;
}) => {
  // Calculate if this meeting has notes
  const hasNotes = meeting.notes && meeting.notes.length > 0;
  
  return (
    <TouchableOpacity
      style={[
        styles.meetingItem,
        hasNotes && styles.hasNotesItem
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.timeContainer}>
        <Text style={styles.meetingTime}>{meeting.time}</Text>
        <Text style={styles.meetingDuration}>{meeting.duration}</Text>
        
        {hasNotes && (
          <View style={styles.noteIndicator}>
            <MaterialIcons name="notes" size={16} color="#FF8447" />
            <Text style={styles.noteIndicatorText}>
              {meeting.notes?.length} note{meeting.notes?.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.meetingDetails}>
        <View style={styles.meetingTypeContainer}>
          {getCallTypeIcon(meeting.type)}
          <View style={styles.statusIndicator}>
            <View 
              style={[
                styles.statusDot, 
                { backgroundColor: getStatusColor(meeting.status) }
              ]} 
            />
          </View>
        </View>
        
        <View style={styles.chevronContainer}>
          <MaterialIcons name="chevron-right" size={24} color="#CCCCCC" />
        </View>
      </View>
    </TouchableOpacity>
  );
});

interface DateGroupProps {
  group: { date: string; meetings: Meeting[] };
  onPressMeeting: (meeting: Meeting) => void;
  getCallTypeIcon: (type?: string) => React.ReactNode;
  getStatusColor: (status?: string) => string;
}

const DateGroup = memo(({ 
  group, 
  onPressMeeting,
  getCallTypeIcon,
  getStatusColor
}: DateGroupProps) => (
  <View style={styles.dateGroup}>
    <View style={styles.dateHeaderContainer}>
      <Text style={styles.dateHeader}>{group.date}</Text>
      <Text style={styles.totalDurationText}>{calculateTotalDuration(group.meetings)}</Text>
    </View>
    
    {group.meetings.map((meeting, meetingIndex) => (
      <MeetingItem
        key={`meeting-${meetingIndex}`}
        meeting={meeting}
        onPress={() => onPressMeeting(meeting)}
        getCallTypeIcon={getCallTypeIcon}
        getStatusColor={getStatusColor}
      />
    ))}
  </View>
));

const EmptyState = memo(() => (
  <View style={styles.emptyState}>
    <MaterialIcons name="history" size={64} color="#DDD" />
    <Text style={styles.emptyStateTitle}>No meeting history</Text>
    <Text style={styles.emptyStateMessage}>Meeting logs will appear here when available.</Text>
  </View>
));

const CallHistoryScreen: React.FC<CallHistoryScreenProps> = ({ route }) => {
  const navigation = useNavigation<StackNavigationProp<BDMStackParamList>>();
  const { customerName, phoneNumber, meetings = [], isCompany, companyInfo } = route.params || { 
    customerName: 'Unknown', 
    meetings: []
  };

  // Create contact ID
  const contactId = useMemo(() => 
    createContactId(customerName, phoneNumber), 
    [customerName, phoneNumber]
  );

  // State for loaded meetings with notes
  const [loadedMeetings, setLoadedMeetings] = useState<Meeting[]>(meetings);

  // Load saved notes when component mounts
  useEffect(() => {
    const loadNotes = async () => {
      const savedMeetings = await loadContactNotes(contactId);
      if (savedMeetings.length > 0) {
        setLoadedMeetings(savedMeetings);
      }
    };
    loadNotes();
  }, [contactId]);

  // Save notes when meetings change
  useEffect(() => {
    if (loadedMeetings.length > 0) {
      saveContactNotes(contactId, loadedMeetings);
    }
  }, [loadedMeetings, contactId]);

  // Update your navigateToPersonNote to save notes
  const navigateToPersonNote = useCallback((meeting: Meeting) => {
    if (!meeting) return;
    
    // Create contact identifier using phone number or name
    const contactIdentifier = meeting.phoneNumber 
      ? `phone_${meeting.phoneNumber.replace(/[^0-9]/g, '')}`
      : `name_${(meeting.name || customerName).toLowerCase().replace(/\s+/g, '_')}`;

    // Navigate to person notes screen with all necessary parameters
    navigation.navigate('BDMPersonNote', {
      name: customerName,
      time: meeting.time || '',
      duration: meeting.duration || '0 mins',
      status: meeting.status || 'No Status',
      notes: meeting.notes || [],
      phoneNumber: meeting.phoneNumber,
      contactInfo: {
        name: customerName,
        phoneNumber: meeting.phoneNumber,
        timestamp: new Date(),
        duration: meeting.duration || '0 mins'
      },
      contactIdentifier
    });
  }, [customerName, navigation]);

  // Rest of your component remains the same...
  const groupedMeetings = useMemo(() => 
    groupMeetingsByDate(loadedMeetings), 
    [loadedMeetings]
  );

  return (
  <AppGradient>
    <BDMMainLayout
      title={customerName}
      showBackButton
      showDrawer={true}
      showBottomTabs={true}
    >
      <ScrollView>
        <View style={styles.container}>
          <View style={styles.meetingHistoryContainer}>
            <Text style={styles.sectionTitle}>Meeting History</Text>
            
            {loadedMeetings.length > 0 ? (
              <>
                {groupedMeetings.map((group, groupIndex) => (
                  <DateGroup
                    key={`group-${groupIndex}`}
                    group={group}
                    onPressMeeting={navigateToPersonNote}
                    getCallTypeIcon={getCallTypeIcon}
                    getStatusColor={getStatusColor}
                  />
                ))}
              </>
            ) : (
              <EmptyState />
            )}
          </View>
        </View>
      </ScrollView>
    </BDMMainLayout>
  </AppGradient>
);
};

// Helper functions
const groupMeetingsByDate = (meetings: Meeting[]) => {
  const groups: { date: string; meetings: Meeting[] }[] = [];
  const dateMap: { [date: string]: Meeting[] } = {};
  
  meetings.forEach(meeting => {
    if (!dateMap[meeting.date]) {
      dateMap[meeting.date] = [];
    }
    dateMap[meeting.date].push(meeting);
  });
  
  Object.keys(dateMap).forEach(date => {
    groups.push({
      date,
      meetings: dateMap[date]
    });
  });
  
  return groups;
};

const calculateTotalDuration = (meetings: Meeting[]): string => {
  if (!meetings || meetings.length === 0) {
    return '0 mins';
  }

  let totalSeconds = 0;
  
  meetings.forEach(meeting => {
    if (!meeting.duration) return;
    
    // Parse duration string
    const durationStr = meeting.duration;
    if (durationStr.includes(':')) {
      // Handle HH:MM:SS format
      const [hours, minutes, seconds] = durationStr.split(':').map(Number);
      totalSeconds += (hours * 3600) + (minutes * 60) + seconds;
    } else {
      // Handle "X hr Y mins" format
      const hrMatch = durationStr.match(/(\d+)\s*hr/);
      const minMatch = durationStr.match(/(\d+)\s*min/);
      const secMatch = durationStr.match(/(\d+)\s*s/);
      
      const hours = hrMatch ? parseInt(hrMatch[1]) : 0;
      const minutes = minMatch ? parseInt(minMatch[1]) : 0;
      const seconds = secMatch ? parseInt(secMatch[1]) : 0;
      
      totalSeconds += (hours * 3600) + (minutes * 60) + seconds;
    }
  });
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};
// Add these helper functions at the bottom of your file (before styles)

// Helper to create unique contact ID
const createContactId = (name: string, phoneNumber?: string) => {
  // Use phone number if available (best unique identifier)
  if (phoneNumber) {
    return `phone_${phoneNumber.replace(/[^0-9]/g, '')}`;
  }
  
  // Fallback to sanitized name
  const sanitizedName = name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  return `name_${sanitizedName}`;
};

// Helper to save notes for a contact
const saveContactNotes = async (contactId: string, meetings: Meeting[]) => {
  try {
    const existingData = await AsyncStorage.getItem('contact_notes');
    const allContacts = existingData ? JSON.parse(existingData) : {};
    
    // Update notes for this contact
    allContacts[contactId] = meetings;
    
    await AsyncStorage.setItem('contact_notes', JSON.stringify(allContacts));
  } catch (error) {
    console.error('Error saving contact notes:', error);
  }
};

// Helper to load notes for a contact
const loadContactNotes = async (contactId: string) => {
  try {
    const existingData = await AsyncStorage.getItem('contact_notes');
    const allContacts = existingData ? JSON.parse(existingData) : {};
    return allContacts[contactId] || [];
  } catch (error) {
    console.error('Error loading contact notes:', error);
    return [];
  }
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  customerCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF5E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 2,
  },
  customerDetail: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  industryText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#0078D7',
    marginTop: 2,
  },
  domainText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 2,
  },
  meetingHistoryContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 16,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateHeader: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  totalDurationText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#888',
  },
  meetingItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  timeContainer: {
    marginRight: 16,
    alignItems: 'flex-start',
    width: 90,
  },
  meetingTime: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginBottom: 2,
  },
  meetingDuration: {
    fontSize: 13,
    fontFamily: 'LexendDeca_400Regular',
    color: '#888',
  },
  meetingDetails: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meetingTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callIcon: {
    marginRight: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },
  chevronContainer: {
    marginLeft: 'auto',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#666',
    marginTop: 16,
  },
  emptyStateMessage: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999',
    textAlign: 'center',
    maxWidth: 200,
    marginTop: 8,
  },
  // noteIndicator: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   marginTop: 4,
  // },
  // noteIndicatorText: {
  //   fontSize: 12,
  //   fontFamily: 'LexendDeca_400Regular',
  //   color: '#FF8447',
  //   marginLeft: 4,
  // },
  hasNotesItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF8447',
  },
  noteIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#FFF5E6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  noteIndicatorText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#FF8447',
    marginLeft: 4,
  },
});

export default memo(CallHistoryScreen);