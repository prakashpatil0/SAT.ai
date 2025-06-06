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
  isDefault?: boolean; // 👈 add this optional flag
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
  
  const DEFAULT_SCRIPTS: Note[] = [
    {
      id: 'term-001',
      title: 'Term Insurance',
      content: `Hello, I'm calling from Policy Planner Insurance Brokers Pvt Ltd. We've got an exciting offer on our term insurance plans that can secure your family's future. Our plans offer high coverage at affordable premiums, with options starting from ₹500 per month. You can choose from various plans, including those with critical illness cover and accidental death benefit.
  
  Benefits:
  
  - High coverage at affordable premiums
  - Option to choose from various plans
  - Critical illness cover and accidental death benefit available
  - Tax benefits under Section 80C and 10(10D)
  
  Attractive Offer: Get 10% discount on your first-year premium if you purchase a plan within the next 48 hours.
  
  Claim Support: Our claims process is hassle-free and transparent. We ensure that your claims are settled quickly and efficiently.
  
  Immediate Closing Request: If you're interested, I can guide you through the application process and help you purchase a plan immediately.
  
  Would you like to know more about our term insurance plans?`,
      date: formatDate(new Date()),
      createdAt: new Date(),
      isPinned: true,
      userId: 'default',
      isDefault: true,
    },
    {
      id: 'health-001',
      title: 'Health Insurance',
      content: `Health Insurance
Hello, I'm calling from Policy Planner Insurance Brokers Pvt Ltd. Are you and your family protected against unexpected medical expenses? Our health insurance plans offer comprehensive coverage, including hospitalization expenses, surgeries, and doctor consultations.

Benefits:

- Comprehensive coverage for hospitalization expenses, surgeries, and doctor consultations
- Option to choose from various plans, including individual and family floater plans
- No claim bonus and lifetime renewal available
- Tax benefits under Section 80D

Attractive Offer: Get a free health check-up package worth ₹2,000 with your policy purchase.

Claim Support: Our claims process is designed to be quick and hassle-free. We have a dedicated team to assist you with your claims.

Immediate Closing Request: If you're interested, I can help you purchase a plan immediately and guide you through the application process.

Would you like to know more about our health insurance plans?`,
      date: formatDate(new Date()),
      createdAt: new Date(),
      isPinned: false,
      userId: 'default',
      isDefault: true,
    },
    {
      id: 'motor-001',
      title: 'Motor Insurance',
      content: `Motor Insurance
Hello, I'm calling from Policy Planner Insurance Brokers Pvt Ltd. Is your vehicle insured against accidents, theft, or damage? Our motor insurance plans offer comprehensive coverage, including third-party liability, own damage, and personal accident cover.

Benefits:

- Comprehensive coverage for third-party liability, own damage, and personal accident cover
- Option to choose from various plans, including two-wheeler and four-wheeler insurance
- No claim bonus and lifetime renewal available
- 24x7 claim support

Attractive Offer: Get a 5% discount on your premium if you purchase a plan within the next 48 hours.

Claim Support: Our claims process is designed to be quick and hassle-free. We have a dedicated team to assist you with your claims.

Immediate Closing Request: If you're interested, I can help you purchase a plan immediately and guide you through the application process.

Would you like to know more about our motor insurance plans?`,
      date: formatDate(new Date()),
      createdAt: new Date(),
      isPinned: false,
      userId: 'default',
      isDefault: true,
    },
    {
      id: 'sme-001',
      title: 'SME Insurance',
      content: `Hello, I'm calling from Policy Planner Insurance Brokers Pvt Ltd. As a business owner, do you want to protect your business against unexpected risks and losses? Our SME insurance plans offer comprehensive coverage, including property damage, liability, and business interruption.

Benefits:

- Comprehensive coverage for property damage, liability, and business interruption
- Option to choose from various plans, including package policies and customized solutions
- Tax benefits under Section 80C and 10(10D)
- 24x7 claim support

Attractive Offer: Get a 10% discount on your premium if you purchase a plan within the next 48 hours.

Claim Support: Our claims process is designed to be quick and hassle-free. We have a dedicated team to assist you with your claims.

Immediate Closing Request: If you're interested, I can help you purchase a plan immediately and guide you through the application process.

Would you like to know more about our SME insurance plans?`,
      date: formatDate(new Date()),
      createdAt: new Date(),
      isPinned: false,
      userId: 'default',
      isDefault: true,
    }
  ];
  
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
  
      const storageKey = NOTES_STORAGE_KEY + "_" + userId;
  
      // Get stored notes
      const storedNotes = await AsyncStorage.getItem(storageKey);
      const parsedNotes: Note[] = storedNotes ? JSON.parse(storedNotes) : [];
  
      // Remove duplicate titles manually first
      const uniqueNotesMap = new Map<string, Note>();
      parsedNotes.forEach(note => {
        const titleKey = note.title.trim().toLowerCase();
        if (!uniqueNotesMap.has(titleKey)) {
          uniqueNotesMap.set(titleKey, note);
        }
      });
  
      let cleanedNotes = Array.from(uniqueNotesMap.values());
  
      // Now prepare list of existing titles
      const existingTitles = cleanedNotes.map(note => note.title.trim().toLowerCase());
  
      // Add missing default notes
      const missingDefaults = DEFAULT_SCRIPTS.filter(defaultNote => 
        !existingTitles.includes(defaultNote.title.trim().toLowerCase())
      );
  
      cleanedNotes = [...cleanedNotes, ...missingDefaults];
  
      // Save cleaned + merged notes back
      await AsyncStorage.setItem(storageKey, JSON.stringify(cleanedNotes));
  
      // Sort notes
      const sortedNotes = cleanedNotes.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  
      setNotes(sortedNotes);
  
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
    navigation.navigate('BDMNotesDetailScreen', { note: note });
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
    <BDMMainLayout title="My Scripts" showBackButton showDrawer={true}>
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
            <Text style={styles.emptyText}>No scripts yet</Text>
            <Text style={styles.emptySubText}>Tap the + button to create your first script</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
           {notes.map((item) => (
  <TouchableOpacity 
    key={item.id}
  onPress={() => {
    console.log("Opening Note:", item.title); // ✅ Check which one is clicked
    navigateToNoteDetails(item);
  }}
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
                      {!item.isDefault && (
  <TouchableOpacity 
    onPress={() => handleDeleteNote(item.id)}
    style={styles.actionButton}
  >
    <MaterialIcons name="delete-outline" size={22} color="#FF5252" />
  </TouchableOpacity>
)}


                    </View>
                  </View>
                  <Text style={styles.content}>{truncateContent(item.content)}</Text>
                  <Text style={styles.date}>{item.date}</Text>
                </View>
                <View style={styles.cardActions}>

                 
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
    borderBottomRightRadius: 1,
    borderColor: "#FFF",
    borderWidth: 2,
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
