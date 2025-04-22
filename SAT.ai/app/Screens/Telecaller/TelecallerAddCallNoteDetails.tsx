import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AppGradient from '@/app/components/AppGradient';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { getAuth } from 'firebase/auth';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Meeting {
  id: string;
  phoneNumber: string;
  timestamp: Date | string | number; // Can be Date, string, or number
  duration: number;
  type: 'incoming' | 'outgoing' | 'missed';
  status: 'completed' | 'missed' | 'in-progress';
  contactId?: string;
  contactName?: string;
}

type RootStackParamList = {
  TelecallerCreateFollowUp: { meeting: Meeting };
  TelecallerCallNoteDetails: { meeting: Meeting };
  TelecallerPersonNotes: { 
    name: string; 
    time: string; 
    duration: string; 
    status: string; 
    notes: string[]; 
    phoneNumber: string;
    contactInfo: {
      name: string;
      phoneNumber: string;
      timestamp: Date;
      duration: number;
    };
  };
};

const TelecallerCallNoteDetails = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [status, setStatus] = useState('Mark Status');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const { meeting } = route.params as { meeting: Meeting };

  // Helper function to safely parse dates
  const parseDate = (dateValue: Date | string | number): Date => {
    if (dateValue instanceof Date) {
      return dateValue;
    }
    // If it's a string or number, try to parse it
    const parsedDate = new Date(dateValue);
    if (isNaN(parsedDate.getTime())) {
      // If parsing fails, return current date as fallback
      return new Date();
    }
    return parsedDate;
  };

  // Ensure we have a valid timestamp
  const callTimestamp = parseDate(meeting.timestamp);

  const statusOptions = ['Prospect', 'Suspect', 'Closing'];

  const handleStatusSelect = (selectedStatus: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStatus(selectedStatus);
    setShowStatusModal(false);
  };

  const handleFollowUpPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFollowUp(!followUp);
    if (!followUp) {
      navigation.navigate('TelecallerCreateFollowUp', { meeting });
    }
  };

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

  const CALL_NOTES_STORAGE_KEY = 'call_notes';

  const handleSubmit = async () => {
    if (notes.trim().length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    try {
      const auth = getAuth();
      const userId = auth.currentUser?.uid;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Create a unique call ID using timestamp and phone number
      const callId = `${meeting.phoneNumber}_${callTimestamp.getTime()}`;

      const noteData = {
        userId,
        callId,
        phoneNumber: meeting.phoneNumber,
        contactName: meeting.contactName || meeting.phoneNumber,
        notes,
        status,
        timestamp: new Date().toISOString(),
        followUp,
        callTimestamp: callTimestamp.toISOString(),
        callDuration: meeting.duration,
        type: meeting.type || 'outgoing'
      };

      // Save to AsyncStorage
      try {
        const existingNotesStr = await AsyncStorage.getItem(CALL_NOTES_STORAGE_KEY);
        const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : [];
        
        // Remove any existing note for this call
        const filteredNotes = existingNotes.filter((note: any) => 
          note.callId !== callId && 
          new Date(note.callTimestamp).getTime() !== callTimestamp.getTime()
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
      
      // Navigate to TelecallerPersonNotes with properly formatted timestamp
      navigation.navigate('TelecallerPersonNotes', {
        phoneNumber: meeting.phoneNumber,
        name: meeting.contactName || meeting.phoneNumber,
        time: format(callTimestamp, 'hh:mm a'),
        duration: formatDuration(meeting.duration),
        status: status !== 'Mark Status' ? status : 'No Status',
        notes: [notes],
        // phoneNumber: meeting.phoneNumber,
        contactInfo: {
          name: meeting.contactName || meeting.phoneNumber,
          phoneNumber: meeting.phoneNumber,
          timestamp: callTimestamp,
          duration: meeting.duration
        }
      });
    } catch (error) {
      console.error('Error saving call notes:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBackButton={true} showBottomTabs={true} title={meeting.contactName || meeting.phoneNumber}>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>
                {meeting.phoneNumber}
              </Text>
              <Text style={styles.timeText}>
                {format(callTimestamp, 'hh:mm a')} • {formatDuration(meeting.duration)}
              </Text>
            </View>
          </View>

          {/* Status Dropdown */}
          <TouchableOpacity 
            style={styles.statusButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowStatusModal(true);
            }}
          >
            <Text style={[
              styles.statusText,
              status !== 'Mark Status' && styles.selectedStatusText
            ]}>
              {status}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
          </TouchableOpacity>

          {/* Notes Input */}
          <View style={styles.notesContainer}>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes here..."
              placeholderTextColor="#A4A4A4"
              multiline
              value={notes}
              onChangeText={setNotes}
              maxLength={120}
            />
            <View style={styles.notesFooter}>
              <Text style={[
                styles.characterCount,
                notes.length === 120 && styles.characterCountLimit
              ]}>
                {notes.length}/120
              </Text>
              <TouchableOpacity 
                style={[
                  styles.submitButton,
                  notes.length === 0 && styles.submitButtonDisabled
                ]}
                disabled={notes.length === 0}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
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
        </ScrollView>

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
                    index < statusOptions.length - 1 && styles.statusOptionBorder,
                    status === option && styles.selectedStatusOption
                  ]}
                  onPress={() => handleStatusSelect(option)}
                >
                  <Text style={[
                    styles.statusOptionText,
                    status === option && styles.selectedStatusOptionText
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
  headerSection: {
    marginBottom: 24,
    // backgroundColor: '#FFFFFF',
    padding: 16,
    // borderRadius: 12,
    // elevation: 2,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.1,
    // shadowRadius: 4,
  },
  titleRow: {
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 12,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  selectedStatusText: {
    color: '#FF8447',
    fontFamily: 'LexendDeca_500Medium',
  },
  notesContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  notesInput: {
    height: 120,
    textAlignVertical: 'top',
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    padding: 0,
  },
  notesFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  characterCount: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  characterCountLimit: {
    color: '#DC2626',
  },
  submitButton: {
    backgroundColor: '#FF8447',
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#FFD5C2',
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
    borderRadius: 6,
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
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    elevation: 4,
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
    color: '#333',
  },
  selectedStatusOption: {
    backgroundColor: '#FFF5E6',
  },
  selectedStatusOptionText: {
    color: '#FF8447',
    fontFamily: 'LexendDeca_500Medium',
  },
});

export default TelecallerCallNoteDetails; 