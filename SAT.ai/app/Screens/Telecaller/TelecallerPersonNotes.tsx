// Full updated version of TelecallerPersonNotes to match BDM styling and logic
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import AppGradient from '@/app/components/AppGradient';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
interface CallNote {
  id?: string;
  notes: string;
  status: string;
  timestamp: Date;
  callDuration: number;
  callTimestamp: Date;
  contactName: string;
  type?: 'incoming' | 'outgoing' | 'missed';
  phoneNumber: string;
  followUp?: boolean;
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase().trim()) {
    case 'prospect': return '#FFD700';
    case 'suspect': return '#87CEEB';
    case 'closing': return '#32CD32';
    case 'not interested': return '#F44336';
    default: return '#FF8447';
  }
};

const TelecallerPersonNotes = ({ route }: any) => {
  const navigation = useNavigation<any>();
  const { name, time, duration, status, notes: initialNotes, phoneNumber, contactInfo, contactIdentifier } = route.params;
  const [allNotes, setAllNotes] = useState<CallNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

useFocusEffect(
  useCallback(() => {
    fetchNotes();
  }, [contactIdentifier])
);

  const fetchNotes = async () => {
  try {
    console.log('Fetching notes for:', contactIdentifier);

    const q = query(
      collection(db, 'telecaller_call_notes'),
      where('contactIdentifier', '==', contactIdentifier),
    );
    const querySnapshot = await getDocs(q);

    console.log('Notes found:', querySnapshot.size);
    querySnapshot.forEach(doc => console.log(doc.data()));

    const notesList: CallNote[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CallNote[];

    setAllNotes(notesList);
  } catch (error) {
    console.error('Error fetching notes from Firestore:', error);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};


  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const handleAddNote = () => {
    const validTimestamp = contactInfo.timestamp instanceof Date ? contactInfo.timestamp : new Date(contactInfo.timestamp);
    navigation.navigate('TelecallerCallNoteDetails', {
      meeting: {
        name: contactInfo.name,
        time: format(validTimestamp, 'hh:mm a'),
        duration: contactInfo.duration,
        phoneNumber: contactInfo.phoneNumber,
        type: 'outgoing',
        timestamp: validTimestamp,
        contactName: contactInfo.name
      }
    });
  };

  return (
    <AppGradient>
      <TelecallerMainLayout title={name} showBackButton showDrawer showBottomTabs>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.contactInfo}>
              <Text style={styles.name}>{name}</Text>
              <View style={styles.callDetails}>
                <Text style={styles.time}>{time}</Text>
                <Text style={styles.duration}>{formatDuration(contactInfo.duration)}</Text>
              </View>
              <Text style={styles.phoneNumber}>{phoneNumber}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}> 
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF8447" />
              <Text style={styles.loadingText}>Loading notes...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchNotes} />}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="notes" size={24} color="#FF8447" />
                <Text style={styles.sectionTitle}>Notes</Text>
                <TouchableOpacity style={styles.addNoteButton} onPress={handleAddNote}>
                  <MaterialIcons name="add" size={20} color="#FFF" />
                  <Text style={styles.addNoteText}>Add Note</Text>
                </TouchableOpacity>
              </View>

              {allNotes.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="description" size={48} color="#CCC" />
                  <Text style={styles.emptyText}>No notes found</Text>
                </View>
              ) : (
                allNotes.map((note, index) => (
                  <View key={note.id || index} style={styles.noteCard}>
                    <View style={styles.noteHeader}>
                      <Text style={styles.noteTimestamp}>{format(new Date(note.callTimestamp), 'MMM d, yyyy h:mm a')}</Text>
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
                      <Text style={styles.noteNumber}>Note {allNotes.length - index}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  contactInfo: { flex: 1 },
  name: { fontSize: 20, fontFamily: 'LexendDeca_600SemiBold', color: '#333' },
  callDetails: { flexDirection: 'row', gap: 8 },
  time: { fontSize: 14, fontFamily: 'LexendDeca_400Regular', color: '#666' },
  duration: { fontSize: 14, fontFamily: 'LexendDeca_400Regular', color: '#666' },
  phoneNumber: { fontSize: 14, fontFamily: 'LexendDeca_400Regular', color: '#666', marginTop: 4 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusText: { fontSize: 14, fontFamily: 'LexendDeca_500Medium', color: '#FFF' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'LexendDeca_600SemiBold', color: '#333', marginLeft: 8, flex: 1 },
  addNoteButton: { flexDirection: 'row', backgroundColor: '#FF8447', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  addNoteText: { fontSize: 12, fontFamily: 'LexendDeca_500Medium', color: '#FFF', marginLeft: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, fontFamily: 'LexendDeca_400Regular', color: '#666', marginTop: 16 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 48 },
  emptyText: { fontSize: 16, fontFamily: 'LexendDeca_400Regular', color: '#999', marginTop: 12 },
  noteCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  noteTimestamp: { fontSize: 12, fontFamily: 'LexendDeca_400Regular', color: '#999' },
  followUpTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF50', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  followUpTagText: { fontSize: 10, fontFamily: 'LexendDeca_400Regular', color: '#FFF', marginLeft: 2 },
  noteText: { fontSize: 16, fontFamily: 'LexendDeca_400Regular', color: '#333', lineHeight: 24 },
  noteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  noteStatus: { fontSize: 12, fontFamily: 'LexendDeca_400Regular', color: '#666' },
  statusValue: { fontFamily: 'LexendDeca_500Medium', color: '#FF8447' },
  noteNumber: { fontSize: 12, fontFamily: 'LexendDeca_400Regular', color: '#999' },
});

export default TelecallerPersonNotes;
