import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

type RootStackParamList = {
  CallHistory: { 
    call: any[];
    phoneNumber: string;
    contactName: string;
    notes: CallNote[];
    contactInfo: {
      name: string;
      phoneNumber: string;
      timestamp: Date;
      duration: number;
    };
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
};

type TelecallerPersonNoteProps = {
  route: {
    params: {
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
  };
};

interface CallNote {
  id?: string;
  notes: string;
  status: string;
  timestamp: Date;
  callDuration: number;
  callTimestamp: Date;
  contactName: string;
  type?: 'incoming' | 'outgoing' | 'missed';
  phoneNumber: string;
}

const CALL_NOTES_STORAGE_KEY = 'call_notes';

const TelecallerPersonNotes = ({ route }: TelecallerPersonNoteProps) => {
  const navigation = useNavigation<any>();
  const { meeting, contactInfo } = route.params || {};
  const [allNotes, setAllNotes] = useState<CallNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotes = async () => {
    try {
      if (!meeting.phoneNumber) {
        setAllNotes([]);
        return;
      }

      let fetchedNotes: CallNote[] = [];

      // Try to fetch from Firestore
      try {
        const notesRef = collection(db, 'callNotes');
        const q = query(
          notesRef,
          where('phoneNumber', '==', meeting.phoneNumber),
          orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(q);
        fetchedNotes = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate(),
          callTimestamp: doc.data().callTimestamp.toDate()
        })) as CallNote[];
      } catch (firestoreError) {
        console.error('Error fetching from Firestore:', firestoreError);
      }

      // Fetch from AsyncStorage
      try {
        const storedNotesStr = await AsyncStorage.getItem(CALL_NOTES_STORAGE_KEY);
        if (storedNotesStr) {
          const storedNotes = JSON.parse(storedNotesStr);
          const phoneNotes = storedNotes
            .filter((note: any) => note.phoneNumber === meeting.phoneNumber)
            .map((note: any) => ({
              ...note,
              timestamp: new Date(note.timestamp),
              callTimestamp: new Date(note.callTimestamp)
            }));
          
          // Merge notes from both sources and remove duplicates
          const allNotesCombined = [...fetchedNotes, ...phoneNotes];
          const uniqueNotes = allNotesCombined.reduce((acc: CallNote[], current) => {
            const isDuplicate = acc.find(note => 
              note.timestamp.getTime() === current.timestamp.getTime() && 
              note.notes === current.notes
            );
            if (!isDuplicate) {
              acc.push(current);
            }
            return acc;
          }, []);

          // Sort by timestamp descending
          uniqueNotes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          fetchedNotes = uniqueNotes;
        }
      } catch (asyncError) {
        console.error('Error fetching from AsyncStorage:', asyncError);
      }

      setAllNotes(fetchedNotes);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (meeting.phoneNumber) {
      fetchNotes();
    }
  }, [meeting.phoneNumber]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchNotes();
  }, []);

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    
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

  const handleViewHistory = () => {
    // Create a properly formatted call object with all necessary data
    const callData = allNotes.map(note => ({
      id: note.id || Date.now().toString(),
      phoneNumber: meeting.phoneNumber,
      timestamp: note.callTimestamp,
      duration: note.callDuration,
      type: note.type || 'outgoing',
      status: note.status,
      contactName: note.contactName || contactInfo.name,
      notes: note.notes
    }));

    navigation.navigate('CallHistory', {
      call: callData,
      phoneNumber: meeting.phoneNumber,
      contactName: contactInfo.name,
      notes: allNotes,
      contactInfo: {
        name: contactInfo.name,
        phoneNumber: meeting.phoneNumber,
        timestamp: contactInfo.timestamp,
        duration: contactInfo.duration
      }
    });
  };

  if (!contactInfo || !meeting.phoneNumber) {
    return (
      <LinearGradient colors={['#FFF8F0', '#FFF']} style={styles.container}>
        <TelecallerMainLayout showDrawer showBackButton={true} showBottomTabs={true}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No contact information available</Text>
          </View>
        </TelecallerMainLayout>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FFF8F0', '#FFF']} style={styles.container}>
      <TelecallerMainLayout showDrawer showBackButton={true} showBottomTabs={true} title={meeting.name}>
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Contact Info Card */}
          <View style={styles.contactCard}>
            <Text style={styles.name}>{contactInfo.name}</Text>
            <Text style={styles.phoneNumber}>{contactInfo.phoneNumber}</Text>
            <View style={styles.divider} />
            <View style={styles.lastCallInfo}>
              <Text style={styles.lastCallLabel}>Last Call</Text>
              <Text style={styles.lastCallTime}>
                {format(new Date(contactInfo.timestamp), 'MMM dd, yyyy • hh:mm a')}
              </Text>
              <Text style={styles.lastCallDuration}>
                Duration: {formatDuration(contactInfo.duration)}
              </Text>
            </View>
          </View>

          {/* Notes Section */}
          <View style={styles.notesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Call History</Text>
              <TouchableOpacity onPress={handleViewHistory} style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>View All</Text>
                <MaterialIcons name="chevron-right" size={24} color="#FF8447" />
              </TouchableOpacity>
            </View>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF8447" />
              </View>
            ) : allNotes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No call notes available</Text>
              </View>
            ) : (
              <>
                {allNotes.map((note, index) => (
                  <View key={index} style={styles.noteCard}>
                    <View style={styles.noteHeader}>
                      <Text style={styles.noteDate}>
                        {format(note.callTimestamp, 'MMM dd, yyyy • hh:mm a')}
                      </Text>
                      <Text style={styles.noteDuration}>
                        {formatDuration(note.callDuration)}
                      </Text>
                    </View>

                    <View style={styles.statusContainer}>
                      <Text style={[
                        styles.status,
                        note.status !== 'Mark Status' && styles.statusHighlight
                      ]}>
                        {note.status !== 'Mark Status' ? note.status : 'No Status'}
                      </Text>
                    </View>

                    <View style={styles.noteContent}>
                      <Text style={styles.noteText}>{note.notes}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      </TelecallerMainLayout>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  contactCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  name: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 4,
  },
  phoneNumber: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 12,
  },
  lastCallInfo: {
    marginTop: 8,
  },
  lastCallLabel: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    marginBottom: 4,
  },
  lastCallTime: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    marginBottom: 2,
  },
  lastCallDuration: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#FF8447',
  },
  notesSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  noteCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  noteDate: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  noteDuration: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF8447',
  },
  statusContainer: {
    marginBottom: 12,
  },
  status: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  statusHighlight: {
    color: '#FF8447',
  },
  noteContent: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  noteText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF8447',
    marginRight: 4,
  },
});

export default TelecallerPersonNotes;