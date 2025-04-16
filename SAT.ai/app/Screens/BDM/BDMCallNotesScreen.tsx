import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';

// Define types
type RootStackParamList = {
  BDMHomeScreen: undefined;
  BDMCreateFollowUp: {
    contactName: string;
    phoneNumber?: string;
    notes: string;
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
  };
};

type CallNoteDetailsScreenProps = {
  route: RouteProp<RootStackParamList, 'BDMCallNoteDetailsScreen'>;
};

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
}

// Define AsyncStorage key
const CALL_NOTES_STORAGE_KEY = 'bdm_call_notes';

const CallNoteDetailsScreen: React.FC<CallNoteDetailsScreenProps> = ({ route }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [status, setStatus] = useState('Mark Status');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { meeting } = route.params;

  const statusOptions = ['Prospect', 'Suspect', 'Closing'];

  const handleStatusSelect = (selectedStatus: string) => {
    setStatus(selectedStatus);
    setShowStatusModal(false);
  };

  const handleFollowUpPress = () => {
    setFollowUp(!followUp);
    if (!followUp) {
      navigation.navigate('BDMCreateFollowUp', {
        contactName: meeting.name,
        phoneNumber: meeting.phoneNumber,
        notes,
      });
    }
  };
  

  const handleSubmit = async () => {
    if (notes.trim().length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    try {
      setIsSaving(true);

      if (!meeting) {
        throw new Error('Meeting information is missing');
      }

      // Ensure we have a valid timestamp
      const validTimestamp = meeting.timestamp 
        ? (meeting.timestamp instanceof Date 
          ? meeting.timestamp 
          : new Date(meeting.timestamp))
        : new Date();

      // Create a unique call ID using timestamp and phone number
      const callId = `${meeting.phoneNumber || 'unknown'}_${validTimestamp.getTime()}`;

      const noteData = {
        callId,
        phoneNumber: meeting.phoneNumber || 'unknown',
        contactName: meeting.name || 'Unknown Contact',
        notes,
        status,
        timestamp: new Date().toISOString(),
        followUp,
        callTimestamp: validTimestamp.toISOString(),
        callDuration: meeting.duration || 0,
        type: meeting.type || 'outgoing'
      };

      // Save to AsyncStorage
      try {
        const existingNotesStr = await AsyncStorage.getItem(CALL_NOTES_STORAGE_KEY);
        const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : [];
        
        // Remove any existing note for this call
        const filteredNotes = existingNotes.filter((note: any) => 
          note.callId !== callId && 
          new Date(note.callTimestamp).getTime() !== validTimestamp.getTime()
        );
        
        // Add the new note
        filteredNotes.push({
          ...noteData,
          id: Date.now().toString()
        });

        await AsyncStorage.setItem(CALL_NOTES_STORAGE_KEY, JSON.stringify(filteredNotes));
      } catch (asyncError) {
        console.error('AsyncStorage save failed:', asyncError);
        throw new Error('Failed to save note to AsyncStorage');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Create contact info object with fallback values
      const contactInfo = {
        name: meeting.name || 'Unknown Contact',
        phoneNumber: meeting.phoneNumber || 'unknown',
        timestamp: validTimestamp,
        duration: meeting.duration?.toString() || '0s'
      };
      
      // Navigate to BDMPersonNote with properly formatted timestamp
      navigation.navigate('BDMPersonNote', {
        name: meeting.name || 'Unknown Contact',
        time: format(validTimestamp, 'hh:mm a'),
        duration: meeting.duration?.toString() || '0s',
        status: status !== 'Mark Status' ? status : 'No Status',
        notes: [notes],
        phoneNumber: meeting.phoneNumber,
        contactInfo
      });
    } catch (error) {
      console.error('Error saving call notes:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to save the note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppGradient>
    <BDMMainLayout title="Call Notes" showBackButton={true} showDrawer={true} showBottomTabs={true}>
      <View style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{meeting.name}</Text>
            <Text style={styles.headerSubtitle}>{meeting.time} • {meeting.duration}</Text>
          </View>
          <TouchableOpacity style={styles.playButton}>
            <MaterialIcons name="play-circle-outline" size={28} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Status Dropdown Button */}
        <TouchableOpacity 
          style={styles.statusButton}
          onPress={() => setShowStatusModal(true)}
        >
          <Text style={styles.statusText}>{status}</Text>
          <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
        </TouchableOpacity>

        {/* Status Modal */}
        <Modal
          visible={showStatusModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStatusModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowStatusModal(false)}
          >
            <View style={styles.modalContent}>
              {statusOptions.map((option, index) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.statusOption,
                    index < statusOptions.length - 1 && styles.statusOptionBorder
                  ]}
                  onPress={() => handleStatusSelect(option)}
                >
                  <Text style={styles.statusOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Notes Section */}
        <View style={styles.notesContainer}>
          <TextInput
            style={styles.notesInput}
            placeholder="Add Meeting Notes"
            placeholderTextColor="#999"
            multiline
            value={notes}
            onChangeText={setNotes}
          />
          <Text style={styles.characterCount}>{notes.length}/500</Text>
          <TouchableOpacity 
            style={[styles.submitButton, (notes.length === 0 || isSaving) && styles.submitButtonDisabled]}
            disabled={notes.length === 0 || isSaving}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>
              {isSaving ? 'Saving...' : 'Submit'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Follow Up Checkbox */}
        <TouchableOpacity 
          style={styles.followUpContainer}
          onPress={handleFollowUpPress}
        >
          <View style={[styles.checkbox, followUp && styles.checkboxChecked]}>
            {followUp && <MaterialIcons name="check" size={16} color="#FFF" />}
          </View>
          <Text style={styles.followUpText}>Follow up on this call</Text>
        </TouchableOpacity>
      </View>
    </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  gradient: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#FFF',
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 4,
  },
  playButton: {
    padding: 8,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  notesContainer: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  notesInput: {
    height: 120,
    textAlignVertical: 'top',
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
  },
  characterCount: {
    alignSelf: 'flex-start',
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#FF7A45',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
  },
  followUpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF8447',
    borderColor: '#FF8447',
  },
  followUpText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 120,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  statusOption: {
    padding: 16,
  },
  statusOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  statusOptionText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
});

export default CallNoteDetailsScreen;