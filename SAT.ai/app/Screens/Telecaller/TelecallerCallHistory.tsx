import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation, useRoute } from '@react-navigation/native';
import AppGradient from '@/app/components/AppGradient';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';

type NavigationProp = StackNavigationProp<RootStackParamList, 'CallHistory'>;

interface CallItem {
  id: string;
  phoneNumber: string;
  timestamp: Date;
  duration: number;
  type: 'incoming' | 'outgoing' | 'missed';
  status: 'completed' | 'missed' | 'in-progress';
  contactId?: string;
  contactName?: string;
}

type RootStackParamList = {
  CallHistory: { 
    call: CallItem[];
    phoneNumber: string;
    contactName?: string;
  };
  TelecallerPersonNotes: { 
    meeting: {
      id: string;
      name: string;
      time: string;
      duration: string;
      type: string;
      status: string;
      phoneNumber: string;
      contactId?: string;
      contactName?: string;
    };
    contactInfo: {
      name: string;
      phoneNumber: string;
      timestamp: Date;
      duration: number;
    };
  };
  TelecallerCallNoteDetails: { 
    meeting: {
      id: string;
      phoneNumber: string;
      timestamp: Date;
      duration: number;
      type: 'incoming' | 'outgoing' | 'missed';
      status: 'completed' | 'missed' | 'in-progress';
      contactName: string;
      contactId?: string;
    }
  };
};

interface GroupedCalls {
  title: string;
  data: CallItem[];
  totalDuration: number | string;
}

interface RouteParams {
  call: CallItem[];
  phoneNumber: string;
  contactName?: string;
}

const CallHistory = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const [groupedHistory, setGroupedHistory] = useState<GroupedCalls[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactName, setContactName] = useState<string | null>(null);

  const { call: calls, phoneNumber, contactName: initialContactName } = (route.params as RouteParams);

  useEffect(() => {
    const loadCallHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!calls || !Array.isArray(calls)) {
          throw new Error('Invalid call history data');
        }

        // Sort calls by date (newest first)
        const sortedCalls = [...calls].sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Group calls by date
        const groupedByDate = sortedCalls.reduce((groups: GroupedCalls[], call) => {
          const date = new Date(call.timestamp).toLocaleDateString();
          
          const existingGroup = groups.find(g => g.title === date);
          if (existingGroup) {
            existingGroup.data.push(call);
            existingGroup.totalDuration = (Number(existingGroup.totalDuration) + (call.duration || 0));
            return groups;
          }

          groups.push({
            title: date,
            data: [call],
            totalDuration: call.duration || 0
          });
          
          return groups;
        }, []);

        // Format total duration for each group
        const formattedGroups = groupedByDate.map(group => ({
          ...group,
          totalDuration: formatDuration(Number(group.totalDuration))
        }));

        setGroupedHistory(formattedGroups);
        setContactName(initialContactName || null);
      } catch (err) {
        console.error('Error loading call history:', err);
        setError('Failed to load call history. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadCallHistory();
  }, [calls, initialContactName]);

  // Get the display title (contact name or phone number)
  const displayTitle = contactName || phoneNumber || 'Call History';

  const formatDuration = (seconds: number): string => {
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

  const renderCallItem = ({ item }: { item: CallItem }) => (
    <TouchableOpacity 
      style={styles.callItem}
      onPress={() => navigation.navigate('TelecallerPersonNotes', { 
        meeting: {
          id: item.id,
          name: item.contactName || item.phoneNumber,
          time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          duration: formatDuration(item.duration),
          type: item.type,
          status: item.status,
          phoneNumber: item.phoneNumber,
          contactId: item.contactId,
          contactName: item.contactName
        },
        contactInfo: {
          name: item.contactName || item.phoneNumber,
          phoneNumber: item.phoneNumber,
          timestamp: item.timestamp,
          duration: item.duration
        }
      })}
    >
      <View style={styles.callInfo}>
        <MaterialIcons 
          name={item.type === 'outgoing' ? 'call-made' : 'call-received'} 
          size={20} 
          color={item.type === 'missed' ? '#DC2626' : '#059669'}
          style={styles.callIcon}
        />
        <View style={styles.timeContainer}>
          <Text style={styles.time}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#666" />
    </TouchableOpacity>
  );

  const renderDateGroup = ({ item }: { item: GroupedCalls }) => (
    <View style={styles.dateGroup}>
      <View style={styles.dateHeader}>
        <Text style={styles.dateTitle}>{item.title}</Text>
        <Text style={styles.totalDuration}>{item.totalDuration}</Text>
      </View>
      {item.data.map((call) => (
        <React.Fragment key={call.id}>
          {renderCallItem({ item: call })}
        </React.Fragment>
      ))}
    </View>
  );

  if (loading) {
    return (
      <AppGradient>
        <TelecallerMainLayout showDrawer showBackButton={true} title={displayTitle}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF8447"/>
            <Text style={styles.loadingText}>Loading call history...</Text>
          </View>
        </TelecallerMainLayout>
      </AppGradient>
    );
  }

  if (error) {
    return (
      <AppGradient>
        <TelecallerMainLayout showDrawer showBackButton={true} title={displayTitle}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.retryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </TelecallerMainLayout>
      </AppGradient>
    );
  }

  return (
    <AppGradient>
      <TelecallerMainLayout title={displayTitle} showBackButton showDrawer showBottomTabs>
        <LinearGradient 
          colors={['#ffffff', '#f0f4f8', '#fcf1e8']} 
          style={styles.container}
        >
          <View style={styles.header}>
            <Text style={styles.name}>Call History</Text>
            <Text style={styles.phone}>{phoneNumber}</Text>
          </View>

          <FlatList
            data={groupedHistory}
            renderItem={renderDateGroup}
            keyExtractor={(item) => item.title}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        </LinearGradient>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  name: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  phone: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 4,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateTitle: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  totalDuration: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  callInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callIcon: {
    marginRight: 12,
  },
  timeContainer: {
    flexDirection: 'column',
  },
  time: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  duration: {
    fontSize: 12,
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
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'LexendDeca_400Regular',
  },
  retryButton: {
    backgroundColor: '#FF8447',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
  },
});

export default CallHistory; 