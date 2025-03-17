import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient} from "expo-linear-gradient";
import BDMScreenHeader from "@/app/Screens/BDM/BDMScreenHeader";
import { useNavigation, NavigationProp } from '@react-navigation/native';

type RootStackParamList = {
  BDMPersonNote: {
    name: string;
    time: string;
    duration: string;
    type: string;
    notes: string[];
  };
};

type Meeting = {
  date: string;
  time: string;
  duration: string;
  notes?: string[];
};

type CallHistoryScreenProps = {
  route: {
    params: {
      customerName: string;
      meetings: Meeting[];
    };
  };
};

const CallHistoryScreen = ({ route }: CallHistoryScreenProps) => {
  const { customerName, meetings } = route.params;
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  // Group meetings by date
  const groupedMeetings = meetings.reduce((acc, meeting) => {
    if (!acc[meeting.date]) {
      acc[meeting.date] = [];
    }
    acc[meeting.date].push(meeting);
    return acc;
  }, {} as Record<string, Meeting[]>);

  // Calculate total duration for a date
  const calculateTotalDuration = (dateMeetings: Meeting[]) => {
    const totalMinutes = dateMeetings.reduce((sum, meeting) => {
      const duration = meeting.duration;
      let minutes = 0;
      if (duration.includes('h')) {
        minutes += parseInt(duration) * 60;
      }
      if (duration.includes('m')) {
        minutes += parseInt(duration.split(' ')[1] || '0');
      }
      return sum + minutes;
    }, 0);

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} hr ${minutes} mins`;
  };

  return (
    <LinearGradient colors={['#f0f4f8', '#fcf1e8']} style={styles.container}>
        <BDMScreenHeader title="Call History" />
      <View style={styles.header}>
        <Text style={styles.customerName}>{customerName}</Text>
        <Text style={styles.subHeader}>Meeting History</Text>
      </View>

      <ScrollView>
        {Object.entries(groupedMeetings).map(([date, dateMeetings]) => (
          <View key={date}>
            <View style={styles.dateHeader}>
              <Text style={styles.dateText}>{date}</Text>
              <Text style={styles.totalDuration}>{calculateTotalDuration(dateMeetings)}</Text>
            </View>

            {dateMeetings.map((meeting, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.meetingContainer}
                onPress={() => navigation.navigate('BDMPersonNote', {
                  name: customerName,
                  time: meeting.time,
                  duration: meeting.duration,
                  type: 'Prospect',
                  notes: meeting.notes || [],
                })}
              >
                <View style={styles.meetingInfo}>
                  <Text style={styles.time}>{meeting.time}</Text>
                  <Text style={styles.duration}>{meeting.duration}</Text>
                </View>
                <MaterialIcons 
                  name="chevron-right"
                  size={24} 
                  color="#666" 
                />
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  header: {
    padding: 16,
  },
  customerName: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  subHeader: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 4,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dateText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  totalDuration: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  meetingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 1,
  },
  meetingInfo: {
    flex: 1,
  },
  time: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginBottom: 4,
  },
  duration: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  notesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  noteItem: {
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    lineHeight: 20,
  },
  characterCount: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
});

export default CallHistoryScreen;