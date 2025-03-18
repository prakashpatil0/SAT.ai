import React, { useState, useRef } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Animated, Image } from "react-native";
import { ProgressBar, Card } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { useProfile } from '@/app/context/ProfileContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BDMStackParamList, RootStackParamList } from '@/app/index';
import BDMMainLayout from '@/app/components/BDMMainLayout';

const BDMHomeScreen = () => {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Sample Meetings Data with dates
  const meetings = [
    { 
      id: '1', 
      name: 'Hardik Pandya', 
      time: '2:00 PM', 
      duration: '1 hr 30 mins', 
      date: 'Today (23rd Jan)',
      type: 'person' 
    },
    { 
      id: '2', 
      name: 'Glycon Tech', 
      time: '1:00 PM', 
      duration: '1 hr', 
      date: 'Today (23rd Jan)',
      type: 'company' 
    },
    { 
      id: '3', 
      name: 'Aarav Pandey', 
      time: '12:50 PM', 
      duration: '30 mins', 
      date: 'Today (23rd Jan)',
      type: 'person' 
    },
    { 
      id: '4', 
      name: 'Google', 
      time: '1:00 PM', 
      duration: '1 hr', 
      date: 'Yesterday (24th Jan)',
      type: 'company' 
    },
    { 
      id: '5', 
      name: 'Alia Bhatt +2 Others', 
      time: '1:00 PM', 
      duration: '1 hr', 
      date: 'Yesterday (24th Jan)',
      type: 'person' 
    },
    { 
      id: '6', 
      name: 'Anjali Deshpandey', 
      time: '12:00 PM', 
      duration: '1 hr', 
      date: 'Yesterday (24th Jan)',
      type: 'person' 
    },
  ];

  // Calculate total duration for a specific date
  const calculateTotalDuration = (date: string) => {
    const dayMeetings = meetings.filter(m => m.date === date);
    let totalMinutes = 0;

    dayMeetings.forEach(meeting => {
      const duration = meeting.duration;
      if (duration.includes('hr')) {
        totalMinutes += parseInt(duration) * 60;
      }
      if (duration.includes('mins')) {
        totalMinutes += parseInt(duration.split(' ')[0]);
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0 && minutes > 0) {
      return `${hours} hr ${minutes} mins`;
    } else if (hours > 0) {
      return `${hours} hr`;
    }
    return `${minutes} mins`;
  };

  // Handle Card Click
  const handleCardClick = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCardId(expandedCardId === id ? null : id);
  };

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <BDMMainLayout showBackButton={false} showBottomTabs>
      <View style={styles.content}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Welcome Back, 👋</Text>
          <Text style={styles.nameText}>Samiksha</Text>
          
          {/* Progress Section */}
          <View style={styles.progressSection}>
            <ProgressBar 
              progress={0.4} 
              color="#FF8447" 
              style={styles.progressBar} 
            />
            <Text style={styles.progressText}>
              Great job! You've completed <Text style={styles.progressHighlight}>40%</Text> of your target
            </Text>
          </View>
        </View>

        {/* Meetings Section */}
        <Text style={styles.sectionTitle}>Meetings History</Text>
        <FlatList
          data={meetings}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const isNewDate = index === 0 || meetings[index - 1].date !== item.date;
            const isExpanded = expandedCardId === item.id;

            return (
              <>
                {isNewDate && (
                  <View style={styles.dateHeader}>
                    <Text style={styles.dateText}>{item.date}</Text>
                    <Text style={styles.durationText}>{calculateTotalDuration(item.date)}</Text>
                  </View>
                )}
                <TouchableOpacity 
                  onPress={() => {
                    if (item.type === 'company') {
                      navigation.navigate('BDMCompanyDetails', { 
                        company: {
                          name: item.name
                        }
                      });
                    } else {
                      navigation.navigate('BDMContactDetails', { 
                        contact: {
                          name: item.name,
                          phone: '+91 87392 83729',
                          email: `${item.name.toLowerCase().replace(' ', '')}@gmail.com`
                        }
                      });
                    }
                  }}
                >
                  <Card style={styles.meetingCard}>
                    <View style={styles.meetingInfo}>
                      <TouchableOpacity 
                        style={styles.iconContainer}
                        onPress={() => {
                          if (item.type === 'company') {
                            navigation.navigate('BDMCompanyDetails', { 
                              company: {
                                name: item.name
                              }
                            });
                          } else {
                            navigation.navigate('BDMContactDetails', { 
                              contact: {
                                name: item.name,
                                phone: '+91 87392 83729',
                                email: `${item.name.toLowerCase().replace(' ', '')}@gmail.com`
                              }
                            });
                          }
                        }}
                      >
                        <MaterialIcons 
                          name={item.type === 'company' ? 'business' : 'person'} 
                          size={24} 
                          color="#FF8447" 
                        />
                      </TouchableOpacity>
                      <View style={styles.meetingDetails}>
                        <Text style={styles.meetingName}>{item.name}</Text>
                        <Text style={styles.meetingTime}>{item.time} • {item.duration}</Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              </>
            );
          }}
        />
      </View>
    </BDMMainLayout>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 20,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 22,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
  },
  nameText: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#222',
    marginTop: 4,
  },
  progressSection: {
    marginTop: 16,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  progressHighlight: {
    color: '#FF8447',
    fontFamily: 'LexendDeca_600SemiBold',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  dateText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  durationText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  meetingCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  meetingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  meetingDetails: {
    flex: 1,
  },
  meetingName: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  meetingTime: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  actionText: {
    marginLeft: 8,
    fontFamily: "LexendDeca_400Regular",
    fontSize: 14,
    color: '#666',
  },
});

export default BDMHomeScreen;