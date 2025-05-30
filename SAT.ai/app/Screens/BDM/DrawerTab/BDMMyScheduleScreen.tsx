import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SegmentedButtons, Button, IconButton, Surface } from 'react-native-paper';
import { format, addDays, isToday, isTomorrow, startOfWeek, isWithinInterval, subDays, startOfDay, endOfDay, addHours, subHours, addMinutes, subMinutes } from 'date-fns';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import { useNavigation } from "@react-navigation/native";
import * as Haptics from 'expo-haptics';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getAuth } from 'firebase/auth';
import AppGradient from '@/app/components/AppGradient';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  type: 'morning' | 'individual' | 'company' | 'break' | 'followup';
  description?: string;
  date: Date;
  isRecurring?: boolean;
  contactName?: string;
  phoneNumber?: string;
  status?: string;
  color?: string;
}

interface NotificationData {
  followUpId: string;
  title: string;
  body: string;
  triggerDate: Date;
}

const BDMMyScheduleScreen = () => {
  const navigation = useNavigation();
  const [view, setView] = useState<'day' | '3days' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isFollowUpModalVisible, setIsFollowUpModalVisible] = useState(false);
  const [followUps, setFollowUps] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationIds, setNotificationIds] = useState<string[]>([]);

  // Fixed daily schedule template with meetings and break times
  const dailyScheduleTemplate = [
    {
      title: 'Morning Meeting',
      startTime: '09:00',
      endTime: '10:00',
      type: 'morning' as const,
      isRecurring: true,
      color: '#F3E8FF',
    },
    {
      title: 'Client Meetings',
      startTime: '10:00',
      endTime: '13:00',
      type: 'individual' as const,
      isRecurring: true,
      color: '#FFF5E6',
    },
    {
      title: 'Break Time',
      startTime: '13:00',
      endTime: '14:00',
      type: 'break' as const,
      isRecurring: true,
      color: '#E3F2FD',
    },
    {
      title: 'Company Visits',
      startTime: '14:00',
      endTime: '19:00',
      type: 'company' as const,
      isRecurring: true,
      color: '#F3E8FF',
    }
  ];

  const navigateDate = (direction: 'prev' | 'next') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const days = view === 'day' ? 1 : view === '3days' ? 3 : 7;
    setSelectedDate(current => 
      direction === 'next' ? addDays(current, days) : subDays(current, days)
    );
  };

  const getEventColor = (type: string) => {
    switch(type) {
      case 'morning': return { bg: '#E1F5FE', text: '#0288D1', border: '#81D4FA' };
      case 'individual': return { bg: '#FFF3E0', text: '#FF8447', border: '#FFB74D' };
      case 'company': return { bg: '#F3E8FF', text: '#9C27B0', border: '#CE93D8' };
      case 'break': return { bg: '#E8F5E9', text: '#2E7D32', border: '#81C784' };
      case 'followup': return { bg: '#FCE4EC', text: '#C2185B', border: '#F48FB1' };
      default: return { bg: '#FFF', text: '#333', border: '#DDD' };
    }
  };

  const getMinutesFromTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + (minutes || 0);
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
                setIsFollowUpModalVisible(false);
                // Add navigation to call screen or dialer here
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
      setIsLoading(true);
      const auth = getAuth();
      const userId = auth.currentUser?.uid;

      if (!userId) {
        setIsLoading(false);
        return;
      }

      const followupsRef = collection(db, 'followups');
      const q = query(
        followupsRef,
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      const fetchedFollowUps: Event[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const followupDate = data.date.toDate();
        
        if (isDateInCurrentView(followupDate)) {
          const followUp: Event = {
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
          };
          
          fetchedFollowUps.push(followUp);
          
          // Schedule notifications for this follow-up
          scheduleFollowUpNotifications(followUp);
        }
      });

      setFollowUps(fetchedFollowUps);
    } catch (error) {
      console.error('Error fetching follow-ups:', error);
    } finally {
      setIsLoading(false);
    }
  };

 const scheduleFollowUpNotifications = async (followUp: Event) => {
  try {
    // Cancel any previously scheduled notifications
    const existingIds = await AsyncStorage.getItem(`notifications_${followUp.id}`);
    if (existingIds) {
      const ids = JSON.parse(existingIds);
      await Promise.all(ids.map((id: string) => Notifications.cancelScheduledNotificationAsync(id)));
    }

    const followUpDateTime = new Date(followUp.date);
    const [hours, minutes] = followUp.startTime.split(':').map(Number);
    followUpDateTime.setHours(hours, minutes, 0);

    const tenMinutesBefore = subMinutes(followUpDateTime, 10);

    if (tenMinutesBefore > new Date()) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ Upcoming Follow-up`,
          body: `In 10 min: ${followUp.contactName || 'Follow-up'} at ${followUp.startTime}`,
          data: { followUpId: followUp.id },
          sound: true,
        },
        trigger: {
          seconds: Math.floor((tenMinutesBefore.getTime() - Date.now()) / 1000),
          repeats: false,
          type: 'timeInterval',
        },
      });

      // Save notification ID
      await AsyncStorage.setItem(`notifications_${followUp.id}`, JSON.stringify([id]));
      setNotificationIds(prev => [...prev, id]);
    }

  } catch (error) {
    console.error('Error scheduling 10-min follow-up notification:', error);
  }
};


  // Add notification listener for snooze action
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const followUpId = response.notification.request.content.data.followUpId;
      if (response.actionIdentifier === 'SNOOZE') {
        handleSnoozeNotification(followUpId);
      }
    });

    return () => subscription.remove();
  }, []);

  const handleSnoozeNotification = async (followUpId: string) => {
    try {
      const followUp = followUps.find(f => f.id === followUpId);
      if (followUp) {
        // Schedule a new notification for 15 minutes later
        const snoozeTime = addMinutes(new Date(), 15);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Snoozed Follow-up',
            body: `Follow-up with ${followUp.contactName}`,
            data: { followUpId },
          },
          trigger: {
            seconds: 15 * 60, // 15 minutes in seconds
            repeats: false,
            type: 'timeInterval'
          },
        });
      }
    } catch (error) {
      console.error('Error snoozing notification:', error);
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
    loadScheduleData(); // Load saved schedule data
  }, [selectedDate, view]);

  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  const registerForPushNotificationsAsync = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!');
        return;
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
    }
  };

  const saveScheduleData = async (events: Event[]) => {
    try {
      await AsyncStorage.setItem('bdm_schedule_data', JSON.stringify(events));
    } catch (error) {
      console.error('Error saving schedule data:', error);
    }
  };

  const loadScheduleData = async () => {
    try {
      const scheduleDataString = await AsyncStorage.getItem('bdm_schedule_data');
      if (scheduleDataString) {
        const scheduleData = JSON.parse(scheduleDataString);
        setFollowUps(scheduleData);
      }
    } catch (error) {
      console.error('Error loading schedule data:', error);
    }
  };

  return (
    <AppGradient>
      <BDMMainLayout title="My Schedule" showBackButton showDrawer showBottomTabs={true}>
      <View style={styles.container}>
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
            onValueChange={(value) => setView(value as 'day' | '3days' | 'week')}
            buttons={[
              { value: 'day', label: 'Day' },
              { value: '3days', label: '3 Days' },
              { value: 'week', label: 'Week' },
            ]}
          />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF8447" />
            <Text style={styles.loadingText}>Loading schedule...</Text>
          </View>
        ) : (
          <>
            {view === 'day' && renderDayView()}
            {view === '3days' && renderMultiDayView(3)}
            {view === 'week' && renderMultiDayView(7)}
          </>
        )}
        
        {renderEventModal()}
        {renderFollowUpModal()}
      </View>
    </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
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
    borderColor: '#E0E0E0',
    backgroundColor: 'transparent',
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
    minHeight: 630, // 21 slots * 30px for full day coverage
  },
  dayColumn: {
    width: 150,
    position: 'relative',
    borderRightWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 630, // Match eventsContainer height
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 16,
  },
});

export default BDMMyScheduleScreen; 