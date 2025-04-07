import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { auth, db } from '@/firebaseConfig';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';

const screenWidth = Dimensions.get('window').width - 40;

interface ChartData {
  labels: string[];
  datasets: {
    data: number[];
  }[];
}

const BDMViewFullReport = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('Weekly');
  const [isLoading, setIsLoading] = useState(true);
  const [weeklyChartData, setWeeklyChartData] = useState<ChartData>({ 
    labels: [], 
    datasets: [{ data: [] }] 
  });
  const [quarterlyChartData, setQuarterlyChartData] = useState<ChartData>({ 
    labels: [], 
    datasets: [{ data: [] }] 
  });
  const [halfYearlyChartData, setHalfYearlyChartData] = useState<ChartData>({ 
    labels: [], 
    datasets: [{ data: [] }] 
  });
  const [highestAchievement, setHighestAchievement] = useState(0);
  const [averageAchievement, setAverageAchievement] = useState(0);

  const periods = ['Weekly', 'Quarterly', 'Half Yearly'];

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      setIsLoading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      // Fetch weekly data
      const weeklyData = await fetchPeriodData('Weekly');
      setWeeklyChartData(weeklyData);

      // Fetch quarterly data
      const quarterlyData = await fetchPeriodData('Quarterly');
      setQuarterlyChartData(quarterlyData);

      // Fetch half yearly data
      const halfYearlyData = await fetchPeriodData('Half Yearly');
      setHalfYearlyChartData(halfYearlyData);

      // Calculate highest and average achievements
      const allAchievements = [
        ...weeklyData.datasets[0].data,
        ...quarterlyData.datasets[0].data,
        ...halfYearlyData.datasets[0].data
      ];

      const highest = Math.max(...allAchievements);
      const average = Math.round(allAchievements.reduce((a, b) => a + b, 0) / allAchievements.length);

      setHighestAchievement(highest);
      setAverageAchievement(average);

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPeriodData = async (period: string) => {
    const userId = auth.currentUser?.uid;
    const now = new Date();
    let startDate = new Date();
    let labels: string[] = [];
    let lastDayOfMonth: Date;

    // Set date range based on period
    switch (period) {
      case 'Weekly':
        // Get the first day of the current month
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        // Get the last day of the current month
        lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        // Calculate number of weeks in the current month
        const totalDays = lastDayOfMonth.getDate();
        const totalWeeks = Math.ceil(totalDays / 7);
        
        // Generate week labels
        labels = Array.from({ length: totalWeeks }, (_, i) => `Week ${i + 1}`);
        
        // Set start date to first day of current month
        startDate = firstDayOfMonth;
        break;
      case 'Quarterly':
        startDate.setMonth(now.getMonth() - 3);
        labels = Array.from({ length: 3 }, (_, i) => {
          const date = new Date(now);
          date.setMonth(now.getMonth() - (2 - i));
          return date.toLocaleString('default', { month: 'short' });
        });
        break;
      case 'Half Yearly':
        startDate.setMonth(now.getMonth() - 6);
        labels = Array.from({ length: 6 }, (_, i) => {
          const date = new Date(now);
          date.setMonth(now.getMonth() - (5 - i));
          return date.toLocaleString('default', { month: 'short' });
        });
        break;
    }

    const meetingsRef = collection(db, 'meetings');
    const q = query(
      meetingsRef,
      where('userId', '==', userId),
      where('meetingDateTime', '>=', Timestamp.fromDate(startDate))
    );

    const querySnapshot = await getDocs(q);
    const meetings = querySnapshot.docs.map(doc => doc.data());

    const progressData = labels.map((_, index) => {
      const intervalStart = new Date(startDate);
      const intervalEnd = new Date(startDate);

      if (period === 'Weekly') {
        // Calculate start and end dates for each week
        intervalStart.setDate(startDate.getDate() + (index * 7));
        intervalEnd.setDate(intervalStart.getDate() + 6);
        // Ensure we don't go beyond the last day of the month
        if (intervalEnd > lastDayOfMonth) {
          intervalEnd.setDate(lastDayOfMonth.getDate());
        }
      } else if (period === 'Quarterly') {
        intervalStart.setMonth(startDate.getMonth() + index);
        intervalEnd.setMonth(intervalStart.getMonth() + 1);
      } else {
        intervalStart.setMonth(startDate.getMonth() + index);
        intervalEnd.setMonth(intervalStart.getMonth() + 1);
      }

      const intervalMeetings = meetings.filter(meeting => {
        const meetingDate = meeting.meetingDateTime.toDate();
        return meetingDate >= intervalStart && meetingDate <= intervalEnd;
      });

      return calculateProgress(intervalMeetings);
    });

    return {
      labels,
      datasets: [{ data: progressData }]
    };
  };

  const calculateProgress = (meetings: any[]) => {
    const targets = {
      projectedMeetings: 30,
      attendedMeetings: 30,
      meetingDuration: 20,
      closing: 50000
    };

    let totalDuration = 0;
    let totalClosing = 0;
    meetings.forEach(meeting => {
      if (meeting.meetingEndDateTime && meeting.meetingDateTime) {
        const duration = meeting.meetingEndDateTime.toDate().getTime() - meeting.meetingDateTime.toDate().getTime();
        totalDuration += duration / (1000 * 60 * 60);
      }
      totalClosing += meeting.closing || 0;
    });

    const progressPercentages = [
      (meetings.length / targets.projectedMeetings) * 100,
      (meetings.filter(m => m.status === 'completed').length / targets.attendedMeetings) * 100,
      (totalDuration / targets.meetingDuration) * 100,
      (totalClosing / targets.closing) * 100
    ];

    return Math.min(
      Math.round(progressPercentages.reduce((a, b) => a + b, 0) / progressPercentages.length),
      100
    );
  };

  const getActiveData = () => {
    switch (selectedPeriod) {
      case 'Quarterly':
        return quarterlyChartData;
      case 'Half Yearly':
        return halfYearlyChartData;
      default:
        return weeklyChartData;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#FF8447" />
        <Text style={styles.loadingText}>Loading your reports...</Text>
      </View>
    );
  }

  return (
    <AppGradient>
    <BDMMainLayout title="Target Report" showBackButton={true} showBottomTabs={true} showDrawer={true}>
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Period Selection */}
        <View style={styles.periodContainer}>
          {periods.map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.selectedPeriodButton
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text style={[
                styles.periodText,
                selectedPeriod === period && styles.selectedPeriodText
              ]}>
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Graph */}
        <View style={styles.graphCard}>
          <LineChart
            data={getActiveData()}
            width={screenWidth}
            height={300}
            chartConfig={{
              backgroundColor: 'white',
              backgroundGradientFrom: 'white',
              backgroundGradientTo: 'white',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(255, 132, 71, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(128, 128, 128, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '6',
                strokeWidth: '2',
                stroke: '#FF8447',
              },
              propsForBackgroundLines: {
                stroke: '#E5E7EB',
                strokeWidth: 1,
              },
              useShadowColorFromDataset: false,
            }}
            bezier
            style={styles.graph}
            withVerticalLines={false}
            withHorizontalLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            fromZero={true}
            yAxisLabel=""
            yAxisSuffix="%"
            formatYLabel={(value) => `${Math.round(Number(value))}`}
            formatXLabel={(value) => value}
          />
        </View>

        {/* Motivational Message */}
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>Your highest record so far is {highestAchievement}% 🎉</Text>
          <Text style={styles.subMessageText}>Keep pushing to achieve more!</Text>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#FF8447" }]} />
            <Text style={styles.legendText}>Achievement</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#E5E7EB" }]} />
            <Text style={styles.legendText}>Target</Text>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Average Achievement</Text>
            <Text style={styles.statValue}>{averageAchievement}%</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Highest Achievement</Text>
            <Text style={styles.statValue}>{highestAchievement}%</Text>
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
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  periodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  periodButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'white',
    elevation: 4,
    marginHorizontal: 2,
  },
  selectedPeriodButton: {
    backgroundColor: '#FF8447',
  },
  periodText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  selectedPeriodText: {
    color: 'white',
  },
  graphCard: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  graph: {
    marginVertical: 8,
    borderRadius: 16,
  },
  messageContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  subMessageText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 8,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 8,
    elevation: 2,
  },
  statTitle: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
});

export default BDMViewFullReport;