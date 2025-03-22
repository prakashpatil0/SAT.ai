import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BDMMainLayout from "@/app/components/BDMMainLayout";
import { auth } from '@/firebaseConfig';
import AppGradient from '@/app/components/AppGradient';

// Define navigation types
type RootStackParamList = {
  BDMHomeScreen: undefined;
  BDMNotesDetailScreen: { note: Note };
};

type BDMMyNotesScreenNavigationProp = StackNavigationProp<RootStackParamList>;

// Define type for notes
interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  createdAt: Date;
  isPinned: boolean;
  userId: string;
}

// Function to truncate content
const truncateContent = (content: string, length = 90) => {
  return content.length > length ? content.substring(0, length) + '...' : content;
};

// Format date for display
const formatDate = (date: Date) => {
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};

// Storage key for notes
const NOTES_STORAGE_KEY = 'bdm_user_notes';

const BDMMyNotesScreen = () => {
  const navigation = useNavigation<BDMMyNotesScreenNavigationProp>();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Animation for FAB
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { width } = Dimensions.get('window');
  
  // Fetch notes from AsyncStorage
  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setError("User not authenticated");
        setLoading(false);
        return;
      }
      
      // Get notes from AsyncStorage
      const storedNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY + "_" + userId);
      
      if (storedNotes) {
        const parsedNotes: Note[] = JSON.parse(storedNotes);
        
        // Sort notes: pinned first, then by creation date
        const sortedNotes = parsedNotes.sort((a, b) => {
          // First sort by pin status
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          
          // Then sort by date (newest first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        setNotes(sortedNotes);
      } else {
        setNotes([]);
      }
    } catch (err) {
      console.error("Error fetching notes:", err);
      setError("Failed to load notes. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Save notes to AsyncStorage
  const saveNotesToStorage = async (updatedNotes: Note[]) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      
      await AsyncStorage.setItem(NOTES_STORAGE_KEY + "_" + userId, JSON.stringify(updatedNotes));
    } catch (err) {
      console.error("Error saving notes to storage:", err);
      Alert.alert("Error", "Failed to save notes to device storage.");
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchNotes();
    
    // Animation for FAB
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    );
    
    // Start the animation after a delay
    const timeout = setTimeout(() => {
      pulseAnimation.start();
    }, 1000);
    
    return () => {
      clearTimeout(timeout);
      pulseAnimation.stop();
    };
  }, []);
  
  // Navigate back
  const handleBackPress = () => {
    navigation.navigate('BDMHomeScreen');
  };
  
  // Add new note
  const handleAddNote = async () => {
    try {
      if (!newNoteTitle.trim()) {
        Alert.alert("Error", "Please enter a title for your note");
        return;
      }
      
      if (!newNoteContent.trim()) {
        Alert.alert("Error", "Please enter content for your note");
        return;
      }
      
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Error", "User not authenticated");
        return;
      }
      
      const currentDate = new Date();
      
      // Create new note
      const newNote: Note = {
        id: Date.now().toString(), // Generate a simple unique ID
        title: newNoteTitle.trim(),
        content: newNoteContent.trim(),
        date: formatDate(currentDate),
        createdAt: currentDate,
        isPinned: false,
        userId
      };
      
      // Add to existing notes
      const updatedNotes = [...notes, newNote];
      
      // Save to AsyncStorage
      await saveNotesToStorage(updatedNotes);
      
      // Update state
      setNotes(updatedNotes);
      
      // Reset form and close modal
      setNewNoteTitle('');
      setNewNoteContent('');
      setModalVisible(false);
      
      Alert.alert("Success", "Note added successfully");
    } catch (err) {
      console.error("Error adding note:", err);
      Alert.alert("Error", "Failed to add note. Please try again.");
    }
  };
  
  // Delete note
  const handleDeleteNote = (noteId: string) => {
    Alert.alert(
      "Delete Note",
      "Are you sure you want to delete this note?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              // Filter out the note to delete
              const updatedNotes = notes.filter(note => note.id !== noteId);
              
              // Save to AsyncStorage
              await saveNotesToStorage(updatedNotes);
              
              // Update state
              setNotes(updatedNotes);
              
              Alert.alert("Success", "Note deleted successfully");
            } catch (err) {
              console.error("Error deleting note:", err);
              Alert.alert("Error", "Failed to delete note. Please try again.");
            }
          }
        }
      ]
    );
  };
  
  // Toggle pin status
  const togglePinStatus = async (noteId: string, currentPinStatus: boolean) => {
    try {
      // Update pin status in notes array
      const updatedNotes = notes.map(note => {
        if (note.id === noteId) {
          return { ...note, isPinned: !currentPinStatus };
        }
        return note;
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
      await saveNotesToStorage(sortedNotes);
      
      // Update state
      setNotes(sortedNotes);
    } catch (err) {
      console.error("Error updating pin status:", err);
      Alert.alert("Error", "Failed to update note. Please try again.");
    }
  };
  
  // Navigate to note details
  const navigateToNoteDetails = (note: Note) => {
    navigation.navigate('BDMNotesDetailScreen', { note });
  };
  
  if (loading && !refreshing) {
    return (
      <BDMMainLayout title="My Notes" showBackButton showDrawer={true}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF8447" />
          <Text style={styles.loadingText}>Loading notes...</Text>
        </View>
      </BDMMainLayout>
    );
  }

  return (
    <AppGradient>
    <BDMMainLayout title="My Notes" showBackButton showDrawer={true}>
      <View style={styles.container}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={fetchNotes}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : notes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="note-add" size={64} color="#CCCCCC" />
            <Text style={styles.emptyText}>No notes yet</Text>
            <Text style={styles.emptySubText}>Tap the + button to create your first note</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {notes.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                onPress={() => navigateToNoteDetails(item)}
                style={styles.cardContainer}
              >
                <View style={[styles.card, item.isPinned && styles.pinnedCard]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.title}>{item.title}</Text>
                    <View style={styles.cardActions}>
                      <TouchableOpacity 
                        onPress={() => togglePinStatus(item.id, item.isPinned)}
                        style={styles.actionButton}
                      >
                        <MaterialCommunityIcons 
                          name={item.isPinned ? 'pin' : 'pin-outline'} 
                          size={22} 
                          color={item.isPinned ? "#FF8447" : "#555"}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleDeleteNote(item.id)}
                        style={styles.actionButton}
                      >
                        <MaterialIcons name="delete-outline" size={22} color="#FF5252" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.content}>{truncateContent(item.content)}</Text>
                  <Text style={styles.date}>{item.date}</Text>
                  {item.isPinned && (
                    <View style={styles.pinnedBadge}>
                      <MaterialCommunityIcons name="pin" size={14} color="#FFF" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
            <View style={styles.bottomSpacing} />
          </ScrollView>
        )}
        
        {/* Add Note Button (FAB) */}
        <Animated.View 
          style={[
            styles.fabContainer,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <TouchableOpacity 
            style={styles.fab}
            onPress={() => setModalVisible(true)}
          >
            <MaterialIcons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
        
        {/* Add Note Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Note</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color="#555" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Title</Text>
                <TextInput
                  style={styles.titleInput}
                  placeholder="Enter title"
                  value={newNoteTitle}
                  onChangeText={setNewNoteTitle}
                  maxLength={50}
                />
                <Text style={styles.characterCount}>{newNoteTitle.length}/50</Text>
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Content</Text>
                <TextInput
                  style={styles.contentInput}
                  placeholder="Enter note content"
                  value={newNoteContent}
                  onChangeText={setNewNoteContent}
                  multiline
                  textAlignVertical="top"
                />
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleAddNote}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#555',
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
    color: '#FF5252',
    fontFamily: 'LexendDeca_400Regular',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FF8447',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'LexendDeca_500Medium',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#555',
    fontFamily: 'LexendDeca_500Medium',
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'LexendDeca_400Regular',
    textAlign: 'center',
    marginTop: 8,
  },
  backButton: {
    fontSize: 24,
    color: "#000",
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "LexendDeca_600SemiBold",
    marginLeft: 10,
    textAlign:"center",
    alignItems:"center",
  },
  cardContainer: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFF1CC',
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  pinnedCard: {
    backgroundColor: '#FFF5E1',
    borderLeftColor: '#FF8447',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 6,
    marginLeft: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
    color: '#333',
    flex: 1,
  },
  content: {
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: '#595550',
    marginBottom: 8,
    lineHeight: 20,
  },
  date: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: '#787878',
    textAlign: 'right',
  },
  pinnedBadge: {
    position: 'absolute',
    top: -5,
    left: -5,
    backgroundColor: '#FF8447',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF8447',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  inputContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#555',
    marginBottom: 6,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
  },
  contentInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    minHeight: 150,
  },
  characterCount: {
    position: 'absolute',
    right: 8,
    bottom: -20,
    fontSize: 12,
    color: '#888',
    fontFamily: 'LexendDeca_400Regular',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    color: '#555',
    fontFamily: 'LexendDeca_500Medium',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#FF8447',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontFamily: 'LexendDeca_500Medium',
    fontSize: 16,
  },
  bottomSpacing: {
    height: 80,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BDMMyNotesScreen;
