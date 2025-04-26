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
    status: string;
    notes: string[];
    phoneNumber?: string;
    contactInfo: {
      name: string;
      phoneNumber?: string;
      timestamp: Date;
      duration: string;
    };
    contactIdentifier: string;
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
      timestamp?: Date | string;
    }
  };
};

type PersonNoteScreenProps = {
  route: {
    params: {
      name: string;
      time: string;
      duration: string;
      status: string;
      notes: string[];
      phoneNumber?: string;
      contactInfo: {
        name: string;
        phoneNumber?: string;
        timestamp: Date;
        duration: string;
      };
      contactIdentifier: string;
    };
  };
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

type Note = {
  id: string;
  contactIdentifier: string;
  phoneNumber?: string;
  contactName?: string;
  notes: string;
  timestamp: string;
  status: string;
  followUp: boolean;
  userId: string;
  createdAt: number;
  userName?: string;
};

// Define AsyncStorage key (same as in BDMCallNoteDetailsScreen)
const CALL_NOTES_STORAGE_KEY = 'bdm_call_notes';

const BDMPersonNote: React.FC<PersonNoteScreenProps> = ({ route }) => {
  const navigation = useNavigation<NavigationProp>();
  const { name, time, duration, status, notes: initialNotes, phoneNumber, contactInfo, contactIdentifier } = route.params;
  const [savedNotes, setSavedNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSavedNotes();
  }, [contactIdentifier]);

  const fetchSavedNotes = async () => {
    try {
      setIsLoading(true);
      
      // Get existing notes from AsyncStorage
      const storedNotes = await AsyncStorage.getItem(CALL_NOTES_STORAGE_KEY);
      
      if (storedNotes) {
        const allNotes = JSON.parse(storedNotes);
        
        // Get notes for this specific contact
        const contactNotes = allNotes[contactIdentifier] || [];
        
        // Sort by timestamp (newest first)
        contactNotes.sort((a: Note, b: Note) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        setSavedNotes(contactNotes);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setIsLoading(false);
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

  const handleAddNote = () => {
    // Create a default contact info if none exists
    const defaultContactInfo = {
      name: name || 'Unknown Contact',
      phoneNumber: phoneNumber || 'unknown',
      timestamp: new Date(),
      duration: duration || '0s'
    };

    // Use provided contactInfo or default
    const validContactInfo = contactInfo || defaultContactInfo;

    // Ensure we have a valid timestamp
    const validTimestamp = validContactInfo.timestamp instanceof Date 
      ? validContactInfo.timestamp 
      : new Date(validContactInfo.timestamp);

    navigation.navigate('BDMCallNoteDetailsScreen', {
      meeting: {
        name: validContactInfo.name,
        time: format(validTimestamp, 'hh:mm a'),
        duration: validContactInfo.duration,
        phoneNumber: validContactInfo.phoneNumber,
        type: 'outgoing',
        contactType: 'person',
        timestamp: validTimestamp
      }
    });
  };
  
  // Replace your current getStatusColor function with this:
const getStatusColor = (status?: string) => {
  // Handle undefined/null status
  if (!status) return '#FF8447'; // Default orange
  
  // Convert to lowercase and trim whitespace
  const normalizedStatus = status.toString().toLowerCase().trim();
  
  switch(normalizedStatus) {
    case 'prospect':
      return '#FFD700'; // Gold
    case 'suspect':
      return '#87CEEB'; // Sky blue
    case 'closing':
      return '#32CD32'; // Lime green
    case 'present':
      return '#4CAF50'; // Green
    case 'half day':
      return '#FFC107'; // Amber
    case 'absent':
      return '#FF5252'; // Red
    default:
      return '#FF8447'; // Default orange
  }
};
  return (
    <AppGradient>
    <BDMMainLayout title={name} showBackButton showDrawer={true} showBottomTabs={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.contactInfo}>
            <Text style={styles.name}>{name}</Text>
            <View style={styles.callDetails}>
              <Text style={styles.time}>{time}</Text>
              <Text style={styles.duration}>{duration}</Text>
            </View>
            {phoneNumber && (
              <Text style={styles.phoneNumber}>{phoneNumber}</Text>
            )}
          </View>
          <View 
            style={[
              styles.statusBadge, 
              { backgroundColor: getStatusColor(status) }
            ]}
          >
            <Text style={styles.statusText}>{status}</Text>
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
                  onPress={handleAddNote}
                >
                  <MaterialIcons name="add" size={20} color="#FFF" />
                  <Text style={styles.addNoteText}>Add Note</Text>
                </TouchableOpacity>
              </View>
              
              {savedNotes.length === 0 && (!initialNotes || initialNotes.length === 0) ? (
                <View style={styles.emptyNotesContainer}>
                  <MaterialIcons name="description" size={48} color="#CCCCCC" />
                  <Text style={styles.emptyNotesText}>No notes for this call</Text>
                  <TouchableOpacity 
                    style={styles.createNoteButton}
                    onPress={handleAddNote}
                  >
                    <Text style={styles.createNoteButtonText}>Add Note</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Saved notes from AsyncStorage */}
                  {savedNotes.map((note, index) => (
                    <View key={`saved-${note.id}`} style={styles.noteCard}>
                      <View style={styles.noteHeader}>
                        <Text style={styles.noteTimestamp}>
                          {format(new Date(note.timestamp), 'MMM d, yyyy h:mm a')}
                        </Text>
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