import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { ProgressBar } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@expo/vector-icons';
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import { LinearGradient } from 'expo-linear-gradient';
import AppGradient from "@/app/components/AppGradient";
import { auth } from '@/firebaseConfig';
import targetService, { getTargets, getCurrentWeekAchievements, getPreviousWeekAchievement } from "@/app/services/targetService";
import { differenceInDays, endOfWeek, startOfWeek, startOfDay, endOfDay } from 'date-fns';
import { collection, query, where, orderBy, limit, getDocs, Timestamp, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

// Define types for achievements and targets
interface Achievements {
  numCalls: number;
  callDuration: number;
  positiveLeads: number;
  closingAmount: number;
}

interface Targets {
  numCalls: number;
  callDuration: number;
  positiveLeads: number;
  closingAmount: number;
}

interface DailyReport {
  numCalls: number;
  callDuration: number;
  positiveLeads: number;
  closingAmount: number;
  createdAt: Timestamp;
  userId: string;
}

const WeeklyTargetScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState<{
    positiveLeads: number;
    numCalls: number;
    callDuration: number;
    closingAmount: number;
    percentageAchieved: number;
  }>({
    positiveLeads: 0,
    numCalls: 0,
    callDuration: 0,
    closingAmount: 0,
    percentageAchieved: 0,
  });
  const [previousAchievement, setPreviousAchievement] = useState<number>(0);
  const [targets, setTargets] = useState(getTargets());
  const [daysRemaining, setDaysRemaining] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) {
        return;
      }
      
      try {
        setLoading(true);
        
        // Calculate current week range
        const today = new Date();
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const daysLeft = differenceInDays(weekEnd, today);
        setDaysRemaining(daysLeft);

        // Fetch daily reports for current week
        const reportsRef = collection(db, 'telecaller_reports');
        const reportsQuery = query(
          reportsRef,
          where('userId', '==', auth.currentUser.uid),
          where('createdAt', '>=', Timestamp.fromDate(weekStart)),
          where('createdAt', '<=', Timestamp.fromDate(weekEnd)),
          orderBy('createdAt', 'desc')
        );

        const reportsSnapshot = await getDocs(reportsQuery);
        
        // Initialize totals
        let totalCalls = 0;
        let totalDuration = 0;
        let totalPositiveLeads = 0;
        let totalClosingAmount = 0;

        // Aggregate data from all reports
        reportsSnapshot.docs.forEach(doc => {
          const report = doc.data() as DailyReport;
          totalCalls += report.numCalls || 0;
          totalDuration += report.callDuration || 0;
          totalPositiveLeads += report.positiveLeads || 0;
          totalClosingAmount += report.closingAmount || 0;
        });

        // Get weekly targets
        const weeklyTargets = getTargets();
        setTargets(weeklyTargets);

        // Calculate achievement percentage
        const achievementPercentage = calculatePercentage(
          {
            numCalls: totalCalls,
            callDuration: totalDuration,
            positiveLeads: totalPositiveLeads,
            closingAmount: totalClosingAmount
          },
          weeklyTargets
        );

        // Update achievements state with all metrics
        setAchievements({
          numCalls: totalCalls,
          callDuration: totalDuration,
          positiveLeads: totalPositiveLeads,
          closingAmount: totalClosingAmount,
          percentageAchieved: Math.round(achievementPercentage * 10) / 10
        });

        // Store weekly achievement in Firebase
        const achievementsRef = collection(db, 'telecaller_achievements');
        const achievementData = {
          userId: auth.currentUser.uid,
          weekStart: Timestamp.fromDate(weekStart),
          weekEnd: Timestamp.fromDate(weekEnd),
          numCalls: totalCalls,
          callDuration: totalDuration,
          positiveLeads: totalPositiveLeads,
          closingAmount: totalClosingAmount,
          percentageAchieved: Math.round(achievementPercentage * 10) / 10,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        };

        // Check if achievement record exists for this week
        const weeklyAchievementQuery = query(
          achievementsRef,
          where('userId', '==', auth.currentUser.uid),
          where('weekStart', '==', Timestamp.fromDate(weekStart)),
          where('weekEnd', '==', Timestamp.fromDate(weekEnd))
        );

        const weeklyAchievementSnapshot = await getDocs(weeklyAchievementQuery);
        
        if (weeklyAchievementSnapshot.empty) {
          // Create new achievement record
          await addDoc(achievementsRef, achievementData);
        } else {
          // Update existing achievement record
          const docRef = weeklyAchievementSnapshot.docs[0].ref;
          await updateDoc(docRef, {
            ...achievementData,
            updatedAt: Timestamp.fromDate(new Date())
          });
        }

        // Fetch previous week's data for comparison
        const prevWeekEnd = startOfDay(weekStart);
        const prevWeekStart = startOfWeek(prevWeekEnd, { weekStartsOn: 1 });

        const prevWeekQuery = query(
          reportsRef,
          where('userId', '==', auth.currentUser.uid),
          where('createdAt', '>=', Timestamp.fromDate(prevWeekStart)),
          where('createdAt', '<', Timestamp.fromDate(weekStart)),
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
          prevTotalCalls += report.numCalls || 0;
          prevTotalDuration += report.callDuration || 0;
          prevTotalPositiveLeads += report.positiveLeads || 0;
          prevTotalClosingAmount += report.closingAmount || 0;
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

        // Store previous week's achievement in Firebase
        const prevAchievementData = {
          userId: auth.currentUser.uid,
          weekStart: Timestamp.fromDate(prevWeekStart),
          weekEnd: Timestamp.fromDate(prevWeekEnd),
          numCalls: prevTotalCalls,
          callDuration: prevTotalDuration,
          positiveLeads: prevTotalPositiveLeads,
          closingAmount: prevTotalClosingAmount,
          percentageAchieved: Math.round(prevAchievementPercentage * 10) / 10,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        };

        // Check if previous week's achievement record exists
        const prevWeekAchievementQuery = query(
          achievementsRef,
          where('userId', '==', auth.currentUser.uid),
          where('weekStart', '==', Timestamp.fromDate(prevWeekStart)),
          where('weekEnd', '==', Timestamp.fromDate(prevWeekEnd))
        );

        const prevWeekAchievementSnapshot = await getDocs(prevWeekAchievementQuery);
        
        if (prevWeekAchievementSnapshot.empty) {
          // Create new achievement record for previous week
          await addDoc(achievementsRef, prevAchievementData);
        }

      } catch (error) {
        console.error('Error fetching target data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Helper function to calculate percentage
  const calculatePercentage = (achievements: Achievements, targets: Targets): number => {
    const numCallsPercentage = (achievements.numCalls / targets.numCalls) * 100;
    const callDurationPercentage = (achievements.callDuration / targets.callDuration) * 100;
    const positiveLeadsPercentage = (achievements.positiveLeads / targets.positiveLeads) * 100;
    const closingAmountPercentage = (achievements.closingAmount / targets.closingAmount) * 100;

    return (numCallsPercentage + callDurationPercentage + positiveLeadsPercentage + closingAmountPercentage) / 4;
  };

  if (loading) {
    return (
      <AppGradient>
        <TelecallerMainLayout showDrawer showBackButton={true} title="Weekly Target">
          <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#FF8447" />
            <Text style={styles.loadingText}>Loading your targets...</Text>
          </View>
        </TelecallerMainLayout>
      </AppGradient>
    );
  }

  return (
    <AppGradient>
    <TelecallerMainLayout showDrawer showBackButton={true} title="Weekly Target">
       <View style={styles.container}>

        {/* Achievement Card */}
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

        {/* This Week Section */}
        <View style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}>
            <Text style={styles.weeklyTitle}>This Week</Text>
            <Text style={styles.daysLeft}>{daysRemaining} days to go!</Text>
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

            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>No. of Calls</Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{achievements.numCalls}</Text>
              <Text style={[styles.targetCell, { flex: 1, textAlign: 'right' }]}>{targets.numCalls}</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>Call Duration</Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{achievements.callDuration} hrs</Text>
              <Text style={[styles.targetCell, { flex: 1, textAlign: 'right' }]}>{targets.callDuration} hrs</Text>
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
    color: '#FF8447', // Orange color for Target column
    fontWeight: "bold",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
});

export default WeeklyTargetScreen;
