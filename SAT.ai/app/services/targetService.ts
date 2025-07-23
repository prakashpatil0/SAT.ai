import { db } from '@/firebaseConfig';
import { collection, addDoc, getDocs, query, where, Timestamp, orderBy, limit, DocumentData, getDoc, doc } from 'firebase/firestore';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { auth } from '@/firebaseConfig';

// Target values (will be moved to database later)
const TARGET_VALUES = {
  positiveLeads: 50,
  numCalls: 300,
  callDuration: 20, // hours
  closingAmount: 50000
};

// Interfaces
export interface TargetData {
  positiveLeads: number;
  numCalls: number;
  callDuration: number; // in hours
  closingAmount: number;
}

export interface AchievementData {
  totalPositiveLeads: number;
  totalNumMeetings: number;
  totalMeetingDuration: number;
  totalClosingAmount: number;
  percentageAchieved: number;
  isLoading: boolean;
}

export interface ReportPeriod {
  labels: string[];
  data: number[];
}

// Interface for target data from Firebase
interface FirebaseTargetData {
  closingAmount: number;
  createdAt: Timestamp;
  dateOfJoining: string;
  emailId: string;
  employeeId: string;
  employeeName: string;
  meetingDuration: string;
  month: number;
  monthName: string;
  numMeetings: number;
  positiveLeads: number;
  updatedAt: Timestamp;
  year: number;
}

// Cache for target data to avoid redundant Firebase calls
const targetCache: { [key: string]: { data: TargetData; timestamp: number } } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Get weekly, monthly, quarterly targets from Firebase
export const getTargets = async (): Promise<TargetData> => {
  try {
    if (!auth.currentUser) {
      return TARGET_VALUES;
    }

    const userId = auth.currentUser.uid;
    const cacheKey = userId;
    const now = Date.now();

    // Check cache
    if (targetCache[cacheKey] && now - targetCache[cacheKey].timestamp < CACHE_DURATION) {
      return targetCache[cacheKey].data;
    }

    const targetDataRef = collection(db, 'telecaller_target_data');
    
    // Fetch user data to get employeeId
    const userDoc = await getDoc(doc(db, 'users', userId));
    let employeeId = null;
    let userEmail = auth.currentUser.email;

    if (userDoc.exists()) {
      const userData = userDoc.data();
      employeeId = userData.employeeId;
      userEmail = userData.email || userEmail;
    }

    // Create query based on available identifiers
    let q = employeeId
      ? query(targetDataRef, where('employeeId', '==', employeeId), orderBy('createdAt', 'desc'), limit(1))
      : query(targetDataRef, where('emailId', '==', userEmail), orderBy('createdAt', 'desc'), limit(1));

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return TARGET_VALUES;
    }

    const targetDoc = querySnapshot.docs[0].data() as any; // use any to allow extra fields
    
    const targetData = {
      positiveLeads: targetDoc.positiveLeads || TARGET_VALUES.positiveLeads,
      numCalls: targetDoc.numMeetings || TARGET_VALUES.numCalls,
      callDuration: parseInt(targetDoc.meetingDuration) || TARGET_VALUES.callDuration,
      closingAmount: targetDoc.closingAmount || TARGET_VALUES.closingAmount,
      disbursmentUnits: targetDoc.disbursmentUnits || 0, // <-- add this line
    };

    // Cache the result
    targetCache[cacheKey] = { data: targetData, timestamp: now };

    return targetData;
  } catch (error) {
    return TARGET_VALUES;
  }
};

// Calculate achievements for the current week
export const getCurrentWeekAchievements = async (userId: string): Promise<AchievementData> => {
  try {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    
    const reportsRef = collection(db, 'dailyReports');
    const q = query(
      reportsRef,
      where('userId', '==', userId),
      where('date', '>=', Timestamp.fromDate(weekStart)),
      where('date', '<=', Timestamp.fromDate(weekEnd))
    );
    
    const querySnapshot = await getDocs(q);
    
    let totalPositiveLeads = 0;
    let totalNumMeetings = 0;
    let totalMeetingDuration = 0;
    let totalClosingAmount = 0;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      totalPositiveLeads += data.positiveLeads || 0;
      totalNumMeetings += data.numMeetings || 0;
      
      const durationStr = data.meetingDuration || '';
      const hrMatch = durationStr.match(/(\d+)\s*hrs?/i);
      const minMatch = durationStr.match(/(\d+)\s*mins?/i);
      
      const hours = hrMatch ? parseInt(hrMatch[1]) : 0;
      const mins = minMatch ? parseInt(minMatch[1]) : 0;
      
      totalMeetingDuration += hours + (mins / 60);
      totalClosingAmount += data.totalClosingAmount || 0;
    });
    
    const targets = await getTargets();

    const progressPercentages = [
      (totalNumMeetings / targets.numCalls) * 100,
      (totalPositiveLeads / targets.positiveLeads) * 100,
      (totalMeetingDuration / targets.callDuration) * 100,
      (totalClosingAmount / targets.closingAmount) * 100
    ];

    const averagePercentage = Math.min(
      Math.round(progressPercentages.reduce((a, b) => a + b, 0) / progressPercentages.length),
      100
    );

    return {
      totalPositiveLeads,
      totalNumMeetings,
      totalMeetingDuration,
      totalClosingAmount,
      percentageAchieved: averagePercentage,
      isLoading: false
    };
  } catch (error) {
    return {
      totalPositiveLeads: 0,
      totalNumMeetings: 0,
      totalMeetingDuration: 0,
      totalClosingAmount: 0,
      percentageAchieved: 0,
      isLoading: false
    };
  }
};

// Get previous achievement percentages
export const getPreviousWeekAchievement = async (userId: string): Promise<number> => {
  try {
    const now = new Date();
    const prevWeekStart = startOfWeek(new Date(now.setDate(now.getDate() - 7)), { weekStartsOn: 1 });
    const prevWeekEnd = endOfWeek(new Date(now.setDate(now.getDate() - 7)), { weekStartsOn: 1 });
    
    const reportsRef = collection(db, 'dailyReports');
    const q = query(
      reportsRef,
      where('userId', '==', userId),
      where('date', '>=', Timestamp.fromDate(prevWeekStart)),
      where('date', '<=', Timestamp.fromDate(prevWeekEnd))
    );
    
    const querySnapshot = await getDocs(q);
    
    let totalPositiveLeads = 0;
    let totalNumMeetings = 0;
    let totalMeetingDuration = 0;
    let totalClosingAmount = 0;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      totalPositiveLeads += data.positiveLeads || 0;
      totalNumMeetings += data.numMeetings || 0;
      
      const durationStr = data.meetingDuration || '';
      const hourMatch = durationStr.match(/(\d+)\s*hr/);
      const minMatch = durationStr.match(/(\d+)\s*min/);
      
      const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
      const mins = minMatch ? parseInt(minMatch[1]) : 0;
      
      totalMeetingDuration += hours + (mins / 60);
      totalClosingAmount += data.totalClosingAmount || 0;
    });
    
    const targets = await getTargets();
    const positiveLeadsPercentage = (totalPositiveLeads / targets.positiveLeads) * 100;
    const numCallsPercentage = (totalNumMeetings / targets.numCalls) * 100;
    const durationPercentage = (totalMeetingDuration / targets.callDuration) * 100;
    const closingPercentage = (totalClosingAmount / targets.closingAmount) * 100;
    
    const percentageAchieved = (
      positiveLeadsPercentage + 
      numCallsPercentage + 
      durationPercentage + 
      closingPercentage
    ) / 4;
    
    return parseFloat(percentageAchieved.toFixed(1));
  } catch (error) {
    return 0;
  }
};

// Cache for report data to avoid redundant queries
const reportCache: { [key: string]: { data: ReportPeriod; timestamp: number } } = {};

// Get weekly report data
export const getWeeklyReportData = async (userId: string): Promise<ReportPeriod> => {
  try {
    const cacheKey = `weekly_${userId}`;
    const now = Date.now();

    if (reportCache[cacheKey] && now - reportCache[cacheKey].timestamp < CACHE_DURATION) {
      return reportCache[cacheKey].data;
    }

    const currentDate = new Date();
    const labels: string[] = [];
    const data: number[] = [];
    
    for (let i = 4; i >= 0; i--) {
      const weekStart = startOfWeek(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - (i * 7)), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - (i * 7)), { weekStartsOn: 1 });
      
      labels.push(`Week ${5-i}`);
      
      const reportsRef = collection(db, 'dailyReports');
      const q = query(
        reportsRef,
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(weekStart)),
        where('date', '<=', Timestamp.fromDate(weekEnd))
      );
      
      const querySnapshot = await getDocs(q);
      
      let totalPositiveLeads = 0;
      let totalNumMeetings = 0;
      let totalMeetingDuration = 0;
      let totalClosingAmount = 0;
      
      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        totalPositiveLeads += docData.positiveLeads || 0;
        totalNumMeetings += docData.numMeetings || 0;
        
        const durationStr = docData.meetingDuration || '';
        const hourMatch = durationStr.match(/(\d+)\s*hr/);
        const minMatch = durationStr.match(/(\d+)\s*min/);
        
        const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
        const mins = minMatch ? parseInt(minMatch[1]) : 0;
        
        totalMeetingDuration += hours + (mins / 60);
        totalClosingAmount += docData.totalClosingAmount || 0;
      });
      
      const targets = await getTargets();
      const positiveLeadsPercentage = (totalPositiveLeads / targets.positiveLeads) * 100;
      const numCallsPercentage = (totalNumMeetings / targets.numCalls) * 100;
      const durationPercentage = (totalMeetingDuration / targets.callDuration) * 100;
      const closingPercentage = (totalClosingAmount / targets.closingAmount) * 100;
      
      const percentageAchieved = (
        positiveLeadsPercentage + 
        numCallsPercentage + 
        durationPercentage + 
        closingPercentage
      ) / 4;
      
      data.push(Math.min(parseFloat(percentageAchieved.toFixed(1)), 100));
    }
    
    const reportData = { labels, data };
    reportCache[cacheKey] = { data: reportData, timestamp: now };
    return reportData;
  } catch (error) {
    return { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'], data: [0, 0, 0, 0, 0] };
  }
};

// Get quarterly report data
export const getQuarterlyReportData = async (userId: string): Promise<ReportPeriod> => {
  try {
    const cacheKey = `quarterly_${userId}`;
    const now = Date.now();

    if (reportCache[cacheKey] && now - reportCache[cacheKey].timestamp < CACHE_DURATION) {
      return reportCache[cacheKey].data;
    }

    const currentDate = new Date();
    const labels: string[] = [];
    const data: number[] = [];
    
    for (let i = 2; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(currentDate, i));
      const monthEnd = endOfMonth(subMonths(currentDate, i));
      
      labels.push(format(monthStart, 'MMM'));
      
      const reportsRef = collection(db, 'dailyReports');
      const q = query(
        reportsRef,
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(monthStart)),
        where('date', '<=', Timestamp.fromDate(monthEnd))
      );
      
      const querySnapshot = await getDocs(q);
      
      let totalPositiveLeads = 0;
      let totalNumMeetings = 0;
      let totalMeetingDuration = 0;
      let totalClosingAmount = 0;
      
      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        totalPositiveLeads += docData.positiveLeads || 0;
        totalNumMeetings += docData.numMeetings || 0;
        
        const durationStr = docData.meetingDuration || '';
        const hourMatch = durationStr.match(/(\d+)\s*hr/);
        const minMatch = durationStr.match(/(\d+)\s*min/);
        
        const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
        const mins = minMatch ? parseInt(minMatch[1]) : 0;
        
        totalMeetingDuration += hours + (mins / 60);
        totalClosingAmount += docData.totalClosingAmount || 0;
      });
      
      const weeklyTargets = await getTargets();
      const monthlyTargets = {
        positiveLeads: weeklyTargets.positiveLeads * 4,
        numCalls: weeklyTargets.numCalls * 4,
        callDuration: weeklyTargets.callDuration * 4,
        closingAmount: weeklyTargets.closingAmount * 4
      };
      
      const positiveLeadsPercentage = (totalPositiveLeads / monthlyTargets.positiveLeads) * 100;
      const numCallsPercentage = (totalNumMeetings / monthlyTargets.numCalls) * 100;
      const durationPercentage = (totalMeetingDuration / monthlyTargets.callDuration) * 100;
      const closingPercentage = (totalClosingAmount / monthlyTargets.closingAmount) * 100;
      
      const percentageAchieved = (
        positiveLeadsPercentage + 
        numCallsPercentage + 
        durationPercentage + 
        closingPercentage
      ) / 4;
      
      data.push(Math.min(parseFloat(percentageAchieved.toFixed(1)), 100));
    }
    
    const reportData = { labels, data };
    reportCache[cacheKey] = { data: reportData, timestamp: now };
    return reportData;
  } catch (error) {
    return { labels: ['Jan', 'Feb', 'Mar'], data: [0, 0, 0] };
  }
};

// Get half yearly report data
export const getHalfYearlyReportData = async (userId: string): Promise<ReportPeriod> => {
  try {
    const cacheKey = `halfYearly_${userId}`;
    const now = Date.now();

    if (reportCache[cacheKey] && now - reportCache[cacheKey].timestamp < CACHE_DURATION) {
      return reportCache[cacheKey].data;
    }

    const currentDate = new Date();
    const labels: string[] = [];
    const data: number[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(currentDate, i));
      const monthEnd = endOfMonth(subMonths(currentDate, i));
      
      labels.push(format(monthStart, 'MMM'));
      
      const reportsRef = collection(db, 'dailyReports');
      const q = query(
        reportsRef,
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(monthStart)),
        where('date', '<=', Timestamp.fromDate(monthEnd))
      );
      
      const querySnapshot = await getDocs(q);
      
      let totalPositiveLeads = 0;
      let totalNumMeetings = 0;
      let totalMeetingDuration = 0;
      let totalClosingAmount = 0;
      
      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        totalPositiveLeads += docData.positiveLeads || 0;
        totalNumMeetings += docData.numMeetings || 0;
        
        const durationStr = docData.meetingDuration || '';
        const hourMatch = durationStr.match(/(\d+)\s*hr/);
        const minMatch = durationStr.match(/(\d+)\s*min/);
        
        const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
        const mins = minMatch ? parseInt(minMatch[1]) : 0;
        
        totalMeetingDuration += hours + (mins / 60);
        totalClosingAmount += docData.totalClosingAmount || 0;
      });
      
      const weeklyTargets = await getTargets();
      const monthlyTargets = {
        positiveLeads: weeklyTargets.positiveLeads * 4,
        numCalls: weeklyTargets.numCalls * 4,
        callDuration: weeklyTargets.callDuration * 4,
        closingAmount: weeklyTargets.closingAmount * 4
      };
      
      const positiveLeadsPercentage = (totalPositiveLeads / monthlyTargets.positiveLeads) * 100;
      const numCallsPercentage = (totalNumMeetings / monthlyTargets.numCalls) * 100;
      const durationPercentage = (totalMeetingDuration / monthlyTargets.callDuration) * 100;
      const closingPercentage = (totalClosingAmount / monthlyTargets.closingAmount) * 100;
      
      const percentageAchieved = (
        positiveLeadsPercentage + 
        numCallsPercentage + 
        durationPercentage + 
        closingPercentage
      ) / 4;
      
      data.push(Math.min(parseFloat(percentageAchieved.toFixed(1)), 100));
    }
    
    const reportData = { labels, data };
    reportCache[cacheKey] = { data: reportData, timestamp: now };
    return reportData;
  } catch (error) {
    return { 
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], 
      data: [0, 0, 0, 0, 0, 0] 
    };
  }
};

// Get all-time highest achievement percentage
export const getHighestAchievement = async (userId: string): Promise<number> => {
  try {
    const reportsRef = collection(db, 'dailyReports');
    const q = query(
      reportsRef,
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return 0;
    }
    
    let highestPercentage = 0;
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.percentageAchieved && data.percentageAchieved > highestPercentage) {
        highestPercentage = data.percentageAchieved;
      }
    });
    
    return highestPercentage;
  } catch (error) {
    return 0;
  }
};

// Get average achievement percentage
export const getAverageAchievement = async (userId: string): Promise<number> => {
  try {
    const reportsRef = collection(db, 'dailyReports');
    const q = query(
      reportsRef,
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return 0;
    }
    
    let totalPercentage = 0;
    let count = 0;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.percentageAchieved) {
        totalPercentage += data.percentageAchieved;
        count++;
      }
    });
    
    return count > 0 ? parseFloat((totalPercentage / count).toFixed(1)) : 0;
  } catch (error) {
    return 0;
  }
};

// Cache for leaderboard data
const leaderboardCache: { data: any[]; timestamp: number } = { data: [], timestamp: 0 };

// Function to fetch leaderboard data
export const getLeaderboardData = async (limit = 10) => {
  try {
    const now = Date.now();
    if (leaderboardCache.data.length && now - leaderboardCache.timestamp < CACHE_DURATION) {
      return leaderboardCache.data.slice(0, limit);
    }

    const reportsRef = collection(db, 'dailyReports');
    const reportsSnap = await getDocs(reportsRef);
    
    if (reportsSnap.empty) {
      return [];
    }
    
    const userAchievements: Record<string, { totalPercentage: number, reportCount: number, latestDate: Date }> = {};
    
    reportsSnap.forEach((doc) => {
      const report = doc.data();
      const userId = report.userId;
      
      if (!userId) return;
      
      const percentage = report.percentageAchieved || 0;
      const reportDate = report.date ? new Date(report.date.seconds * 1000) : new Date();
      
      if (!userAchievements[userId]) {
        userAchievements[userId] = {
          totalPercentage: percentage,
          reportCount: 1,
          latestDate: reportDate
        };
      } else {
        userAchievements[userId].totalPercentage += percentage;
        userAchievements[userId].reportCount += 1;
        if (reportDate > userAchievements[userId].latestDate) {
          userAchievements[userId].latestDate = reportDate;
        }
      }
    });
    
    const usersArray = Object.keys(userAchievements).map((userId) => {
      const { totalPercentage, reportCount, latestDate } = userAchievements[userId];
      const avgPercentage = totalPercentage / reportCount;
      
      return {
        userId,
        percentageAchieved: avgPercentage,
        latestReportDate: latestDate
      };
    });
    
    usersArray.sort((a, b) => {
      if (b.percentageAchieved !== a.percentageAchieved) {
        return b.percentageAchieved - a.percentageAchieved;
      }
      return b.latestReportDate.getTime() - a.latestReportDate.getTime();
    });
    
    const topUsers = usersArray.slice(0, limit);
    
    const leaderboardData = await Promise.all(
      topUsers.map(async (user) => {
        try {
          let userData = null;
          let userName = 'Unknown User';
          let profileImage = null;
          
          const userDoc = await getDoc(doc(db, 'users', user.userId));
          
          if (userDoc.exists()) {
            userData = userDoc.data();
            userName = userData.name || 
                      (userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : null) ||
                      userData.displayName || 
                      userData.email || 
                      'Unknown User';
            
            const imageFields = ['profileImageUrl', 'profileImage', 'photoURL', 'avatar', 'picture'];
            for (const field of imageFields) {
              if (userData[field]) {
                profileImage = userData[field];
                break;
              }
            }
          } 
          
          if (!userData || !userName || userName === 'Unknown User') {
            const authDoc = await getDoc(doc(db, 'auth', user.userId));
            if (authDoc.exists()) {
              const authProfile = authDoc.data();
              if (userName === 'Unknown User') {
                userName = authProfile.name || 
                          authProfile.displayName || 
                          (authProfile.firstName && authProfile.lastName ? `${authProfile.firstName} ${authProfile.lastName}` : null) ||
                          authProfile.email || 
                          'Unknown User';
              }
              if (!profileImage) {
                const authImageFields = ['profileImageUrl', 'profileImage', 'photoURL', 'avatar', 'picture'];
                for (const field of authImageFields) {
                  if (authProfile[field]) {
                    profileImage = authProfile[field];
                    break;
                  }
                }
              }
            }
          }
          
          return {
            userId: user.userId,
            name: userName,
            profileImage: profileImage,
            percentageAchieved: user.percentageAchieved
          };
        } catch (error) {
          return {
            userId: user.userId,
            name: 'Unknown User',
            profileImage: null,
            percentageAchieved: user.percentageAchieved
          };
        }
      })
    );
    
    leaderboardCache.data = leaderboardData;
    leaderboardCache.timestamp = now;
    return leaderboardData;
  } catch (error) {
    return [];
  }
};

const targetService = {
  getTargets,
  getCurrentWeekAchievements,
  getPreviousWeekAchievement,
  getWeeklyReportData,
  getQuarterlyReportData,
  getHalfYearlyReportData,
  getHighestAchievement,
  getAverageAchievement,
  getLeaderboardData
};

export default targetService;