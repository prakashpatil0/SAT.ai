import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, TextInput, Alert } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from "@expo/vector-icons/Ionicons";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import AppGradient from '@/app/components/AppGradient';
import { auth, db } from '@/firebaseConfig';
import { collection, query, where, getDocs, addDoc, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

interface Script {
  id: string;
  title: string;
  content: string;
  date: string;
  isPinned: boolean;
  userId: string;
  createdAt: Timestamp;
}

type RootStackParamList = {
  // ... other routes
  DetailsScreen: {
    script: Script;
    onUpdate: () => void;
  };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MyScript = () => {
  const navigation = useNavigation<NavigationProp>();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const scriptsRef = collection(db, 'scripts');
    const q = query(
      scriptsRef,
      where('userId', '==', userId),
      orderBy('isPinned', 'desc'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scriptData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Script[];
      setScripts(scriptData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleBackPress = () => {
    navigation.goBack();
  };

  const navigateToDetails = (script: Script) => {
    navigation.navigate('DetailsScreen', {
      script,
      onUpdate: () => {
        // Refresh scripts after update
        fetchScripts();
      }
    });
  };

  const fetchScripts = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      setLoading(true);
      const scriptsRef = collection(db, 'scripts');
      const q = query(
        scriptsRef,
        where('userId', '==', userId),
        orderBy('isPinned', 'desc'),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const scriptData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Script[];
      setScripts(scriptData);
    } catch (error) {
      console.error('Error fetching scripts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddScript = async () => {
    try {
      if (!newTitle.trim() || !newContent.trim()) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }

      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const scriptsRef = collection(db, 'scripts');
      await addDoc(scriptsRef, {
        title: newTitle.trim(),
        content: newContent.trim(),
        date: new Date().toLocaleDateString(),
        isPinned: false,
        userId,
        createdAt: serverTimestamp()
      });

      setModalVisible(false);
      setNewTitle('');
      setNewContent('');
      await fetchScripts();
    } catch (error) {
      console.error('Error adding script:', error);
      Alert.alert('Error', 'Failed to add script. Please try again.');
    }
  };

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBottomTabs={true} showBackButton title="My Script">
        <View style={styles.container}>
          <ScrollView style={styles.scrollView}>
            {loading ? (
              <ActivityIndicator size="large" color="#FF8447" style={styles.loader} />
            ) : scripts.length === 0 ? (
              <Text style={styles.emptyText}>No scripts found</Text>
            ) : (
              scripts.map((script) => (
                <TouchableOpacity 
                  key={script.id} 
                  onPress={() => navigateToDetails(script)}
                >
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.title}>{script.title}</Text>
                      {script.isPinned && (
                        <MaterialCommunityIcons name='pin-outline' size={25} color="black"/>
                      )}
                    </View>
                    <Text style={styles.content}>{truncateContent(script.content)}</Text>
                    <Text style={styles.date}>{script.date}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Floating Action Button (FAB) */}
          <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
            <MaterialIcons name="add" size={28} color="white" />
          </TouchableOpacity>

          {/* Modal for Adding New Script */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add New Script</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <MaterialIcons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
                
                <TextInput
                  style={styles.input}
                  placeholder="Enter script title"
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholderTextColor="#999"
                />
                
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter script content"
                  multiline
                  value={newContent}
                  onChangeText={setNewContent}
                  placeholderTextColor="#999"
                  textAlignVertical="top"
                />
                
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.button, styles.addButton]}
                    onPress={handleAddScript}
                  >
                    <Text style={styles.buttonText}>Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={[styles.buttonText, styles.cancelButtonText]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

// Function to truncate content
const truncateContent = (content: string, length = 90) => {
  return content.length > length ? content.substring(0, length) + '...' : content;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  loader: {
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  card: {
    backgroundColor: '#FFF1CC',
    borderRadius: 8,
    marginBottom: 10,
    padding: 15,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: "LexendDeca_600SemiBold",
  },
  content: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: '#595550',
  },
  date: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: '#787878',
    textAlign: 'right',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
  },
  textArea: {
    height: 150,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  addButton: {
    backgroundColor: '#FF8447',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
    color: 'white',
  },
  cancelButtonText: {
    color: '#333',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF8447',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    marginBottom: 65,
    borderBottomRightRadius:1,
    borderWidth: 3,
    borderColor: "#FFF"
  },
});

export default MyScript;
