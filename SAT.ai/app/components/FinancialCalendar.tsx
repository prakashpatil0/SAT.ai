import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

interface Event {
  id: string;
  title: string;
  type: 'holiday' | 'meeting' | 'event';
  date: string; // yyyy-MM-dd
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const FinancialCalendar = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewingMonth, setViewingMonth] = useState(selectedDate.getMonth());
  const [viewingYear, setViewingYear] = useState(selectedDate.getFullYear());
  const [eventsData, setEventsData] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [viewingMonth, viewingYear]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'Financial_Calendar'));
      const expandedEvents: Event[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const title = data.title || 'Untitled';

        const typeRaw = (data.type || '').toLowerCase();
        const type: Event['type'] =
          typeRaw === 'eve' ? 'event' :
          typeRaw === 'holiday' ? 'holiday' :
          typeRaw === 'meeting' ? 'meeting' :
          'event';

        let start = '';
        let end = '';

        try {
          if (data.startdate?.toDate) {
            const startObj = data.startdate.toDate();
            start = `${startObj.getFullYear()}-${(startObj.getMonth() + 1).toString().padStart(2, '0')}-${startObj.getDate().toString().padStart(2, '0')}`;
          }
          if (data.enddate?.toDate) {
            const endObj = data.enddate.toDate();
            end = `${endObj.getFullYear()}-${(endObj.getMonth() + 1).toString().padStart(2, '0')}-${endObj.getDate().toString().padStart(2, '0')}`;
          }
        } catch (e) {
          console.warn(`❗ Invalid date in doc ${docSnap.id}`, data);
          continue;
        }

        if (!start) continue;

        const startDateObj = new Date(start);
        const endDateObj = end ? new Date(end) : startDateObj;

        for (
          let d = new Date(startDateObj);
          d <= endDateObj;
          d.setDate(d.getDate() + 1)
        ) {
          const currentDate = format(new Date(d), 'yyyy-MM-dd');

          expandedEvents.push({
            id: `${docSnap.id}_${currentDate}_${Math.random()}`,
            title,
            type,
            date: currentDate,
          });
        }
      }

      const monthStr = String(viewingMonth + 1).padStart(2, '0');
      const startOfMonth = `${viewingYear}-${monthStr}`;

      const filtered = expandedEvents.filter(
        event => event.date && event.date.startsWith(startOfMonth)
      );

      setEventsData(filtered);
    } catch (error) {
      console.error('🔥 Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const daysInMonth = (month: number, year: number) =>
    new Date(year, month + 1, 0).getDate();

  const getColorByType = (type: Event['type']) => {
    switch (type) {
      case 'holiday': return '#FF6B6B';
      case 'meeting': return '#5FBBE6';
      case 'event': return '#28a745';
      default: return '#ccc';
    }
  };

  const renderCalendar = () => {
    const days = daysInMonth(viewingMonth, viewingYear);
    const startDay = new Date(viewingYear, viewingMonth, 1).getDay();
    const emptyDays = Array.from({ length: startDay }, () => null);
    const dates = Array.from({ length: days }, (_, i) => i + 1);
    const fullGrid = [...emptyDays, ...dates];
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    return (
      <View style={styles.calendarGrid}>
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
          <Text key={d} style={styles.weekdayText}>{d}</Text>
        ))}
        {fullGrid.map((day, index) => {
          const dateStr = day
            ? format(new Date(viewingYear, viewingMonth, day), 'yyyy-MM-dd')
            : '';
          const events = day
            ? eventsData.filter(e => e.date === dateStr)
            : [];

          const isToday = dateStr === todayStr;

          return (
            <TouchableOpacity
              key={index}
              style={[styles.dayBox, isToday && styles.todayBox]}
              disabled={!day}
            >
              {day && (
                <Text style={[styles.dayText, isToday && styles.todayText]}>
                  {day}
                </Text>
              )}
              {events.length > 0 && (
                <View style={styles.dotContainer}>
                  {events.slice(0, 3).map((e, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        { backgroundColor: getColorByType(e.type), marginRight: 2 },
                      ]}
                    />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const changeMonth = (increment: number) => {
    let newMonth = viewingMonth + increment;
    let newYear = viewingYear;

    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }

    setViewingMonth(newMonth);
    setViewingYear(newYear);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => changeMonth(-1)}>
          <MaterialIcons name="chevron-left" size={28} color="#09142D" />
        </TouchableOpacity>
        <Text style={styles.headerText}>
          {months[viewingMonth]} {viewingYear}
        </Text>
        <TouchableOpacity onPress={() => changeMonth(1)}>
          <MaterialIcons name="chevron-right" size={28} color="#09142D" />
        </TouchableOpacity>
      </View>

      {renderCalendar()}

      <View style={styles.eventsSection}>
        <Text style={styles.eventsHeader}>
          Events in {months[viewingMonth]}:
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#28a745" />
        ) : (
          <FlatList
            data={eventsData}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Text style={styles.noEventText}>No events this month.</Text>
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.eventCard,
                  { backgroundColor: getColorByType(item.type) },
                ]}
              >
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventType}>{item.type.toUpperCase()}</Text>
                <Text style={styles.eventDate}>
                  {item.date
                    ? format(new Date(item.date), 'dd MMM yyyy')
                    : 'Invalid Date'}
                </Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            style={{ maxHeight: 200 }}
          />
        )}
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    flex: 1, 
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF8447',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    padding: 4,
  },
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    marginBottom: 6,
    fontWeight: 'bold',
    color: 'black',
  },
  dayBox: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#FFF',
    position: 'relative',
  },
  selectedDay: {
    backgroundColor: '#FF8447',
  },
  dayText: {
    fontSize: 14,
    color: '#333',
  },
    dotContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    bottom: 0, 
  },
  eventsSection: {
    marginTop: 24,
  },
  eventsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#09142D',
    marginBottom: 12,
  },
  eventCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 3,
  },
  eventTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  eventType: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
  },
  eventDate: {
    fontSize: 12,
    color: '#fff',
    marginTop: 2,
  },
  noEventText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    fontSize: 14,
  },
    todayBox: {
    backgroundColor: '#FF8447',
    borderColor: '#FF8447',
  },
  todayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});


export default FinancialCalendar;


