import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from "expo-linear-gradient";
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/firebaseConfig';
import { format } from 'date-fns';
import AppGradient from '@/app/components/AppGradient';

type RootStackParamList = {
  BDMPersonNote: {
    name: string;
    time: string;
    duration: string;
    type: string;
    notes: string[];
    phoneNumber?: string;
    date?: string;
  };
  BDMCreateFollowUp: {
    contactName?: string;
    phoneNumber?: string;
    notes?: string;
  };
  BDMCallNoteDetailsScreen: {
    meeting: {
      name: string;
      time: string;
      duration: string;
      phoneNumber?: string;
      date?: string;
      type?: 'incoming' | 'outgoing' | 'missed';
      contactType?: 'person' | 'company';
    }
  };
};

type PersonNoteScreenProps = {
  route: RouteProp<RootStackParamList, 'BDMPersonNote'>;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface Note {
  id: string;
  contactName: string;
  phoneNumber?: string;
  date: string;
  time: string;
  duration: string;
  notes: string;
  status: string;
  followUp: boolean;
  userId: string;
  createdAt: number;
  userName?: string;
}

// Define AsyncStorage key (same as in BDMCallNoteDetailsScreen)
const CALL_NOTES_STORAGE_KEY = 'bdm_call_notes';

const BDMPersonNote: React.FC<PersonNoteScreenProps> = ({ route }) => {
  const navigation = useNavigation<NavigationProp>();
  const { name, time, duration, type, notes: initialNotes, phoneNumber, date } = route.params;
  const [savedNotes, setSavedNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSavedNotes();
  }, []);

  const fetchSavedNotes = async () => {
    try {
      setIsLoading(true);
      const userId = auth.currentUser?.uid;
      
      if (!userId) {
        setIsLoading(false);
        return;
      }
      
      // Get existing notes from AsyncStorage
      const storedNotes = await AsyncStorage.getItem(CALL_NOTES_STORAGE_KEY + "_" + userId);
      
      if (storedNotes) {
        const allNotes: Note[] = JSON.parse(storedNotes);
        
        // Filter notes by phone number or contact name
        const contactNotes = allNotes.filter(note => 
          (phoneNumber && note.phoneNumber === phoneNumber) || 
          (note.contactName && note.contactName.toLowerCase() === name.toLowerCase())
        );
        
        // Sort by creation date (newest first)
        contactNotes.sort((a, b) => b.createdAt - a.createdAt);
        
        setSavedNotes(contactNotes);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'prospect':
        return '#FFD700'; // Gold
      case 'suspect':
        return '#87CEEB'; // Sky blue
      case 'closing':
        return '#32CD32'; // Lime green
      default:
        return '#FF8447'; // Default orange
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return format(date, 'MMM d, yyyy h:mm a');
  };

  const navigateToCreateFollowUp = () => {
    navigation.navigate('BDMCreateFollowUp', {
      contactName: name,
      phoneNumber: phoneNumber,
      notes: savedNotes.length > 0 ? `Previous note: ${savedNotes[0].notes}` : ''
    });
  };

  return (
    <AppGradient>
    <BDMMainLayout title={name} showBackButton showDrawer={true} showBottomTabs={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.contactInfo}>
            <Text style={styles.name}>{name}</Text>
            <View style={styles.callDetails}>
              <Text style={styles.time}>{date ? `${date} • ` : ''}{time}</Text>
              <Text style={styles.duration}>{duration}</Text>
            </View>
            {phoneNumber && (
              <Text style={styles.phoneNumber}>{phoneNumber}</Text>
            )}
          </View>
          <View 
            style={[
              styles.statusBadge, 
              { backgroundColor: getStatusColor(type) }
            ]}
          >
            <Text style={styles.statusText}>{type}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF8447" />
            <Text style={styles.loadingText}>Loading notes...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.contentContainer}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="notes" size={24} color="#FF8447" />
                <Text style={styles.sectionTitle}>Notes</Text>
                <TouchableOpacity 
                  style={styles.addNoteButton}
                  onPress={navigateToCreateFollowUp}
                >
                  <MaterialIcons name="add" size={20} color="#FFF" />
                  <Text style={styles.addNoteText}>Follow Up</Text>
                </TouchableOpacity>
              </View>
              
              {(savedNotes.length > 0 || (initialNotes && initialNotes.length > 0)) ? (
                <>
                  {/* Saved notes from AsyncStorage */}
                  {savedNotes.map((note, index) => (
                    <View key={`saved-${note.id}`} style={styles.noteCard}>
                      <View style={styles.noteHeader}>
                        <Text style={styles.noteTimestamp}>{formatTimestamp(note.createdAt)}</Text>
                        {note.followUp && (
                          <View style={styles.followUpTag}>
                            <MaterialIcons name="event" size={12} color="#FFF" />
                            <Text style={styles.followUpTagText}>Follow-up</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.noteText}>{note.notes}</Text>
                      <View style={styles.noteFooter}>
                        <Text style={styles.noteStatus}>Status: <Text style={styles.statusValue}>{note.status}</Text></Text>
                        <Text style={styles.noteNumber}>Note {savedNotes.length - index}</Text>
                      </View>
                    </View>
                  ))}
                  
                  {/* Initial notes passed from route params */}
                  {initialNotes && initialNotes.map((note, index) => (
                    <View key={`initial-${index}`} style={styles.noteCard}>
                      <Text style={styles.noteText}>{note}</Text>
                      <Text style={styles.noteNumber}>Call Note {index + 1}</Text>
                    </View>
                  ))}
                </>
              ) : (
                <View style={styles.emptyNotesContainer}>
                  <MaterialIcons name="description" size={48} color="#CCCCCC" />
                  <Text style={styles.emptyNotesText}>No notes for this call</Text>
                  <TouchableOpacity 
                    style={styles.createNoteButton}
                    onPress={() => {
                      navigation.navigate('BDMCallNoteDetailsScreen', {
                        meeting: {
                          name: name,
                          time: time,
                          duration: duration,
                          phoneNumber: phoneNumber,
                          date: date,
                          type: 'outgoing',
                          contactType: 'person'
                        }
                      });
                    }}
                  >
                    <Text style={styles.createNoteButtonText}>Add Note</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  contactInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333333',
    marginBottom: 4,
  },
  callDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666666',
    marginRight: 8,
  },
  duration: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666666',
  },
  phoneNumber: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666666',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FFFFFF',
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666666',
    marginTop: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333333',
    marginLeft: 8,
    flex: 1,
  },
  addNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8447',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addNoteText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  noteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteTimestamp: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999999',
  },
  followUpTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  followUpTagText: {
    fontSize: 10,
    fontFamily: 'LexendDeca_400Regular',
    color: '#FFFFFF',
    marginLeft: 2,
  },
  noteText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333333',
    lineHeight: 24,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  noteStatus: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666666',
  },
  statusValue: {
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF8447',
  },
  noteNumber: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999999',
  },
  emptyNotesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyNotesText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999999',
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  createNoteButton: {
    backgroundColor: '#FF8447',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createNoteButtonText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FFFFFF',
  },
});

export default BDMPersonNote;