import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Dimensions } from 'react-native';
import { Surface, SegmentedButtons, Button, IconButton } from 'react-native-paper';
import { format, addDays, isToday, isTomorrow, startOfWeek, isWithinInterval, subDays, startOfDay, endOfDay } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getAuth } from 'firebase/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  type: 'meeting' | 'calling' | 'break' | 'followup';
  description?: string;
  date: Date;
  isRecurring?: boolean;
  contactName?: string;
  phoneNumber?: string;
  status?: string;
}

const ScheduleScreen = () => {
  const [view, setView] = useState('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isFollowUpModalVisible, setIsFollowUpModalVisible] = useState(false);
  const [followUps, setFollowUps] = useState<Event[]>([]);

  // Fixed daily schedule template with 30-minute intervals
  const dailyScheduleTemplate = [
    {
      title: 'Morning Meeting',
      startTime: '09:00',
      endTime: '10:00',
      type: 'meeting' as const,
      isRecurring: true,
    },
    {
      title: 'Calling Session 1',
      startTime: '10:00',
      endTime: '13:00',
      type: 'calling' as const,
      isRecurring: true,
    },
    {
      title: 'Break Time',
      startTime: '13:00',
      endTime: '14:00',
      type: 'break' as const,
      isRecurring: true,
    },
    {
      title: 'Calling Session 2',
      startTime: '14:00',
      endTime: '19:00',
      type: 'calling' as const,
      isRecurring: true,
    }
  ];

  // Sample follow-up events with more details
  const getFollowUpEvents = (): Event[] => {
    return [
      {
        id: 'f1',
        title: 'Follow Up: Product Demo',
        startTime: '11:30',
        endTime: '12:00',
        type: 'followup',
        date: addDays(new Date(), 1),
        description: 'Demo of new features to client',
        contactName: 'John Smith',
        phoneNumber: '+1234567890',
        status: 'Pending'
      },
      {
        id: 'f2',
        title: 'Follow Up: Proposal Discussion',
        startTime: '15:00',
        endTime: '15:30',
        type: 'followup',
        date: new Date(),
        description: 'Review proposal changes',
        contactName: 'Sarah Johnson',
        phoneNumber: '+9876543210',
        status: 'Scheduled'
      }
    ];
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const days = view === 'day' ? 1 : view === '3days' ? 3 : 7;
    setSelectedDate(current => 
      direction === 'next' ? addDays(current, days) : subDays(current, days)
    );
  };

  // Updated color scheme
  const getEventColor = (type: string) => {
    switch(type) {
      case 'meeting': return { bg: '#E1F5FE', text: '#0288D1', border: '#81D4FA' };
      case 'calling': return { bg: '#FFF3E0', text: '#FF8447', border: '#FFB74D' };
      case 'break': return { bg: '#E8F5E9', text: '#2E7D32', border: '#81C784' };
      case 'followup': return { bg: '#FCE4EC', text: '#C2185B', border: '#F48FB1' };
      default: return { bg: '#FFF', text: '#333', border: '#DDD' };
    }
  };

  const renderTimeColumn = () => (
    <View style={styles.timeColumn}>
      {Array.from({ length: 21 }, (_, i) => (
        <Text key={i} style={styles.timeSlot}>
          {String(Math.floor(i/2) + 9).padStart(2, '0')}:
          {i % 2 === 0 ? '00' : '30'}
        </Text>
      ))}
    </View>
  );

  const renderEvent = (event: Event, viewType: 'day' | '3days' | 'week') => {
    const colors = getEventColor(event.type);
    const startMinutes = getMinutesFromTime(event.startTime);
    const endMinutes = getMinutesFromTime(event.endTime);
    const duration = endMinutes - startMinutes;
    const top = ((startMinutes - 9 * 60) / 30) * 30;
    const height = (duration / 30) * 30;
    const isShortDuration = duration <= 30;

    if (event.type === 'followup') {
      return renderFollowUpEvent(event, viewType);
    }

    return (
      <TouchableOpacity
        key={event.id}
        style={[
          styles.eventCard,
          {
            top,
            height,
            backgroundColor: colors.bg,
            borderColor: colors.border,
            width: viewType === 'day' ? '90%' : 140,
            left: viewType === 'day' ? '5%' : 5,
          },
          isShortDuration && styles.shortEventCard
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedEvent(event);
          setModalVisible(true);
        }}
      >
        <Text 
          style={[
            styles.eventTitle, 
            { color: colors.text },
            isShortDuration && styles.shortEventTitle
          ]} 
          numberOfLines={isShortDuration ? 1 : 2}
        >
          {event.title}
        </Text>
        {!isShortDuration && (
          <Text style={[styles.eventTime, { color: colors.text }]}>
            {event.startTime} - {event.endTime}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderFollowUpEvent = (event: Event, viewType: 'day' | '3days' | 'week') => {
    const colors = getEventColor('followup');
    const startMinutes = getMinutesFromTime(event.startTime);
    const top = ((startMinutes - 9 * 60) / 30) * 30;

    return (
      <TouchableOpacity
        key={event.id}
        style={[
          styles.followUpCard,
          {
            top,
            backgroundColor: colors.bg,
            borderColor: colors.border,
            width: viewType === 'day' ? '90%' : 140,
            left: viewType === 'day' ? '5%' : 5,
          }
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setSelectedEvent(event);
          setIsFollowUpModalVisible(true);
        }}
      >
        <View style={styles.followUpContent}>
          <Text style={[styles.followUpTime, { color: colors.text }]}>
            {event.startTime}
          </Text>
          <Text style={[styles.followUpTitle, { color: colors.text }]} numberOfLines={1}>
            {event.contactName || 'Follow Up'}
          </Text>
          <MaterialIcons name="phone-in-talk" size={16} color={colors.text} />
        </View>
      </TouchableOpacity>
    );
  };

  const getMinutesFromTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  const renderDayView = () => (
    <View style={styles.dayContainer}>
      <Text style={styles.dateHeader}>{format(selectedDate, 'MMMM d, yyyy')}</Text>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.scheduleContainer}>
          {renderTimeColumn()}
          <View style={styles.eventsContainer}>
            {getEventsForCurrentView().map(event => renderEvent(event, 'day'))}
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderMultiDayView = (days: number) => {
    const dates = Array.from({ length: days }, (_, i) => addDays(selectedDate, i));
    const events = getEventsForCurrentView();

    return (
      <ScrollView horizontal style={styles.multiDayContainer}>
        <View>
          <View style={styles.daysHeader}>
            <View style={styles.timeHeaderCell} />
            {dates.map(date => (
              <View key={date.toISOString()} style={styles.dayHeaderCell}>
                <Text style={styles.dateHeader}>{format(date, 'EEE, MMM d')}</Text>
              </View>
            ))}
          </View>
          <ScrollView>
            <View style={styles.scheduleContainer}>
              {renderTimeColumn()}
              {dates.map(date => (
                <View key={date.toISOString()} style={styles.dayColumn}>
                  {events
                    .filter(event => format(event.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'))
                    .map(event => renderEvent(event, days === 3 ? '3days' : 'week'))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    );
  };

  const renderEventModal = () => (
    <Modal
      visible={modalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <Surface style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedEvent?.title}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <View style={styles.modalRow}>
              <MaterialIcons name="access-time" size={20} color="#666" />
              <Text style={styles.modalText}>
                {selectedEvent?.startTime} - {selectedEvent?.endTime}
              </Text>
            </View>
            <View style={styles.modalRow}>
              <MaterialIcons name="event" size={20} color="#666" />
              <Text style={styles.modalText}>
                {selectedEvent?.date ? format(selectedEvent.date, 'EEEE, MMMM d') : ''}
              </Text>
            </View>
            {selectedEvent?.description && (
              <View style={styles.modalRow}>
                <MaterialIcons name="description" size={20} color="#666" />
                <Text style={styles.modalText}>{selectedEvent.description}</Text>
              </View>
            )}
          </View>
          <View style={styles.modalFooter}>
            <Button 
              mode="contained" 
              onPress={() => setModalVisible(false)}
              style={styles.modalButton}
            >
              Close
            </Button>
          </View>
        </Surface>
      </View>
    </Modal>
  );

  const renderFollowUpModal = () => (
    <Modal
      visible={isFollowUpModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setIsFollowUpModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <Surface style={styles.followUpModalContent}>
          <View style={styles.followUpModalHeader}>
            <Text style={styles.followUpModalTitle}>Follow-up Details</Text>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setIsFollowUpModalVisible(false)}
            />
          </View>
          
          <View style={styles.followUpModalBody}>
            <View style={styles.followUpDetailRow}>
              <MaterialIcons name="person" size={20} color="#666" />
              <Text style={styles.followUpDetailText}>
                {selectedEvent?.contactName}
              </Text>
            </View>
            
            <View style={styles.followUpDetailRow}>
              <MaterialIcons name="phone" size={20} color="#666" />
              <Text style={styles.followUpDetailText}>
                {selectedEvent?.phoneNumber}
              </Text>
            </View>
            
            <View style={styles.followUpDetailRow}>
              <MaterialIcons name="access-time" size={20} color="#666" />
              <Text style={styles.followUpDetailText}>
                {selectedEvent?.startTime} - {selectedEvent?.endTime}
              </Text>
            </View>
            
            <View style={styles.followUpDetailRow}>
              <MaterialIcons name="event" size={20} color="#666" />
              <Text style={styles.followUpDetailText}>
                {selectedEvent?.date ? format(selectedEvent.date, 'EEEE, MMMM d') : ''}
              </Text>
            </View>
            
            <View style={styles.followUpDetailRow}>
              <MaterialIcons name="description" size={20} color="#666" />
              <Text style={styles.followUpDetailText}>
                {selectedEvent?.description}
              </Text>
            </View>

            <View style={styles.followUpDetailRow}>
              <MaterialIcons name="flag" size={20} color="#666" />
              <Text style={styles.followUpDetailText}>
                Status: {selectedEvent?.status}
              </Text>
            </View>
          </View>

          <View style={styles.followUpModalFooter}>
            {/* <Button
              mode="contained"
              onPress={() => {
                // Handle call action
                Alert.alert('Calling', `Calling ${selectedEvent?.contactName}...`);
              }}
              style={[styles.followUpButton, { backgroundColor: '#4CAF50' }]}
              icon="phone"
            >
              Call Now
            </Button> */}
            
            <Button
              mode="contained"
              onPress={() => setIsFollowUpModalVisible(false)}
              style={[styles.followUpButton, { backgroundColor: '#FF8447' }]}
            >
              Close
            </Button>
          </View>
        </Surface>
      </View>
    </Modal>
  );

  const fetchFollowUps = async () => {
    try {
      const auth = getAuth();
      const userId = auth.currentUser?.uid;

      if (!userId) return;

      const followupsRef = collection(db, 'followups');
      const q = query(
        followupsRef,
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      const fetchedFollowUps: Event[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Convert Firestore timestamp to Date
        const followupDate = data.date.toDate();
        
        // Only add follow-ups for the current view period
        if (isDateInCurrentView(followupDate)) {
          fetchedFollowUps.push({
            id: doc.id,
            title: data.title || 'Follow Up',
            startTime: data.startTime,
            endTime: data.endTime,
            type: 'followup',
            date: followupDate,
            description: data.description,
            contactName: data.contactName,
            phoneNumber: data.phoneNumber,
            status: data.status
          });
        }
      });

      console.log('Fetched follow-ups:', fetchedFollowUps); // Debug log
      setFollowUps(fetchedFollowUps);

    } catch (error) {
      console.error('Error fetching follow-ups:', error);
    }
  };

  // Helper function to check if a date falls within the current view
  const isDateInCurrentView = (date: Date) => {
    const startOfView = startOfDay(selectedDate);
    const endOfView = endOfDay(
      view === 'day' 
        ? selectedDate 
        : view === '3days' 
          ? addDays(selectedDate, 2) 
          : addDays(selectedDate, 6)
    );

    return isWithinInterval(date, { start: startOfView, end: endOfView });
  };

  // Combine regular schedule with follow-ups
  const getEventsForCurrentView = (): Event[] => {
    let events: Event[] = [];
    
    // Add daily schedule template events
    if (view === 'day') {
      events = dailyScheduleTemplate.map(template => ({
        ...template,
        id: `${selectedDate.toISOString()}-${template.startTime}`,
        date: selectedDate,
      }));
    } else {
      const daysToShow = view === '3days' ? 3 : 7;
      for (let i = 0; i < daysToShow; i++) {
        const currentDate = addDays(selectedDate, i);
        events = [...events, ...dailyScheduleTemplate.map(template => ({
          ...template,
          id: `${currentDate.toISOString()}-${template.startTime}`,
          date: currentDate,
        }))];
      }
    }

    // Add follow-ups to events
    const allEvents = [...events, ...followUps];
    
    // Sort events by time
    return allEvents.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare === 0) {
        return a.startTime.localeCompare(b.startTime);
      }
      return dateCompare;
    });
  };

  useEffect(() => {
    fetchFollowUps();
  }, [selectedDate, view]);

  return (
    <LinearGradient colors={['#FFF8F0', '#FFF']} style={styles.container}>
      <TelecallerMainLayout showDrawer showBackButton={true} showBottomTabs={true} title="My Schedule">
        <View style={styles.header}>
          <View style={styles.dateNavigation}>
            <IconButton
              icon="chevron-left"
              size={24}
              onPress={() => navigateDate('prev')}
            />
            <Text style={styles.currentDateText}>
              {format(selectedDate, 'MMMM d, yyyy')}
            </Text>
            <IconButton
              icon="chevron-right"
              size={24}
              onPress={() => navigateDate('next')}
            />
          </View>
          
          <SegmentedButtons
            value={view}
            onValueChange={setView}
            buttons={[
              { value: 'day', label: 'Day' },
              { value: '3days', label: '3 Days' },
              { value: 'week', label: 'Week' },
            ]}
          />
        </View>

        {view === 'day' && renderDayView()}
        {view === '3days' && renderMultiDayView(3)}
        {view === 'week' && renderMultiDayView(7)}
        {renderEventModal()}
        {renderFollowUpModal()}
      </TelecallerMainLayout>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  dayContainer: {
    flex: 1,
  },
  multiDayContainer: {
    flex: 1,
  },
  daysHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  dateHeader: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  scheduleContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  timeColumn: {
    width: 60,
    paddingTop: 8,
    borderRightWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    position: 'sticky',
    left: 0,
    zIndex: 1,
  },
  timeSlot: {
    height: 30,
    textAlign: 'right',
    paddingRight: 8,
    color: '#666',
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
  },
  eventsContainer: {
    flex: 1,
    position: 'relative',
    minHeight: 610, // 21 slots * 30px for full day coverage
    marginBottom: 80,
  },
  dayColumn: {
    width: 150,
    position: 'relative',
    borderRightWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 630, // Match eventsContainer height
    marginBottom: 80,
    
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  modalBody: {
    marginBottom: 20,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginLeft: 12,
  },
  modalFooter: {
    alignItems: 'flex-end',
  },
  modalButton: {
    backgroundColor: '#FF8447',
  },
  timeHeaderCell: {
    width: 60,
  },
  dayHeaderCell: {
    width: 150,
    alignItems: 'center',
    padding: 8,
    borderRightWidth: 1,
    borderColor: '#E0E0E0',
  },
  scrollContainer: {
    flex: 1,
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  currentDateText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginHorizontal: 16,
  },
  followUpCard: {
    position: 'absolute',
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    zIndex: 2,
  },
  followUpContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  followUpTitle: {
    fontSize: 12,
    fontFamily: 'LexendDeca_500Medium',
    flex: 1,
    marginHorizontal: 8,
  },
  followUpTime: {
    fontSize: 12,
    fontFamily: 'LexendDeca_500Medium',
  },
  followUpModalContent: {
    width: '95%',
    maxHeight: '80%',
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 20,
  },
  followUpModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    paddingBottom: 12,
  },
  followUpModalTitle: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  followUpModalBody: {
    marginBottom: 20,
  },
  followUpDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  followUpDetailText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  followUpModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  followUpButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  eventCard: {
    padding: 8,
    borderRadius: 8,
    position: 'absolute',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    borderWidth: 1,
    zIndex: 1,
  },
  shortEventCard: {
    padding: 4,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 12,
    fontFamily: 'LexendDeca_500Medium',
    marginBottom: 4,
  },
  shortEventTitle: {
    fontSize: 11,
    marginBottom: 0,
    textAlign: 'center',
    fontFamily: 'LexendDeca_600SemiBold',
  },
  eventTime: {
    fontSize: 10,
    fontFamily: 'LexendDeca_400Regular',
  },
});

export default ScheduleScreen;