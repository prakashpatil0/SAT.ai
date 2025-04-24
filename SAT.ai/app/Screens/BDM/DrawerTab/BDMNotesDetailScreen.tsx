import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/firebaseConfig';
import AppGradient from '@/app/components/AppGradient';

// Define the Note interface
interface Note {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: Date;
  date: string;
  userId: string;
}

// Define the navigation param list type
type RootStackParamList = {
  BDMMyNotesScreen: undefined;
  BDMNotesDetailScreen: { note: Note };
};

// Define the navigation prop type
type BDMNotesDetailScreenNavigationProp = StackNavigationProp<RootStackParamList>;
type BDMNotesDetailScreenRouteProp = RouteProp<RootStackParamList, 'BDMNotesDetailScreen'>;

// Storage key for notes
const NOTES_STORAGE_KEY = 'bdm_user_notes';

const BDMNotesDetailScreen = () => {
  const navigation = useNavigation<BDMNotesDetailScreenNavigationProp>();
  const route = useRoute<BDMNotesDetailScreenRouteProp>();
  const { note } = route.params;
  

  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isPinned, setIsPinned] = useState(note.isPinned);
  const [isSaving, setIsSaving] = useState(false);

  
  // Format date for display
  const formatDate = (date: Date) => {
    if (!date) return 'Unknown date';
    
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    
    return new Date(date).toLocaleDateString('en-US', options);
  };

  // Save note changes
  const saveNote = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your note');
      return;
    }
    
    try {
      setIsSaving(true);
      
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        setIsSaving(false);
        return;
      }
      
      // Get existing notes
      const storedNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY + "_" + userId);
      let notes: Note[] = [];
      
      if (storedNotes) {
        notes = JSON.parse(storedNotes);
      }
      
      // Update the note
      const updatedNotes = notes.map(existingNote => {
        if (existingNote.id === note.id) {
          return {
            ...existingNote,
            title,
            content,
            isPinned
          };
        }
        return existingNote;
      });
      
      // Sort notes: pinned first, then by creation date
      const sortedNotes = updatedNotes.sort((a, b) => {
        // First sort by pin status
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        
        // Then sort by date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(NOTES_STORAGE_KEY + "_" + userId, JSON.stringify(sortedNotes));
      
      setEditMode(false);
      setIsSaving(false);
      Alert.alert('Success', 'Note updated successfully');
    } catch (error) {
      console.error('Error updating note:', error);
      Alert.alert('Error', 'Failed to update note');
      setIsSaving(false);
    }
  };

  // Toggle pin status
  const togglePinStatus = async () => {
    try {
      const newPinState = !isPinned;
      setIsPinned(newPinState);
      
      if (!editMode) {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        
        // Get existing notes
        const storedNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY + "_" + userId);
        let notes: Note[] = [];
        
        if (storedNotes) {
          notes = JSON.parse(storedNotes);
        }
        
        // Update the note
        const updatedNotes = notes.map(existingNote => {
          if (existingNote.id === note.id) {
            return {
              ...existingNote,
              isPinned: newPinState
            };
          }
          return existingNote;
        });
        
        // Sort notes: pinned first, then by creation date
        const sortedNotes = updatedNotes.sort((a, b) => {
          // First sort by pin status
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          
          // Then sort by date (newest first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        // Save to AsyncStorage
        await AsyncStorage.setItem(NOTES_STORAGE_KEY + "_" + userId, JSON.stringify(sortedNotes));
      }
    } catch (error) {
      console.error('Error updating pin status:', error);
      Alert.alert('Error', 'Failed to update pin status');
      setIsPinned(isPinned); // Revert back on error
    }
  };

  // Discard changes confirmation
  const confirmDiscard = () => {
    if (title !== note.title || content !== note.content || isPinned !== note.isPinned) {
      Alert.alert(
        'Discard Changes',
        'Are you sure you want to discard your changes?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Discard', 
            onPress: () => {
              setTitle(note.title);
              setContent(note.content);
              setIsPinned(note.isPinned);
              setEditMode(false);
            }, 
            style: 'destructive' 
          }
        ]
      );
    } else {
      setEditMode(false);
    }
  };

  return (
    <AppGradient>
    <BDMMainLayout title={editMode ? "Edit Note" : "Note Details"} showBackButton>
      <View style={styles.headerActions}>
        {editMode ? (
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={confirmDiscard} style={styles.headerButton}>
              <MaterialIcons name="close" size={24} color="#757575" />
            </TouchableOpacity>
            <TouchableOpacity onPress={saveNote} style={styles.headerButton} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#FF7B42" />
              ) : (
                <MaterialIcons name="check" size={24} color="#FF7B42" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditMode(true)} style={styles.headerButton}>
            <MaterialIcons name="edit" size={24} color="#FF7B42" />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.noteContainer}>
            {editMode ? (
              // Edit Mode View
              <>
                <View style={styles.pinnedRow}>
                  <TouchableOpacity 
                    style={styles.pinnedButton} 
                    onPress={togglePinStatus}
                  >
                    <MaterialIcons
                      name="push-pin"
                      size={20}
                      color={isPinned ? "#FF7B42" : "#757575"}
                    />
                    <Text style={[styles.pinnedText, isPinned && styles.pinnedActive]}>
                      {isPinned ? "Pinned" : "Pin to top"}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <TextInput
                  style={styles.titleInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Title"
                  placeholderTextColor="#9E9E9E"
                  maxLength={50}
                />
                
                <TextInput
                  style={styles.contentInput}
                  value={content}
                  onChangeText={setContent}
                  placeholder="Write your note here..."
                  placeholderTextColor="#9E9E9E"
                  multiline
                  textAlignVertical="top"
                />
              </>
            ) : (
              // View Mode
              <>
                <View style={styles.noteHeader}>
                  <View style={styles.titleContainer}>
                    <Text style={styles.title}>{title}</Text>
                    {isPinned && (
                      <MaterialIcons name="push-pin" size={20} color="#FF7B42" style={styles.pinIcon} />
                    )}
                  </View>
                  <Text style={styles.date}>{formatDate(note.createdAt)}</Text>
                </View>
                
                <View style={styles.divider} />
                
                <ScrollView style={styles.contentContainer}>
                  <Text style={styles.content}>{content || "No content"}</Text>
                </ScrollView>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  noteContainer: {
    padding: 20,
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    marginHorizontal: 10,
    borderWidth:1,
    borderColor: '#E0E0E0',
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 5,
  },
  noteHeader: {
    marginBottom: 15,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: 'LexendDeca_600SemiBold',
    fontSize: 22,
    color: '#333',
    marginBottom: 5,
    flexShrink: 1,
  },
  pinIcon: {
    marginLeft: 8,
  },
  date: {
    fontFamily: 'LexendDeca_400Regular',
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 10,
  },
  contentContainer: {
    flex: 1,
    marginTop: 10,
  },
  content: {
    fontFamily: 'LexendDeca_400Regular',
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  pinnedRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  pinnedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  pinnedText: {
    fontFamily: 'LexendDeca_400Regular',
    fontSize: 14,
    color: '#757575',
    marginLeft: 5,
  },
  pinnedActive: {
    color: '#FF7B42',
  },
  titleInput: {
    fontFamily: 'LexendDeca_600SemiBold',
    fontSize: 20,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingVertical: 10,
    marginBottom: 15,
  },
  contentInput: {
    fontFamily: 'LexendDeca_400Regular',
    fontSize: 16,
    color: '#555',
    flex: 1,
    height: 400,
    textAlignVertical: 'top',
    lineHeight: 24,
    paddingTop: 10,
  },
  threeDotsButton: {
    padding: 5,
  },
  optionsPopup: {
    backgroundColor: '#FFF',
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 10,
    borderRadius: 8,
    elevation: 5,
    width: 120,
    marginTop: 5,
    zIndex: 10,
  },
  optionButton: {
    paddingVertical: 5,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 14,
    color: '#000',
  },
});

export default BDMNotesDetailScreen;
