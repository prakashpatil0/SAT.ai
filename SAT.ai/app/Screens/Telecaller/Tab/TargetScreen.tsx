import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Animated, Easing } from "react-native";
import { ProgressBar } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@expo/vector-icons';
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import { LinearGradient } from 'expo-linear-gradient';
import AppGradient from "@/app/components/AppGradient";
import { auth, db } from '@/firebaseConfig';
import { getTargets, getCurrentWeekAchievements, getPreviousWeekAchievement } from "@/app/services/targetService";
import { differenceInDays, endOfWeek, startOfWeek, startOfDay, endOfDay, startOfMonth, endOfMonth, getWeek, getMonth, getYear } from 'date-fns';
import { collection, query, where, orderBy, limit, getDocs, Timestamp, addDoc, updateDoc, onSnapshot, doc } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Default target values
const TARGET_VALUES = {
  positiveLeads: 50,
  numCalls: 300,
  callDuration: 2,
  closingAmount: 50000
};

// Interface for target data from Firebase
interface FirebaseTargetData {
  closingAmount: number;
  createdAt: Timestamp;
  dateOfJoining: string;
  emailId: string;
  employeeId: string;
  employeeName: string;
  meetingDuration: string;
  month?: number;
  monthName?: string;
  numMeetings: number;
  positiveLeads: number;
  updatedAt: Timestamp | string;
  year?: number;
  fromDate?: Timestamp;
  toDate?: Timestamp;
  disbursementUnit?: number; // legacy/optional
  disbursmentUnits?: number; // <-- add this for correct field
}

// Define types for achievements and targets
interface Achievements {
  numCalls: number;
  callDuration: number;
  positiveLeads: number;
  closingAmount: number;
  disbursementUnit?: number;
  rejectedLeads?: number;
}

interface Targets {
  numCalls: number;
  callDuration: number;
  positiveLeads: number;
  closingAmount: number;
  disbursmentUnits?: number;
}

interface DailyReport {
  numMeetings: number;
  meetingDuration: string;
  positiveLeads: number;
  totalClosingAmount: number;
  createdAt: Timestamp;
  userId: string;
  rejectedLeads?: number;
}

// Move the formatDuration function outside of fetchData
const formatDuration = (totalHours: number) => {
  const totalSeconds = Math.round(totalHours * 3600);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const WeeklyTargetScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<{
    positiveLeads: number;
    numCalls: number;
    callDuration: number;
    closingAmount: number;
    disbursementUnit: number;
    rejectedLeads: number;
    percentageAchieved: number;
  }>({
    positiveLeads: 0,
    numCalls: 0,
    callDuration: 0,
    closingAmount: 0,
    disbursementUnit: 0,
    rejectedLeads: 0,
    percentageAchieved: 0,
  });
  const [previousAchievement, setPreviousAchievement] = useState<number>(0);
  const [targets, setTargets] = useState<Targets>({
    positiveLeads: 0,
    numCalls: 0,
    callDuration: 0,
    closingAmount: 0,
    disbursmentUnits: 0,
  });
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [waveAnimation] = useState(new Animated.Value(0));
  const [userName, setUserName] = useState<string>('');
  const [companyId, setCompanyId] = useState<string | null>(null);

  const fetchData = async (showLoading = true) => {
    if (!auth.currentUser) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }
    
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      
      // Calculate current week range (Monday to Saturday)
      const today = new Date();
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const saturday = new Date(weekEnd);
      saturday.setDate(saturday.getDate() - 1);

      // Calculate month range
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);
      
      // Calculate days remaining until Saturday
      const daysLeft = differenceInDays(saturday, today);
      setDaysRemaining(daysLeft);

      // Fetch user data to get userName
      const userDoc = doc(db, 'users', auth.currentUser.uid);
      const userSnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', auth.currentUser.uid)));
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        setUserName(userData.displayName || userData.email || 'Unknown User');
        setCompanyId(userData.companyId || null); // <-- set companyId here
      }

      // Fetch targets from Firebase
      const weeklyTargets = await getTargets();
      if (!weeklyTargets) {
        throw new Error('Failed to fetch target data');
      }
      setTargets(weeklyTargets);

      // Fetch daily reports for current week
      const reportsRef = collection(db, 'telecaller_reports');
      const weeklyReportsQuery = query(
        reportsRef,
        where('userId', '==', auth.currentUser.uid),
        where('createdAt', '>=', Timestamp.fromDate(weekStart)),
        where('createdAt', '<=', Timestamp.fromDate(saturday)),
        orderBy('createdAt', 'desc')
      );

      // Fetch daily reports for current month
      const monthlyReportsQuery = query(
        reportsRef,
        where('userId', '==', auth.currentUser.uid),
        where('createdAt', '>=', Timestamp.fromDate(monthStart)),
        where('createdAt', '<=', Timestamp.fromDate(monthEnd)),
        orderBy('createdAt', 'desc')
      );

      const [weeklySnapshot, monthlySnapshot] = await Promise.all([
        getDocs(weeklyReportsQuery),
        getDocs(monthlyReportsQuery)
      ]);
      
      // Initialize totals
      let weeklyTotalCalls = 0;
      let weeklyTotalDuration = 0;
      let weeklyTotalPositiveLeads = 0;
      let weeklyTotalClosingAmount = 0;
      let weeklyTotalRejectedLeads = 0;

      let monthlyTotalCalls = 0;
      let monthlyTotalDuration = 0;
      let monthlyTotalPositiveLeads = 0;
      let monthlyTotalClosingAmount = 0;

      // Process weekly data
      weeklySnapshot.docs.forEach(doc => {
        const report = doc.data() as DailyReport & { rejectedLeads?: number };
        weeklyTotalCalls += report.numMeetings || 0;
        const durationParts = report.meetingDuration.split(':');
        const hours = parseInt(durationParts[0], 10);
        const minutes = parseInt(durationParts[1], 10);
        const seconds = parseInt(durationParts[2], 10);
        const totalHours = hours + (minutes / 60) + (seconds / 3600);
        weeklyTotalDuration += totalHours;
        weeklyTotalPositiveLeads += report.positiveLeads || 0;
        weeklyTotalClosingAmount += report.totalClosingAmount || 0;
        weeklyTotalRejectedLeads += report.rejectedLeads || 0;
      });

      // Process monthly data
      monthlySnapshot.docs.forEach(doc => {
        const report = doc.data() as DailyReport;
        monthlyTotalCalls += report.numMeetings || 0;
        const durationParts = report.meetingDuration.split(':');
        const hours = parseInt(durationParts[0], 10);
        const minutes = parseInt(durationParts[1], 10);
        const seconds = parseInt(durationParts[2], 10);
        const totalHours = hours + (minutes / 60) + (seconds / 3600);
        monthlyTotalDuration += totalHours;
        monthlyTotalPositiveLeads += report.positiveLeads || 0;
        monthlyTotalClosingAmount += report.totalClosingAmount || 0;
      });

      // Calculate percentages
      const weeklyAchievementPercentage = calculatePercentage(
        {
          numCalls: weeklyTotalCalls,
          callDuration: weeklyTotalDuration,
          positiveLeads: weeklyTotalPositiveLeads,
          closingAmount: weeklyTotalClosingAmount
        },
        weeklyTargets
      );

      const monthlyAchievementPercentage = calculatePercentage(
        {
          numCalls: monthlyTotalCalls,
          callDuration: monthlyTotalDuration,
          positiveLeads: monthlyTotalPositiveLeads,
          closingAmount: monthlyTotalClosingAmount
        },
        weeklyTargets
      );

      // Update achievements state
   setAchievements({
  numCalls: weeklyTotalCalls,
  callDuration: weeklyTotalDuration,
  positiveLeads: weeklyTotalPositiveLeads,
  closingAmount: weeklyTotalClosingAmount,
  disbursementUnit: 0, // default or calculated value if available
  rejectedLeads: weeklyTotalRejectedLeads,
  percentageAchieved: Math.round(weeklyAchievementPercentage * 10) / 10,
});

      // Calculate date-related fields
      const currentDate = new Date();
      const date = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const month = getMonth(currentDate) + 1; // 1-12
      const week = getWeek(currentDate, { weekStartsOn: 1 }); // ISO week
      const year = getYear(currentDate);

      // Store weekly achievement in Firebase
      const weeklyAchievementData = {
        userId: auth.currentUser.uid,
        userName: userName,
        weekStart: Timestamp.fromDate(weekStart),
        weekEnd: Timestamp.fromDate(weekEnd),
        numCalls: weeklyTotalCalls,
        callDuration: weeklyTotalDuration,
        positiveLeads: weeklyTotalPositiveLeads,
        closingAmount: weeklyTotalClosingAmount,
      percentageAchieved: Math.round(weeklyAchievementPercentage),

        createdAt: Timestamp.fromDate(currentDate),
        updatedAt: Timestamp.fromDate(currentDate),
        date: date,
        month: month,
        week: week,
        year: year
      };

      // Store monthly achievement in Firebase
      const monthlyAchievementData = {
        userId: auth.currentUser.uid,
        userName: userName,
        monthStart: Timestamp.fromDate(monthStart),
        monthEnd: Timestamp.fromDate(monthEnd),
        numCalls: monthlyTotalCalls,
        callDuration: monthlyTotalDuration,
        positiveLeads: monthlyTotalPositiveLeads,
        closingAmount: monthlyTotalClosingAmount,
     percentageAchieved: Math.round(weeklyAchievementPercentage),

        createdAt: Timestamp.fromDate(currentDate),
        updatedAt: Timestamp.fromDate(currentDate),
        date: date,
        month: month,
        week: week,
        year: year
      };

      // Check and update weekly achievement
      const weeklyAchievementQuery = query(
        collection(db, 'telecaller_achievements'),
        where('userId', '==', auth.currentUser.uid),
        where('weekStart', '==', Timestamp.fromDate(weekStart)),
        where('weekEnd', '==', Timestamp.fromDate(weekEnd))
      );

      // Check and update monthly achievement
      const monthlyAchievementQuery = query(
        collection(db, 'telecaller_monthly_achievements'),
        where('userId', '==', auth.currentUser.uid),
        where('monthStart', '==', Timestamp.fromDate(monthStart)),
        where('monthEnd', '==', Timestamp.fromDate(monthEnd))
      );

      const [weeklyAchievementSnapshot, monthlyAchievementSnapshot] = await Promise.all([
        getDocs(weeklyAchievementQuery),
        getDocs(monthlyAchievementQuery)
      ]);
      
      // Update or create weekly achievement
      if (weeklyAchievementSnapshot.empty) {
        await addDoc(collection(db, 'telecaller_achievements'), weeklyAchievementData);
      } else {
        const docRef = weeklyAchievementSnapshot.docs[0].ref;
        await updateDoc(docRef, {
          ...weeklyAchievementData,
          updatedAt: Timestamp.fromDate(new Date())
        });
      }

      // Update or create monthly achievement
      if (monthlyAchievementSnapshot.empty) {
        await addDoc(collection(db, 'telecaller_monthly_achievements'), monthlyAchievementData);
      } else {
        const docRef = monthlyAchievementSnapshot.docs[0].ref;
        await updateDoc(docRef, {
          ...monthlyAchievementData,
          updatedAt: Timestamp.fromDate(new Date())
        });
      }

      // Fetch previous week's data
      const prevWeekEnd = new Date(weekStart);
      prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
      const prevWeekStart = startOfWeek(prevWeekEnd, { weekStartsOn: 1 });

      const prevWeekQuery = query(
        reportsRef,
        where('userId', '==', auth.currentUser.uid),
        where('createdAt', '>=', Timestamp.fromDate(prevWeekStart)),
        where('createdAt', '<=', Timestamp.fromDate(prevWeekEnd)),
        orderBy('createdAt', 'desc')
      );

      const prevWeekSnapshot = await getDocs(prevWeekQuery);
      
      // Calculate previous week's totals
      let prevTotalCalls = 0;
      let prevTotalDuration = 0;
      let prevTotalPositiveLeads = 0;
      let prevTotalClosingAmount = 0;

      prevWeekSnapshot.docs.forEach(doc => {
        const report = doc.data() as DailyReport;
        prevTotalCalls += report.numMeetings || 0;
        const durationParts = report.meetingDuration.split(':');
        const hours = parseInt(durationParts[0], 10);
        const minutes = parseInt(durationParts[1], 10);
        const seconds = parseInt(durationParts[2], 10);
        const totalHours = hours + (minutes / 60) + (seconds / 3600);
        prevTotalDuration += totalHours;
        prevTotalPositiveLeads += report.positiveLeads || 0;
        prevTotalClosingAmount += report.totalClosingAmount || 0;
      });

      // Calculate previous week's achievement percentage
      const prevAchievementPercentage = calculatePercentage(
        {
          numCalls: prevTotalCalls,
          callDuration: prevTotalDuration,
          positiveLeads: prevTotalPositiveLeads,
          closingAmount: prevTotalClosingAmount
        },
        weeklyTargets
      );

      setPreviousAchievement(Math.round(prevAchievementPercentage * 10) / 10);

      // Store previous week's achievement
      const prevAchievementData = {
        userId: auth.currentUser.uid,
        userName: userName,
        weekStart: Timestamp.fromDate(prevWeekStart),
        weekEnd: Timestamp.fromDate(prevWeekEnd),
        numCalls: prevTotalCalls,
        callDuration: prevTotalDuration,
        positiveLeads: prevTotalPositiveLeads,
        closingAmount: prevTotalClosingAmount,
        percentageAchieved: Math.round(prevAchievementPercentage * 10) / 10,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
        date: date,
        month: month,
        week: getWeek(prevWeekStart, { weekStartsOn: 1 }),
        year: year
      };

      // Check and store previous week's achievement
      const prevWeekAchievementQuery = query(
        collection(db, 'telecaller_achievements'),
        where('userId', '==', auth.currentUser.uid),
        where('weekStart', '==', Timestamp.fromDate(prevWeekStart)),
        where('weekEnd', '==', Timestamp.fromDate(prevWeekEnd))
      );

      const prevWeekAchievementSnapshot = await getDocs(prevWeekAchievementQuery);
      
      if (prevWeekAchievementSnapshot.empty) {
        await addDoc(collection(db, 'telecaller_achievements'), prevAchievementData);
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Notification setup
  useEffect(() => {
    const setupNotifications = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        // Removed console.log
      }
    };
    setupNotifications();
  }, []);

  // Real-time target listener
  useEffect(() => {
    if (!auth.currentUser) return;

    const userDoc = doc(db, "users", auth.currentUser.uid);
    let employeeId: string | null = null;
    let userEmail = auth.currentUser.email;

    const unsubscribeUser = onSnapshot(userDoc, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        employeeId = userData.employeeId;
        userEmail = userData.email || userEmail;
        setUserName(userData.displayName || userData.email || 'Unknown User');
  setCompanyId(userData.companyId || null); // <-- make sure it's set here too
console.log('🔥 companyId:', userData.companyId);

        const targetDataRef = collection(db, 'telecaller_target_data');
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
            const targetDoc = snapshot.docs[0].data() as FirebaseTargetData;
            const updateDate = typeof targetDoc.updatedAt === 'string'
              ? targetDoc.updatedAt
              : targetDoc.updatedAt?.toDate().toLocaleDateString() || 'Unknown date';
          const newTargets = {
  numCalls: targetDoc.numMeetings || TARGET_VALUES.numCalls,
  positiveLeads: targetDoc.positiveLeads || TARGET_VALUES.positiveLeads,
  callDuration: parseInt(targetDoc.meetingDuration) || TARGET_VALUES.callDuration,
  closingAmount: targetDoc.closingAmount || TARGET_VALUES.closingAmount,
  disbursmentUnits: targetDoc.disbursmentUnits || 0, // <-- use correct field
};


            if (JSON.stringify(newTargets) !== JSON.stringify(targets)) {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: 'Target Updated! 🎯',
                  body: `Your weekly targets have been updated on ${updateDate}:\n• Calls: ${newTargets.numCalls}\n• Duration: ${formatDuration(newTargets.callDuration)}\n• Leads: ${newTargets.positiveLeads}\n• Amount: ₹${newTargets.closingAmount.toLocaleString()}`,
                  sound: true,
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: null,
              });
              setTargets(newTargets);
              fetchData(false);
            }
          }
        });

        return () => unsubscribeTarget();
      }
    });

    return () => unsubscribeUser();
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (loading) {
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
  }, [loading]);

 const calculatePercentage = (achievements: Achievements, targets: Targets): number => {
  if (targets.closingAmount === 0) return 0; // Prevent divide-by-zero
  const achievedPercentage = (achievements.closingAmount / targets.closingAmount) * 100;
  return Math.min(achievedPercentage, 100); // Cap at 100%
};


  const renderWaveSkeleton = () => {
    const translateY = waveAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 10],
    });

    return (
      <View style={styles.skeletonContainer}>
        <Animated.View 
          style={[
            styles.skeletonWave,
            { transform: [{ translateY }] }
          ]} 
        />
        <View style={styles.skeletonContent}>
          <View style={styles.skeletonHeader} />
          <View style={styles.skeletonCard}>
            <View style={styles.skeletonCardHeader} />
            <View style={styles.skeletonCardContent}>
              <View style={styles.skeletonProgress} />
              <View style={styles.skeletonStats}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={styles.skeletonStatRow} />
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };


  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBackButton={true} title="Weekly Target">
        <View style={styles.container}>
          <View style={styles.achievementCard}>
            <Text style={styles.achievementText}>
              Last week you achieved <Text style={styles.achievementPercentage}>{previousAchievement}%</Text> of your target!
            </Text>
            <TouchableOpacity 
              style={styles.viewReportButton}
              onPress={() => navigation.navigate('ViewFullReport' as never)}
            >
              <Text style={styles.viewReportText}>
                View Full Report <MaterialIcons name="arrow-forward" size={18} color="#FF8447" />
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weeklyCard}>
            <View style={styles.weeklyHeader}>
              <Text style={styles.weeklyTitle}>This Week</Text>
              <Text style={styles.daysLeft}>{daysRemaining} days left</Text>
            </View>

            <ProgressBar 
              progress={achievements.percentageAchieved > 0 ? achievements.percentageAchieved / 100 : 0} 
              color="#FF8447" 
              style={styles.progressBar} 
            />
            <Text style={styles.progressText}>{achievements.percentageAchieved.toFixed(1)}%</Text>

            <View style={styles.statsTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}></Text>
                <Text style={[styles.tableHeaderText, { flex: 2, textAlign: 'right' }]}>Achieved</Text>
                <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Target</Text>
              </View>

             {companyId === 'PP739792' && (
  <>
    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 2 }]}>No. of Calls</Text>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{achievements.numCalls}</Text>
      <Text style={[styles.targetCell, { flex: 1, textAlign: 'right' }]}>{targets.numCalls}</Text>
    </View>

    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 2 }]}>Call Duration</Text>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatDuration(achievements.callDuration)}</Text>
      <Text style={[styles.targetCell, { flex: 1, textAlign: 'right' }]}>{formatDuration(targets.callDuration)}</Text>
    </View>

    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 2 }]}>Positive Leads</Text>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{achievements.positiveLeads}</Text>
      <Text style={[styles.targetCell, { flex: 1, textAlign: 'right' }]}>{targets.positiveLeads}</Text>
    </View>

    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 2 }]}>Closing Amount</Text>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>₹{achievements.closingAmount.toLocaleString()}</Text>
      <Text style={[styles.targetCell, { flex: 1, textAlign: 'right' }]}>{targets.closingAmount.toLocaleString()}</Text>
    </View>
  </>
)}

{companyId === 'BU603894' && (
  <>
    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 2 }]}>No. of Calls</Text>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{achievements.numCalls}</Text>
      <Text style={[styles.targetCell, { flex: 1, textAlign: 'right' }]}>{targets.numCalls}</Text>
    </View>

    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 2 }]}>Call Duration</Text>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatDuration(achievements.callDuration)}</Text>
      <Text style={[styles.targetCell, { flex: 1, textAlign: 'right' }]}>{formatDuration(targets.callDuration)}</Text>
    </View>

    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 2 }]}>Connected calls</Text>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{achievements.positiveLeads}</Text>
      <Text style={[styles.targetCell, { flex: 1, textAlign: 'right' }]}>{targets.positiveLeads}</Text>
    </View>
    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 2 }]}>Disbursement unit</Text>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{achievements.rejectedLeads ?? 0}</Text>
      <Text style={[styles.targetCell, { flex: 1, textAlign: 'right' }]}>{targets.disbursmentUnits}</Text>
    </View>

    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 2 }]}>Disbursement Amount</Text>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>₹{achievements.closingAmount.toLocaleString()}</Text>
      <Text style={[styles.targetCell, { flex: 1, textAlign: 'right' }]}>{targets.closingAmount.toLocaleString()}</Text>
    </View>
    
  </>
)}

            </View>
          </View>
        </View>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
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
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    textAlign: 'center',
    alignSelf: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FF8447',
  },
  achievementCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  achievementText: {
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginBottom: 16,
  },
  achievementPercentage: {
    color: '#FF8447',
    textDecorationLine: 'underline',
  },
  viewReportButton: {
    marginTop: 8,
  },
  viewReportText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF8447',
    textDecorationLine: 'underline',
  },
  weeklyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  weeklyTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  daysLeft: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  statsTable: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
  },
  tableCell: {
    fontSize: 14,
    color: "#333",
  },
  targetCell: {
    fontSize: 14,
    color: '#FF8447',
    fontWeight: "bold",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  skeletonContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  skeletonWave: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ translateY: 0 }],
  },
  skeletonContent: {
    flex: 1,
    padding: 16,
  },
  skeletonHeader: {
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    zIndex: 1000,
    marginBottom: 16,
    width: '60%',
    alignSelf: 'center',
  },
  skeletonCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  skeletonCardHeader: {
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 16,
    width: '40%',
  },
  skeletonCardContent: {
    flex: 1,
  },
  skeletonProgress: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 24,
    zIndex: 1000,
  },
  skeletonStats: {
    marginTop: 16,
  },
  skeletonStatRow: {
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 12,
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

export default WeeklyTargetScreen;