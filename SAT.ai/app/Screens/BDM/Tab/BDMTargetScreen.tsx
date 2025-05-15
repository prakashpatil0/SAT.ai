import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import { auth, db } from '@/firebaseConfig';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

interface TargetData {
  projectedMeetings: { achieved: number; target: number };
  attendedMeetings: { achieved: number; target: number };
  meetingDuration: { achieved: number; target: number };
  closing: { achieved: number; target: number };
}

const BDMTargetScreen = () => {
  const navigation = useNavigation();
  const [targetData, setTargetData] = useState<TargetData>({
    projectedMeetings: { achieved: 0, target: 30 },
    attendedMeetings: { achieved: 0, target: 30 },
    meetingDuration: { achieved: 0, target: 20 },
    closing: { achieved: 0, target: 50000 }
  });
  const [progressAnim] = useState(new Animated.Value(0));
  const [overallProgress, setOverallProgress] = useState(0);
  const [lastWeekProgress, setLastWeekProgress] = useState(0);

  useEffect(() => {
    fetchTargetData();
  }, []);

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: overallProgress,
      duration: 1000,
      useNativeDriver: false
    }).start();
  }, [overallProgress]);

  const fetchTargetData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      // Get start and end of current week
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Get start and end of last week
      const startOfLastWeek = new Date(startOfWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
      const endOfLastWeek = new Date(startOfWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() - 1);
      endOfLastWeek.setHours(23, 59, 59, 999);

      // Fetch reports for current week
      const reportsRef = collection(db, 'bdm_reports');
      const currentWeekQuery = query(
        reportsRef,
        where('userId', '==', userId),
        where('createdAt', '>=', Timestamp.fromDate(startOfWeek)),
        where('createdAt', '<=', Timestamp.fromDate(endOfWeek))
      );

      // Fetch reports for last week
      const lastWeekQuery = query(
        reportsRef,
        where('userId', '==', userId),
        where('createdAt', '>=', Timestamp.fromDate(startOfLastWeek)),
        where('createdAt', '<=', Timestamp.fromDate(endOfLastWeek))
      );

      const [currentWeekSnapshot, lastWeekSnapshot] = await Promise.all([
        getDocs(currentWeekQuery),
        getDocs(lastWeekQuery)
      ]);

      // Calculate current week achievements
      let totalMeetings = 0;
      let totalAttendedMeetings = 0;
      let totalDuration = 0;
      let totalClosing = 0;

      currentWeekSnapshot.forEach(doc => {
        const data = doc.data();
        totalMeetings += data.numMeetings || 0;
        totalAttendedMeetings += data.numMeetings || 0; // All reported meetings are considered attended
        
        // Parse duration string (e.g., "1 hr 30 mins" -> hours)
        const durationStr = data.meetingDuration || '';
        const hrMatch = durationStr.match(/(\d+)\s*hr/);
        const minMatch = durationStr.match(/(\d+)\s*min/);
        const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) +
                     (minMatch ? parseInt(minMatch[1]) / 60 : 0);
        totalDuration += hours;

        totalClosing += data.totalClosingAmount || 0;
      });

      const newTargetData = {
        projectedMeetings: { achieved: totalMeetings, target: 30 },
        attendedMeetings: { achieved: totalAttendedMeetings, target: 30 },
        meetingDuration: { achieved: Math.round(totalDuration), target: 20 },
        closing: { achieved: totalClosing, target: 50000 }
      };

      setTargetData(newTargetData);

      // Calculate current week progress
      const progressPercentages = [
        (newTargetData.projectedMeetings.achieved / newTargetData.projectedMeetings.target) * 100,
        (newTargetData.attendedMeetings.achieved / newTargetData.attendedMeetings.target) * 100,
        (newTargetData.meetingDuration.achieved / newTargetData.meetingDuration.target) * 100,
        (newTargetData.closing.achieved / newTargetData.closing.target) * 100
      ];

      const avgProgress = Math.min(
        Math.round(progressPercentages.reduce((a, b) => a + b, 0) / progressPercentages.length),
        100
      );
      setOverallProgress(avgProgress);

      // Calculate last week's progress
      let lastWeekMeetings = 0;
      let lastWeekAttendedMeetings = 0;
      let lastWeekDuration = 0;
      let lastWeekClosing = 0;

      lastWeekSnapshot.forEach(doc => {
        const data = doc.data();
        lastWeekMeetings += data.numMeetings || 0;
        lastWeekAttendedMeetings += data.numMeetings || 0;
        
        const durationStr = data.meetingDuration || '';
        const hrMatch = durationStr.match(/(\d+)\s*hr/);
        const minMatch = durationStr.match(/(\d+)\s*min/);
        const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) +
                     (minMatch ? parseInt(minMatch[1]) / 60 : 0);
        lastWeekDuration += hours;

        lastWeekClosing += data.totalClosingAmount || 0;
      });

      const lastWeekPercentages = [
        (lastWeekMeetings / 30) * 100,
        (lastWeekAttendedMeetings / 30) * 100,
        (lastWeekDuration / 20) * 100,
        (lastWeekClosing / 50000) * 100
      ];

      const lastWeekProgress = Math.min(
        Math.round(lastWeekPercentages.reduce((a, b) => a + b, 0) / lastWeekPercentages.length),
        100
      );
      setLastWeekProgress(lastWeekProgress);

    } catch (error) {
      console.error('Error fetching target data:', error);
    }
  };

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

              {/* Progress Bar */}
              {renderProgressBar()}
              <Text style={styles.progressText}>{Math.round(overallProgress)}%</Text>

              {/* Target Details */}
              <View style={styles.targetDetails}>
                {/* Column Headers */}
                <View style={styles.columnHeaders}>
                  <View style={styles.spacer} />
                  <View style={styles.valueColumns}>
                    <Text style={styles.columnLabel}>Achieved</Text>
                    <Text style={[styles.columnLabel, styles.targetColumn]}>Target</Text>
                  </View>
                </View>

                {/* Rows */}
                <View style={styles.row}>
                  <Text style={styles.label}>Projected No. of Meetings</Text>
                  <View style={styles.valueColumns}>
                    <Text style={styles.achieved}>{targetData.projectedMeetings.achieved}</Text>
                    <Text style={styles.target}>{targetData.projectedMeetings.target}</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Attended No. of Meetings</Text>
                  <View style={styles.valueColumns}>
                    <Text style={styles.achieved}>{targetData.attendedMeetings.achieved}</Text>
                    <Text style={styles.target}>{targetData.attendedMeetings.target}</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Meeting Duration</Text>
                  <View style={styles.valueColumns}>
                    <Text style={styles.achieved}>{targetData.meetingDuration.achieved} hrs</Text>
                    <Text style={styles.target}>{targetData.meetingDuration.target} hrs</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Closing</Text>
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
});

export default BDMTargetScreen;