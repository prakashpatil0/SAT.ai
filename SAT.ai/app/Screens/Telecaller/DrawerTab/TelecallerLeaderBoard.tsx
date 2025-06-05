import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Alert,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Avatar } from "react-native-paper";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import AppGradient from "@/app/components/AppGradient";
import { FontAwesome5 } from "@expo/vector-icons";
import { auth, storage } from "@/firebaseConfig";
import { ref, getDownloadURL } from "firebase/storage";
import { useProfile } from "@/app/context/ProfileContext";
import { db } from "@/firebaseConfig";
import {
  collection,
  query,
  getDocs,
  orderBy,
  getDoc,
  doc,
  limit,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import debounce from "lodash.debounce";

type LeaderboardUser = {
  userId: string;
  name: string;
  profileImage: string | null;
  percentageAchieved: number;
  rank: number;
  isPlaceholder?: boolean;
  isNotRanked?: boolean;
};

const placeholderData: LeaderboardUser[] = Array(10)
  .fill(null)
  .map((_, index) => ({
    userId: `placeholder-${index}`,
    name: "Add your data",
    profileImage: null,
    percentageAchieved: 0,
    rank: index + 1,
    isPlaceholder: true,
  }));

const LeaderBoard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  const [defaultProfileImage, setDefaultProfileImage] = useState<string | null>(
    null
  );
  const [imageLoading, setImageLoading] = useState(true);
  const [isBackgroundFetching, setIsBackgroundFetching] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const currentUserId = auth.currentUser?.uid;
  const { userProfile, refreshProfile } = useProfile();

  const CACHE_KEY = "telecaller_leaderboard_cache";
  const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  const DEFAULT_IMAGE_CACHE_KEY = "default_profile_image";

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([refreshProfile(), loadDefaultProfileImage()]);
      await loadCachedLeaderboardData();
      // Start background fetch after initial load
      debouncedBackgroundFetch();
    };
    initialize();

    // Cleanup debounce on unmount
    return () => {
      debouncedBackgroundFetch.cancel();
    };
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
        }),
      ]).start();
    }
  }, [loading]);

  const loadDefaultProfileImage = async () => {
    try {
      const cachedImage = await AsyncStorage.getItem(DEFAULT_IMAGE_CACHE_KEY);
      if (cachedImage) {
        setDefaultProfileImage(cachedImage);
        setImageLoading(false);
        return;
      }

      const imageRef = ref(storage, "assets/person.png");
      const url = await getDownloadURL(imageRef);
      setDefaultProfileImage(url);
      await AsyncStorage.setItem(DEFAULT_IMAGE_CACHE_KEY, url);
    } catch {
      setDefaultProfileImage(null);
    } finally {
      setImageLoading(false);
    }
  };

  const loadCachedLeaderboardData = async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const now = Date.now();

        setLeaderboardData(data);
        setLoading(false);
        fetchUserNames(data); // Fetch names for cached users
        if (now - timestamp >= CACHE_EXPIRY) {
          // Trigger background fetch if cache is stale
          debouncedBackgroundFetch();
        }
        return;
      }
      fetchLeaderboardData();
    } catch {
      fetchLeaderboardData();
    }
  };

  const saveLeaderboardToCache = async (data: LeaderboardUser[]) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch {}
  };

  const fetchUserNames = async (users: LeaderboardUser[]) => {
    try {
      const userIds = users
        .filter((user) => !user.isPlaceholder)
        .map((user) => user.userId);
      if (!userIds.length) return;

      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);

      const nameMap: Record<string, string> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        const userId = data.uid;
        if (userId && userIds.includes(userId)) {
          const name =
            data.name ||
            (data.firstName && data.lastName
              ? `${data.firstName} ${data.lastName}`
              : null) ||
            data.displayName ||
            data.email ||
            "Unknown User";
          nameMap[userId] = name;
        }
      });

      setUserNameMap((prev) => ({ ...prev, ...nameMap }));
    } catch {}
  };

  const fetchLeaderboardData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else if (!loading) setIsBackgroundFetching(true);

      const achievementsRef = collection(db, "telecaller_achievements");
      const achievementsQuery = query(
        achievementsRef,
        orderBy("percentageAchieved", "desc"),
        limit(10)
      );

      const achievementsSnapshot = await getDocs(achievementsQuery);

      const userAchievements: Record<
        string,
        { highestPercentage: number; latestDate: Date }
      > = {};

      achievementsSnapshot.forEach((doc) => {
        const data = doc.data();
        const userId = data.userId;
        const percentage = data.percentageAchieved;
        const date = data.createdAt.toDate();

        if (
          !userAchievements[userId] ||
          percentage > userAchievements[userId].highestPercentage ||
          (percentage === userAchievements[userId].highestPercentage &&
            date > userAchievements[userId].latestDate)
        ) {
          userAchievements[userId] = {
            highestPercentage: percentage,
            latestDate: date,
          };
        }
      });

      const sortedUsers = Object.entries(userAchievements)
        .map(([userId, data]) => ({
          userId,
          percentageAchieved: data.highestPercentage,
          latestDate: data.latestDate,
        }))
        .sort((a, b) => b.percentageAchieved - a.percentageAchieved)
        .slice(0, 10);

      const leaderboardData = await Promise.all(
        sortedUsers.map(async (user, index) => {
          try {
            const userDoc = await getDoc(doc(db, "users", user.userId));
            let userName = userNameMap[user.userId] || "Unknown User";
            let profileImage = null;

            if (userDoc.exists()) {
              const userData = userDoc.data();
              userName =
                userData.name ||
                (userData.firstName && userData.lastName
                  ? `${userData.firstName} ${data.lastName}`
                  : null) ||
                userData.displayName ||
                userData.email ||
                "Unknown User";

              const imageFields = [
                "profileImageUrl",
                "profileImage",
                "photoURL",
                "avatar",
                "picture",
              ];
              for (const field of imageFields) {
                if (userData[field] && typeof userData[field] === "string") {
                  profileImage = String(userData[field]);
                  break;
                }
              }
            }

            return {
              userId: user.userId,
              name: userName,
              profileImage: profileImage || defaultProfileImage,
              percentageAchieved: user.percentageAchieved,
              rank: index + 1,
            };
          } catch {
            return {
              userId: user.userId,
              name: userNameMap[user.userId] || "Unknown User",
              profileImage: defaultProfileImage,
              percentageAchieved: user.percentageAchieved,
              rank: index + 1,
            };
          }
        })
      );

      const topUsers = leaderboardData.slice(0, 10);
      const remainingPlaceholders = placeholderData
        .slice(topUsers.length)
        .map((placeholder, index) => ({
          ...placeholder,
          rank: topUsers.length + index + 1,
        }));

      const finalData = [...topUsers, ...remainingPlaceholders].slice(0, 10);
      setLeaderboardData(finalData);
      saveLeaderboardToCache(finalData);
      fetchUserNames(finalData);
    } catch {
      if (showRefreshing) {
        Alert.alert(
          "Error",
          "Could not refresh leaderboard data. Showing cached data.",
          [{ text: "OK" }]
        );
      }
    } finally {
      if (showRefreshing) setRefreshing(false);
      setIsBackgroundFetching(false);
      if (loading) setLoading(false);
    }
  };

  const debouncedBackgroundFetch = debounce(() => {
    fetchLeaderboardData(false);
  }, 1000);

  const getProfileImage = (
    user: LeaderboardUser | { profileImage: string | null; rank: number; isPlaceholder?: boolean }
  ) => {
    if (user.isPlaceholder) {
      return defaultProfileImage ? { uri: defaultProfileImage } : undefined;
    }

    if (
      "userId" in user &&
      isCurrentUser(user.userId) &&
      userProfile?.profileImageUrl
    ) {
      return { uri: String(userProfile.profileImageUrl) };
    }

    if (user.profileImage && typeof user.profileImage === "string") {
      return { uri: String(user.profileImage) };
    }

    return defaultProfileImage ? { uri: defaultProfileImage } : undefined;
  };

  const getAvatarImageSource = (
    user: LeaderboardUser | { profileImage: string | null; rank: number; isPlaceholder?: boolean }
  ) => {
    const imageSource = getProfileImage(user);
    return imageSource || { uri: "https://via.placeholder.com/40" };
  };

  const isCurrentUser = (userId: string) => {
    return currentUserId === userId;
  };

  const formatPercentage = (percentage: number) => {
    if (percentage === 0) return "0%";
    return `${percentage.toFixed(1)}%`;
  };

  const topThree = leaderboardData.slice(0, 3);
  const currentUserRanking = leaderboardData.find(
    (user) => user.userId === currentUserId
  );

  const handleRefresh = () => {
    fetchLeaderboardData(true);
  };

  if (loading) {
    return (
      <AppGradient>
        <TelecallerMainLayout
          showDrawer
          showBottomTabs={true}
          showBackButton
          title="Leaderboard"
        >
          <View
            style={[styles.content, { justifyContent: "center", alignItems: "center" }]}
          >
            <ActivityIndicator size="large" color="#FF8447" />
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
        rightComponent={
          refreshing || isBackgroundFetching ? (
            <ActivityIndicator size="small" color="#333" />
          ) : (
            <TouchableOpacity onPress={handleRefresh}>
              <Ionicons name="refresh" size={24} color="#333" />
            </TouchableOpacity>
          )
        }
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <Animated.View
            style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
          >
            {currentUserRanking && !currentUserRanking.isPlaceholder && (
              <View style={styles.currentUserBanner}>
                <Text style={styles.currentUserText}>
                  Your Position:{" "}
                  {currentUserRanking.isNotRanked ? (
                    <Text style={styles.notRankedText}>Not Ranked Yet</Text>
                  ) : (
                    <Text style={styles.currentUserRank}>#{currentUserRanking.rank}</Text>
                  )}
                </Text>
                <Text style={styles.currentUserScore}>
                  Achievement:{" "}
                  {currentUserRanking.isNotRanked ? (
                    <Text style={styles.notRankedText}>No Data</Text>
                  ) : (
                    <Text style={styles.currentUserScoreValue}>
                      {formatPercentage(currentUserRanking.percentageAchieved)}
                    </Text>
                  )}
                </Text>
              </View>
            )}

            <View style={styles.topThreeContainer}>
              <View style={styles.secondPlaceWrapper}>
                <View style={styles.imageContainer}>
                  {imageLoading ? (
                    <View
                      style={[styles.topThreeImage, { justifyContent: "center", alignItems: "center" }]}
                    >
                      <MaterialIcons name="person" size={24} color="#999" />
                    </View>
                  ) : (
                    <Image
                      source={getAvatarImageSource(
                        topThree[1] || { profileImage: null, rank: 2, isPlaceholder: true }
                      )}
                      style={[
                        styles.topThreeImage,
                        topThree[1]?.isPlaceholder && styles.placeholderImage,
                        isCurrentUser(topThree[1]?.userId) && styles.currentUserImage,
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
                  <Text
                    style={[
                      styles.topThreeName,
                      topThree[1]?.isPlaceholder && styles.placeholderText,
                      isCurrentUser(topThree[1]?.userId) && styles.currentUserText,
                    ]}
                  >
                    {topThree[1]?.name || "Waiting\nfor data"}
                  </Text>
                  <Text style={[styles.rank, styles.secondRank]}>2</Text>
                  <Text
                    style={[
                      styles.percentage,
                      topThree[1]?.isPlaceholder && styles.placeholderText,
                      isCurrentUser(topThree[1]?.userId) && styles.currentUserScore,
                    ]}
                  >
                    {topThree[1] ? formatPercentage(topThree[1].percentageAchieved) : "0%"}
                  </Text>
                </View>
              </View>

              <View style={styles.firstPlaceWrapper}>
                <FontAwesome5 name="crown" size={40} color="#FFD700" style={styles.crown} />
                <View style={styles.imageContainer}>
                  {imageLoading ? (
                    <View
                      style={[
                        styles.topThreeImage,
                        styles.firstImage,
                        { justifyContent: "center", alignItems: "center" },
                      ]}
                    >
                      <MaterialIcons name="person" size={24} color="#999" />
                    </View>
                  ) : (
                    <Image
                      source={getAvatarImageSource(
                        topThree[0] || { profileImage: null, rank: 1, isPlaceholder: true }
                      )}
                      style={[
                        styles.topThreeImage,
                        styles.firstImage,
                        topThree[0]?.isPlaceholder && styles.placeholderImage,
                        isCurrentUser(topThree[0]?.userId) && styles.currentUserImage,
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
                  <Text
                    style={[
                      styles.topThreeName,
                      styles.firstName,
                      topThree[0]?.isPlaceholder && styles.placeholderText,
                      isCurrentUser(topThree[0]?.userId) && styles.currentUserText,
                    ]}
                  >
                    {topThree[0]?.name || "Waiting\nfor data"}
                  </Text>
                  <Text style={[styles.rank, styles.firstRank]}>1</Text>
                  <Text
                    style={[
                      styles.percentage,
                      styles.firstPercentage,
                      topThree[0]?.isPlaceholder && styles.placeholderText,
                      isCurrentUser(topThree[0]?.userId) && styles.currentUserScore,
                    ]}
                  >
                    {topThree[0] ? formatPercentage(topThree[0].percentageAchieved) : "0%"}
                  </Text>
                </View>
              </View>

              <View style={styles.thirdPlaceWrapper}>
                <View style={styles.imageContainer}>
                  {imageLoading ? (
                    <View
                      style={[styles.topThreeImage, { justifyContent: "center", alignItems: "center" }]}
                    >
                      <MaterialIcons name="person" size={24} color="#999" />
                    </View>
                  ) : (
                    <Image
                      source={getAvatarImageSource(
                        topThree[2] || { profileImage: null, rank: 3, isPlaceholder: true }
                      )}
                      style={[
                        styles.topThreeImage,
                        topThree[2]?.isPlaceholder && styles.placeholderImage,
                        isCurrentUser(topThree[2]?.userId) && styles.currentUserImage,
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
                  <Text
                    style={[
                      styles.topThreeName,
                      topThree[2]?.isPlaceholder && styles.placeholderText,
                      isCurrentUser(topThree[2]?.userId) && styles.currentUserText,
                    ]}
                  >
                    {topThree[2]?.name || "Waiting\nfor data"}
                  </Text>
                  <Text style={[styles.rank, styles.thirdRank]}>3</Text>
                  <Text
                    style={[
                      styles.percentage,
                      topThree[2]?.isPlaceholder && styles.placeholderText,
                      isCurrentUser(topThree[2]?.userId) && styles.currentUserScore,
                    ]}
                  >
                    {topThree[2] ? formatPercentage(topThree[2].percentageAchieved) : "0%"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.listContainer}>
              {leaderboardData.slice(3).map((user) => (
                <View
                  key={user.userId}
                  style={[
                    styles.listItem,
                    isCurrentUser(user.userId) && styles.currentUserItem,
                  ]}
                >
                  <Text
                    style={[
                      styles.listRank,
                      isCurrentUser(user.userId) && styles.currentUserText,
                    ]}
                  >
                    {user.rank}
                  </Text>
                  <View style={styles.avatarContainer}>
                    {imageLoading ? (
                      <View
                        style={[styles.listAvatar, { justifyContent: "center", alignItems: "center" }]}
                      >
                        <MaterialIcons name="person" size={20} color="#999" />
                      </View>
                    ) : (
                      <Avatar.Image
                        size={40}
                        source={getAvatarImageSource(user)}
                        style={[
                          styles.listAvatar,
                          user.isPlaceholder && styles.placeholderAvatar,
                          isCurrentUser(user.userId) && styles.currentUserAvatar,
                        ]}
                      />
                    )}
                    {isCurrentUser(user.userId) && (
                      <View style={styles.miniYouBadge}>
                        <Text style={styles.miniYouBadgeText}>YOU</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.listName,
                      user.isPlaceholder && styles.placeholderText,
                      isCurrentUser(user.userId) && styles.currentUserText,
                    ]}
                  >
                    {user.name}
                  </Text>
                  <View style={styles.percentageContainer}>
                    <Text
                      style={[
                        styles.listPercentage,
                        user.isPlaceholder && styles.placeholderPercentage,
                        isCurrentUser(user.userId) && styles.currentUserScoreValue,
                      ]}
                    >
                      {formatPercentage(user.percentageAchieved)}
                    </Text>
                    <View
                      style={[
                        styles.percentageBar,
                        {
                          width: `${Math.min(user.percentageAchieved, 100)}%`,
                          backgroundColor: isCurrentUser(user.userId)
                            ? "#FF8447"
                            : "#DDD",
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
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
  listContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingTop: 25,
    flex: 1,
    elevation: 5,
    minHeight: 300,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    alignItems: "flex-end",
    justifyContent: "center",
  },
  percentageBar: {
    height: 4,
    backgroundColor: "#DDD",
    borderRadius: 2,
    marginTop: 4,
    minWidth: 5,
  },
  listPercentage: {
    fontSize: 14,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#FF8447",
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
  },
});

export default LeaderBoard;