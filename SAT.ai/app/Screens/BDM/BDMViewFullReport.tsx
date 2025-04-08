import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { auth, db } from '@/firebaseConfig';
import { collection, query, where, getDocs, Timestamp, addDoc, updateDoc, orderBy } from 'firebase/firestore';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, endOfWeek, subMonths, startOfWeek, endOfDay } from 'date-fns';

const screenWidth = Dimensions.get('window').width - 40;

interface ChartData {
  labels: string[];
  datasets: {
    data: number[];
  }[];
  monthInfo?: { [key: string]: { year: number, month: string } };
}

interface MonthlyAchievement {
  month: string;
  highestAchievement: number;
  weekCount: number;
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
  const [monthlyAchievements, setMonthlyAchievements] = useState<MonthlyAchievement[]>([]);

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
      const weeklyData = await getWeeklyData(new Date());
      setWeeklyChartData(weeklyData);

      // Fetch quarterly data
      const quarterlyData = await getQuarterData(new Date());
      setQuarterlyChartData(quarterlyData);

      // Fetch half yearly data
      const halfYearlyData = await getHalfYearData(new Date());
      setHalfYearlyChartData(halfYearlyData);

      // Calculate highest and average achievements
      const allAchievements = [
        ...weeklyData.datasets[0].data,
        ...quarterlyData.datasets[0].data,
        ...halfYearlyData.datasets[0].data
      ].filter(value => value > 0); // Filter out zero values

      const highest = allAchievements.length > 0 ? Math.max(...allAchievements) : 0;
      const average = allAchievements.length > 0 
        ? Math.round(allAchievements.reduce((a, b) => a + b, 0) / allAchievements.length) 
        : 0;

      setHighestAchievement(highest);
      setAverageAchievement(average);

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getWeeklyData = async (currentMonth: Date): Promise<ChartData> => {
    const userId = auth.currentUser?.uid;
    if (!userId) return { labels: [], datasets: [{ data: [] }] };

    const reportsRef = collection(db, 'bdm_reports');
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    // Get all weeks in the month
    const weeks = eachWeekOfInterval(
      { start: monthStart, end: monthEnd },
      { weekStartsOn: 1 } // Start weeks on Monday
    );

    const data: number[] = [];
    const labels: string[] = [];
    
    // Process each week
    for (let i = 0; i < weeks.length; i++) {
      const weekStart = weeks[i];
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      
      // Create label for this week
      const weekNumber = i + 1;
      labels.push(`Week ${weekNumber}`);
      
      // Get current year, month, and week number
      const currentYear = weekStart.getFullYear();
      const currentMonth = weekStart.getMonth() + 1;
      const currentWeekNumber = Math.ceil((weekStart.getDate() + new Date(currentYear, weekStart.getMonth(), 1).getDay()) / 7);
      
      // Query reports for this week
      const weekQuery = query(
        reportsRef,
        where('userId', '==', userId),
        where('year', '==', currentYear),
        where('month', '==', currentMonth),
        where('weekNumber', '==', currentWeekNumber)
      );

      const weekSnapshot = await getDocs(weekQuery);
      
      if (!weekSnapshot.empty) {
        // Calculate achievement percentage for this week
        let totalMeetings = 0;
        let totalAttendedMeetings = 0;
        let totalDuration = 0;
        let totalClosing = 0;
        
        weekSnapshot.forEach(doc => {
          const reportData = doc.data();
          
          totalMeetings += reportData.numMeetings || 0;
          totalAttendedMeetings += reportData.positiveLeads || 0;
          totalClosing += reportData.totalClosingAmount || 0;
          
          // Parse duration string - handle both formats
          const durationStr = reportData.meetingDuration || '';
          
          // Check if it's in HH:MM:SS format
          if (durationStr.includes(':')) {
            const [hours, minutes, seconds] = durationStr.split(':').map(Number);
            totalDuration += (hours * 3600) + (minutes * 60) + seconds;
          } else {
            // Handle "X hr Y mins" format
            const hrMatch = durationStr.match(/(\d+)\s*hr/);
            const minMatch = durationStr.match(/(\d+)\s*min/);
            const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) +
                         (minMatch ? parseInt(minMatch[1]) / 60 : 0);
            totalDuration += hours * 3600; // Convert to seconds
          }
        });
        
        // Calculate progress percentages
        const meetingsPercentage = (totalMeetings / 30) * 100;
        const attendedPercentage = (totalAttendedMeetings / 30) * 100;
        const durationPercentage = (totalDuration / (20 * 3600)) * 100; // 20 hours in seconds
        const closingPercentage = (totalClosing / 50000) * 100;
        
        // Calculate overall progress as average of all percentages
        const overallProgress = Math.min(
          (meetingsPercentage + attendedPercentage + durationPercentage + closingPercentage) / 4,
          100
        );
        
        data.push(Math.min(Math.max(Math.round(overallProgress * 10) / 10, 0), 100));
        
        // Save to achievements collection for consistency
        const achievementsRef = collection(db, 'bdm_achievements');
        const achievementQuery = query(
          achievementsRef,
          where('userId', '==', userId),
          where('weekStart', '==', Timestamp.fromDate(weekStart)),
          where('weekEnd', '==', Timestamp.fromDate(weekEnd))
        );
        
        const achievementSnapshot = await getDocs(achievementQuery);
        
        if (!achievementSnapshot.empty) {
          // Update existing achievement
          const existingAchievement = achievementSnapshot.docs[0];
          await updateDoc(existingAchievement.ref, {
            percentageAchieved: overallProgress,
            updatedAt: Timestamp.fromDate(new Date())
          });
        } else {
          // Create new achievement
          const achievementData = {
            userId,
            weekStart: Timestamp.fromDate(weekStart),
            weekEnd: Timestamp.fromDate(weekEnd),
            percentageAchieved: overallProgress,
            year: currentYear,
            month: currentMonth,
            weekNumber: currentWeekNumber,
            createdAt: Timestamp.fromDate(new Date()),
            updatedAt: Timestamp.fromDate(new Date())
          };
          
          await addDoc(achievementsRef, achievementData);
        }
      } else {
        data.push(0);
      }
    }

    // Calculate and save monthly total for real-time updates
    const now = new Date();
    const isCurrentMonth = currentMonth.getMonth() === now.getMonth() && 
                          currentMonth.getFullYear() === now.getFullYear();
    
    if (isCurrentMonth) {
      // Calculate total achievement for the current month
      const totalAchievement = data.reduce((sum, achievement) => sum + achievement, 0);
      const averageAchievement = data.length > 0 ? totalAchievement / data.length : 0;
      
      // Save to monthly summary for real-time updates
      const monthlySummaryRef = collection(db, 'bdm_monthly_summaries');
      const monthlyQuery = query(
        monthlySummaryRef,
        where('userId', '==', userId),
        where('monthStart', '==', Timestamp.fromDate(monthStart)),
        where('monthEnd', '==', Timestamp.fromDate(monthEnd))
      );
      
      const monthlySnapshot = await getDocs(monthlyQuery);
      
      if (!monthlySnapshot.empty) {
        // Update existing monthly summary
        const existingMonthly = monthlySnapshot.docs[0];
        
        // Create weekly achievements array for the current month
        const weeklyAchievements = weeks.map((weekStart, index) => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          return {
            weekNumber: index + 1,
            achievement: data[index],
            weekStart: Timestamp.fromDate(weekStart),
            weekEnd: Timestamp.fromDate(weekEnd)
          };
        });
        
        await updateDoc(existingMonthly.ref, {
          totalAchievement: averageAchievement,
          weekCount: data.length,
          weeklyAchievements: weeklyAchievements,
          updatedAt: Timestamp.fromDate(new Date())
        });
      } else {
        // Create new monthly summary
        const weeklyAchievements = weeks.map((weekStart, index) => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          return {
            weekNumber: index + 1,
            achievement: data[index],
            weekStart: Timestamp.fromDate(weekStart),
            weekEnd: Timestamp.fromDate(weekEnd)
          };
        });
        
        const monthlyData = {
          userId,
          monthStart: Timestamp.fromDate(monthStart),
          monthEnd: Timestamp.fromDate(monthEnd),
          totalAchievement: averageAchievement,
          weekCount: data.length,
          month: monthStart.getMonth() + 1,
          year: monthStart.getFullYear(),
          weeklyAchievements: weeklyAchievements,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        };
        
        await addDoc(monthlySummaryRef, monthlyData);
      }
    }

    return {
      labels,
      datasets: [{ data }]
    };
  };

  const getQuarterData = async (currentMonth: Date): Promise<ChartData> => {
    const userId = auth.currentUser?.uid;
    if (!userId) return { labels: [], datasets: [{ data: [] }] };

    const monthlySummaryRef = collection(db, 'bdm_monthly_summaries');
    const reportsRef = collection(db, 'bdm_reports');
    const currentYear = currentMonth.getFullYear();
    const currentQuarter = Math.floor(currentMonth.getMonth() / 3) + 1;
    const quarterStartMonth = (currentQuarter - 1) * 3;
    
    const monthlyDataArray: number[] = [];
    const labels: string[] = [];
    const monthlyAchievements: MonthlyAchievement[] = [];
    
    // Get data for each month of the current quarter
    for (let i = 0; i < 3; i++) {
      const monthStart = new Date(currentYear, quarterStartMonth + i, 1);
      const monthEnd = new Date(currentYear, quarterStartMonth + i + 1, 0);
      
      // Create detailed label with month and year
      labels.push(format(monthStart, 'MMM yyyy'));
      
      // Check if this is the current month
      const now = new Date();
      const isCurrentMonth = monthStart.getMonth() === now.getMonth() && 
                            monthStart.getFullYear() === now.getFullYear();
      
      if (isCurrentMonth) {
        // For current month, calculate real-time data from weekly achievements
        const weeks = eachWeekOfInterval(
          { start: monthStart, end: monthEnd },
          { weekStartsOn: 1 } // Start weeks on Monday
        );
        
        let totalAchievement = 0;
        let weekCount = 0;
        
        // Process each week in the current month
        for (const weekStart of weeks) {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          
          // Get current year, month, and week number
          const weekYear = weekStart.getFullYear();
          const weekMonth = weekStart.getMonth() + 1;
          const weekNumber = Math.ceil((weekStart.getDate() + new Date(weekYear, weekStart.getMonth(), 1).getDay()) / 7);
          
          // Query reports for this week
          const weekQuery = query(
            reportsRef,
            where('userId', '==', userId),
            where('year', '==', weekYear),
            where('month', '==', weekMonth),
            where('weekNumber', '==', weekNumber)
          );
          
          const weekSnapshot = await getDocs(weekQuery);
          
          if (!weekSnapshot.empty) {
            // Calculate achievement percentage for this week
            let totalMeetings = 0;
            let totalAttendedMeetings = 0;
            let totalDuration = 0;
            let totalClosing = 0;
            
            weekSnapshot.forEach(doc => {
              const reportData = doc.data();
              
              totalMeetings += reportData.numMeetings || 0;
              totalAttendedMeetings += reportData.positiveLeads || 0;
              totalClosing += reportData.totalClosingAmount || 0;
              
              // Parse duration string - handle both formats
              const durationStr = reportData.meetingDuration || '';
              
              // Check if it's in HH:MM:SS format
              if (durationStr.includes(':')) {
                const [hours, minutes, seconds] = durationStr.split(':').map(Number);
                totalDuration += (hours * 3600) + (minutes * 60) + seconds;
              } else {
                // Handle "X hr Y mins" format
                const hrMatch = durationStr.match(/(\d+)\s*hr/);
                const minMatch = durationStr.match(/(\d+)\s*min/);
                const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) +
                             (minMatch ? parseInt(minMatch[1]) / 60 : 0);
                totalDuration += hours * 3600; // Convert to seconds
              }
            });
            
            // Calculate progress percentages
            const meetingsPercentage = (totalMeetings / 30) * 100;
            const attendedPercentage = (totalAttendedMeetings / 30) * 100;
            const durationPercentage = (totalDuration / (20 * 3600)) * 100; // 20 hours in seconds
            const closingPercentage = (totalClosing / 50000) * 100;
            
            // Calculate overall progress as average of all percentages
            const overallProgress = Math.min(
              (meetingsPercentage + attendedPercentage + durationPercentage + closingPercentage) / 4,
              100
            );
            
            totalAchievement += overallProgress;
            weekCount++;
          }
        }
        
        // Calculate average achievement for the current month
        const averageAchievement = weekCount > 0 ? totalAchievement / weekCount : 0;
        monthlyDataArray.push(Math.min(Math.max(Math.round(averageAchievement * 10) / 10, 0), 100));
        
        monthlyAchievements.push({
          month: format(monthStart, 'MMMM yyyy'),
          highestAchievement: averageAchievement,
          weekCount: weekCount
        });
        
        // Save the calculated data to monthly summary for consistency
        const monthlyQuery = query(
          monthlySummaryRef,
      where('userId', '==', userId),
          where('monthStart', '==', Timestamp.fromDate(monthStart)),
          where('monthEnd', '==', Timestamp.fromDate(monthEnd))
        );
        
        const monthlySnapshot = await getDocs(monthlyQuery);
        
        if (!monthlySnapshot.empty) {
          // Update existing monthly summary
          const existingMonthly = monthlySnapshot.docs[0];
          await updateDoc(existingMonthly.ref, {
            totalAchievement: averageAchievement,
            weekCount: weekCount,
            updatedAt: Timestamp.fromDate(new Date())
          });
        } else {
          // Create new monthly summary
          const monthlyData = {
            userId,
            monthStart: Timestamp.fromDate(monthStart),
            monthEnd: Timestamp.fromDate(monthEnd),
            totalAchievement: averageAchievement,
            weekCount: weekCount,
            month: monthStart.getMonth() + 1,
            year: monthStart.getFullYear(),
            createdAt: Timestamp.fromDate(new Date()),
            updatedAt: Timestamp.fromDate(new Date())
          };
          
          await addDoc(monthlySummaryRef, monthlyData);
        }
      } else {
        // For past months, use the stored monthly summary
        const monthQuery = query(
          monthlySummaryRef,
          where('userId', '==', userId),
          where('monthStart', '==', Timestamp.fromDate(monthStart)),
          where('monthEnd', '==', Timestamp.fromDate(monthEnd))
        );

        const monthSnapshot = await getDocs(monthQuery);
        
        if (!monthSnapshot.empty) {
          const monthData = monthSnapshot.docs[0].data();
          const totalAchievement = monthData.totalAchievement || 0;
          
          monthlyDataArray.push(Math.min(Math.max(Math.round(totalAchievement * 10) / 10, 0), 100));
          
          monthlyAchievements.push({
            month: format(monthStart, 'MMMM yyyy'),
            highestAchievement: totalAchievement,
            weekCount: monthData.weekCount || 0
          });
        } else {
          // If no monthly summary exists, calculate from reports
          const monthYear = monthStart.getFullYear();
          const monthNumber = monthStart.getMonth() + 1;
          
          // Get all weeks in the month
          const weeks = eachWeekOfInterval(
            { start: monthStart, end: monthEnd },
            { weekStartsOn: 1 } // Start weeks on Monday
          );
          
          let totalAchievement = 0;
          let weekCount = 0;
          
          // Process each week in the month
          for (const weekStart of weeks) {
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
            
            // Get week number
            const weekNumber = Math.ceil((weekStart.getDate() + new Date(monthYear, monthStart.getMonth(), 1).getDay()) / 7);
            
            // Query reports for this week
            const weekQuery = query(
              reportsRef,
              where('userId', '==', userId),
              where('year', '==', monthYear),
              where('month', '==', monthNumber),
              where('weekNumber', '==', weekNumber)
            );
            
            const weekSnapshot = await getDocs(weekQuery);
            
            if (!weekSnapshot.empty) {
              // Calculate achievement percentage for this week
              let totalMeetings = 0;
              let totalAttendedMeetings = 0;
              let totalDuration = 0;
              let totalClosing = 0;
              
              weekSnapshot.forEach(doc => {
                const reportData = doc.data();
                
                totalMeetings += reportData.numMeetings || 0;
                totalAttendedMeetings += reportData.positiveLeads || 0;
                totalClosing += reportData.totalClosingAmount || 0;
                
                // Parse duration string - handle both formats
                const durationStr = reportData.meetingDuration || '';
                
                // Check if it's in HH:MM:SS format
                if (durationStr.includes(':')) {
                  const [hours, minutes, seconds] = durationStr.split(':').map(Number);
                  totalDuration += (hours * 3600) + (minutes * 60) + seconds;
                } else {
                  // Handle "X hr Y mins" format
                  const hrMatch = durationStr.match(/(\d+)\s*hr/);
                  const minMatch = durationStr.match(/(\d+)\s*min/);
                  const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) +
                               (minMatch ? parseInt(minMatch[1]) / 60 : 0);
                  totalDuration += hours * 3600; // Convert to seconds
                }
              });
              
              // Calculate progress percentages
              const meetingsPercentage = (totalMeetings / 30) * 100;
              const attendedPercentage = (totalAttendedMeetings / 30) * 100;
              const durationPercentage = (totalDuration / (20 * 3600)) * 100; // 20 hours in seconds
              const closingPercentage = (totalClosing / 50000) * 100;
              
              // Calculate overall progress as average of all percentages
              const overallProgress = Math.min(
                (meetingsPercentage + attendedPercentage + durationPercentage + closingPercentage) / 4,
                100
              );
              
              totalAchievement += overallProgress;
              weekCount++;
            }
          }
          
          // Calculate average achievement for the month
          const averageAchievement = weekCount > 0 ? totalAchievement / weekCount : 0;
          monthlyDataArray.push(Math.min(Math.max(Math.round(averageAchievement * 10) / 10, 0), 100));
          
          monthlyAchievements.push({
            month: format(monthStart, 'MMMM yyyy'),
            highestAchievement: averageAchievement,
            weekCount: weekCount
          });
          
          // Save the calculated data to monthly summary for future use
          const monthlyData = {
            userId,
            monthStart: Timestamp.fromDate(monthStart),
            monthEnd: Timestamp.fromDate(monthEnd),
            totalAchievement: averageAchievement,
            weekCount: weekCount,
            month: monthStart.getMonth() + 1,
            year: monthStart.getFullYear(),
            createdAt: Timestamp.fromDate(new Date()),
            updatedAt: Timestamp.fromDate(new Date())
          };
          
          await addDoc(monthlySummaryRef, monthlyData);
        }
      }
    }

    setMonthlyAchievements(monthlyAchievements);
    return {
      labels,
      datasets: [{ data: monthlyDataArray }]
    };
  };

  const getHalfYearData = async (currentMonth: Date): Promise<ChartData> => {
    const userId = auth.currentUser?.uid;
    if (!userId) return { labels: [], datasets: [{ data: [] }] };

    const monthlySummaryRef = collection(db, 'bdm_monthly_summaries');
    const reportsRef = collection(db, 'bdm_reports');
    const currentYear = currentMonth.getFullYear();
    const currentMonthIndex = currentMonth.getMonth();
    
    // Calculate start and end dates for the 6-month period
    const startDate = new Date(currentYear, currentMonthIndex - 5, 1); // 5 months ago
    const endDate = new Date(currentYear, currentMonthIndex + 1, 0); // Current month end
    
    const halfYearQuery = query(
      monthlySummaryRef,
      where('userId', '==', userId),
      where('monthStart', '>=', Timestamp.fromDate(startDate)),
      where('monthEnd', '<=', Timestamp.fromDate(endDate)),
      orderBy('monthStart', 'asc')
    );

    const halfYearSnapshot = await getDocs(halfYearQuery);
    const monthlyDataMap: { [key: string]: number } = {};
    const labels: string[] = [];
    const monthInfo: { [key: string]: { year: number, month: string } } = {};

    // Generate labels for the last 6 months (current month and previous 5)
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(currentYear, currentMonthIndex - i, 1);
      const monthKey = format(monthDate, 'MMM yyyy');
      labels.push(monthKey);
      monthlyDataMap[monthKey] = 0; // Initialize with 0
      monthInfo[monthKey] = {
        year: monthDate.getFullYear(),
        month: format(monthDate, 'MMMM')
      };
    }

    // Process monthly achievements
    halfYearSnapshot.docs.forEach(doc => {
      const monthData = doc.data();
      const achievementDate = monthData.monthStart.toDate();
      const monthKey = format(achievementDate, 'MMM yyyy');
      
      if (monthlyDataMap[monthKey] !== undefined) {
        // Use the totalAchievement directly and ensure it's properly formatted
        const achievement = monthData.totalAchievement || 0;
        monthlyDataMap[monthKey] = Math.min(Math.max(Math.round(achievement * 10) / 10, 0), 100);
      }
    });

    // For the current month, calculate real-time data if not already in the snapshot
    const now = new Date();
    const currentMonthKey = format(now, 'MMM yyyy');
    
    if (monthlyDataMap[currentMonthKey] === 0) {
      // Calculate current month data from weekly achievements
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      
      const weeks = eachWeekOfInterval(
        { start: monthStart, end: monthEnd },
        { weekStartsOn: 1 } // Start weeks on Monday
      );
      
      let totalAchievement = 0;
      let weekCount = 0;
      
      // Process each week in the current month
      for (const weekStart of weeks) {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        
        // Get current year, month, and week number
        const weekYear = weekStart.getFullYear();
        const weekMonth = weekStart.getMonth() + 1;
        const weekNumber = Math.ceil((weekStart.getDate() + new Date(weekYear, weekStart.getMonth(), 1).getDay()) / 7);
        
        // Query reports for this week
        const weekQuery = query(
          reportsRef,
          where('userId', '==', userId),
          where('year', '==', weekYear),
          where('month', '==', weekMonth),
          where('weekNumber', '==', weekNumber)
        );
        
        const weekSnapshot = await getDocs(weekQuery);
        
        if (!weekSnapshot.empty) {
          // Calculate achievement percentage for this week
          let totalMeetings = 0;
          let totalAttendedMeetings = 0;
          let totalDuration = 0;
          let totalClosing = 0;
          
          weekSnapshot.forEach(doc => {
            const reportData = doc.data();
            
            totalMeetings += reportData.numMeetings || 0;
            totalAttendedMeetings += reportData.positiveLeads || 0;
            totalClosing += reportData.totalClosingAmount || 0;
            
            // Parse duration string - handle both formats
            const durationStr = reportData.meetingDuration || '';
            
            // Check if it's in HH:MM:SS format
            if (durationStr.includes(':')) {
              const [hours, minutes, seconds] = durationStr.split(':').map(Number);
              totalDuration += (hours * 3600) + (minutes * 60) + seconds;
            } else {
              // Handle "X hr Y mins" format
              const hrMatch = durationStr.match(/(\d+)\s*hr/);
              const minMatch = durationStr.match(/(\d+)\s*min/);
              const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) +
                           (minMatch ? parseInt(minMatch[1]) / 60 : 0);
              totalDuration += hours * 3600; // Convert to seconds
            }
          });
          
          // Calculate progress percentages
          const meetingsPercentage = (totalMeetings / 30) * 100;
          const attendedPercentage = (totalAttendedMeetings / 30) * 100;
          const durationPercentage = (totalDuration / (20 * 3600)) * 100; // 20 hours in seconds
          const closingPercentage = (totalClosing / 50000) * 100;
          
          // Calculate overall progress as average of all percentages
          const overallProgress = Math.min(
            (meetingsPercentage + attendedPercentage + durationPercentage + closingPercentage) / 4,
            100
          );
          
          totalAchievement += overallProgress;
          weekCount++;
        }
      }
      
      // Calculate average achievement for the current month
      const averageAchievement = weekCount > 0 ? totalAchievement / weekCount : 0;
      monthlyDataMap[currentMonthKey] = Math.min(Math.max(Math.round(averageAchievement * 10) / 10, 0), 100);
      
      // Save the calculated data to monthly summary for consistency
      const monthlyQuery = query(
        monthlySummaryRef,
        where('userId', '==', userId),
        where('monthStart', '==', Timestamp.fromDate(monthStart)),
        where('monthEnd', '==', Timestamp.fromDate(monthEnd))
      );
      
      const monthlySnapshot = await getDocs(monthlyQuery);
      
      if (!monthlySnapshot.empty) {
        // Update existing monthly summary
        const existingMonthly = monthlySnapshot.docs[0];
        await updateDoc(existingMonthly.ref, {
          totalAchievement: averageAchievement,
          weekCount: weekCount,
          updatedAt: Timestamp.fromDate(new Date())
        });
      } else {
        // Create new monthly summary
        const monthlyData = {
          userId,
          monthStart: Timestamp.fromDate(monthStart),
          monthEnd: Timestamp.fromDate(monthEnd),
          totalAchievement: averageAchievement,
          weekCount: weekCount,
          month: monthStart.getMonth() + 1,
          year: monthStart.getFullYear(),
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        };
        
        await addDoc(monthlySummaryRef, monthlyData);
      }
    }

    // Convert the map to an array of data points
    const data = labels.map(label => monthlyDataMap[label] || 0);

    return {
      labels,
      datasets: [{ data }],
      monthInfo
    };
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
            getDotProps={(value, index) => {
              const isCurrentMonth = selectedPeriod === 'Half Yearly' && 
                format(new Date(), 'MMM') === getActiveData().labels[index];
              return {
                r: isCurrentMonth ? '8' : '6',
                strokeWidth: isCurrentMonth ? '3' : '2',
                stroke: isCurrentMonth ? '#FF8447' : '#FF8447',
              };
            }}
            formatXLabel={(value) => {
              if (selectedPeriod === 'Half Yearly' || selectedPeriod === 'Quarterly') {
                return value; // Already formatted as 'MMM yyyy'
              }
              return value; // Keep week labels as is
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
        {/* <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Average Achievement</Text>
            <Text style={styles.statValue}>{averageAchievement}%</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Highest Achievement</Text>
            <Text style={styles.statValue}>{highestAchievement}%</Text>
          </View>
        </View> */}
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