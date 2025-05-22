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
import { HrStackParamList } from "@/app/index";
import { useProfile } from "@/app/context/ProfileContext";
import { LinearGradient } from "expo-linear-gradient";
import { storage } from "@/firebaseConfig";
import { ref, getDownloadURL } from "firebase/storage";



const MainDrawer = (props: DrawerContentComponentProps) => {
  const navigation = useNavigation();
  const auth = getAuth();
  const { userProfile, profileImage } = useProfile();
  const [loading, setLoading] = useState(false);
  const [firebaseProfileImage, setFirebaseProfileImage] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const role = userProfile?.role || "guest"; // e.g. "HR", "BDM", "Telecaller"

  useEffect(() => {
    const loadProfileImage = async () => {
      try {
        setIsImageLoading(true);
        if (profileImage) {
          setFirebaseProfileImage(profileImage);
          return;
        }
        if (userProfile?.profileImageUrl) {
          setFirebaseProfileImage(userProfile.profileImageUrl);
          return;
        }
        const defaultRef = ref(storage, "assets/person.png");
        const url = await getDownloadURL(defaultRef);
        setFirebaseProfileImage(url);
      } catch (error) {
        setFirebaseProfileImage(null);
      } finally {
        setIsImageLoading(false);
      }
    };
    loadProfileImage();
  }, [userProfile, profileImage]);

  const handleNavigate = (screenName: keyof HrStackParamList) => {
    props.navigation.closeDrawer();
    setTimeout(() => props.navigation.navigate(screenName), 300);
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        onPress: async () => {
          try {
            setLoading(true);
            await signOut(auth);
            navigation.reset({ index: 0, routes: [{ name: "Login" as never }] });
          } catch (err) {
            Alert.alert("Logout Failed", "Please try again.");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const renderMenuItems = () => {
    switch (role) {
      case "hr manager":
        return (
          <>
            <DrawerItem label="Home" icon={({ size }) => <MaterialIcons name="home" size={size} color="#FF8447" />} onPress={() => handleNavigate("HrHomeScreen")} />
            <DrawerItem label="Profile" icon={({ size }) => <MaterialCommunityIcons name="account-circle" size={size} color="#09142D" />} onPress={() => handleNavigate("HrProfile")} />
            {/* <DrawerItem label="Settings" icon={({ size }) => <MaterialIcons name="settings" size={size} color="#09142D" />} onPress={() => handleNavigate("HrSettings")} /> */}
            <DrawerItem label="Performance Appraisal Form" icon={({ size }) => <MaterialCommunityIcons name="speedometer" size={size} color="#09142D" />} onPress={() => handleNavigate("PerformanceForm")} />
            <DrawerItem label="Performance Form" icon={({ size }) => <MaterialCommunityIcons name="flash" size={size} color="#09142D" />} onPress={() => handleNavigate("PerformanceAppraisalForm")} />
            <DrawerItem label="Performance Review" icon={({ size }) => <MaterialCommunityIcons name="speedometer" size={size} color="#09142D" />} onPress={() => handleNavigate("AllEmployeeList")} />
          </>
        );
      case "bdm":
        return (
          <>
            <DrawerItem label="Dashboard" icon={({ size }) => <MaterialIcons name="dashboard" size={size} color="#FF8447" />} onPress={() => handleNavigate("BDMHome")} />
            <DrawerItem label="Scripts" icon={({ size }) => <MaterialCommunityIcons name="notebook" size={size} color="#09142D" />} onPress={() => handleNavigate("BDMScripts")} />
          </>
        );
      case "telecaller":
        return (
          <>
            <DrawerItem label="Telecaller Home" icon={({ size }) => <MaterialIcons name="call" size={size} color="#FF8447" />} onPress={() => handleNavigate("TelecallerHome")} />
            <DrawerItem label="Call Notes" icon={({ size }) => <MaterialIcons name="notes" size={size} color="#09142D" />} onPress={() => handleNavigate("CallNotes")} />
            <DrawerItem label="Telecaller Home" icon={({ size }) => <MaterialIcons name="call" size={size} color="#FF8447" />} onPress={() => handleNavigate("TelecallerHome")} />
            <DrawerItem label="Call Notes" icon={({ size }) => <MaterialIcons name="notes" size={size} color="#09142D" />} onPress={() => handleNavigate("CallNotes")} />
          </>
        );
      default:
        return (
          <DrawerItem label="Home" icon={({ size }) => <MaterialIcons name="home" size={size} color="#999" />} onPress={() => handleNavigate("GuestHome")} />
        );
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FF8447", "#FF6D24"]} style={styles.profileHeader}>
        <TouchableOpacity onPress={() => props.navigation.closeDrawer()} style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.profileContainer} onPress={() => handleNavigate("HrProfile")}>
          {isImageLoading ? (
            <ActivityIndicator size="small" color="#FFF" style={styles.profileImage} />
          ) : firebaseProfileImage ? (
            <Image source={{ uri: firebaseProfileImage }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, { backgroundColor: "#f0f0f0", justifyContent: "center", alignItems: "center" }]}>
              <MaterialIcons name="person" size={24} color="#999" />
            </View>
          )}
          <View style={styles.profileTextContainer}>
            <Text style={styles.profileName}>
              {userProfile?.name || userProfile?.firstName || auth.currentUser?.displayName || "User"}
            </Text>
            <Text style={styles.profileEmail}>
              {userProfile?.email || auth.currentUser?.email || "Not available"}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#FFF" style={styles.profileArrow} />
        </TouchableOpacity>
      </LinearGradient>

      <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>MAIN MENU</Text>
          {renderMenuItems()}
        </View>
      </DrawerContentScrollView>

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <>
            <MaterialCommunityIcons name="logout" size={24} color="#FFFFFF" style={styles.logoutIcon} />
            <Text style={styles.logoutText}>Logout</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};
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

export default MainDrawer;
