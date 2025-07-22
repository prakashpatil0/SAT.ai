import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { useProfile } from '@/app/context/ProfileContext';

interface MeetingTickerPillProps {
  role: 'bdm' | 'telecaller';
}

const TICKER_HEIGHT = 36;

const MeetingTickerPill: React.FC<MeetingTickerPillProps> = ({ role }) => {
  const { userProfile } = useProfile();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef<FlatList<any>>(null);
  const currentIndex = useRef(0);

  useEffect(() => {
    if (!userProfile?.id) return;
    setIsLoading(true);
    let unsubscribe: (() => void) | undefined;
    if (role === 'bdm') {
      const meetingRef = collection(db, 'bdm_schedule_meeting');
      const q = query(meetingRef, where('userId', '==', userProfile.id));
      unsubscribe = onSnapshot(q, (querySnapshot) => {
        const now = new Date();
        const meetingsData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            meetingId: data.meetingId || doc.id,
            meetingDate: data.meetingDate || { seconds: 0 },
            individuals: data.individuals || [],
            meetingTime: data.meetingTime || 'N/A',
          };
        });
        // Only keep upcoming meetings
        const upcomingMeetings = meetingsData.filter(meeting =>
          new Date(meeting.meetingDate.seconds * 1000) > now
        );
        setItems(upcomingMeetings);
        setIsLoading(false);
      }, (error) => {
        setItems([]);
        setIsLoading(false);
      });
    } else if (role === 'telecaller') {
      const followupRef = collection(db, 'followups');
      const q = query(followupRef, where('userId', '==', userProfile.id));
      unsubscribe = onSnapshot(q, (querySnapshot) => {
        const now = new Date();
        const followupsData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            date: data.date?.toDate ? data.date.toDate() : data.date,
            startTime: data.startTime || '',
            contactName: data.contactName || '',
            phoneNumber: data.phoneNumber || '',
            status: data.status || '',
          };
        });
        // Only keep upcoming followups
        const upcomingFollowups = followupsData.filter(fu => fu.date && new Date(fu.date) > now);
        setItems(upcomingFollowups);
        setIsLoading(false);
      }, (error) => {
        setItems([]);
        setIsLoading(false);
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [role, userProfile?.id]);

  // Auto-scroll logic
  useEffect(() => {
    if (items.length > 1 && flatListRef.current) {
      currentIndex.current = 0;
      const interval = setInterval(() => {
        if (currentIndex.current >= items.length) {
          currentIndex.current = 0;
        }
        if (flatListRef.current) {
          try {
            flatListRef.current.scrollToIndex({
              animated: true,
              index: currentIndex.current,
            });
            currentIndex.current = (currentIndex.current + 1) % items.length;
          } catch (e) {
            currentIndex.current = 0;
          }
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [items]);

  return (
    <View style={styles.meetingPill}>
      <View style={styles.meetingLeft}>
        {/* <MaterialIcons name="person" size={18} color="#374151" /> */}
        <View style={styles.meetingTickerContainer}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#FF8447" />
          ) : items.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={items}
              keyExtractor={(item) => item.meetingId || item.id}
              pagingEnabled
              snapToAlignment="start"
              snapToInterval={TICKER_HEIGHT}
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              getItemLayout={(_, index) => ({
                length: TICKER_HEIGHT,
                offset: TICKER_HEIGHT * index,
                index,
              })}
              style={{ height: TICKER_HEIGHT }}
              renderItem={({ item }) => {
                if (role === 'bdm') {
                  const meetingTime = new Date(item.meetingDate.seconds * 1000);
                  const formattedDate = meetingTime.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    // year: 'numeric',
                  });
                  return (
                    <View style={styles.meetingTickerItem}>
                      <Text style={styles.meetingTitle}>{item.individuals[0]?.name || 'N/A'}</Text>
                      <Text style={styles.meetingTime}>{formattedDate} ⌛ {item.meetingTime || 'N/A'}</Text>
                    </View>
                  );
                } else {
                  // telecaller
                  const formattedDate = item.date ? new Date(item.date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    // year: 'numeric',
                  }) : 'N/A';
                  return (
                    <View style={styles.meetingTickerItem}>
                      <Text style={styles.meetingTitle}>{item.contactName || item.phoneNumber || 'N/A'}</Text>
                      <Text style={styles.meetingTime}>{formattedDate} ⌛ {item.startTime || 'N/A'}</Text>
                    </View>
                  );
                }
              }}
            />
          ) : (
            <View style={styles.meetingTickerItem}>
              <Text style={styles.meetingTitle}>No upcoming {role === 'bdm' ? 'meetings' : 'meetings'}</Text>
              {/* <Text style={styles.meetingTime}>You're all caught up! 🎉</Text> */}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  meetingPill: {
    height: 15 + 14, // ticker height + padding
    backgroundColor: '#E6F4F1',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: 1.5,
    borderColor: '#FF8447',
    borderStyle: 'dashed',
    minWidth: 220,
    maxWidth: 350,
    alignSelf: 'center',
    marginHorizontal: 8,
  },
  meetingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  meetingTickerContainer: {
    marginLeft: 8,
    height: TICKER_HEIGHT,
    overflow: 'hidden',
    justifyContent: 'center',
    flex: 1,
  },
  meetingTickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TICKER_HEIGHT,
  },
  meetingTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#374151',
    marginRight: 6,
  },
  meetingTime: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#374151',
  },
});

export default MeetingTickerPill; 