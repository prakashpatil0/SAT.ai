import React, { useCallback, useMemo, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import { BDMStackParamList } from '@/app/index';

type Meeting = {
  date: string;
  time: string;
  duration: string;
  notes?: string[];
  status?: string;
  type?: 'incoming' | 'outgoing' | 'missed';
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
}) => (
  <TouchableOpacity
    style={styles.meetingItem}
    onPress={onPress}
  >
    <View style={styles.timeContainer}>
      <Text style={styles.meetingTime}>{meeting.time}</Text>
      <Text style={styles.meetingDuration}>{meeting.duration}</Text>
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
));

const DateGroup = memo(({ 
  group, 
  onPressMeeting,
  getCallTypeIcon,
  getStatusColor
}: { 
  group: { date: string; meetings: Meeting[] };
  onPressMeeting: (meeting: Meeting) => void;
  getCallTypeIcon: (type?: string) => React.ReactNode;
  getStatusColor: (status?: string) => string;
}) => (
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

  const navigateToPersonNote = useCallback((meeting: Meeting) => {
    if (!meeting) return;
    
    navigation.navigate('BDMPersonNote', {
      name: customerName,
      time: meeting.time || '',
      duration: meeting.duration || '0 mins',
      type: meeting.status?.toLowerCase() || 'prospect',
      notes: meeting.notes || []
    });
  }, [customerName, navigation]);

  const getStatusColor = useCallback((status?: string) => {
    if (!status) return '#999';
    
    switch (status.toLowerCase()) {
      case 'prospect':
        return '#4CAF50';
      case 'suspect':
        return '#FF9800';
      case 'closing':
        return '#2196F3';
      case 'missed':
        return '#F44336';
      default:
        return '#999';
    }
  }, []);

  const getCallTypeIcon = useCallback((type?: string) => {
    if (!type) return null;
    
    switch (type.toLowerCase()) {
      case 'incoming':
        return <MaterialIcons name="call-received" size={20} color="#4CAF50" style={styles.callIcon} />;
      case 'outgoing':
        return <MaterialIcons name="call-made" size={20} color="#2196F3" style={styles.callIcon} />;
      case 'missed':
        return <MaterialIcons name="call-missed" size={20} color="#F44336" style={styles.callIcon} />;
      default:
        return null;
    }
  }, []);

  const groupedMeetings = useMemo(() => groupMeetingsByDate(meetings), [meetings]);

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
            
            {meetings.length > 0 ? (
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

  let totalHours = 0;
  let totalMinutes = 0;
  
  meetings.forEach(meeting => {
    if (!meeting.duration) return;
    
    const durationParts = meeting.duration.split(' ');
    
    for (let i = 0; i < durationParts.length; i += 2) {
      const value = parseInt(durationParts[i], 10);
      const unit = durationParts[i + 1];
      
      if (!unit) continue;
      
      if (unit.startsWith('hr')) {
        totalHours += value;
      } else if (unit.startsWith('min')) {
        totalMinutes += value;
      }
    }
  });
  
  totalHours += Math.floor(totalMinutes / 60);
  totalMinutes = totalMinutes % 60;
  
  if (totalHours > 0 && totalMinutes > 0) {
    return `${totalHours} hr ${totalMinutes} mins`;
  } else if (totalHours > 0) {
    return `${totalHours} hr`;
  } else {
    return `${totalMinutes} mins`;
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
});

export default memo(CallHistoryScreen);