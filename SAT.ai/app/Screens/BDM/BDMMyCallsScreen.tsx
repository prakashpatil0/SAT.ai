import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '@/firebaseConfig';

// Define types
type RootStackParamList = {
  BDMHomeScreen: undefined;
  BDMCallNoteDetailsScreen: {
    meeting: {
      name: string;
      time: string;
      duration: string;
      phoneNumber?: string;
      date?: string;
      type?: 'incoming' | 'outgoing' | 'missed';
      contactType?: 'person' | 'company';
    }
  };
  BDMCallHistory: {
    customerName: string;
    phoneNumber?: string;
    meetings: Array<{
      date: string;
      time: string;
      duration: string;
      notes?: string[];
    }>;
  };
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

// AsyncStorage key (same as in BDMCallNotesScreen)
const CALL_NOTES_STORAGE_KEY = 'bdm_call_notes';

// Filter options
type FilterOption = 'all' | 'followUp' | 'prospect' | 'suspect' | 'closing';

const BDMMyCallsScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [callNotes, setCallNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  useEffect(() => {
    loadCallNotes();
  }, []);

  const loadCallNotes = async () => {
    try {
      setLoading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setLoading(false);
        return;
      }

      const storedNotes = await AsyncStorage.getItem(CALL_NOTES_STORAGE_KEY + "_" + userId);
      
      if (storedNotes) {
        const parsedNotes: Note[] = JSON.parse(storedNotes);
        setCallNotes(parsedNotes);
        setFilteredNotes(parsedNotes);
      } else {
        setCallNotes([]);
        setFilteredNotes([]);
      }
    } catch (error) {
      console.error('Error loading call notes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters and search
  useEffect(() => {
    let result = [...callNotes];
    
    // Apply active filter
    if (activeFilter === 'followUp') {
      result = result.filter(note => note.followUp);
    } else if (activeFilter !== 'all') {
      // For status filters (prospect, suspect, closing)
      result = result.filter(note => 
        note.status.toLowerCase() === activeFilter.toLowerCase()
      );
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(note => 
        note.contactName.toLowerCase().includes(query) || 
        note.notes.toLowerCase().includes(query)
      );
    }
    
    setFilteredNotes(result);
  }, [callNotes, activeFilter, searchQuery]);

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      // If dateString is already in a readable format, just return it
      return dateString;
    } catch (error) {
      return dateString;
    }
  };

  // Get appropriate icon for call status
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'prospect':
        return <View style={[styles.statusDot, { backgroundColor: '#FFD700' }]} />;
      case 'suspect':
        return <View style={[styles.statusDot, { backgroundColor: '#87CEEB' }]} />;
      case 'closing':
        return <View style={[styles.statusDot, { backgroundColor: '#32CD32' }]} />;
      default:
        return <View style={[styles.statusDot, { backgroundColor: '#FFD700' }]} />;
    }
  };

  const renderFilterButton = (filter: FilterOption, label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        activeFilter === filter && styles.filterButtonActive
      ]}
      onPress={() => setActiveFilter(filter)}
    >
      <Text 
        style={[
          styles.filterButtonText,
          activeFilter === filter && styles.filterButtonTextActive
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderNoteItem = ({ item }: { item: Note }) => (
    <TouchableOpacity 
      style={styles.callCard}
      onPress={() => {
        // Group this note with any other notes from the same contact
        const contactNotes = callNotes.filter(
          note => note.phoneNumber === item.phoneNumber || 
                 note.contactName.toLowerCase() === item.contactName.toLowerCase()
        );
        
        // Format notes for the call history screen
        const meetings = contactNotes.map(note => ({
          date: note.date,
          time: note.time,
          duration: note.duration,
          notes: [note.notes] // Convert to string array as expected by BDMCallHistory
        }));
        
        // Navigate to call history screen
        navigation.navigate('BDMCallHistory', {
          customerName: item.contactName,
          phoneNumber: item.phoneNumber,
          meetings: meetings
        });
      }}
    >
      <View style={styles.callCardHeader}>
        <View style={styles.callNameContainer}>
          {getStatusIcon(item.status)}
          <Text style={styles.callName}>{item.contactName}</Text>
        </View>
        <Text style={styles.callTime}>{item.time} • {item.duration}</Text>
      </View>
      
      <Text style={styles.callNotes} numberOfLines={2}>{item.notes}</Text>
      
      <View style={styles.callCardFooter}>
        <Text style={styles.callDate}>{formatDate(item.date)}</Text>
        {item.followUp && (
          <View style={styles.followUpTag}>
            <MaterialIcons name="event" size={12} color="#FF8447" />
            <Text style={styles.followUpText}>Follow-up</Text>
          </View>
        )}
        <View style={styles.statusTag}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="call-end" size={64} color="#CCCCCC" />
      <Text style={styles.emptyTitle}>No call notes yet</Text>
      <Text style={styles.emptySubtitle}>
        Your saved call notes will appear here
      </Text>
    </View>
  );

  return (
    <BDMMainLayout title="My Calls" showBackButton={false} showDrawer={true} showBottomTabs={true}>
      <LinearGradient colors={['#FFF8F0', '#FFF']} style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search calls..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            {renderFilterButton('all', 'All')}
            {renderFilterButton('followUp', 'Follow Up')}
            {renderFilterButton('prospect', 'Prospect')}
            {renderFilterButton('suspect', 'Suspect')}
            {renderFilterButton('closing', 'Closing')}
          </ScrollView>
        </View>

        {/* Call Notes List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF8447" />
          </View>
        ) : (
          <FlatList
            data={filteredNotes}
            renderItem={renderNoteItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={renderEmptyList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </LinearGradient>
    </BDMMainLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterScrollContent: {
    paddingRight: 16,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFF',
    marginRight: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterButtonActive: {
    backgroundColor: '#FF8447',
  },
  filterButtonText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#FFF',
    fontFamily: 'LexendDeca_500Medium',
  },
  listContainer: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  callCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  callCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  callNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  callName: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  callTime: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999',
  },
  callNotes: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  callCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callDate: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999',
    flex: 1,
  },
  followUpTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 132, 71, 0.1)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  followUpText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#FF8447',
    marginLeft: 4,
  },
  statusTag: {
    backgroundColor: 'rgba(100, 100, 100, 0.1)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default BDMMyCallsScreen; 