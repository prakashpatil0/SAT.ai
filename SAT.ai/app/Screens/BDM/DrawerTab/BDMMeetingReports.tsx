import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  Linking,
  TextInput
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import { auth, db } from '@/firebaseConfig';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

// Add storage key constant
const MEETING_LOGS_STORAGE_KEY = 'bdm_meeting_logs';

interface Individual {
  name: string;
  phoneNumber: string;
  emailId: string;
}

interface Meeting {
  id: string;
  date: string;
  time: string;
  rawDate?: Date;
  rawTime?: Date;
  locationUrl: string;
  companyName: string;
  individuals: Individual[];
  meetingType: 'Individual' | 'Company';
  userId: string;
  notes: string;
  status: 'planned' | 'completed' | 'cancelled';
  createdAt: Date | Timestamp;
  meetingStartDateTime: Date | Timestamp;
  syncStatus?: 'synced' | 'pending';
}

// Helper function to convert Timestamp or Date to Date
const toDate = (date: Date | Timestamp): Date => {
  if (date && 'toDate' in date) {
    return (date as Timestamp).toDate();
  }
  return date as Date;
};

type FilterType = 'all' | 'individual' | 'company' | 'today' | 'upcoming' | 'past';

const BDMMeetingReports = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showMeetingDetails, setShowMeetingDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMeeting, setEditedMeeting] = useState<Meeting | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const navigation = useNavigation();
// Inside component:
useFocusEffect(
  useCallback(() => {
    fetchMeetings(); // refetch data every time screen is focused
  }, [])
);
  useEffect(() => {
    fetchMeetings();
  }, []);

  useEffect(() => {
    applyFilter(activeFilter);
  }, [meetings, activeFilter]);

  const fetchMeetings = async () => {
    try {
      setIsLoading(true);
      const userId = auth.currentUser?.uid;
      
      if (!userId) {
        Alert.alert('Authentication Error', 'User not authenticated');
        return;
      }

      let allMeetings: Meeting[] = [];

      // Fetch from AsyncStorage first
      try {
        const localLogsStr = await AsyncStorage.getItem(MEETING_LOGS_STORAGE_KEY);
        if (localLogsStr) {
          const localLogs = JSON.parse(localLogsStr);
          const localMeetings = localLogs.map((log: any) => ({
            id: log.id,
            date: log.meetingStartDateTime ? 
              format(new Date(log.meetingStartDateTime), 'dd MMM yyyy') : 
              'Date not set',
            time: log.meetingStartDateTime ? 
              format(new Date(log.meetingStartDateTime), 'hh:mm a') : 
              'Time not set',
            locationUrl: log.locationUrl,
            companyName: log.companyName,
            individuals: log.individuals,
            meetingType: log.meetingType,
            userId: log.userId,
            notes: log.notes,
            status: log.status,
            createdAt: new Date(log.createdAt),
            meetingStartDateTime: new Date(log.meetingStartDateTime),
            syncStatus: log.syncStatus
          }));
          allMeetings = [...allMeetings, ...localMeetings];
        }
      } catch (error) {
        console.error('Error fetching local meetings:', error);
      }

      // Fetch from Firebase
      try {
        const meetingsRef = collection(db, 'meetings');
        const q = query(
          meetingsRef, 
          where('userId', '==', userId),
          orderBy('meetingStartDateTime', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const firebaseMeetings: Meeting[] = [];
        
        querySnapshot.forEach((doc) => {
          const meetingData = doc.data() as Omit<Meeting, 'id'>;
          firebaseMeetings.push({
            id: doc.id,
            ...meetingData,
            date: meetingData.meetingStartDateTime ? 
              format(toDate(meetingData.meetingStartDateTime), 'dd MMM yyyy') : 
              'Date not set',
            time: meetingData.meetingStartDateTime ? 
              format(toDate(meetingData.meetingStartDateTime), 'hh:mm a') : 
              'Time not set',
            syncStatus: 'synced'
          });
        });

        allMeetings = [...allMeetings, ...firebaseMeetings];
      } catch (error) {
        console.error('Error fetching Firebase meetings:', error);
      }

      // Sort all meetings by date and time
      allMeetings.sort((a, b) => {
        const dateA = toDate(a.meetingStartDateTime);
        const dateB = toDate(b.meetingStartDateTime);
        return dateB.getTime() - dateA.getTime();
      });
      
      setMeetings(allMeetings);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      Alert.alert('Error', 'Failed to fetch meetings');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMeetings();
  };

  const applyFilter = (filterType: FilterType) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let filtered: Meeting[];
    
    switch (filterType) {
      case 'individual':
        filtered = meetings.filter(meeting => meeting.meetingType === 'Individual');
        break;
      case 'company':
        filtered = meetings.filter(meeting => meeting.meetingType === 'Company');
        break;
      case 'today':
        filtered = meetings.filter(meeting => {
          if (!meeting.meetingStartDateTime) return false;
          const meetingDate = toDate(meeting.meetingStartDateTime);
          return meetingDate.getDate() === today.getDate() &&
                 meetingDate.getMonth() === today.getMonth() &&
                 meetingDate.getFullYear() === today.getFullYear();
        });
        break;
      case 'upcoming':
        filtered = meetings.filter(meeting => {
          if (!meeting.meetingStartDateTime) return false;
          const meetingDate = toDate(meeting.meetingStartDateTime);
          return meetingDate > now;
        });
        break;
      case 'past':
        filtered = meetings.filter(meeting => {
          if (!meeting.meetingStartDateTime) return false;
          const meetingDate = toDate(meeting.meetingStartDateTime);
          return meetingDate < now;
        });
        break;
      case 'all':
      default:
        filtered = [...meetings];
        break;
    }
    
    setFilteredMeetings(filtered);
  };

  const toggleFilterMenu = () => {
    setIsFilterMenuVisible(!isFilterMenuVisible);
  };
  
  const renderFilterButton = (type: FilterType, label: string, icon: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        activeFilter === type && styles.activeFilterButton
      ]}
      onPress={() => {
        setActiveFilter(type);
        setIsFilterMenuVisible(false);
      }}
    >
      <MaterialIcons
        name={icon as any}
        size={18}
        color={activeFilter === type ? "#FFF" : "#666"}
      />
      <Text
        style={[
          styles.filterButtonText,
          activeFilter === type && styles.activeFilterButtonText
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const handleMeetingPress = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setShowMeetingDetails(true);
  };

  const handleEditPress = (meeting: Meeting) => {
    setEditedMeeting({...meeting});
    setIsEditing(true);
  };

  const handleDeletePress = (meeting: Meeting) => {
    Alert.alert(
      "Delete Meeting",
      "Are you sure you want to delete this meeting? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          onPress: () => deleteMeeting(meeting),
          style: "destructive"
        }
      ]
    );
  };

  const deleteMeeting = async (meeting: Meeting) => {
    try {
      setIsDeleting(true);
      
      // Delete from Firebase if synced
      if (meeting.syncStatus === 'synced') {
        const meetingRef = doc(db, 'meetings', meeting.id);
        await deleteDoc(meetingRef);
      }
      
      // Delete from local state
      const updatedMeetings = meetings.filter(m => m.id !== meeting.id);
      setMeetings(updatedMeetings);
      
      // Update AsyncStorage
      const localLogsStr = await AsyncStorage.getItem(MEETING_LOGS_STORAGE_KEY);
      if (localLogsStr) {
        const localLogs = JSON.parse(localLogsStr);
        const updatedLogs = localLogs.filter((log: any) => log.id !== meeting.id);
        await AsyncStorage.setItem(MEETING_LOGS_STORAGE_KEY, JSON.stringify(updatedLogs));
      }
      
      Alert.alert("Success", "Meeting deleted successfully");
    } catch (error) {
      console.error('Error deleting meeting:', error);
      Alert.alert("Error", "Failed to delete meeting");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editedMeeting) return;
    
    try {
      setIsLoading(true);
      
      // Update in Firebase if synced
      if (editedMeeting.syncStatus === 'synced') {
        const meetingRef = doc(db, 'meetings', editedMeeting.id);
        await updateDoc(meetingRef, {
          companyName: editedMeeting.companyName,
          individuals: editedMeeting.individuals,
          notes: editedMeeting.notes,
          status: editedMeeting.status,
          updatedAt: Timestamp.fromDate(new Date())
        });
      }
      
      // Update local state
      const updatedMeetings = meetings.map(m => 
        m.id === editedMeeting.id ? editedMeeting : m
      );
      setMeetings(updatedMeetings);
      
      // Update AsyncStorage
      const localLogsStr = await AsyncStorage.getItem(MEETING_LOGS_STORAGE_KEY);
      if (localLogsStr) {
        const localLogs = JSON.parse(localLogsStr);
        const updatedLogs = localLogs.map((log: any) => 
          log.id === editedMeeting.id ? editedMeeting : log
        );
        await AsyncStorage.setItem(MEETING_LOGS_STORAGE_KEY, JSON.stringify(updatedLogs));
      }
      
      setSelectedMeeting(editedMeeting);
      setIsEditing(false);
      Alert.alert("Success", "Meeting updated successfully");
    } catch (error) {
      console.error('Error updating meeting:', error);
      Alert.alert("Error", "Failed to update meeting");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedMeeting(null);
  };

  const handleBackToReports = () => {
    if (isFilterMenuVisible) {
      setIsFilterMenuVisible(false);
      return;
    }
    if (isEditing) {
      handleCancelEdit();
      return;
    }
    if (showMeetingDetails) {
      setShowMeetingDetails(false);
      setSelectedMeeting(null);
      return;
    }
    navigation.goBack();
  };

  const renderMeetingItem = ({ item }: { item: Meeting }) => (
    <TouchableOpacity
      style={[
        styles.meetingCard,
        item.syncStatus === 'pending' && styles.pendingMeetingCard
      ]}
      onPress={() => handleMeetingPress(item)}
    >
      <View style={styles.meetingHeader}>
        <View style={styles.meetingTypeContainer}>
          <MaterialIcons
            name={item.meetingType === 'Individual' ? 'person' : 'business'}
            size={20}
            color={item.meetingType === 'Individual' ? '#FF8447' : '#0078D7'}
          />
          <Text style={styles.meetingTypeText}>
            {item.meetingType === 'Individual' ? 'Individual' : 'Company'}
          </Text>
        </View>
        
        <View style={styles.meetingDateTimeContainer}>
          <Text style={styles.meetingDateTime}>
            {item.date} • {item.time}
          </Text>
          {item.syncStatus === 'pending' && (
            <View style={styles.syncStatusContainer}>
              <MaterialIcons name="sync" size={16} color="#FF8447" />
              <Text style={styles.syncStatusText}>Syncing...</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.meetingDetails}>
        {item.meetingType === 'Company' && (
          <Text style={styles.companyName}>{item.companyName}</Text>
        )}
        
        <Text style={styles.attendeeTitle}>
          {item.meetingType === 'Company' ? 'Attendees' : 'Contact'}:
        </Text>
        
        {item.individuals.map((individual, index) => (
          <Text key={index} style={styles.attendeeName}>
            {individual.name}
            {item.individuals.length > 1 && index < item.individuals.length - 1 ? ', ' : ''}
          </Text>
        ))}
        
        {item.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesTitle}>Notes:</Text>
            <Text style={styles.notesText} numberOfLines={2}>
              {item.notes}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.meetingActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleEditPress(item)}
        >
          <MaterialIcons name="edit" size={20} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDeletePress(item)}
        >
          <MaterialIcons name="delete" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderMeetingDetails = () => {
    if (!selectedMeeting) return null;

    const meetingDate = toDate(selectedMeeting.meetingStartDateTime);
    const formattedDate = format(meetingDate, 'dd MMMM yyyy');
    const formattedTime = format(meetingDate, 'hh:mm a');

    return (
      <Modal
        visible={showMeetingDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={handleBackToReports}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleBackToReports} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Meeting Details</Text>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Meeting ID</Text>
                <Text style={styles.detailText}>{selectedMeeting.id}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Date & Time</Text>
                <Text style={styles.detailText}>{formattedDate} at {formattedTime}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Meeting Type</Text>
                <Text style={styles.detailText}>{selectedMeeting.meetingType}</Text>
              </View>

              {selectedMeeting.meetingType === 'Company' && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Company Name</Text>
                  <Text style={styles.detailText}>{selectedMeeting.companyName}</Text>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Attendees</Text>
                {selectedMeeting.individuals.map((individual, index) => (
                  <View key={index} style={styles.attendeeCard}>
                    <Text style={styles.attendeeName}>{individual.name}</Text>
                    <Text style={styles.attendeeDetail}>{individual.phoneNumber}</Text>
                    <Text style={styles.attendeeDetail}>{individual.emailId}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Location</Text>
                <TouchableOpacity 
                  style={styles.locationLink}
                  onPress={() => {
                    if (selectedMeeting.locationUrl) {
                      Linking.openURL(selectedMeeting.locationUrl);
                    }
                  }}
                >
                  <MaterialIcons name="location-on" size={20} color="#FF8447" />
                  <Text style={styles.locationText}>View Location</Text>
                </TouchableOpacity>
              </View>

              {selectedMeeting.notes && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailText}>{selectedMeeting.notes}</Text>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailText}>{selectedMeeting.status}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Sync Status</Text>
                <Text style={styles.detailText}>
                  {selectedMeeting.syncStatus === 'pending' ? 'Syncing...' : 'Synced'}
                </Text>
              </View>
              
              <View style={styles.detailActions}>
                <TouchableOpacity 
                  style={[styles.detailActionButton, styles.editButton]}
                  onPress={() => handleEditPress(selectedMeeting)}
                >
                  <MaterialIcons name="edit" size={20} color="#FFFFFF" />
                  <Text style={styles.detailActionText}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.detailActionButton, styles.deleteButton]}
                  onPress={() => handleDeletePress(selectedMeeting)}
                >
                  <MaterialIcons name="delete" size={20} color="#FFFFFF" />
                  <Text style={styles.detailActionText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEditForm = () => {
    if (!editedMeeting) return null;
    
    return (
      <Modal
        visible={isEditing}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCancelEdit} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Meeting</Text>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Company Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={editedMeeting.companyName}
                  onChangeText={(text) => setEditedMeeting({
                    ...editedMeeting,
                    companyName: text
                  })}
                  placeholder="Enter company name"
                />
              </View>
              
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Attendees</Text>
                {editedMeeting.individuals.map((individual, index) => (
                  <View key={index} style={styles.attendeeEditCard}>
                    <TextInput
                      style={styles.formInput}
                      value={individual.name}
                      onChangeText={(text) => {
                        const updatedIndividuals = [...editedMeeting.individuals];
                        updatedIndividuals[index] = {
                          ...updatedIndividuals[index],
                          name: text
                        };
                        setEditedMeeting({
                          ...editedMeeting,
                          individuals: updatedIndividuals
                        });
                      }}
                      placeholder="Name"
                    />
                    <TextInput
                      style={styles.formInput}
                      value={individual.phoneNumber}
                      onChangeText={(text) => {
                        const updatedIndividuals = [...editedMeeting.individuals];
                        updatedIndividuals[index] = {
                          ...updatedIndividuals[index],
                          phoneNumber: text
                        };
                        setEditedMeeting({
                          ...editedMeeting,
                          individuals: updatedIndividuals
                        });
                      }}
                      placeholder="Phone Number"
                    />
                    <TextInput
                      style={styles.formInput}
                      value={individual.emailId}
                      onChangeText={(text) => {
                        const updatedIndividuals = [...editedMeeting.individuals];
                        updatedIndividuals[index] = {
                          ...updatedIndividuals[index],
                          emailId: text
                        };
                        setEditedMeeting({
                          ...editedMeeting,
                          individuals: updatedIndividuals
                        });
                      }}
                      placeholder="Email"
                    />
                  </View>
                ))}
              </View>
              
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Notes</Text>
                <TextInput
                  style={[styles.formInput, styles.notesInput]}
                  value={editedMeeting.notes}
                  onChangeText={(text) => setEditedMeeting({
                    ...editedMeeting,
                    notes: text
                  })}
                  placeholder="Enter notes"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
              
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Status</Text>
                <View style={styles.statusButtons}>
                  {['planned', 'completed', 'cancelled'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusButton,
                        editedMeeting.status === status && styles.statusButtonActive
                      ]}
                      onPress={() => setEditedMeeting({
                        ...editedMeeting,
                        status: status as 'planned' | 'completed' | 'cancelled'
                      })}
                    >
                      <Text style={[
                        styles.statusButtonText,
                        editedMeeting.status === status && styles.statusButtonTextActive
                      ]}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.formActions}>
                <TouchableOpacity 
                  style={[styles.formActionButton, styles.cancelButton]}
                  onPress={handleCancelEdit}
                >
                  <Text style={styles.formActionText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.formActionButton, styles.saveButton]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.formActionText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="event-busy" size={64} color="#DDDDDD" />
      <Text style={styles.emptyTitle}>No Meetings Found</Text>
      <Text style={styles.emptyMessage}>
        {activeFilter === 'all'
          ? "You haven't logged any meetings yet."
          : `No meetings found for the selected filter: ${activeFilter}`}
      </Text>
      
      {activeFilter !== 'all' && (
        <TouchableOpacity
          style={styles.showAllButton}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={styles.showAllButtonText}>Show All Meetings</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFilterMenu = () => (
    <Modal
      visible={isFilterMenuVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setIsFilterMenuVisible(false)}
    >
      <TouchableOpacity 
        style={styles.filterModalOverlay}
        activeOpacity={1} 
        onPress={() => setIsFilterMenuVisible(false)}
      >
        <View style={styles.filterMenuContainer}>
          {renderFilterButton('all', 'All Meetings', 'list')}
          {renderFilterButton('individual', 'Individual', 'person')}
          {renderFilterButton('company', 'Company', 'business')}
          {renderFilterButton('today', 'Today', 'today')}
          {renderFilterButton('upcoming', 'Upcoming', 'event')}
          {renderFilterButton('past', 'Past', 'history')}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <AppGradient>
      <BDMMainLayout 
        title="Meeting Reports" 
        showBackButton={true}
        showDrawer={true} 
        showBottomTabs={true}
        rightComponent={
          <TouchableOpacity onPress={toggleFilterMenu}>
            <MaterialIcons name="filter-list" size={24} color="#333" />
          </TouchableOpacity>
        }
      >
        <View style={styles.container}>
          {renderFilterMenu()}
          {renderMeetingDetails()}
          {renderEditForm()}
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF8447" />
              <Text style={styles.loadingText}>Loading meetings...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredMeetings}
              renderItem={renderMeetingItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmptyList}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={["#FF8447"]}
                />
              }
            />
          )}
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
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
  },
  filterMenuContainer: {
    backgroundColor: 'white',
    marginTop: 60,
    marginHorizontal: 20,
    borderRadius: 10,
    padding: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  activeFilterButton: {
    backgroundColor: '#FF8447',
  },
  filterButtonText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginLeft: 8,
  },
  activeFilterButtonText: {
    color: '#FFF',
  },
  meetingCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  meetingTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingTypeText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    marginLeft: 6,
  },
  meetingDateTimeContainer: {
    alignItems: 'flex-end',
  },
  meetingDateTime: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  meetingDetails: {
    marginBottom: 12,
  },
  companyName: {
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 8,
  },
  attendeeTitle: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    marginBottom: 4,
  },
  attendeeName: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginBottom: 4,
  },
  notesContainer: {
    marginTop: 8,
  },
  notesTitle: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
  },
  meetingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginTop: 16,
  },
  emptyMessage: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  showAllButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  showAllButtonText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF8447',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  modalScroll: {
    flex: 1,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailLabel: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
  },
  attendeeCard: {
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  attendeeDetail: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginBottom: 2,
  },
  locationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E6',
    padding: 12,
    borderRadius: 8,
  },
  locationText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#FF8447',
    marginLeft: 8,
  },
  pendingMeetingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF8447',
  },
  syncStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  syncStatusText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#FF8447',
    marginLeft: 4,
  },
  detailActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 40,
  },
  detailActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 8,
  },
  editButton: {
    backgroundColor: '#FF8447',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  detailActionText: {
    color: '#FFFFFF',
    fontFamily: 'LexendDeca_500Medium',
    fontSize: 16,
    marginLeft: 8,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
    fontFamily: 'LexendDeca_400Regular',
    fontSize: 16,
    marginBottom: 12,
  },
  notesInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  attendeeEditCard: {
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statusButtonActive: {
    backgroundColor: '#FF8447',
    borderColor: '#FF8447',
  },
  statusButtonText: {
    fontFamily: 'LexendDeca_400Regular',
    fontSize: 14,
    color: '#666',
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
    fontFamily: 'LexendDeca_500Medium',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 40,
  },
  formActionButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: '#FF8447',
  },
  formActionText: {
    fontFamily: 'LexendDeca_500Medium',
    fontSize: 16,
    color: '#333',
  },
});

export default BDMMeetingReports; 