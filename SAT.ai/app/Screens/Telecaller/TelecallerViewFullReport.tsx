import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useNavigation } from '@react-navigation/native';
import { auth } from '@/firebaseConfig';
import { MaterialIcons } from '@expo/vector-icons';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, addDays, startOfWeek, endOfWeek, subWeeks, startOfQuarter, endOfQuarter, subQuarters, eachWeekOfInterval, getWeeksInMonth, isSameMonth, isSameWeek } from 'date-fns';
import { collection, query, where, orderBy, getDocs, Timestamp, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getTargets } from '@/app/services/targetService';

import TelecallerMainLayout from '../../components/TelecallerMainLayout';
import AppGradient from '@/app/components/AppGradient';

const screenWidth = Dimensions.get('window').width - 40;

interface ChartData {
  labels: string[];
  datasets: Array<{
    data: number[];
  }>;
}

interface ReportData {
  labels: string[];
  data: number[];
}

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

const ViewFullReport = () => {
  const navigation = useNavigation();
  const [selectedPeriod, setSelectedPeriod] = useState('Weekly');
  const periods = ['Weekly', 'Quarterly', 'Half Yearly'];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeOffset, setTimeOffset] = useState(0);
  const [quarterOffset, setQuarterOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

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

  const getCurrentQuarter = (date: Date) => {
    const month = date.getMonth();
    return Math.floor(month / 3) + 1;
  };

  const getQuarterMonths = (date: Date) => {
    const currentMonth = date.getMonth();
    const currentYear = date.getFullYear();
    const quarterStart = Math.floor(currentMonth / 3) * 3;
    
    return {
      start: new Date(currentYear, quarterStart, 1),
      end: new Date(currentYear, quarterStart + 2, 31)
    };
  };

  const getHalfYearMonths = (date: Date) => {
    const currentMonth = date.getMonth();
    const currentYear = date.getFullYear();
    const labels = [];
    
    // Generate labels for current month and previous 5 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(currentYear, currentMonth - i, 1);
      labels.push(format(monthDate, 'MMM'));
    }
    
    return {
      labels,
      start: new Date(currentYear, currentMonth - 5, 1),
      end: new Date(currentYear, currentMonth, 31)
    };
  };

  const handleTimeNavigation = (direction: 'prev' | 'next') => {
    const newOffset = direction === 'next' ? timeOffset + 1 : timeOffset - 1;
    setTimeOffset(newOffset);
    fetchPeriodData(selectedPeriod, newOffset);
  };

  const handleQuarterNavigation = (direction: 'prev' | 'next') => {
    const newOffset = direction === 'next' ? quarterOffset + 3 : quarterOffset - 3;
    setQuarterOffset(newOffset);
    fetchPeriodData(selectedPeriod, newOffset);
  };

  const handleMonthNavigation = (direction: 'prev' | 'next') => {
    const newOffset = direction === 'next' ? monthOffset + 1 : monthOffset - 1;
    setMonthOffset(newOffset);
    fetchPeriodData(selectedPeriod, quarterOffset + newOffset);
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'Quarterly': {
        const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + quarterOffset + monthOffset);
        const currentQuarter = Math.floor(currentMonth.getMonth() / 3) + 1;
        return (
          <View style={styles.periodLabelContainer}>
            <View style={styles.quarterNavigationContainer}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => handleQuarterNavigation('prev')}
              >
                <MaterialIcons name="chevron-left" size={30} color="#FF8447" />
              </TouchableOpacity>
              <View style={styles.quarterLabelContainer}>
                <Text style={styles.quarterLabel}>Quarter {currentQuarter}</Text>
                <Text style={styles.yearLabel}>{currentMonth.getFullYear()}</Text>
              </View>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => handleQuarterNavigation('next')}
              >
                <MaterialIcons name="chevron-right" size={30} color="#FF8447" />
              </TouchableOpacity>
            </View>
            <View style={styles.monthNavigationContainer}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => handleMonthNavigation('prev')}
              >
                <MaterialIcons name="chevron-left" size={30} color="#FF8447" />
              </TouchableOpacity>
              <View style={styles.monthLabelContainer}>
                <Text style={styles.monthLabel}>{format(currentMonth, 'MMMM')}</Text>
              </View>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => handleMonthNavigation('next')}
              >
                <MaterialIcons name="chevron-right" size={30} color="#FF8447" />
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      case 'Half Yearly': {
        const { start, end } = getHalfYearMonths(new Date(currentDate.getFullYear(), currentDate.getMonth() + (timeOffset * 6)));
        return `${format(start, 'MMM yyyy')} - ${format(end, 'MMM yyyy')}`;
      }
      default: {
        const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + timeOffset);
        return format(currentMonth, 'MMMM yyyy');
      }
    }
  };

  const getWeekLabels = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const firstWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const lastWeekEnd = endOfWeek(monthEnd, { weekStartsOn: 1 }); // Monday
    const lastSaturday = new Date(lastWeekEnd);
    lastSaturday.setDate(lastSaturday.getDate() - 1); // Adjust to Saturday

    // Calculate total weeks between first Monday and last Saturday
    const totalWeeks = Math.ceil((lastSaturday.getTime() - firstWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    const labels = [];
    for (let i = 1; i <= totalWeeks; i++) {
      labels.push(`Week ${i}`);
    }
    return labels;
  };

  const getQuarterLabels = (currentMonth: Date) => {
    const currentQuarter = Math.floor(currentMonth.getMonth() / 3) + 1;
    const quarterStartMonth = (currentQuarter - 1) * 3;
    
    // Get three months for the current quarter
    return [
      format(new Date(currentMonth.getFullYear(), quarterStartMonth, 1), 'MMM'),
      format(new Date(currentMonth.getFullYear(), quarterStartMonth + 1, 1), 'MMM'),
      format(new Date(currentMonth.getFullYear(), quarterStartMonth + 2, 1), 'MMM')
    ];
  };

  const getQuarterData = async (currentMonth: Date): Promise<ChartData> => {
    const userId = auth.currentUser?.uid;
    if (!userId) return { labels: [], datasets: [{ data: [] }] };

    const achievementsRef = collection(db, 'telecaller_monthly_achievements');
    const currentYear = currentMonth.getFullYear();
    const currentQuarter = Math.floor(currentMonth.getMonth() / 3) + 1;
    const quarterStartMonth = (currentQuarter - 1) * 3;
    
    const monthlyData: number[] = [];
    const labels: string[] = [];
    
    // Get data for each month of the current quarter
    for (let i = 0; i < 3; i++) {
      const monthStart = new Date(currentYear, quarterStartMonth + i, 1);
      const monthEnd = new Date(currentYear, quarterStartMonth + i + 1, 0);
      
      labels.push(format(monthStart, 'MMM'));
      
      const monthQuery = query(
        achievementsRef,
        where('userId', '==', userId),
        where('monthStart', '==', Timestamp.fromDate(monthStart)),
        where('monthEnd', '==', Timestamp.fromDate(monthEnd))
      );

      const monthSnapshot = await getDocs(monthQuery);
      
      if (!monthSnapshot.empty) {
        const monthAchievements = monthSnapshot.docs.map(doc => doc.data().percentageAchieved);
        const monthAverage = monthAchievements.reduce((sum, val) => sum + val, 0) / monthAchievements.length;
        monthlyData.push(Math.min(Math.max(Math.round(monthAverage * 10) / 10, 0), 100)); // Ensure value is between 0 and 100
      } else {
        monthlyData.push(0);
      }
    }

    return {
      labels,
      datasets: [{ data: monthlyData }]
    };
  };

  const getWeeklyData = async (month: Date): Promise<ChartData> => {
    const userId = auth.currentUser?.uid;
    if (!userId) return { labels: [], datasets: [{ data: [] }] };

    const achievementsRef = collection(db, 'telecaller_achievements');
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    const weeklyQuery = query(
      achievementsRef,
      where('userId', '==', userId),
      where('weekStart', '>=', Timestamp.fromDate(monthStart)),
      where('weekEnd', '<=', Timestamp.fromDate(monthEnd)),
      orderBy('weekStart', 'asc')
    );

    const weeklySnapshot = await getDocs(weeklyQuery);
    const data: number[] = [];
    const labels: string[] = [];
    
    // Get all weeks in the month
    const weeks = eachWeekOfInterval(
      { start: monthStart, end: monthEnd },
      { weekStartsOn: 1 }
    );

    // Initialize data for each week
    weeks.forEach((weekStart, index) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekKey = `Week ${index + 1}`;
      labels.push(weekKey);

      // Find achievements for this week
      const weekAchievements = weeklySnapshot.docs
        .filter(doc => {
          const achievement = doc.data();
          const achievementDate = achievement.weekStart.toDate();
          return achievementDate >= weekStart && achievementDate <= weekEnd;
        })
        .map(doc => doc.data().percentageAchieved);

      if (weekAchievements.length > 0) {
        const weekAverage = weekAchievements.reduce((sum, val) => sum + val, 0) / weekAchievements.length;
        data.push(Math.min(Math.max(Math.round(weekAverage * 10) / 10, 0), 100)); // Ensure value is between 0 and 100
      } else {
        data.push(0);
      }
    });

    return {
      labels,
      datasets: [{ data }]
    };
  };

  const getHalfYearData = async (currentMonth: Date): Promise<ChartData> => {
    const userId = auth.currentUser?.uid;
    if (!userId) return { labels: [], datasets: [{ data: [] }] };

    const achievementsRef = collection(db, 'telecaller_monthly_achievements');
    const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 5, 1);
    const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    const halfYearQuery = query(
      achievementsRef,
      where('userId', '==', userId),
      where('monthStart', '>=', Timestamp.fromDate(startDate)),
      where('monthEnd', '<=', Timestamp.fromDate(endDate)),
      orderBy('monthStart', 'asc')
    );

    const halfYearSnapshot = await getDocs(halfYearQuery);
    const monthlyData: { [key: string]: number[] } = {};
    const labels: string[] = [];

    // Generate labels for the last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
      const monthKey = format(monthDate, 'MMM');
      labels.push(monthKey);
      monthlyData[monthKey] = [];
    }

    // Group achievements by month
    halfYearSnapshot.docs.forEach(doc => {
      const achievement = doc.data();
      const achievementDate = achievement.monthStart.toDate();
      const monthKey = format(achievementDate, 'MMM');
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].push(achievement.percentageAchieved);
      }
    });

    // Calculate monthly averages
    const data = labels.map(monthKey => {
      const monthAchievements = monthlyData[monthKey];
      if (monthAchievements.length > 0) {
        const monthAverage = monthAchievements.reduce((sum, val) => sum + val, 0) / monthAchievements.length;
        return Math.min(Math.max(Math.round(monthAverage * 10) / 10, 0), 100); // Ensure value is between 0 and 100
      }
      return 0;
    });

    return {
      labels,
      datasets: [{ data }]
    };
  };

  const fetchPeriodData = async (period: string, offset: number) => {
    if (!auth.currentUser) return;

    try {
      setIsLoading(true);
      const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);

      switch (period) {
        case 'Weekly': {
          const weeklyData = await getWeeklyData(currentMonth);
          setWeeklyChartData(weeklyData);
          break;
        }
        case 'Quarterly': {
          const quarterlyData = await getQuarterData(currentMonth);
          setQuarterlyChartData(quarterlyData);
          break;
        }
        case 'Half Yearly': {
          const halfYearData = await getHalfYearData(currentMonth);
          setHalfYearlyChartData(halfYearData);
          break;
        }
      }

      // Calculate highest and average achievements
      const allTimeQuery = query(
        collection(db, 'telecaller_achievements'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );

      const allTimeSnapshot = await getDocs(allTimeQuery);
      let highest = 0;
      let total = 0;
      let count = 0;

      allTimeSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const percentage = data.percentageAchieved;
        highest = Math.max(highest, percentage);
        total += percentage;
        count++;
      });

      setHighestAchievement(Math.round(highest * 10) / 10);
      setAverageAchievement(count > 0 ? Math.round((total / count) * 10) / 10 : 0);

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to calculate percentage achievement
  const calculatePercentage = (achievements: Achievements, targets: Targets): number => {
    const numCallsPercentage = (achievements.numCalls / targets.numCalls) * 100;
    const callDurationPercentage = (achievements.callDuration / targets.callDuration) * 100;
    const positiveLeadsPercentage = (achievements.positiveLeads / targets.positiveLeads) * 100;
    const closingAmountPercentage = (achievements.closingAmount / targets.closingAmount) * 100;

    // Round to 1 decimal place
    return Math.round(((numCallsPercentage + callDurationPercentage + positiveLeadsPercentage + closingAmountPercentage) / 4) * 10) / 10;
  };

  useEffect(() => {
    fetchPeriodData(selectedPeriod, timeOffset);
  }, [selectedPeriod]);

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

  const activeData = getActiveData();

  const renderSkeletonLoading = () => (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonHeader} />
      <View style={styles.skeletonPeriodContainer}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonPeriodButton} />
        ))}
      </View>
      <View style={styles.skeletonChart} />
      <View style={styles.skeletonStats}>
        {[1, 2].map((i) => (
          <View key={i} style={styles.skeletonStatCard} />
        ))}
      </View>
      <View style={styles.skeletonInsights}>
        {[1, 2].map((i) => (
          <View key={i} style={styles.skeletonInsightCard} />
        ))}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <AppGradient>
        <TelecallerMainLayout showDrawer showBackButton title="Performance Report">
          {renderSkeletonLoading()}
        </TelecallerMainLayout>
      </AppGradient>
    );
  }

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBackButton title="Performance Report">
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            {/* Header Section */}
            <View style={styles.headerSection}>
              <Text style={styles.headerTitle}>Performance Analytics</Text>
              <Text style={styles.headerSubtitle}>Track your achievements and progress</Text>
            </View>

            {/* Period Selection */}
            <View style={styles.periodContainer}>
              {periods.map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButton,
                    selectedPeriod === period && styles.selectedPeriodButton,
                  ]}
                  onPress={() => {
                    setSelectedPeriod(period);
                    setTimeOffset(0);
                  }}
                >
                  <Text
                    style={[
                      styles.periodText,
                      selectedPeriod === period && styles.selectedPeriodText,
                    ]}
                  >
                    {period}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Period Label and Navigation */}
            {getPeriodLabel()}

            {/* Quick Stats */}
            <View style={styles.quickStatsContainer}>
              <View style={styles.quickStatCard}>
                <MaterialIcons name="trending-up" size={24} color="#FF8447" />
                <Text style={styles.quickStatValue}>{highestAchievement.toFixed(1)}%</Text>
                <Text style={styles.quickStatLabel}>Highest Achievement</Text>
              </View>
              <View style={styles.quickStatCard}>
                <MaterialIcons name="assessment" size={24} color="#FF8447" />
                <Text style={styles.quickStatValue}>{averageAchievement.toFixed(1)}%</Text>
                <Text style={styles.quickStatLabel}>Average Achievement</Text>
              </View>
            </View>

            {/* Graph Section */}
            <View style={styles.graphCard}>
              <LineChart
                data={activeData}
                width={screenWidth}
                height={300}
                yAxisSuffix="%"
                yAxisInterval={25}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 1,
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
                    strokeWidth: 2,
                  },
                  formatYLabel: (value) => {
                    const numValue = parseFloat(value);
                    return Math.min(Math.max(Math.round(numValue), 0), 100).toString();
                  },
                  useShadowColorFromDataset: false,
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
                segments={4}
                withInnerLines={true}
                withOuterLines={true}
                withVerticalLines={true}
                withHorizontalLines={true}
                withDots={true}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                withShadow={false}
                fromZero={true}
                getDotProps={(value, index) => ({
                  r: value === highestAchievement ? '8' : '6',
                  strokeWidth: value === highestAchievement ? '3' : '2',
                  stroke: value === highestAchievement ? '#FF8447' : '#FF8447',
                })}
              />
            </View>

            {/* Performance Insights */}
            <View style={styles.insightsContainer}>
              <Text style={styles.insightsTitle}>Performance Insights</Text>
              <View style={styles.insightCard}>
                <MaterialIcons name="emoji-events" size={24} color="#FF8447" />
                <View style={styles.insightContent}>
                  <Text style={styles.insightText}>
                    Your highest achievement of {highestAchievement.toFixed(1)}% shows your potential!
                  </Text>
                  <Text style={styles.insightSubtext}>
                    Keep pushing to break your own records
                  </Text>
                </View>
              </View>
              <View style={styles.insightCard}>
                <MaterialIcons name="trending-up" size={24} color="#FF8447" />
                <View style={styles.insightContent}>
                  <Text style={styles.insightText}>
                    Your average performance is {averageAchievement.toFixed(1)}%
                  </Text>
                  <Text style={styles.insightSubtext}>
                    Maintain consistency to achieve your targets
                  </Text>
                </View>
              </View>
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
          </ScrollView>
        </View>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  scrollContainer: { flexGrow: 1 },
  periodContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 30,
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "white",
    elevation: 4,
    marginHorizontal: 2,
  },
  selectedPeriodButton: { backgroundColor: "#FF8447" },
  periodText: {
    fontSize: 12,
    fontFamily: "LexendDeca_500Medium",
    color: "#666",
    marginLeft: 8,
  },
  selectedPeriodText: { color: "white" },
  graphCard: { justifyContent: "center" },
  graph: { marginVertical: 18, marginHorizontal: 20 },
  messageContainer: { alignItems: "center", marginTop: 20 },
  messageText: { fontSize: 16, fontFamily: "LexendDeca_600SemiBold", color: "#333" },
  subMessageText: { fontSize: 14, fontFamily: "LexendDeca_400Regular", color: "#666", marginTop: 8 },
  legendContainer: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", marginHorizontal: 16 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendText: { fontSize: 12, fontFamily: "LexendDeca_400Regular", color: "#666" },
  statsContainer: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 , marginBottom: 60},
  statCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 8,
    elevation: 2,
  },
  statTitle: { fontSize: 12, fontFamily: "LexendDeca_400Regular", color: "#666", marginBottom: 8 },
  statValue: { fontSize: 24, fontFamily: "LexendDeca_600SemiBold", color: "#333" },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  periodLabelContainer: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: '100%',
  },
  quarterNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  monthNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  quarterLabelContainer: {
    alignItems: 'center',
  },
  monthLabelContainer: {
    alignItems: 'center',
  },
  quarterLabel: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 4,
  },
  yearLabel: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  monthLabel: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  navButton: {
    padding: 8,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 8,
    elevation: 2,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginVertical: 8,
  },
  quickStatLabel: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    textAlign: 'center',
  },
  insightsContainer: {
    marginTop: 24,
  },
  insightsTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 16,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    alignItems: 'center',
  },
  insightContent: {
    flex: 1,
    marginLeft: 12,
  },
  insightText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginBottom: 4,
  },
  insightSubtext: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  // Skeleton Loading Styles
  skeletonContainer: {
    flex: 1,
    padding: 20,
  },
  skeletonHeader: {
    height: 40,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 20,
    width: '60%',
    alignSelf: 'center',
  },
  skeletonPeriodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  skeletonPeriodButton: {
    height: 40,
    width: 100,
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
  },
  skeletonChart: {
    height: 300,
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    marginBottom: 20,
  },
  skeletonStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  skeletonStatCard: {
    flex: 1,
    height: 100,
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    marginHorizontal: 8,
  },
  skeletonInsights: {
    marginTop: 20,
  },
  skeletonInsightCard: {
    height: 80,
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    marginBottom: 12,
  },
});

export default ViewFullReport;
