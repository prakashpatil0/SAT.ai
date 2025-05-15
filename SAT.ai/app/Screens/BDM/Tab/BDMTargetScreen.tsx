import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Animated, Easing, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import { auth, db } from '@/firebaseConfig';
import { collection, query, where, getDocs, Timestamp, onSnapshot, getDoc, doc, orderBy, limit } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSharedValue, withRepeat, withSequence, withTiming, withDelay, useAnimatedStyle } from 'react-native-reanimated';
import AnimatedReanimated from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface TargetData {
  projectedMeetings: { achieved: number; target: number };
  attendedMeetings: { achieved: number; target: number };
  meetingDuration: { achieved: string; target: string };
  closing: { achieved: number; target: number };
}

const SkeletonLoader = ({ width, height, style }: { width: number | string; height: number; style?: any }) => {
  const [opacity] = useState(new Animated.Value(0.3));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: '#E5E7EB',
          borderRadius: 8,
          opacity,
        },
        style,
      ]}
    />
  );
};

const BDMTargetScreen = () => {
  const navigation = useNavigation();
  const [targetData, setTargetData] = useState<TargetData>({
    projectedMeetings: { achieved: 0, target: 30 },
    attendedMeetings: { achieved: 0, target: 30 },
    meetingDuration: { achieved: '00:00:00', target: '00:00:00' },
    closing: { achieved: 0, target: 50000 }
  });
  const [progressAnim] = useState(new Animated.Value(0));
  const [overallProgress, setOverallProgress] = useState(0);
  const [lastWeekProgress, setLastWeekProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [waveAnimation] = useState(new Animated.Value(0));
  const [error, setError] = useState<string | null>(null);

  const fetchTargetData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setError('User not authenticated');
        return;
      }

      // First get user data to get employeeId
      const userDoc = await getDoc(doc(db, "users", userId));
      let employeeId = null;
      let userEmail = auth.currentUser?.email;

      if (userDoc.exists()) {
        const userData = userDoc.data();
        employeeId = userData.employeeId;
        userEmail = userData.email || userEmail;
      }

      if (!userEmail) {
        setError('User email not found');
        return;
      }

      // Fetch target data from Firebase
      const targetDataRef = collection(db, 'bdm_target_data');
      let q;
      if (employeeId) {
        q = query(
          targetDataRef,
          where('employeeId', '==', employeeId),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
      } else {
        q = query(
          targetDataRef,
          where('emailId', '==', userEmail),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
      }

      const targetSnapshot = await getDocs(q);
      
      if (targetSnapshot.empty) {
        console.log('No target data found, using default values');
        // Continue with default values
      } else {
        const targetDoc = targetSnapshot.docs[0].data();
        console.log('Found target data:', targetDoc);
        
        // Update target values from Firebase
        targetData.projectedMeetings.target = targetDoc.numMeetings || 30;
        targetData.attendedMeetings.target = targetDoc.positiveLeads || 30;
        targetData.meetingDuration.target = `${targetDoc.meetingDuration || '20'}:00:00`;
        targetData.closing.target = targetDoc.closingAmount || 50000;
      }

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const startOfLastWeek = new Date(startOfWeek);
      startOfLastWeek.setDate(startOfWeek.getDate() - 7);
      const endOfLastWeek = new Date(startOfWeek);
      endOfLastWeek.setDate(startOfLastWeek.getDate() - 1);
      endOfLastWeek.setHours(23, 59, 59, 999);

      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const currentWeekNumber = Math.ceil((now.getDate() + new Date(currentYear, now.getMonth(), 1).getDay()) / 7);
      
      const lastWeekDate = new Date(startOfLastWeek);
      const lastWeekMonth = lastWeekDate.getMonth() + 1;
      const lastWeekYear = lastWeekDate.getFullYear();
      const lastWeekNumber = Math.ceil((lastWeekDate.getDate() + new Date(lastWeekYear, lastWeekDate.getMonth(), 1).getDay()) / 7);

      const reportsRef = collection(db, 'bdm_reports');
      const [currentWeekSnapshot, lastWeekSnapshot] = await Promise.all([
        getDocs(query(
          reportsRef,
          where('userId', '==', userId),
          where('year', '==', currentYear),
          where('month', '==', currentMonth),
          where('weekNumber', '==', currentWeekNumber)
        )),
        getDocs(query(
          reportsRef,
          where('userId', '==', userId),
          where('year', '==', lastWeekYear),
          where('month', '==', lastWeekMonth),
          where('weekNumber', '==', lastWeekNumber)
        ))
      ]);

      let totalMeetings = 0;
      let totalAttendedMeetings = 0;
      let totalDuration = 0;
      let totalClosing = 0;

      currentWeekSnapshot.forEach(doc => {
        const data = doc.data();
        totalMeetings += data.numMeetings || 0;
        totalAttendedMeetings += data.positiveLeads || 0;
        totalClosing += data.totalClosingAmount || 0;
        
        const durationStr = data.meetingDuration || '';
        if (durationStr.includes(':')) {
          const [hours, minutes, seconds] = durationStr.split(':').map(Number);
          totalDuration += (hours * 3600) + (minutes * 60) + seconds;
        } else {
          const hrMatch = durationStr.match(/(\d+)\s*hr/);
          const minMatch = durationStr.match(/(\d+)\s*min/);
          const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) +
                       (minMatch ? parseInt(minMatch[1]) / 60 : 0);
          totalDuration += hours * 3600;
        }
      });

      let lastWeekMeetings = 0;
      let lastWeekAttendedMeetings = 0;
      let lastWeekDuration = 0;
      let lastWeekClosing = 0;

      lastWeekSnapshot.forEach(doc => {
        const data = doc.data();
        lastWeekMeetings += data.numMeetings || 0;
        lastWeekAttendedMeetings += data.positiveLeads || 0;
        lastWeekClosing += data.totalClosingAmount || 0;
        
        const durationStr = data.meetingDuration || '';
        if (durationStr.includes(':')) {
          const [hours, minutes, seconds] = durationStr.split(':').map(Number);
          lastWeekDuration += (hours * 3600) + (minutes * 60) + seconds;
        } else {
          const hrMatch = durationStr.match(/(\d+)\s*hr/);
          const minMatch = durationStr.match(/(\d+)\s*min/);
          const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) +
                       (minMatch ? parseInt(minMatch[1]) / 60 : 0);
          lastWeekDuration += hours * 3600;
        }
      });

      const formatDuration = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      };

      const newTargetData = {
        projectedMeetings: { 
          achieved: totalMeetings, 
          target: targetData.projectedMeetings.target 
        },
        attendedMeetings: { 
          achieved: totalAttendedMeetings, 
          target: targetData.attendedMeetings.target 
        },
        meetingDuration: { 
          achieved: formatDuration(totalDuration), 
          target: targetData.meetingDuration.target 
        },
        closing: { 
          achieved: totalClosing, 
          target: targetData.closing.target 
        }
      };

      setTargetData(newTargetData);

      const meetingsPercentage = (totalMeetings / targetData.projectedMeetings.target) * 100;
      const attendedPercentage = (totalAttendedMeetings / targetData.attendedMeetings.target) * 100;
      const durationPercentage = (totalDuration / (parseInt(targetData.meetingDuration.target) * 3600)) * 100;
      const closingPercentage = (totalClosing / targetData.closing.target) * 100;

      const overallProgress = Math.min(
        (meetingsPercentage + attendedPercentage + durationPercentage + closingPercentage) / 4,
        100
      );

      setOverallProgress(Math.min(overallProgress, 100));

      const lastWeekMeetingsPercentage = (lastWeekMeetings / targetData.projectedMeetings.target) * 100;
      const lastWeekAttendedPercentage = (lastWeekAttendedMeetings / targetData.attendedMeetings.target) * 100;
      const lastWeekDurationPercentage = (lastWeekDuration / (parseInt(targetData.meetingDuration.target) * 3600)) * 100;
      const lastWeekClosingPercentage = (lastWeekClosing / targetData.closing.target) * 100;

      const lastWeekProgress = Math.min(
        (lastWeekMeetingsPercentage + lastWeekAttendedPercentage + 
         lastWeekDurationPercentage + lastWeekClosingPercentage) / 4,
        100
      );
      
      setLastWeekProgress(lastWeekProgress);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching target data:", error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTargetData();
    
    const setupRealtimeListener = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        const reportsRef = collection(db, 'bdm_reports');
        const q = query(
          reportsRef,
          where('userId', '==', userId),
          where('createdAt', '>=', Timestamp.fromDate(startOfWeek)),
          where('createdAt', '<=', Timestamp.fromDate(endOfWeek))
        );
        
        return onSnapshot(q, () => {
          fetchTargetData();
        });
      } catch (error) {
        console.error('Error setting up real-time listener:', error);
      }
    };
    
    let unsubscribe: (() => void) | undefined;
    setupRealtimeListener().then(unsub => {
      if (unsub) unsubscribe = unsub;
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchTargetData]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: overallProgress,
      duration: 500,
      useNativeDriver: false
    }).start();
  }, [overallProgress]);

  // Add wave animation effect
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(waveAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      ).start();
    } else {
      waveAnimation.setValue(0);
    }
  }, [isLoading]);

  // Add notification setup
  useEffect(() => {
    const setupNotifications = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      }
    };

    setupNotifications();
  }, []);

  // Add real-time target listener
  useEffect(() => {
    if (!auth.currentUser) return;

    // Get user data to get employeeId
    const userDoc = doc(db, "users", auth.currentUser.uid);
    let employeeId: string | null = null;
    let userEmail = auth.currentUser.email;

    const unsubscribeUser = onSnapshot(userDoc, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        employeeId = userData.employeeId;
        userEmail = userData.email || userEmail;

        // Set up target listener based on available identifier
        const targetDataRef = collection(db, 'bdm_target_data');
        let q;
        
        if (employeeId) {
          q = query(
            targetDataRef,
            where('employeeId', '==', employeeId),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
        } else {
          q = query(
            targetDataRef,
            where('emailId', '==', userEmail),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
        }

        const unsubscribeTarget = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const targetDoc = snapshot.docs[0].data();
            
            // Create new target data object
            const newTargetData = {
              projectedMeetings: { 
                achieved: targetData.projectedMeetings.achieved, 
                target: targetDoc.numMeetings || 30 
              },
              attendedMeetings: { 
                achieved: targetData.attendedMeetings.achieved, 
                target: targetDoc.positiveLeads || 30 
              },
              meetingDuration: { 
                achieved: targetData.meetingDuration.achieved, 
                target: `${targetDoc.meetingDuration || '20'}:00:00` 
              },
              closing: { 
                achieved: targetData.closing.achieved, 
                target: targetDoc.closingAmount || 50000 
              }
            };

            // Check if targets have changed
            if (JSON.stringify(newTargetData) !== JSON.stringify(targetData)) {
              // Show notification
              Notifications.scheduleNotificationAsync({
                content: {
                  title: 'Target Updated! 🎯',
                  body: `Your weekly targets have been updated:\n• Meetings: ${newTargetData.projectedMeetings.target}\n• Prospective Meetings: ${newTargetData.attendedMeetings.target}\n• Duration: ${newTargetData.meetingDuration.target}\n• Amount: ₹${newTargetData.closing.target.toLocaleString()}`,
                  sound: true,
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: null,
              });

              // Update target data state
              setTargetData(newTargetData);
              
              // Refresh data with new targets
              fetchTargetData();
            }
          }
        });

        return () => {
          unsubscribeTarget();
        };
      }
    });

    return () => {
      unsubscribeUser();
    };
  }, []);

  const getDaysLeft = () => {
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
    const daysLeft = Math.ceil((endOfWeek.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft;
  };

  const renderProgressBar = () => {
    const width = progressAnim.interpolate({
      inputRange: [0, 100],
      outputRange: ['0%', '100%']
    });

    return (
      <View style={styles.progressBarContainer}>
        <Animated.View style={[styles.progressBar, { width }]} />
      </View>
    );
  };

  if (error) {
    return (
      <AppGradient>
        <BDMMainLayout title="Weekly Target" showBackButton showDrawer={true} showBottomTabs={true}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => fetchTargetData()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </BDMMainLayout>
      </AppGradient>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#FF8447" />
      </View>
    );
  }

  return (
    <AppGradient>
      <BDMMainLayout title="Weekly Target" showBackButton showDrawer={true} showBottomTabs={true}>
        <View style={styles.container}>
          <ScrollView style={styles.scrollView}>
            {/* Achievement Card */}
            <View style={styles.card}>
              <Text style={styles.achievementText}>
                Last week you achieved <Text style={styles.achievementHighlight}>{lastWeekProgress}%</Text> of your target!
              </Text>
              <TouchableOpacity 
                style={styles.reportLink}
                onPress={() => navigation.navigate('BDMViewFullReport' as never)}
              >
                <Text style={styles.reportText}>View Full Report</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#FF8447" />
              </TouchableOpacity>
            </View>

            {/* This Week Card */}
            <View style={styles.card}>
              <View style={styles.weekHeader}>
                <Text style={styles.weekTitle}>This Week</Text>
                <Text style={styles.daysLeft}>{getDaysLeft()} days to go!</Text>
              </View>

              {renderProgressBar()}
              <Text style={styles.progressText}>{Math.round(overallProgress)}%</Text>

              <View style={styles.targetDetails}>
                <View style={styles.columnHeaders}>
                  <View style={styles.spacer} />
                  <View style={styles.valueColumns}>
                    <Text style={styles.columnLabel}>Achieved</Text>
                    <Text style={[styles.columnLabel, styles.targetColumn]}>Target</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Number of Meetings</Text>
                  <View style={styles.valueColumns}>
                    <Text style={styles.achieved}>{targetData.projectedMeetings.achieved}</Text>
                    <Text style={styles.target}>{targetData.projectedMeetings.target}</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Prospective No. of Meetings</Text>
                  <View style={styles.valueColumns}>
                    <Text style={styles.achieved}>{targetData.attendedMeetings.achieved}</Text>
                    <Text style={styles.target}>{targetData.attendedMeetings.target}</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Meeting Duration</Text>
                  <View style={styles.valueColumns}>
                    <Text style={styles.achieved}>{targetData.meetingDuration.achieved}</Text>
                    <Text style={styles.target}>{targetData.meetingDuration.target}</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Closing Amount</Text>
                  <View style={styles.valueColumns}>
                    <Text style={styles.achieved}>₹{targetData.closing.achieved.toLocaleString()}</Text>
                    <Text style={styles.target}>₹{targetData.closing.target.toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  achievementText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    flexWrap: 'wrap',
    flex: 1,
    marginRight: 8,
  },
  achievementHighlight: {
    color: '#FF8447',
    textDecorationLine: 'underline',
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    flexWrap: 'wrap',
  },
  reportText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#FF8447',
    marginRight: 8,
    textDecorationLine: 'underline',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  weekTitle: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  daysLeft: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF8447',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  targetDetails: {
    gap: 16,
    marginTop: 8,
  },
  columnHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  spacer: {
    flex: 1,
  },
  columnLabel: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  valueColumns: {
    flexDirection: 'row',
    width: 180,
    justifyContent: 'space-between',
  },
  targetColumn: {
    color: '#FF8447',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    flex: 1,
  },
  achieved: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    width: 70,
    textAlign: 'center',
  },
  target: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF8447',
    width: 70,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#FF8447',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
  },
});

export default BDMTargetScreen;