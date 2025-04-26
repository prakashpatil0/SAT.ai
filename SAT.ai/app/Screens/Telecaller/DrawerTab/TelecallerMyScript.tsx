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
  // createdAt: Timestamp;
  isDefault?: boolean; // Optional field to indicate default scripts
}

// Helper function to format a date into dd/mm/yyyy
const formatDate = (date: Date): string => {
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};

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
  const DEFAULT_SCRIPTS: Script[] = [
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
      // createdAt: new Date(),
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
      // createdAt: new Date(),
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
      // createdAt: new Date(),
      isPinned: false,
      userId: 'default',
      isDefault: true,
    },
    {
      id: 'sme-001',
      title: 'SME Insurance',
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
      // createdAt: new Date(),
      isPinned: false,
      userId: 'default',
      isDefault: true,
    }
  ];
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
      const dbScripts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Script[];
    
      // Filter out any Firestore scripts that have the same title as default ones
      const filteredDbScripts = dbScripts.filter(
        dbScript => !DEFAULT_SCRIPTS.some(defaultScript => defaultScript.title === dbScript.title)
      );
      const combined = [...DEFAULT_SCRIPTS, ...filteredDbScripts];
      
      setScripts(combined);
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
          <ScrollView style={styles.scrollView}
  contentContainerStyle={{ paddingBottom: 100 }}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
>
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
                        <MaterialCommunityIcons name='pin-outline' size={25} color="black" />
                      )}
                    </View>
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
