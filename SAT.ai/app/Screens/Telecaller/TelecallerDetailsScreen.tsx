import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import TelecallerMainLayout from '../../components/TelecallerMainLayout';
import AppGradient from '../../components/AppGradient';
interface Script {
  id: string;
  title: string;
  content: string;
  date: string;
  isPinned: boolean;
  userId: string;
  createdAt: Timestamp;
}

interface RouteParams {
  script: Script;
  onUpdate: () => void;
}

const DetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { script, onUpdate } = route.params as RouteParams;
  const [showOptions, setShowOptions] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false)

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handlePinScript = async () => {
    try {
      const scriptRef = doc(db, 'scripts', script.id);
      await updateDoc(scriptRef, {
        isPinned: !script.isPinned
      });
      onUpdate();
      setShowOptions(false);
    } catch (error) {
      console.error('Error pinning script:', error);
      Alert.alert('Error', 'Failed to update script. Please try again.');
    }
  };

const handleDeleteScript = async () => {
  if (script.userId === 'default') {
    Alert.alert('Cannot Delete', 'This is a default script and cannot be deleted.');
    return;
  }

  Alert.alert(
    'Delete Script',
    'Are you sure you want to delete this script?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const scriptRef = doc(db, 'scripts', script.id);
            await deleteDoc(scriptRef);
            onUpdate();
            navigation.goBack();
          } catch (error) {
            console.error('Error deleting script:', error);
            Alert.alert('Error', 'Failed to delete script. Please try again.');
          }
        }
      }
    ]
  );
};

  const subscribeToScripts = (userId: string, callback: (scripts: Script[]) => void) => {
    const scriptsRef = collection(db, 'scripts');
    const q = query(
      scriptsRef,
      where('userId', '==', userId),
      orderBy('isPinned', 'desc'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const scripts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Script[];
      callback(scripts);
    });
  };

  const createScript = async (scriptData: Omit<Script, 'id' | 'createdAt'>) => {
    try {
      const scriptsRef = collection(db, 'scripts');
      const docRef = await addDoc(scriptsRef, {
        ...scriptData,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating script:', error);
      throw error;
    }
  };
  const truncateContent = (content: string, length: number) => {
    if (content.length <= length) return content;
    return content.substring(0, length) + '...';
  };

  return (
    <AppGradient>
    <ScrollView>
     <TelecallerMainLayout title="My Script" showBackButton={true} showBottomTabs={true}>
        <ScrollView style={styles.container}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.title}>{script.title}</Text>
              <TouchableOpacity onPress={() => setShowOptions(!showOptions)} style={styles.threeDotsButton}>
                <Ionicons name="ellipsis-vertical" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <Text style={styles.date}>{script.date}</Text>

            {/* Show partial or full content */}
            <ScrollView style={{ marginTop: 15 }}>
    <Text style={styles.content}>
      {script.content}
    </Text>
  </ScrollView>
            {/* See More / See Less button */}
            {script.content.length > 250 && (
              <TouchableOpacity onPress={() => setShowFullContent(!showFullContent)}>
                <Text style={styles.seeMoreText}>
                  {showFullContent ? 'See Less ▲' : 'See More ▼'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Options popup */}
            {showOptions && (
              <View style={styles.optionsPopup}>
                <TouchableOpacity onPress={handlePinScript} style={styles.optionButton}>
                  <Text style={styles.optionText}>{script.isPinned ? 'Unpin' : 'Pin'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteScript} style={styles.optionButton}>
                  <Text style={[styles.optionText, { color: 'red' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </TelecallerMainLayout>
    </ScrollView>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "transparent",
  },
  backButton: {
    padding: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "LexendDeca_600SemiBold",
    marginLeft: 10,
    textAlign: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFF1CC',
    borderRadius: 8,
    padding: 15,
    elevation: 3,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: "LexendDeca_600SemiBold",
    flex: 1,
  },
  threeDotsButton: {
    padding: 5,
  },
  date: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: '#787878',
    marginTop: 5,
  },
  content: {
    fontSize: 16,
    fontFamily: "LexendDeca_400Regular",
    color: '#595550',
    marginTop: 15,
  },
  seeMoreText: {
    marginTop: 8,
    color: '#007BFF',     // blue color text
    fontSize: 14,
    fontFamily: "LexendDeca_600SemiBold",
    textAlign: 'left',
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

export default DetailsScreen;
