import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useNavigation } from '@react-navigation/native';
import { auth } from '@/firebaseConfig';

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

const ViewFullReport = () => {
  const navigation = useNavigation();
  const [selectedPeriod, setSelectedPeriod] = useState('Weekly');
  const periods = ['Weekly', 'Quarterly', 'Half Yearly'];

  const [isLoading, setIsLoading] = useState(true);
  const [weeklyChartData, setWeeklyChartData] = useState({ labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'], datasets: [{ data: [0, 0, 0, 0, 0] }] });
  const [quarterlyChartData, setQuarterlyChartData] = useState({ labels: ['Jan', 'Feb', 'Mar'], datasets: [{ data: [0, 0, 0] }] });
  const [halfYearlyChartData, setHalfYearlyChartData] = useState({ labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], datasets: [{ data: [0, 0, 0, 0, 0, 0] }] });
  const [highestAchievement, setHighestAchievement] = useState(0);
  const [averageAchievement, setAverageAchievement] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) {
        return;
      }

      try {
        setIsLoading(true);

        // Get weekly data
        const weeklyData = await getWeeklyReportData(auth.currentUser.uid);
        setWeeklyChartData({
          labels: weeklyData.labels,
          datasets: [{ data: weeklyData.data }]
        });

        // Get quarterly data
        const quarterlyData = await getQuarterlyReportData(auth.currentUser.uid);
        setQuarterlyChartData({
          labels: quarterlyData.labels,
          datasets: [{ data: quarterlyData.data }]
        });

        // Get half yearly data
        const halfYearlyData = await getHalfYearlyReportData(auth.currentUser.uid);
        setHalfYearlyChartData({
          labels: halfYearlyData.labels,
          datasets: [{ data: halfYearlyData.data }]
        });

        // Get highest achievement
        const highest = await getHighestAchievement(auth.currentUser.uid);
        setHighestAchievement(highest);

        // Get average achievement
        const average = await getAverageAchievement(auth.currentUser.uid);
        setAverageAchievement(average);
      } catch (error) {
        console.error('Error fetching report data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

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
                  onPress={() => setSelectedPeriod(period)}
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
});

export default ViewFullReport;
