import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useNavigation } from '@react-navigation/native';
import { auth } from '@/firebaseConfig';
import { MaterialIcons } from '@expo/vector-icons';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';

import TelecallerMainLayout from '../../components/TelecallerMainLayout';
import AppGradient from '@/app/components/AppGradient';
import targetService, {
  getWeeklyReportData,
  getQuarterlyReportData,
  getHalfYearlyReportData,
  getHighestAchievement,
  getAverageAchievement
} from '@/app/services/targetService';

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

const ViewFullReport = () => {
  const navigation = useNavigation();
  const [selectedPeriod, setSelectedPeriod] = useState('Weekly');
  const periods = ['Weekly', 'Quarterly', 'Half Yearly'];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeOffset, setTimeOffset] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [weeklyChartData, setWeeklyChartData] = useState<ChartData>({ 
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'], 
    datasets: [{ data: [0, 0, 0, 0, 0] }] 
  });
  const [quarterlyChartData, setQuarterlyChartData] = useState<ChartData>({ 
    labels: ['Q1', 'Q2', 'Q3', 'Q4'], 
    datasets: [{ data: [0, 0, 0, 0] }] 
  });
  const [halfYearlyChartData, setHalfYearlyChartData] = useState<ChartData>({ 
    labels: [], 
    datasets: [{ data: [] }] 
  });
  const [highestAchievement, setHighestAchievement] = useState(0);
  const [averageAchievement, setAverageAchievement] = useState(0);

  const getCurrentQuarter = (date: Date) => {
    const month = date.getMonth();
    // Map months to quarters (0-11 to 1-3)
    if (month >= 0 && month <= 3) return 1;
    if (month >= 4 && month <= 7) return 2;
    return 3;
  };

  const getQuarterMonths = (date: Date) => {
    const currentMonth = date.getMonth();
    const currentYear = date.getFullYear();
    
    // Calculate start and end months for the current quarter
    let startMonth, endMonth;
    if (currentMonth >= 0 && currentMonth <= 3) {
      startMonth = 0; // January
      endMonth = 3;   // April
    } else if (currentMonth >= 4 && currentMonth <= 7) {
      startMonth = 4; // May
      endMonth = 7;   // August
    } else {
      startMonth = 8; // September
      endMonth = 11;  // December
    }
    
    return {
      start: new Date(currentYear, startMonth, 1),
      end: new Date(currentYear, endMonth, 31)
    };
  };

  const getHalfYearMonths = (date: Date) => {
    const currentMonth = date.getMonth();
    const currentYear = date.getFullYear();
    const labels = [];
    
    // Generate labels for next 6 months starting from current month
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(currentYear, currentMonth + i, 1);
      labels.push(format(monthDate, 'MMM'));
    }
    
    return {
      labels,
      start: new Date(currentYear, currentMonth, 1),
      end: new Date(currentYear, currentMonth + 5, 31)
    };
  };

  const handleTimeNavigation = (direction: 'prev' | 'next') => {
    const newOffset = direction === 'next' ? timeOffset + 1 : timeOffset - 1;
    setTimeOffset(newOffset);
    fetchPeriodData(selectedPeriod, newOffset);
  };

  const fetchPeriodData = async (period: string, offset: number) => {
    if (!auth.currentUser) return;

    try {
      setIsLoading(true);
      const userId = auth.currentUser.uid;

      switch (period) {
        case 'Weekly':
          const weeklyData = await getWeeklyReportData(userId);
          setWeeklyChartData({
            labels: weeklyData.labels,
            datasets: [{ data: weeklyData.data }]
          });
          break;

        case 'Quarterly': {
          const { start: qStart, end: qEnd } = getQuarterMonths(currentDate);
          const quarterlyData = await getQuarterlyReportData(userId);
          
          // Create labels based on current month
          const currentMonth = currentDate.getMonth();
          let labels = ['Q1', 'Q2', 'Q3'];
          
          // Highlight current quarter
          const currentQuarter = getCurrentQuarter(currentDate);
          const data = Array(3).fill(0);
          data[currentQuarter - 1] = quarterlyData.data[currentQuarter - 1] || 0;

          setQuarterlyChartData({
            labels,
            datasets: [{ data }]
          });
          break;
        }

        case 'Half Yearly': {
          const { labels: hLabels, start: hStart, end: hEnd } = getHalfYearMonths(currentDate);
          const halfYearlyData = await getHalfYearlyReportData(userId);
          
          // Ensure data array has exactly 6 elements
          const data = Array(6).fill(0);
          halfYearlyData.data.forEach((value, index) => {
            if (index < 6) data[index] = value;
          });

          setHalfYearlyChartData({
            labels: hLabels,
            datasets: [{ data }]
          });
          break;
        }
      }

      const highest = await getHighestAchievement(userId);
      const average = await getAverageAchievement(userId);
      setHighestAchievement(highest);
      setAverageAchievement(average);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
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

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'Quarterly':
        const currentQuarter = getCurrentQuarter(currentDate);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
        const currentMonth = currentDate.getMonth();
        return `${monthNames[currentMonth]} (Q${currentQuarter})`;
      case 'Half Yearly':
        const { start: hStart, end: hEnd } = getHalfYearMonths(currentDate);
        return `${format(hStart, 'MMMM yyyy')} - ${format(hEnd, 'MMMM yyyy')}`;
      default:
        return 'This Week';
    }
  };

  const activeData = getActiveData();

  if (isLoading) {
    return (
      <AppGradient>
        <TelecallerMainLayout showDrawer showBackButton title="Weekly Report">
          <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#FF8447" />
            <Text style={styles.loadingText}>Loading your reports...</Text>
          </View>
        </TelecallerMainLayout>
      </AppGradient>
    );
  }

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBackButton title="Weekly Report">
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
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

            {/* Period Label */}
            <Text style={styles.periodLabel}>{getPeriodLabel()}</Text>

            {/* Graph Section */}
            <View style={styles.graphCard}>
              <LineChart
                data={activeData}
                width={screenWidth}
                height={300}
                yAxisSuffix="%"
                yAxisInterval={1}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
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
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
                segments={selectedPeriod === 'Half Yearly' ? 5 : 4}
                withInnerLines={true}
                withOuterLines={true}
                withVerticalLines={true}
                withHorizontalLines={true}
                withDots={true}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                withShadow={false}
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
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "white",
    elevation: 4,
    marginHorizontal: 2,
  },
  selectedPeriodButton: { backgroundColor: "#FF8447" },
  periodText: { fontSize: 12, fontFamily: "LexendDeca_500Medium", color: "#666" },
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
  timeNavigation: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  navButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    elevation: 2,
  },
  periodLabel: {
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginHorizontal: 16,
    minWidth: 150,
    textAlign: 'center',
  },
});

export default ViewFullReport;
