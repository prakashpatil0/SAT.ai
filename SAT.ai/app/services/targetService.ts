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

// Get weekly, monthly, quarterly targets (TODO: fetch from database)
export const getTargets = (): TargetData => {
  return TARGET_VALUES;
};

// Calculate achievements for the current week
export const getCurrentWeekAchievements = async (userId: string): Promise<AchievementData> => {
  try {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
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
      
      // Parse meeting duration (assuming format like '1 hr 20 mins')
      const durationStr = data.meetingDuration || '';
      const hrMatch = durationStr.match(/(\d+)\s*hrs?/i);
      const minMatch = durationStr.match(/(\d+)\s*mins?/i);
      
      const hours = hrMatch ? parseInt(hrMatch[1]) : 0;
      const mins = minMatch ? parseInt(minMatch[1]) : 0;
      
      totalMeetingDuration += hours + (mins / 60);
      
      // Add closing amounts
      totalClosingAmount += data.totalClosingAmount || 0;
    });
    
    // Calculate percentage achieved for each metric
    const targets = {
      projectedMeetings: 30,
      attendedMeetings: 30,
      meetingDuration: 20, // hours
      closing: 50000
    };

    const progressPercentages = [
      (totalNumMeetings / targets.projectedMeetings) * 100,
      (totalPositiveLeads / targets.attendedMeetings) * 100,
      (totalMeetingDuration / targets.meetingDuration) * 100,
      (totalClosingAmount / targets.closing) * 100
    ];

    // Calculate average percentage, ensuring it doesn't exceed 100%
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
    console.error('Error getting current week achievements:', error);
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
    
    // Use the same calculation as getCurrentWeekAchievements
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
    
    const targets = getTargets();
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
    console.error('Error fetching previous week achievement:', error);
    return 0;
  }
};

// Get weekly report data
export const getWeeklyReportData = async (userId: string): Promise<ReportPeriod> => {
  try {
    const now = new Date();
    const labels: string[] = [];
    const data: number[] = [];
    
    // Get data for the last 5 weeks
    for (let i = 4; i >= 0; i--) {
      try {
        const weekStart = startOfWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 7)), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 7)), { weekStartsOn: 1 });
        
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
        
        const targets = getTargets();
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
      } catch (weekError) {
        console.error(`Error fetching data for week ${5-i}:`, weekError);
        data.push(0); // Push 0 for this week if there's an error
      }
    }
    
    return { labels, data };
  } catch (error) {
    console.error('Error fetching weekly report data:', error);
    return { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'], data: [0, 0, 0, 0, 0] };
  }
};

// Get quarterly report data
export const getQuarterlyReportData = async (userId: string): Promise<ReportPeriod> => {
  try {
    const now = new Date();
    const labels: string[] = [];
    const data: number[] = [];
    
    // Get data for the last 3 months
    for (let i = 2; i >= 0; i--) {
      try {
        const monthStart = startOfMonth(subMonths(now, i));
        const monthEnd = endOfMonth(subMonths(now, i));
        
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
        
        // Monthly targets (4x weekly targets)
        const weeklyTargets = getTargets();
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
      } catch (monthError) {
        console.error(`Error fetching data for month ${format(subMonths(now, i), 'MMM')}:`, monthError);
        data.push(0); // Push 0 for this month if there's an error
      }
    }
    
    return { labels, data };
  } catch (error) {
    console.error('Error fetching quarterly report data:', error);
    return { labels: ['Jan', 'Feb', 'Mar'], data: [0, 0, 0] };
  }
};

// Get half yearly report data
export const getHalfYearlyReportData = async (userId: string): Promise<ReportPeriod> => {
  try {
    const now = new Date();
    const labels: string[] = [];
    const data: number[] = [];
    
    // Get data for the last 6 months
    for (let i = 5; i >= 0; i--) {
      try {
        const monthStart = startOfMonth(subMonths(now, i));
        const monthEnd = endOfMonth(subMonths(now, i));
        
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
        
        // Monthly targets (4x weekly targets)
        const weeklyTargets = getTargets();
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
      } catch (monthError) {
        console.error(`Error fetching data for month ${format(subMonths(now, i), 'MMM')}:`, monthError);
        data.push(0); // Push 0 for this month if there's an error
      }
    }
    
    return { labels, data };
  } catch (error) {
    console.error('Error fetching half yearly report data:', error);
    return { 
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], 
      data: [0, 0, 0, 0, 0, 0] 
    };
  }
};

// Get all-time highest achievement percentage
export const getHighestAchievement = async (userId: string): Promise<number> => {
  try {
    // Instead of using orderBy which requires an index, we'll fetch all reports
    // and calculate the highest achievement locally
    const reportsRef = collection(db, 'dailyReports');
    const q = query(
      reportsRef,
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return 0;
    }
    
    // Find the highest percentage achieved
    let highestPercentage = 0;
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.percentageAchieved && data.percentageAchieved > highestPercentage) {
        highestPercentage = data.percentageAchieved;
      }
    });
    
    return highestPercentage;
  } catch (error) {
    console.error('Error fetching highest achievement:', error);
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
    console.error('Error fetching average achievement:', error);
    return 0;
  }
};

// Function to fetch leaderboard data
export const getLeaderboardData = async (limit = 10) => {
  try {
    console.log("Fetching leaderboard data...");
    
    // Get all daily reports
    const reportsRef = collection(db, "dailyReports");
    const reportsSnap = await getDocs(reportsRef);
    
    if (reportsSnap.empty) {
      console.log("No daily reports found");
      return [];
    }
    
    // Group reports by userId and calculate average percentage
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
        
        // Track the latest report date for tiebreaking
        if (reportDate > userAchievements[userId].latestDate) {
          userAchievements[userId].latestDate = reportDate;
        }
      }
    });
    
    // Calculate average for each user and create sorted array
    const usersArray = Object.keys(userAchievements).map((userId) => {
      const { totalPercentage, reportCount, latestDate } = userAchievements[userId];
      const avgPercentage = totalPercentage / reportCount;
      
      return {
        userId,
        percentageAchieved: avgPercentage,
        latestReportDate: latestDate
      };
    });
    
    // Sort by percentage (descending) and then by latest report date (most recent first)
    usersArray.sort((a, b) => {
      if (b.percentageAchieved !== a.percentageAchieved) {
        return b.percentageAchieved - a.percentageAchieved;
      }
      // If percentages are equal, sort by most recent report
      return b.latestReportDate.getTime() - a.latestReportDate.getTime();
    });
    
    // Get top users based on limit
    const topUsers = usersArray.slice(0, limit);
    
    // Now fetch user details for these top users
    const leaderboardData = await Promise.all(
      topUsers.map(async (user) => {
        try {
          // First try to get user data from users collection
          let userData = null;
          let userName = "Unknown User";
          let profileImage = null;
          
          // Try to get user from users collection
          const userDoc = await getDoc(doc(db, "users", user.userId));
          
          if (userDoc.exists()) {
            userData = userDoc.data();
            
            // Try different name fields
            userName = userData.name || 
                      (userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : null) ||
                      userData.displayName || 
                      userData.email || 
                      "Unknown User";
            
            // Try different profile image fields
            const imageFields = ["profileImageUrl", "profileImage", "photoURL", "avatar", "picture"];
            
            for (const field of imageFields) {
              if (userData[field]) {
                profileImage = userData[field];
                break;
              }
            }
          } 
          
          // If user not found in users collection or missing data, try auth collection
          if (!userData || !userName || userName === "Unknown User") {
            const authDoc = await getDoc(doc(db, "auth", user.userId));
            
            if (authDoc.exists()) {
              const authProfile = authDoc.data();
              
              // Try auth fields for name
              if (userName === "Unknown User") {
                userName = authProfile.name || 
                          authProfile.displayName || 
                          (authProfile.firstName && authProfile.lastName ? `${authProfile.firstName} ${authProfile.lastName}` : null) ||
                          authProfile.email || 
                          "Unknown User";
              }
              
              // Try auth fields for profile image
              if (!profileImage) {
                const authImageFields = ["profileImageUrl", "profileImage", "photoURL", "avatar", "picture"];
                
                for (const field of authImageFields) {
                  if (authProfile[field]) {
                    profileImage = authProfile[field];
                    break;
                  }
                }
              }
            }
          }
          
          console.log(`Resolved user ${user.userId} to name: ${userName}`);
          
          return {
            userId: user.userId,
            name: userName,
            profileImage: profileImage,
            percentageAchieved: user.percentageAchieved
          };
        } catch (error) {
          console.error(`Error fetching user details for ${user.userId}:`, error);
          // Return a default entry in case of an error
          return {
            userId: user.userId,
            name: "Unknown User",
            profileImage: null,
            percentageAchieved: user.percentageAchieved
          };
        }
      })
    );
    
    return leaderboardData;
  } catch (error) {
    console.error("Error getting leaderboard data:", error);
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