import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useNavigation } from '@react-navigation/native';
import { auth } from '@/firebaseConfig';
import { MaterialIcons } from '@expo/vector-icons';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachWeekOfInterval, isSameMonth, isSameWeek } from 'date-fns';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import TelecallerMainLayout from '../../components/TelecallerMainLayout';
import AppGradient from '@/app/components/AppGradient';

const screenWidth = Dimensions.get('window').width - 40;

interface ChartData {
  labels: string[];
  datasets: Array<{
    data: number[];
  }>;
}

interface AchievementData {
  callDuration: number;
  closingAmount: number;
  createdAt: Timestamp;
  date: string;
  month: number;
  numCalls: number;
  percentageAchieved: number;
  positiveLeads: number;
  updatedAt: Timestamp;
  userId: string;
  userName: string;
  week: number;
  weekStart: Timestamp;
  weekEnd: Timestamp;
  year: number;
}

interface MonthlyAchievement {
  month: string;
  highestAchievement: number;
  totalAchievement: number;
  weekCount: number;
}

const TelecallerViewFullReport = () => {
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
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthlyAchievements, setMonthlyAchievements] = useState<MonthlyAchievement[]>([]);
  const [allAchievements, setAllAchievements] = useState<AchievementData[]>([]);

  const getCurrentQuarter = (date: Date) => {
    return Math.floor(date.getMonth() / 3) + 1;
  };

  const getQuarterMonths = (date: Date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    const quarterStart = Math.floor(month / 3) * 3;
    return {
      start: new Date(year, quarterStart, 1),
      end: new Date(year, quarterStart + 2, new Date(year, quarterStart + 3, 0).getDate()),
      labels: [
        format(new Date(year, quarterStart, 1), 'MMM'),
        format(new Date(year, quarterStart + 1, 1), 'MMM'),
        format(new Date(year, quarterStart + 2, 1), 'MMM')
      ]
    };
  };

  const getHalfYearMonths = (date: Date) => {
    const currentMonth = date.getMonth();
    const currentYear = date.getFullYear();
    const labels = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(currentYear, currentMonth - i, 1);
      labels.push(format(monthDate, 'MMM'));
    }
    return {
      labels,
      start: new Date(currentYear, currentMonth - 5, 1),
      end: new Date(currentYear, currentMonth, new Date(currentYear, currentMonth + 1, 0).getDate())
    };
  };

  const handleTimeNavigation = (direction: 'prev' | 'next') => {
    const newOffset = direction === 'next' ? timeOffset + 1 : timeOffset - 1;
    setTimeOffset(newOffset);
  };

  const handleQuarterNavigation = (direction: 'prev' | 'next') => {
    const newOffset = direction === 'next' ? quarterOffset + 3 : quarterOffset - 3;
    setQuarterOffset(newOffset);
    setMonthOffset(0);
  };

  const handleMonthNavigation = (direction: 'prev' | 'next') => {
    const newOffset = direction === 'next' ? monthOffset + 1 : monthOffset - 1;
    if (newOffset >= 0 && newOffset <= 2) {
      setMonthOffset(newOffset);
    }
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'Quarterly': {
        const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + quarterOffset + monthOffset);
        const currentQuarter = getCurrentQuarter(currentMonth);
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
                style={[styles.navButton, monthOffset === 0 && { opacity: 0.5 }]}
                onPress={() => handleMonthNavigation('prev')}
                disabled={monthOffset === 0}
              >
                <MaterialIcons name="chevron-left" size={30} color="#FF8447" />
              </TouchableOpacity>
              <View style={styles.monthLabelContainer}>
                <Text style={styles.monthLabel}>{format(currentMonth, 'MMMM')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.navButton, monthOffset === 2 && { opacity: 0.5 }]}
                onPress={() => handleMonthNavigation('next')}
                disabled={monthOffset === 2}
              >
                <MaterialIcons name="chevron-right" size={30} color="#FF8447" />
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      case 'Half Yearly': {
        const adjustedDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + (timeOffset * 6));
        const { start, end } = getHalfYearMonths(adjustedDate);
        return (
          <View style={styles.periodLabelContainer}>
            <View style={styles.quarterNavigationContainer}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => handleTimeNavigation('prev')}
              >
                <MaterialIcons name="chevron-left" size={30} color="#FF8447" />
              </TouchableOpacity>
              <View style={styles.quarterLabelContainer}>
                <Text style={styles.quarterLabel}>{format(start, 'MMM yyyy')} - {format(end, 'MMM yyyy')}</Text>
              </View>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => handleTimeNavigation('next')}
              >
                <MaterialIcons name="chevron-right" size={30} color="#FF8447" />
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      default: {
        const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + timeOffset);
        return (
          <View style={styles.periodLabelContainer}>
            <View style={styles.quarterNavigationContainer}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => handleTimeNavigation('prev')}
              >
                <MaterialIcons name="chevron-left" size={30} color="#FF8447" />
              </TouchableOpacity>
              <View style={styles.quarterLabelContainer}>
                <Text style={styles.quarterLabel}>{format(currentMonth, 'MMMM yyyy')}</Text>
              </View>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => handleTimeNavigation('next')}
              >
                <MaterialIcons name="chevron-right" size={30} color="#FF8447" />
              </TouchableOpacity>
            </View>
          </View>
        );
      }
    }
  };

  const getWeekLabels = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const firstWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const lastSaturday = new Date(lastWeekEnd);
    lastSaturday.setDate(lastSaturday.getDate() - 1);
    const totalWeeks = Math.ceil((lastSaturday.getTime() - firstWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const labels = [];
    for (let i = 1; i <= totalWeeks; i++) {
      labels.push(`Week ${i}`);
    }
    return labels;
  };

  // Optimized data fetching - single query for all data
  const fetchAllAchievements = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];

    try {
      const achievementsRef = collection(db, 'telecaller_achievements');
      const q = query(
        achievementsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const achievements = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as unknown as AchievementData[];

      return achievements;
    } catch (error) {
      console.error('Error fetching achievements:', error);
      return [];
    }
  };

  // Memoized data processing functions
  const getWeeklyData = useMemo(() => {
    return (month: Date, achievements: AchievementData[]): ChartData => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
      const data: number[] = [];
      const labels: string[] = getWeekLabels(month);
      const currentDate = new Date();
      const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

      for (let i = 0; i < weeks.length; i++) {
        const weekStart = weeks[i];
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const isCurrentWeek = isSameWeek(weekStart, currentWeekStart, { weekStartsOn: 1 });
        labels[i] = isCurrentWeek ? `Week ${i + 1}*` : `Week ${i + 1}`;

        // Filter achievements for this week
        const weekAchievements = achievements.filter(achievement => {
          const achievementDate = achievement.weekStart.toDate();
          return achievementDate >= weekStart && achievementDate <= weekEnd;
        });

        if (weekAchievements.length > 0) {
          const percentages = weekAchievements.map(a => a.percentageAchieved);
          const highestAchievement = Math.max(...percentages);
          data.push(Math.min(Math.max(Math.round(highestAchievement * 10) / 10, 0), 100));
        } else {
          data.push(0);
        }
      }

      return { labels, datasets: [{ data }] };
    };
  }, []);

  const getQuarterData = useMemo(() => {
    return (currentMonth: Date, achievements: AchievementData[]): ChartData => {
      const adjustedMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + quarterOffset, 1);
      const { start, labels } = getQuarterMonths(adjustedMonth);
      const monthlyData: number[] = [];
      const monthlyAchievements: MonthlyAchievement[] = [];

      for (let i = 0; i < 3; i++) {
        const monthStart = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const monthEnd = endOfMonth(monthStart);

        // Filter achievements for this month
        const monthAchievements = achievements.filter(achievement => {
          const achievementDate = achievement.weekStart.toDate();
          return achievementDate >= monthStart && achievementDate <= monthEnd;
        });

        let totalAchievement = 0;
        let weekCount = 0;
        let highestAchievement = 0;

        if (monthAchievements.length > 0) {
          const percentages = monthAchievements.map(a => a.percentageAchieved);
          totalAchievement = percentages.reduce((sum, ach) => sum + ach, 0);
          weekCount = percentages.length;
          highestAchievement = Math.max(...percentages);
        }

        const averageAchievement = weekCount > 0 ? totalAchievement / weekCount : 0;
        monthlyData.push(Math.min(Math.max(Math.round(averageAchievement * 10) / 10, 0), 100));
        monthlyAchievements.push({
          month: format(monthStart, 'MMMM'),
          highestAchievement: Math.round(highestAchievement * 10) / 10,
          totalAchievement: Math.round(totalAchievement * 10) / 10,
          weekCount
        });
      }

      setMonthlyAchievements(monthlyAchievements);
      return { labels, datasets: [{ data: monthlyData }] };
    };
  }, [quarterOffset]);

  const getHalfYearData = useMemo(() => {
    return (currentMonth: Date, achievements: AchievementData[]): ChartData => {
      const adjustedMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + (timeOffset * 6), 1);
      const { start, labels } = getHalfYearMonths(adjustedMonth);
      const monthlyData: number[] = [];
      const monthlyAchievements: MonthlyAchievement[] = [];

      for (let i = 0; i < 6; i++) {
        const monthStart = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const monthEnd = endOfMonth(monthStart);

        // Filter achievements for this month
        const monthAchievements = achievements.filter(achievement => {
          const achievementDate = achievement.weekStart.toDate();
          return achievementDate >= monthStart && achievementDate <= monthEnd;
        });

        let totalAchievement = 0;
        let weekCount = 0;
        let highestAchievement = 0;

        if (monthAchievements.length > 0) {
          const percentages = monthAchievements.map(a => a.percentageAchieved);
          totalAchievement = percentages.reduce((sum, ach) => sum + ach, 0);
          weekCount = percentages.length;
          highestAchievement = Math.max(...percentages);
        }

        const averageAchievement = weekCount > 0 ? totalAchievement / weekCount : 0;
        monthlyData.push(Math.min(Math.max(Math.round(averageAchievement * 10) / 10, 0), 100));
        monthlyAchievements.push({
          month: format(monthStart, 'MMMM'),
          highestAchievement: Math.round(highestAchievement * 10) / 10,
          totalAchievement: Math.round(totalAchievement * 10) / 10,
          weekCount
        });
      }

      setMonthlyAchievements(monthlyAchievements);
      return { labels, datasets: [{ data: monthlyData }] };
    };
  }, [timeOffset]);

  const processPeriodData = useMemo(() => {
    return (period: string, achievements: AchievementData[]) => {
      let adjustedMonth: Date;
      
      switch (period) {
        case 'Weekly':
          adjustedMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + timeOffset, 1);
          break;
        case 'Quarterly':
          adjustedMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + quarterOffset + monthOffset, 1);
          break;
        case 'Half Yearly':
          adjustedMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + (timeOffset * 6), 1);
          break;
        default:
          adjustedMonth = new Date();
      }

      switch (period) {
        case 'Weekly': {
          const weeklyData = getWeeklyData(adjustedMonth, achievements);
          setWeeklyChartData(weeklyData);
          break;
        }
        case 'Quarterly': {
          const quarterlyData = getQuarterData(adjustedMonth, achievements);
          setQuarterlyChartData(quarterlyData);
          break;
        }
        case 'Half Yearly': {
          const halfYearData = getHalfYearData(adjustedMonth, achievements);
          setHalfYearlyChartData(halfYearData);
          break;
        }
      }
    };
  }, [currentDate, timeOffset, quarterOffset, monthOffset, getWeeklyData, getQuarterData, getHalfYearData]);

  const fetchPeriodData = async () => {
    if (!auth.currentUser) return;

    try {
      setIsLoading(true);
      setMonthlyAchievements([]);

      // Fetch all achievements once
      const achievements = await fetchAllAchievements();
      setAllAchievements(achievements);

      // Process data for current period
      processPeriodData(selectedPeriod, achievements);

      // Calculate highest and average achievements
      if (achievements.length > 0) {
        const percentages = achievements.map(a => a.percentageAchieved);
        const highest = Math.max(...percentages);
        const total = percentages.reduce((sum, p) => sum + p, 0);
        const count = percentages.length;

        setHighestAchievement(Math.round(highest * 10) / 10);
        setAverageAchievement(count > 0 ? Math.round((total / count) * 10) / 10 : 0);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriodData();
  }, [selectedPeriod, timeOffset, quarterOffset, monthOffset]);

  // Re-process data when achievements change
  useEffect(() => {
    if (allAchievements.length > 0) {
      processPeriodData(selectedPeriod, allAchievements);
    }
  }, [allAchievements, selectedPeriod, timeOffset, quarterOffset, monthOffset]);

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

  // Dynamic Y-axis segments based on data range
  const getYAxisSegments = () => {
    if (!activeData.datasets[0].data.length) return 4;
    
    const maxValue = Math.max(...activeData.datasets[0].data);
    if (maxValue <= 25) return 5;
    if (maxValue <= 50) return 4;
    if (maxValue <= 75) return 3;
    return 4;
  };

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

  const getMonthSelector = () => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        value: date,
        label: format(date, 'MMM yyyy')
      };
    }).reverse();

    const isCurrentMonth = (date: Date) => {
      const now = new Date();
      return isSameMonth(date, now);
    };

    return (
      <View style={styles.monthSelectorContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthSelectorScrollContent}
        >
          {months.map((month, index) => {
            const isSelected = format(selectedMonth, 'MMM yyyy') === month.label;
            const isCurrent = isCurrentMonth(month.value);
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.monthSelectorItem,
                  isSelected && styles.monthSelectorItemSelected,
                  isCurrent && styles.monthSelectorItemCurrent
                ]}
                onPress={() => {
                  setSelectedMonth(month.value);
                  setTimeOffset(-index);
                }}
              >
                <Text style={[
                  styles.monthSelectorItemText,
                  isSelected && styles.monthSelectorItemTextSelected,
                  isCurrent && styles.monthSelectorItemTextCurrent
                ]}>
                  {month.label}
                </Text>
                {isCurrent && (
                  <View style={styles.currentMonthIndicator} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

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
            <View style={styles.headerSection}>
              <Text style={styles.headerTitle}>Performance Analytics</Text>
              <Text style={styles.headerSubtitle}>Track your achievements and progress</Text>
            </View>

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
                    setQuarterOffset(0);
                    setMonthOffset(0);
                    setMonthlyAchievements([]);
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

            {selectedPeriod === 'Weekly' && getMonthSelector()}
            {getPeriodLabel()}

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
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(255, 132, 71, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(128, 128, 128, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: '6', strokeWidth: '2', stroke: '#FF8447' },
                  propsForBackgroundLines: { stroke: '#E5E7EB', strokeWidth: 2 },
                  formatYLabel: (value) => {
                    const numValue = parseFloat(value);
                    return Math.min(Math.max(Math.round(numValue), 0), 100).toString();
                  },
                  useShadowColorFromDataset: false,
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
                segments={getYAxisSegments()}
                withInnerLines={true}
                withOuterLines={true}
                withVerticalLines={true}
                withHorizontalLines={true}
                withDots={true}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                withShadow={false}
                fromZero={true}
                getDotProps={(value, index) => {
                  const isCurrentMonth = selectedPeriod !== 'Weekly' && 
                    format(new Date(), 'MMM yyyy') === activeData.labels[index];
                  return {
                    r: isCurrentMonth ? '8' : '6',
                    strokeWidth: isCurrentMonth ? '3' : '2',
                    stroke: isCurrentMonth ? '#FF8447' : '#FF8447',
                  };
                }}
                formatXLabel={(value) => value}
              />
            </View>
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

            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#FF8447" }]} />
                <Text style={styles.legendText}>Weekly Achievement</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#E5E7EB" }]} />
                <Text style={styles.legendText}>Target</Text>
              </View>
              {selectedPeriod === 'Weekly' && (
                <Text style={styles.currentWeekNote}>* Current Week</Text>
              )}
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
  legendContainer: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", marginHorizontal: 16 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendText: { fontSize: 12, fontFamily: "LexendDeca_400Regular", color: "#666" },
  periodLabelContainer: {
    alignItems: 'center',
    marginBottom: 5,
    borderRadius: 16,
    padding: 5,
    width: '100%',
  },
  quarterNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
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
  quarterLabelContainer: { alignItems: 'center' },
  monthLabelContainer: { alignItems: 'center' },
  quarterLabel: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
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
  navButton: { padding: 8 },
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
  currentWeekNote: {
    fontSize: 12,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
    fontStyle: "italic",
    marginTop: 4,
  },
  monthSelectorContainer: {
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
  },
  monthSelectorScrollContent: {
    paddingHorizontal: 4,
  },
  monthSelectorItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  monthSelectorItemSelected: {
    backgroundColor: '#FF8447',
  },
  monthSelectorItemCurrent: {
    borderWidth: 2,
    borderColor: '#FF8447',
  },
  monthSelectorItemText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  monthSelectorItemTextSelected: {
    color: '#fff',
  },
  monthSelectorItemTextCurrent: {
    color: '#fff',
  },
  currentMonthIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF8447',
  },
  monthAchievementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  monthAchievementText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  monthAchievementValue: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF8447',
  },
});

export default TelecallerViewFullReport;