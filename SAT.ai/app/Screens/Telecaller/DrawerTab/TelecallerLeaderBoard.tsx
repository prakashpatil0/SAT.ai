import React, { useState, useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, ScrollView, ActivityIndicator, Animated, Alert, TouchableOpacity, Platform } from "react-native";
import { Avatar } from "react-native-paper";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import AppGradient from "@/app/components/AppGradient";
import { FontAwesome5 } from "@expo/vector-icons";
import { getLeaderboardData } from "@/app/services/targetService";
import { auth } from '@/firebaseConfig';
import { DEFAULT_PROFILE_IMAGE } from '@/app/utils/profileStorage';
import { useProfile } from '@/app/context/ProfileContext';
import { db } from '@/firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Define the LeaderboardUser type
type LeaderboardUser = {
  userId: string;
  name: string;
  profileImage: string | null;
  percentageAchieved: number;
  rank: number;
  isPlaceholder?: boolean;
  isNotRanked?: boolean;
};

// Default images for when user has no profile image
const defaultProfileImages = [
  require("@/assets/images/girl.png"),
  require("@/assets/images/girl.png"),
  require("@/assets/images/girl.png"),
  require("@/assets/images/girl.png"),
];

// Placeholder data to maintain leaderboard structure when no real data is available
const placeholderData: LeaderboardUser[] = Array(10).fill(null).map((_, index) => ({
  userId: `placeholder-${index}`,
  name: "Add your data",
  profileImage: null,
  percentageAchieved: 0,
  rank: index + 1,
  isPlaceholder: true
}));

const LeaderBoard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  
  // Current user ID and profile
  const currentUserId = auth.currentUser?.uid;
  const { userProfile, refreshProfile } = useProfile();

  useEffect(() => {
    refreshProfile(); // Ensure we have the latest profile data
    fetchLeaderboardData();
    fetchAllUserNames();
  }, []);
  
  useEffect(() => {
    // Start animation when data is loaded
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

  // Fetch all user names from Firebase to have a complete mapping
  const fetchAllUserNames = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const nameMap: Record<string, string> = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const userId = data.uid;
        if (userId) {
          // Try different name fields
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
      
      const data = await getLeaderboardData(10);
      
      // Add rank to each user
      const rankedData = data.map((user, index) => ({
        ...user,
        rank: index + 1
      }));
      
      // If we have user name mappings, update the names
      if (Object.keys(userNameMap).length > 0) {
        rankedData.forEach(user => {
          if (userNameMap[user.userId]) {
            user.name = userNameMap[user.userId];
          }
        });
      }
      
      // If current user is authenticated but not in the list, add their data for context
      if (currentUserId && userProfile && !rankedData.some(user => user.userId === currentUserId)) {
        // Add a dummy entry for the current user with a rank beyond the leaderboard
        // This won't be displayed in the top 10 but will be used to show "Your Position" banner
        const currentUserEntry: LeaderboardUser = {
          userId: currentUserId,
          name: userProfile.name || userNameMap[currentUserId] || 'You',
          profileImage: userProfile.profileImageUrl || null,
          percentageAchieved: 0, // This will be shown as "Not Ranked Yet"
          rank: rankedData.length + 1,
          isNotRanked: true
        };
        rankedData.push(currentUserEntry);
      }
      
      // If we have less than 10 users, fill the rest with placeholder data
      if (rankedData.length < 10) {
        const fillerData = placeholderData.slice(rankedData.length).map(placeholder => ({
          ...placeholder,
          rank: rankedData.length + placeholder.rank
        }));
        setLeaderboardData([...rankedData, ...fillerData]);
      } else {
        setLeaderboardData(rankedData);
      }
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      // On error, show placeholder data to maintain UI structure
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

  // Helper function to get a profile image (either from user data or fallback)
  const getProfileImage = (user: LeaderboardUser | { profileImage: string | null, rank: number, isPlaceholder?: boolean }) => {
    // For placeholder entries, use a consistent default image with reduced opacity
    if (user.isPlaceholder) {
      return defaultProfileImages[3];
    }
    
    // Use the user's profile image if available
    if (user.profileImage) {
      return { uri: user.profileImage };
    }
    
    // If this is the current user, try to get image from userProfile
    if ('userId' in user && isCurrentUser(user.userId) && userProfile?.profileImageUrl) {
      return { uri: userProfile.profileImageUrl };
    }
    
    // Use predetermined images for top 3, then default for others
    if (user.rank <= 3) {
      return defaultProfileImages[user.rank - 1];
    }
    
    // Default fallback image
    return DEFAULT_PROFILE_IMAGE ? { uri: DEFAULT_PROFILE_IMAGE } : defaultProfileImages[3];
  };
  
  // Check if this entry is the current user
  const isCurrentUser = (userId: string) => {
    return currentUserId === userId;
  };

  // Format percentage for display
  const formatPercentage = (percentage: number) => {
    if (percentage === 0) return "0%";
    return `${percentage.toFixed(1)}%`;
  };

  // Get top 3 users for the podium
  const topThree = leaderboardData.filter(user => !user.isNotRanked).slice(0, 3);
  
  // Get remaining users for the list
  const remainingUsers = leaderboardData.filter(user => !user.isNotRanked).slice(3);
  
  // Find current user in leaderboard
  const currentUserRanking = leaderboardData.find(user => user.userId === currentUserId);

  const handleRefresh = () => {
    fetchLeaderboardData(true);
    fetchAllUserNames();
  };

  if (loading) {
    return (
      <AppGradient>
        <TelecallerMainLayout showDrawer showBottomTabs={true} showBackButton title="Leaderboard">
          <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#FF8447" />
            <Text style={styles.loadingText}>Loading leaderboard data...</Text>
          </View>
        </TelecallerMainLayout>
      </AppGradient>
    );
  }

  return (
    <AppGradient>
      <TelecallerMainLayout 
        showDrawer 
        showBottomTabs={true} 
        showBackButton 
        title="Leaderboard"
        rightIcon={
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
                    <Text style={styles.currentUserScoreValue}>{formatPercentage(currentUserRanking.percentageAchieved)}</Text>
                  )}
                </Text>
              </View>
            )}
            
            {/* Top Three Section - Always display even with placeholder data */}
            <View style={styles.topThreeContainer}>
              {/* Second Place */}
              <View style={styles.secondPlaceWrapper}>
                <View style={styles.imageContainer}>
                  <Image 
                    source={getProfileImage(topThree[1] || { profileImage: null, rank: 2, isPlaceholder: true })} 
                    style={[
                      styles.topThreeImage, 
                      topThree[1]?.isPlaceholder && styles.placeholderImage,
                      isCurrentUser(topThree[1]?.userId) && styles.currentUserImage
                    ]} 
                  />
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
                    {topThree[1]?.name ? topThree[1].name.split(' ').join('\n') : 'Waiting\nfor data'}
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

              {/* First Place (Centered and Highlighted) */}
              <View style={styles.firstPlaceWrapper}>
                <FontAwesome5 name="crown" size={40} color="#FFD700" style={styles.crown} />
                <View style={styles.imageContainer}>
                  <Image 
                    source={getProfileImage(topThree[0] || { profileImage: null, rank: 1, isPlaceholder: true })} 
                    style={[
                      styles.topThreeImage, 
                      styles.firstImage, 
                      topThree[0]?.isPlaceholder && styles.placeholderImage,
                      isCurrentUser(topThree[0]?.userId) && styles.currentUserImage
                    ]} 
                  />
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
                    {topThree[0]?.name ? topThree[0].name.split(' ').join('\n') : 'Waiting\nfor data'}
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
                  <Image 
                    source={getProfileImage(topThree[2] || { profileImage: null, rank: 3, isPlaceholder: true })} 
                    style={[
                      styles.topThreeImage, 
                      topThree[2]?.isPlaceholder && styles.placeholderImage,
                      isCurrentUser(topThree[2]?.userId) && styles.currentUserImage
                    ]} 
                  />
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
                    {topThree[2]?.name ? topThree[2].name.split(' ').join('\n') : 'Waiting\nfor data'}
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

            {/* List Section - Always show structure with 7 more entries */}
            <View style={styles.listContainer}>
              {remainingUsers.map((user) => (
                <View key={user.userId} style={[
                  styles.listItem,
                  isCurrentUser(user.userId) && styles.currentUserItem
                ]}>
                  <Text style={[
                    styles.listRank,
                    isCurrentUser(user.userId) && styles.currentUserText
                  ]}>{user.rank}</Text>
                  <View style={styles.avatarContainer}>
                    <Avatar.Image
                      size={40}
                      source={getProfileImage(user)}
                      style={[
                        styles.listAvatar, 
                        user.isPlaceholder && styles.placeholderAvatar,
                        isCurrentUser(user.userId) && styles.currentUserAvatar
                      ]}
                    />
                    {isCurrentUser(user.userId) && (
                      <View style={styles.miniYouBadge}>
                        <Text style={styles.miniYouBadgeText}>YOU</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[
                    styles.listName, 
                    user.isPlaceholder && styles.placeholderText,
                    isCurrentUser(user.userId) && styles.currentUserText
                  ]}>{user.name}</Text>
                  <View style={styles.percentageContainer}>
                    <Text style={[
                      styles.listPercentage, 
                      user.isPlaceholder && styles.placeholderPercentage,
                      isCurrentUser(user.userId) && styles.currentUserScoreValue
                    ]}>
                      {formatPercentage(user.percentageAchieved)}
                    </Text>
                    <View style={[
                      styles.percentageBar,
                      {
                        width: `${Math.min(user.percentageAchieved, 100)}%`,
                        backgroundColor: isCurrentUser(user.userId) ? '#FF8447' : '#DDD'
                      }
                    ]} />
                  </View>
                </View>
              ))}
              
              {/* Always show 7 list items even if we don't have that many users */}
              {remainingUsers.length === 0 && (
                <Text style={styles.noDataMessage}>Submit your daily reports to appear on the leaderboard!</Text>
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Extra padding to account for bottom tabs
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
    opacity: 0.5,
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
    height: 140,
    zIndex: 1,
    elevation: 4,
  },
  secondPodium: {
    backgroundColor: "#E6E6FA",
    width: 110,
    height: 110,
    elevation: 3,
  },
  thirdPodium: {
    backgroundColor: "#FFE4E1",
    width: 110,
    height: 110,
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
  listContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingTop: 25,
    flex: 1,
    elevation: 5,
    minHeight: 300, // Ensure minimum height for visual structure
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  listRank: {
    width: 25,
    fontSize: 14,
    fontFamily: "LexendDeca_500Medium",
    color: "#666",
    marginRight: 10,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  listAvatar: {
    backgroundColor: "#F5F5F5",
  },
  placeholderAvatar: {
    opacity: 0.5,
  },
  listName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "LexendDeca_500Medium",
    color: "#333",
  },
  percentageContainer: {
    width: 80,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  percentageBar: {
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    marginTop: 4,
    minWidth: 5,
  },
  listPercentage: {
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
  noDataMessage: {
    fontSize: 14,
    fontFamily: "LexendDeca_500Medium",
    color: "#666",
    textAlign: "center",
    marginTop: 20,
    padding: 20,
    backgroundColor: "#FFF8F0",
    borderRadius: 10,
  },
  placeholderText: {
    color: "#AAAAAA",
    fontStyle: "italic",
  },
  placeholderPercentage: {
    color: "#CCCCCC",
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
  miniYouBadge: {
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
  miniYouBadgeText: {
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
  }
});

export default LeaderBoard;
