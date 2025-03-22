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
import { differenceInDays, endOfWeek } from 'date-fns';

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
        
        // Calculate days remaining in the week
        const today = new Date();
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
        const daysLeft = differenceInDays(weekEnd, today);
        setDaysRemaining(daysLeft);
        
        // Get current achievements
        const currentAchievements = await getCurrentWeekAchievements(auth.currentUser.uid);
        console.log("Current achievements:", currentAchievements); // Debug log
        setAchievements(currentAchievements);
        
        // Get previous week's achievement percentage
        const prevAchievement = await getPreviousWeekAchievement(auth.currentUser.uid);
        setPreviousAchievement(prevAchievement);
      } catch (error) {
        console.error('Error fetching target data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

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
    <Text style={[styles.tableCell, { flex: 2 }]}>Positive Leads</Text>
    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{achievements.positiveLeads}</Text>
    <Text style={[styles.targetCell, { flex: 1, textAlign: 'right' }]}>{targets.positiveLeads}</Text>
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
    <Text style={[styles.tableCell, { flex: 2 }]}>Closing</Text>
    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>₹{achievements.closingAmount.toLocaleString()}</Text>
    <Text style={[styles.targetCell, { flex: 1, textAlign: 'right' }]}>₹{targets.closingAmount.toLocaleString()}</Text>
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
