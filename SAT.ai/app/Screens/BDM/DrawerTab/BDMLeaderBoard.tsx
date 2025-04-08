import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Animated, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import { Avatar } from "react-native-paper";
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import { auth, db, storage } from '@/firebaseConfig';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { useProfile } from '@/app/context/ProfileContext';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedReanimated, { 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming,
  useSharedValue,
  withDelay
} from 'react-native-reanimated';

interface LeaderboardUser {
  userId: string;
  name: string;
  profileImage: string | null;
  percentageAchieved: number;
  rank: number;
  isPlaceholder?: boolean;
  isNotRanked?: boolean;
}

// Placeholder data
const placeholderData: LeaderboardUser[] = Array(10).fill(null).map((_, index) => ({
  userId: `placeholder-${index}`,
  name: "Add your data",
  profileImage: null,
  percentageAchieved: 0,
  rank: index + 1,
  isPlaceholder: true
}));

// Wave Skeleton component
const WaveSkeleton = ({ width, height, style }: { width: number | string; height: number; style?: any }) => {
  const translateX = useSharedValue(typeof width === 'number' ? -width : -100);

  React.useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(typeof width === 'number' ? width : 100, { duration: 1000 }),
        withDelay(500, withTiming(typeof width === 'number' ? -width : -100, { duration: 0 }))
      ),
      -1
    );
  }, [width]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <View style={[{ width, height, backgroundColor: '#E5E7EB', overflow: 'hidden' }, style]}>
      <AnimatedReanimated.View
        style={[
          {
            width: '100%',
            height: '100%',
            backgroundColor: 'transparent',
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255, 255, 255, 0.3)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: '100%', height: '100%' }}
        />
      </AnimatedReanimated.View>
    </View>
  );
};

const BDMLeaderBoard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  const [defaultProfileImages, setDefaultProfileImages] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(true);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  
  // Current user ID and profile
  const currentUserId = auth.currentUser?.uid;
  const { userProfile, refreshProfile } = useProfile();

  useEffect(() => {
    refreshProfile();
    loadDefaultProfileImages();
    fetchLeaderboardData();
    fetchAllUserNames();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [loading]);

  const loadDefaultProfileImages = async () => {
    try {
      console.log('Loading default profile images from Firebase Storage');
      const imageUrls: string[] = [];
      
      // Load three default profile images
      for (let i = 0; i < 3; i++) {
        try {
          const imageRef = ref(storage, 'assets/person.png');
          const url = await getDownloadURL(imageRef);
          console.log(`Successfully loaded default profile image ${i+1} URL:`, url);
          imageUrls.push(url);
        } catch (error) {
          console.error(`Error loading default profile image ${i+1}:`, error);
          // If we can't load from Firebase, use an empty string
          imageUrls.push('');
        }
      }
      
      setDefaultProfileImages(imageUrls);
    } catch (error) {
      console.error('Error loading default profile images:', error);
    } finally {
      setImageLoading(false);
    }
  };

  const fetchAllUserNames = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const nameMap: Record<string, string> = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const userId = data.uid;
        if (userId) {
          const name = data.name || 
            (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : null) ||
            data.displayName || 
            data.email || 
            'Unknown User';
          
          nameMap[userId] = name;
        }
      });
      
      setUserNameMap(nameMap);
    } catch (error) {
      console.error('Error fetching user names:', error);
    }
  };

  const fetchLeaderboardData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);

      // Get start and end of current week
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Get all BDM users
      const usersRef = collection(db, 'users');
      const usersQuery = query(usersRef, where('role', '==', 'bdm'));
      const usersSnapshot = await getDocs(usersQuery);
      
      const userProgressPromises = usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        const userId = userData.uid;

        if (!userId) return null; // Skip if no userId

        // Fetch reports for current week
        const reportsRef = collection(db, 'bdm_reports');
        const reportsQuery = query(
          reportsRef,
          where('userId', '==', userId),
          where('createdAt', '>=', Timestamp.fromDate(startOfWeek)),
          where('createdAt', '<=', Timestamp.fromDate(endOfWeek))
        );

        try {
          const querySnapshot = await getDocs(reportsQuery);
          let totalMeetings = 0;
          let totalAttendedMeetings = 0;
          let totalDuration = 0;
          let totalClosing = 0;

          querySnapshot.forEach(doc => {
            const data = doc.data();
            totalMeetings += data.numMeetings || 0;
            totalAttendedMeetings += data.numMeetings || 0;
            
            // Parse duration string (e.g., "1 hr 30 mins" -> hours)
            const durationStr = data.meetingDuration || '';
            const hrMatch = durationStr.match(/(\d+)\s*hr/);
            const minMatch = durationStr.match(/(\d+)\s*min/);
            const hours = (hrMatch ? parseInt(hrMatch[1]) : 0) +
                         (minMatch ? parseInt(minMatch[1]) / 60 : 0);
            totalDuration += hours;

            totalClosing += data.totalClosingAmount || 0;
          });

          // Calculate progress percentages using same targets as BDMTargetScreen
          const progressPercentages = [
            (totalMeetings / 30) * 100, // projectedMeetings target: 30
            (totalAttendedMeetings / 30) * 100, // attendedMeetings target: 30
            (totalDuration / 20) * 100, // meetingDuration target: 20 hours
            (totalClosing / 50000) * 100 // closing target: 50000
          ];

          const averageProgress = Math.min(
            Math.round(progressPercentages.reduce((a, b) => a + b, 0) / progressPercentages.length),
            100
          );

          return {
            userId,
            name: userData.name || 
                  (userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : null) ||
                  userData.displayName || 
                  'Unknown User',
            profileImage: userData.profileImageUrl || null,
            percentageAchieved: averageProgress
          };
        } catch (error) {
          console.error(`Error fetching reports for user ${userId}:`, error);
          return null;
        }
      });

      const userProgressResults = await Promise.all(userProgressPromises);
      
      // Filter out null results and sort by percentage
      const sortedUsers = userProgressResults
        .filter(result => result !== null)
        .sort((a, b) => b.percentageAchieved - a.percentageAchieved)
        .map((user, index) => ({
          ...user,
          rank: index + 1
        }));

      // Fill remaining positions with placeholder data if needed
      const topUsers = sortedUsers.slice(0, 10);
      const remainingPlaceholders = placeholderData
        .slice(topUsers.length)
        .map((placeholder, index) => ({
          ...placeholder,
          rank: topUsers.length + index + 1
        }));

      setLeaderboardData([...topUsers, ...remainingPlaceholders].slice(0, 10));

    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      setLeaderboardData(placeholderData);
      Alert.alert(
        "Error",
        "Could not load leaderboard data. Please try again later.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getProfileImage = (user: LeaderboardUser) => {
    if (user.isPlaceholder) {
      return defaultProfileImages[0] ? { uri: defaultProfileImages[0] } : null;
    }
    
    if (user.profileImage) {
      return { uri: user.profileImage };
    }
    
    if (isCurrentUser(user.userId) && userProfile?.profileImageUrl) {
      return { uri: userProfile.profileImageUrl };
    }
    
    if (user.rank <= 3 && defaultProfileImages[user.rank - 1]) {
      return { uri: defaultProfileImages[user.rank - 1] };
    }
    
    return defaultProfileImages[0] ? { uri: defaultProfileImages[0] } : null;
  };

  const isCurrentUser = (userId: string) => {
    return currentUserId === userId;
  };

  const formatPercentage = (percentage: number) => {
    if (percentage === 0) return "0%";
    return `${percentage.toFixed(1)}%`;
  };

  const topThree = leaderboardData.filter(user => !user.isNotRanked).slice(0, 3);
  const remainingUsers = leaderboardData.filter(user => !user.isNotRanked).slice(3);
  const currentUserRanking = leaderboardData.find(user => user.userId === currentUserId);

  const handleRefresh = () => {
    fetchLeaderboardData(true);
    fetchAllUserNames();
  };

  const renderWaveSkeleton = () => {
    return (
      <View style={styles.skeletonContainer}>
        {/* Current User Banner Skeleton */}
        <View style={styles.skeletonCurrentUserBanner}>
          <WaveSkeleton width="40%" height={24} />
          <WaveSkeleton width="40%" height={24} />
        </View>

        {/* Top Three Section Skeleton */}
        <View style={styles.topThreeContainer}>
          {/* Second Place Skeleton */}
          <View style={styles.secondPlaceWrapper}>
            <View style={styles.skeletonImageContainer}>
              <WaveSkeleton width={65} height={65} style={styles.skeletonTopThreeImage} />
            </View>
            <View style={[styles.podium, styles.secondPodium]}>
              <WaveSkeleton width="80%" height={20} style={styles.skeletonText} />
              <WaveSkeleton width="40%" height={24} style={styles.skeletonText} />
              <WaveSkeleton width="60%" height={16} style={styles.skeletonText} />
            </View>
          </View>

          {/* First Place Skeleton */}
          <View style={styles.firstPlaceWrapper}>
            <View style={styles.skeletonImageContainer}>
              <WaveSkeleton width={75} height={75} style={[styles.skeletonTopThreeImage, styles.firstImage]} />
            </View>
            <View style={[styles.podium, styles.firstPodium]}>
              <WaveSkeleton width="80%" height={20} style={styles.skeletonText} />
              <WaveSkeleton width="40%" height={24} style={styles.skeletonText} />
              <WaveSkeleton width="60%" height={16} style={styles.skeletonText} />
            </View>
          </View>

          {/* Third Place Skeleton */}
          <View style={styles.thirdPlaceWrapper}>
            <View style={styles.skeletonImageContainer}>
              <WaveSkeleton width={65} height={65} style={styles.skeletonTopThreeImage} />
            </View>
            <View style={[styles.podium, styles.thirdPodium]}>
              <WaveSkeleton width="80%" height={20} style={styles.skeletonText} />
              <WaveSkeleton width="40%" height={24} style={styles.skeletonText} />
              <WaveSkeleton width="60%" height={16} style={styles.skeletonText} />
            </View>
          </View>
        </View>

        {/* List Section Skeleton */}
        <View style={styles.listContainer}>
          {[1, 2, 3, 4, 5, 6, 7].map((_, index) => (
            <View key={index} style={styles.skeletonListItem}>
              <WaveSkeleton width={25} height={20} style={styles.skeletonText} />
              <WaveSkeleton width={40} height={40} style={styles.skeletonAvatar} />
              <WaveSkeleton width="40%" height={20} style={styles.skeletonText} />
              <WaveSkeleton width="20%" height={20} style={styles.skeletonText} />
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <AppGradient>
        <BDMMainLayout title="Leaderboard" showBackButton showDrawer={true} showBottomTabs={true}>
          {renderWaveSkeleton()}
        </BDMMainLayout>
      </AppGradient>
    );
  }

  return (
    <AppGradient>
      <BDMMainLayout 
        title="Leaderboard" 
        showBackButton={true}
        showDrawer={true} 
        showBottomTabs={true}
        rightComponent={
          refreshing ? 
          <ActivityIndicator size="small" color="#333" /> : 
          <TouchableOpacity onPress={handleRefresh}>
            <Ionicons name="refresh" size={24} color="#333" />
          </TouchableOpacity>
        }
      >
        <ScrollView 
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View 
            style={[
              styles.content, 
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
            ]}
          >
            {/* Current User Ranking Banner */}
            {currentUserRanking && !currentUserRanking.isPlaceholder && (
              <View style={styles.currentUserBanner}>
                <Text style={styles.currentUserText}>
                  Your Position: {currentUserRanking.isNotRanked ? (
                    <Text style={styles.notRankedText}>Not Ranked Yet</Text>
                  ) : (
                    <Text style={styles.currentUserRank}>#{currentUserRanking.rank}</Text>
                  )}
                </Text>
                <Text style={styles.currentUserScore}>
                  Achievement: {currentUserRanking.isNotRanked ? (
                    <Text style={styles.notRankedText}>No Data</Text>
                  ) : (
                    <Text style={styles.currentUserScoreValue}>
                      {formatPercentage(currentUserRanking.percentageAchieved)}
                    </Text>
                  )}
                </Text>
              </View>
            )}

            {/* Top Three Section */}
            <View style={styles.topThreeContainer}>
              {/* Second Place */}
              <View style={styles.secondPlaceWrapper}>
                <View style={styles.imageContainer}>
                  {imageLoading ? (
                    <View style={[styles.topThreeImage, { justifyContent: 'center', alignItems: 'center' }]}>
                      <MaterialIcons name="person" size={24} color="#999" />
                    </View>
                  ) : (
                    <Image 
                      source={getProfileImage(topThree[1] || { ...placeholderData[1], rank: 2 }) ? getProfileImage(topThree[1] || { ...placeholderData[1], rank: 2 }) : null}
                      style={[
                        styles.topThreeImage,
                        topThree[1]?.isPlaceholder && styles.placeholderImage,
                        isCurrentUser(topThree[1]?.userId) && styles.currentUserImage
                      ]}
                    />
                  )}
                  {isCurrentUser(topThree[1]?.userId) && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>YOU</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.podium, styles.secondPodium]}>
                  <Text style={[
                    styles.topThreeName,
                    topThree[1]?.isPlaceholder && styles.placeholderText,
                    isCurrentUser(topThree[1]?.userId) && styles.currentUserText
                  ]}>
                    {topThree[1]?.name || 'Waiting\nfor data'}
                  </Text>
                  <Text style={[styles.rank, styles.secondRank]}>2</Text>
                  <Text style={[
                    styles.percentage,
                    topThree[1]?.isPlaceholder && styles.placeholderText,
                    isCurrentUser(topThree[1]?.userId) && styles.currentUserScore
                  ]}>
                    {topThree[1] ? formatPercentage(topThree[1].percentageAchieved) : "0%"}
                  </Text>
                </View>
              </View>

              {/* First Place */}
              <View style={styles.firstPlaceWrapper}>
                <FontAwesome5 name="crown" size={40} color="#FFD700" style={styles.crown} />
                <View style={styles.imageContainer}>
                  {imageLoading ? (
                    <View style={[styles.topThreeImage, styles.firstImage, { justifyContent: 'center', alignItems: 'center' }]}>
                      <MaterialIcons name="person" size={24} color="#999" />
                    </View>
                  ) : (
                    <Image 
                      source={getProfileImage(topThree[0] || { ...placeholderData[0], rank: 1 }) ? getProfileImage(topThree[0] || { ...placeholderData[0], rank: 1 }) : null}
                      style={[
                        styles.topThreeImage,
                        styles.firstImage,
                        topThree[0]?.isPlaceholder && styles.placeholderImage,
                        isCurrentUser(topThree[0]?.userId) && styles.currentUserImage
                      ]}
                    />
                  )}
                  {isCurrentUser(topThree[0]?.userId) && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>YOU</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.podium, styles.firstPodium]}>
                  <Text style={[
                    styles.topThreeName,
                    styles.firstName,
                    topThree[0]?.isPlaceholder && styles.placeholderText,
                    isCurrentUser(topThree[0]?.userId) && styles.currentUserText
                  ]}>
                    {topThree[0]?.name || 'Waiting\nfor data'}
                  </Text>
                  <Text style={[styles.rank, styles.firstRank]}>1</Text>
                  <Text style={[
                    styles.percentage,
                    styles.firstPercentage,
                    topThree[0]?.isPlaceholder && styles.placeholderText,
                    isCurrentUser(topThree[0]?.userId) && styles.currentUserScore
                  ]}>
                    {topThree[0] ? formatPercentage(topThree[0].percentageAchieved) : "0%"}
                  </Text>
                </View>
              </View>

              {/* Third Place */}
              <View style={styles.thirdPlaceWrapper}>
                <View style={styles.imageContainer}>
                  {imageLoading ? (
                    <View style={[styles.topThreeImage, { justifyContent: 'center', alignItems: 'center' }]}>
                      <MaterialIcons name="person" size={24} color="#999" />
                    </View>
                  ) : (
                    <Image 
                      source={getProfileImage(topThree[2] || { ...placeholderData[2], rank: 3 }) ? getProfileImage(topThree[2] || { ...placeholderData[2], rank: 3 }) : null}
                      style={[
                        styles.topThreeImage,
                        topThree[2]?.isPlaceholder && styles.placeholderImage,
                        isCurrentUser(topThree[2]?.userId) && styles.currentUserImage
                      ]}
                    />
                  )}
                  {isCurrentUser(topThree[2]?.userId) && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>YOU</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.podium, styles.thirdPodium]}>
                  <Text style={[
                    styles.topThreeName,
                    topThree[2]?.isPlaceholder && styles.placeholderText,
                    isCurrentUser(topThree[2]?.userId) && styles.currentUserText
                  ]}>
                    {topThree[2]?.name || 'Waiting\nfor data'}
                  </Text>
                  <Text style={[styles.rank, styles.thirdRank]}>3</Text>
                  <Text style={[
                    styles.percentage,
                    topThree[2]?.isPlaceholder && styles.placeholderText,
                    isCurrentUser(topThree[2]?.userId) && styles.currentUserScore
                  ]}>
                    {topThree[2] ? formatPercentage(topThree[2].percentageAchieved) : "0%"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Rest of the Leaderboard */}
            <View style={styles.leaderboardContainer}>
              <Text style={styles.leaderboardTitle}>Full Leaderboard</Text>
              
              {remainingUsers.map((user, index) => (
                <View 
                  key={user.userId} 
                  style={[
                    styles.leaderboardItem,
                    isCurrentUser(user.userId) && styles.currentUserItem
                  ]}
                >
                  <View style={styles.rankContainer}>
                    <Text style={[
                      styles.rankNumber,
                      isCurrentUser(user.userId) && styles.currentUserRankNumber
                    ]}>
                      #{user.rank}
                    </Text>
                  </View>
                  
                  <View style={styles.userImageContainer}>
                    {imageLoading ? (
                      <View style={[styles.userImage, { justifyContent: 'center', alignItems: 'center' }]}>
                        <MaterialIcons name="person" size={24} color="#999" />
                      </View>
                    ) : (
                      <Image 
                        source={getProfileImage(user) ? getProfileImage(user) : null}
                        style={[
                          styles.userImage,
                          user.isPlaceholder && styles.placeholderImage,
                          isCurrentUser(user.userId) && styles.currentUserImage
                        ]}
                      />
                    )}
                    {isCurrentUser(user.userId) && (
                      <View style={styles.youBadgeSmall}>
                        <Text style={styles.youBadgeTextSmall}>YOU</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.userInfoContainer}>
                    <Text style={[
                      styles.userName,
                      user.isPlaceholder && styles.placeholderText,
                      isCurrentUser(user.userId) && styles.currentUserText
                    ]}>
                      {user.name}
                    </Text>
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill,
                            { width: `${user.percentageAchieved}%` }
                          ]} 
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {formatPercentage(user.percentageAchieved)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  topThreeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingTop: 60,
    paddingBottom: 40,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  secondPlaceWrapper: {
    alignItems: "center",
    marginRight: -5,
    zIndex: 1,
  },
  firstPlaceWrapper: {
    alignItems: "center",
    zIndex: 2,
  },
  thirdPlaceWrapper: {
    alignItems: "center",
    marginLeft: -5,
    zIndex: 1,
  },
  imageContainer: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 2,
    top: -40,
  },
  topThreeImage: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    borderWidth: 2,
    borderColor: "white",
  },
  firstImage: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    borderWidth: 3,
  },
  placeholderImage: {
    opacity: 1.5,
  },
  currentUserImage: {
    borderColor: "#FF8447",
    borderWidth: 3,
  },
  podium: {
    alignItems: "center",
    borderRadius: 15,
    padding: 12,
    paddingTop: 35,
  },
  firstPodium: {
    backgroundColor: "#FFE4B5",
    width: 120,
    height: 160,
    zIndex: 1,
    elevation: 4,
  },
  secondPodium: {
    backgroundColor: "#E6E6FA",
    width: 110,
    height: 130,
    elevation: 3,
  },
  thirdPodium: {
    backgroundColor: "#FFE4E1",
    width: 110,
    height: 130,
    elevation: 3,
  },
  crown: {
    position: "absolute",
    top: -75,
    alignSelf: "center",
    zIndex: 3,
  },
  topThreeName: {
    fontSize: 13,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#333",
    textAlign: "center",
    marginTop: 5,
    lineHeight: 18,
  },
  firstName: {
    fontSize: 14,
  },
  rank: {
    fontSize: 22,
    fontFamily: "LexendDeca_700Bold",
    marginTop: 5,
  },
  firstRank: {
    fontSize: 28,
    color: "#FFB347",
  },
  secondRank: {
    color: "#9370DB",
  },
  thirdRank: {
    color: "#FF8C69",
  },
  percentage: {
    fontSize: 12,
    fontFamily: "LexendDeca_500Medium",
    color: "#666",
    marginTop: 4,
  },
  firstPercentage: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  leaderboardContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingTop: 25,
    flex: 1,
    elevation: 5,
    minHeight: 300,
  },
  leaderboardTitle: {
    fontSize: 18,
    fontFamily: "LexendDeca_700Bold",
    color: "#333",
    marginBottom: 20,
  },
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  rankContainer: {
    width: 25,
    marginRight: 10,
  },
  rankNumber: {
    fontSize: 14,
    fontFamily: "LexendDeca_500Medium",
    color: "#666",
  },
  userImageContainer: {
    position: "relative",
    marginRight: 12,
  },
  userImage: {
    backgroundColor: "#F5F5F5",
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  placeholderImage: {
    opacity: 0.5,
  },
  currentUserItem: {
    backgroundColor: "#FFF8F0",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#FF8447",
  },
  currentUserText: {
    color: "#333",
    fontFamily: "LexendDeca_600SemiBold",
  },
  currentUserAvatar: {
    borderColor: "#FF8447",
    borderWidth: 2,
  },
  currentUserScore: {
    color: "#444",
    fontFamily: "LexendDeca_600SemiBold",
  },
  currentUserScoreValue: {
    color: "#FF8447",
    fontFamily: "LexendDeca_700Bold",
  },
  notRankedText: {
    color: "#999",
    fontStyle: "italic",
    fontFamily: "LexendDeca_500Medium",
  },
  youBadge: {
    position: "absolute",
    backgroundColor: "#FF8447",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    bottom: -5,
    right: -5,
    elevation: 3,
    zIndex: 3,
  },
  youBadgeText: {
    color: "white",
    fontSize: 10,
    fontFamily: "LexendDeca_700Bold",
  },
  youBadgeSmall: {
    position: "absolute",
    backgroundColor: "#FF8447",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    bottom: -2,
    right: -2,
    elevation: 3,
    zIndex: 3,
  },
  youBadgeTextSmall: {
    color: "white",
    fontSize: 8,
    fontFamily: "LexendDeca_700Bold",
  },
  currentUserBanner: {
    backgroundColor: "#FFF8F0",
    borderRadius: 15,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#FF8447",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
  },
  currentUserRank: {
    color: "#FF8447",
    fontFamily: "LexendDeca_700Bold",
  },
  currentUserRankNumber: {
    color: "#FF8447",
  },
  userInfoContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontFamily: "LexendDeca_500Medium",
    color: "#333",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    marginRight: 10,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#FF8447',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#FF8447",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  placeholderText: {
    color: "#AAAAAA",
    fontStyle: "italic",
  },
  placeholderPercentage: {
    color: "#CCCCCC",
  },
  skeletonContainer: {
    flex: 1,
    padding: 16,
  },
  skeletonCurrentUserBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  skeletonImageContainer: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 2,
    top: -40,
  },
  skeletonTopThreeImage: {
    borderRadius: 32.5,
    borderWidth: 2,
    borderColor: 'white',
  },
  skeletonText: {
    marginVertical: 4,
  },
  skeletonListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  skeletonAvatar: {
    borderRadius: 20,
  },
});

export default BDMLeaderBoard;

