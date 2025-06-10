import React, { useEffect, useState } from "react";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { getAuth, signOut } from "firebase/auth";
import { useProfile } from "@/app/context/ProfileContext";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storage } from "@/firebaseConfig";
import { ref, getDownloadURL } from "firebase/storage";

const CustomDrawer = (props: DrawerContentComponentProps) => {
  const navigation = useNavigation();
  const auth = getAuth();
  const { userProfile, profileImage } = useProfile();
  const [loading, setLoading] = useState(false);
  const [recentScreens, setRecentScreens] = useState<string[]>([]);
  const [defaultProfileImage, setDefaultProfileImage] = useState<string | null>(
    null
  );
  const [imageLoading, setImageLoading] = useState(true);

  // Load recent screens from history
  // useEffect(() => {
  // This would normally load from AsyncStorage
  // For now using static recent screens
  //   setRecentScreens(['HomeScreen', 'Target', 'ContactBook']);
  //   loadDefaultProfileImage();
  // }, []);

  const loadDefaultProfileImage = async () => {
    try {
      console.log("Loading default profile image from Firebase Storage");
      const imageRef = ref(storage, "assets/girl.png");
      const url = await getDownloadURL(imageRef);
      console.log("Successfully loaded default profile image URL:", url);
      setDefaultProfileImage(url);
    } catch (error) {
      console.error("Error loading default profile image:", error);
    } finally {
      setImageLoading(false);
    }
  };

  // const handleLogout = () => {
  //   Alert.alert(
  //     "Logout",
  //     "Are you sure you want to logout?",
  //     [
  //       {
  //         text: "Cancel",
  //         style: "cancel"
  //       },
  //       {
  //         text: "Logout",
  //         onPress: async () => {
  //           try {
  //             setLoading(true);
  //             // Clear session data
  //             await AsyncStorage.multiRemove(['sessionToken', 'lastActiveTime', 'userRole']);
  //             await signOut(auth);
  //             navigation.reset({
  //               index: 0,
  //               routes: [{ name: 'Login' as never }]
  //             });
  //           } catch (error) {
  //             console.error('Logout error:', error);
  //             Alert.alert('Error', 'Failed to logout. Please try again.');
  //           } finally {
  //             setLoading(false);
  //           }
  //         }
  //       }
  //     ]
  //   );
  // };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.reset({ index: 0, routes: [{ name: "Login" as never }] });
    } catch (err) {
      console.error("Logout failed", err);
    }
  };
  const handleNavigate = (screenName: string) => {
    props.navigation.closeDrawer();
    setTimeout(() => {
      props.navigation.navigate(screenName);
    }, 300);
  };

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <LinearGradient
        colors={["#FF8447", "#FF6D24"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.profileHeader}
      >
        <TouchableOpacity
          onPress={() => props.navigation.closeDrawer()}
          style={styles.closeButton}
        >
          <MaterialIcons name="close" size={24} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileContainer}
          onPress={() => handleNavigate("Profile")}
        >
          {imageLoading ? (
            <View
              style={[
                styles.profileImage,
                { justifyContent: "center", alignItems: "center" },
              ]}
            >
              <MaterialIcons name="person" size={24} color="#FFF" />
            </View>
          ) : (
            <Image
              source={
                profileImage
                  ? { uri: profileImage }
                  : { uri: defaultProfileImage || "" }
              }
              style={styles.profileImage}
            />
          )}
          <View style={styles.profileTextContainer}>
            <Text style={styles.profileName}>
              {userProfile?.name ||
                userProfile?.firstName ||
                auth.currentUser?.displayName ||
                "User"}
            </Text>
            <Text style={styles.profileEmail}>
              {userProfile?.email || auth.currentUser?.email || "Not available"}
            </Text>
          </View>
          <MaterialIcons
            name="chevron-right"
            size={22}
            color="#FFF"
            style={styles.profileArrow}
          />
        </TouchableOpacity>
      </LinearGradient>

      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.drawerContent}
      >
        {/* Recent Screens Section */}
        {/* <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>RECENT</Text>
          {recentScreens.map((screen, index) => (
            <TouchableOpacity 
              key={index}
              style={styles.recentItem}
              onPress={() => handleNavigate(screen)}
            >
              <MaterialIcons name="history" size={18} color="#777" />
              <Text style={styles.recentItemText}>{screen}</Text>
            </TouchableOpacity>
          ))}
        </View> */}

        {/* Main Menu */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>MAIN MENU</Text>

          <DrawerItem
            label="Home"
            icon={({ color, size }) => (
              <MaterialIcons name="home" size={size} color="#FF8447" />
            )}
            labelStyle={styles.menuText}
            style={styles.drawerItem}
            onPress={() => handleNavigate("HomeScreen")}
          />

          <DrawerItem
            label="Profile"
            icon={({ color, size }) => (
              <MaterialCommunityIcons
                name="account-circle"
                size={size}
                color="#09142D"
              />
            )}
            labelStyle={styles.menuText}
            style={styles.drawerItem}
            onPress={() => handleNavigate("Profile")}
          />

          <DrawerItem
            label="Contact Book"
            icon={({ color, size }) => (
              <MaterialCommunityIcons
                name="contacts"
                size={size}
                color="#09142D"
              />
            )}
            labelStyle={styles.menuText}
            style={styles.drawerItem}
            onPress={() => handleNavigate("ContactBook")}
          />

          <DrawerItem
            label="Virtual Business Card"
            icon={({ color, size }) => (
              <MaterialCommunityIcons
                name="card-account-details"
                size={size}
                color="#09142D"
              />
            )}
            labelStyle={styles.menuText}
            style={styles.drawerItem}
            onPress={() => handleNavigate("VirtualBusinessCard")}
          />
        </View>

        {/* Productivity Tools */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>PRODUCTIVITY</Text>

          <DrawerItem
            label="My Schedule"
            icon={({ color, size }) => (
              <MaterialCommunityIcons
                name="calendar"
                size={size}
                color="#09142D"
              />
            )}
            labelStyle={styles.menuText}
            style={styles.drawerItem}
            onPress={() => handleNavigate("My Schedule")}
          />

          <DrawerItem
            label="My Script"
            icon={({ color, size }) => (
              <MaterialCommunityIcons
                name="note-text-outline"
                size={size}
                color="#09142D"
              />
            )}
            labelStyle={styles.menuText}
            style={styles.drawerItem}
            onPress={() => handleNavigate("My Script")}
          />

          <DrawerItem
            label="Leaderboard"
            icon={({ color, size }) => (
              <MaterialCommunityIcons
                name="podium"
                size={size}
                color="#09142D"
              />
            )}
            labelStyle={styles.menuText}
            style={styles.drawerItem}
            onPress={() => handleNavigate("Leaderboard")}
          />
          {/* <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>EMPLOYEE SERVICES</Text>
        <DrawerItem
          label="Leave Application"
          icon={({ color, size }) => <MaterialCommunityIcons name="calendar-star" size={size} color="#09142D" />}
          labelStyle={styles.menuText}
          style={styles.drawerItem}
          onPress={() => handleNavigate("ApplyLeaveScreen")}
          />
        </View> */}
        </View>
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>EMPLOYEE SERVICES</Text>
          <DrawerItem
            label="Leave Application"
            icon={({ color, size }) => (
              <MaterialCommunityIcons
                name="calendar-star"
                size={size}
                color="#09142D"
              />
            )}
            labelStyle={styles.menuText}
            style={styles.drawerItem}
            onPress={() => handleNavigate("TelecallerLeaveApplication")}
          />

          <DrawerItem
            label="Financial Calendar"
            icon={({ color, size }) => (
              <MaterialIcons name="calendar-today" size={size} color={color} />
            )}
            labelStyle={styles.menuText}
            style={styles.drawerItem}
            onPress={() => handleNavigate("FinancialCalendar")}
          />
        </View>


        {/* Tools & Settings */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>TOOLS & SETTINGS</Text>

          <DrawerItem
            label="Settings"
            icon={({ color, size }) => (
              <MaterialIcons name="settings" size={size} color="#09142D" />
            )}
            labelStyle={styles.menuText}
            style={styles.drawerItem}
            onPress={() => handleNavigate("TelecallerSettings")}
          />
        </View>
      </DrawerContentScrollView>

      {/* App Version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <>
            <MaterialCommunityIcons
              name="logout"
              size={24}
              color="#FFFFFF"
              style={styles.logoutIcon}
            />
            <Text style={styles.logoutText}>Logout</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default CustomDrawer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  profileHeader: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "flex-end",
    marginBottom: 10,
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  profileTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#FFF",
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  profileArrow: {
    marginLeft: 8,
  },
  drawerContent: {
    paddingTop: 16,
  },
  sectionContainer: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 12,
    color: "#9C9C9C",
    marginBottom: 12,
    fontFamily: "LexendDeca_600SemiBold",
    paddingHorizontal: 8,
    letterSpacing: 1,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  recentItemText: {
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: "#555",
    marginLeft: 12,
  },
  drawerItem: {
    borderRadius: 8,
    marginVertical: 2,
  },
  menuText: {
    fontSize: 16,
    color: "#333",
    fontFamily: "LexendDeca_400Regular",
  },
  versionContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  versionText: {
    fontSize: 12,
    color: "#999",
    fontFamily: "LexendDeca_400Regular",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF7F41",
    padding: 15,
    margin: 16,
    marginBottom: 30,
    borderRadius: 12,
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
  },
});
