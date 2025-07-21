import React, { useState, useEffect, useCallback } from "react";
import { View, Image, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { getAuth, signOut } from "firebase/auth";
import { useProfile } from "@/app/context/ProfileContext";
import { LinearGradient } from "expo-linear-gradient";
import { storage } from "@/firebaseConfig";
import { ref, getDownloadURL } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadDefaultProfileImage } from "@/app/utils/profileStorage";

interface MainDrawerProps extends DrawerContentComponentProps {
  userRole?: string;
}

const MainDrawer = (props: MainDrawerProps) => {
  const navigation = useNavigation();
  const auth = getAuth();
  const { userProfile, profileImage } = useProfile();
  const [loading, setLoading] = useState(false);
  const [firebaseProfileImage, setFirebaseProfileImage] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('telecaller');

  // Load user role from storage
  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const role = await AsyncStorage.getItem('userRole');
        if (role) {
          setUserRole(role.toLowerCase());
        }
      } catch (error) {
        console.error('Error loading user role:', error);
      }
    };
    loadUserRole();
  }, []);

  const loadProfileImage = useCallback(async () => {
    try {
      setIsImageLoading(true);
      
      // First priority: User's own profile photo
      if (profileImage) {
        setFirebaseProfileImage(profileImage);
        return;
      }
      
      // Second priority: User profile from database
      if (userProfile?.profileImageUrl) {
        setFirebaseProfileImage(userProfile.profileImageUrl);
        return;
      }
      
      // Third priority: Role-based default images using utility function
      const defaultImageUrl = await loadDefaultProfileImage(userRole);
      setFirebaseProfileImage(defaultImageUrl);
    } catch (error) {
      console.error('Error loading profile image:', error);
      setFirebaseProfileImage(null);
    } finally {
      setIsImageLoading(false);
    }
  }, [profileImage, userProfile?.profileImageUrl, userRole]);

  useEffect(() => {
    loadProfileImage();
  }, [loadProfileImage]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          onPress: async () => {
            try {
              setLoading(true);
              await signOut(auth);
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' as never }],
              });
            } catch {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [navigation]);

  const handleNavigate = useCallback((screenName: string) => {
    props.navigation.closeDrawer();
    setTimeout(() => {
      props.navigation.navigate(screenName as never);
    }, 300);
  }, [props.navigation]);

  // Get navigation screens based on user role
  const getNavigationScreens = () => {
    switch (userRole) {
      case 'bdm':
        return {
          mainMenu: [
            { label: "Home", icon: "home", screen: "BDMHomeScreen", color: "#FF8447" },
            { label: "Profile", icon: "account-circle", screen: "Profile", color: "#09142D" },
            { label: "Contact Book", icon: "contacts", screen: "BDMContactBook", color: "#09142D" },
            { label: "Virtual Business Card", icon: "card-account-details", screen: "BDMVirtualBusinessCard", color: "#09142D" },
            { label: "Settings", icon: "settings", screen: "BDMSettings", color: "#09142D" },
          ],
          productivity: [
            { label: "My Schedule", icon: "calendar", screen: "BDMMyScheduleScreen", color: "#09142D" },
            { label: "Meeting Reports", icon: "file-document-outline", screen: "BDMMeetingReports", color: "#09142D" },
            { label: "My Scripts", icon: "note-text-outline", screen: "BDMMyNotesScreen", color: "#09142D" },
            { label: "Leaderboard", icon: "podium", screen: "BDMLeaderBoard", color: "#09142D" },
          ],
          employeeServices: [
            { label: "Leave Application", icon: "calendar-star", screen: "TelecallerLeaveApplication", color: "#09142D" },
          ],
          toolsSettings: []
        };
      
      case 'hr':
        return {
          mainMenu: [
            { label: "Home", icon: "home", screen: "HrHomeScreen", color: "#FF8447" },
            { label: "Profile", icon: "person", screen: "HrProfile", color: "#09142D" },
            { label: "Settings", icon: "settings", screen: "HrSettings", color: "#09142D" },
          ],
          productivity: [],
          employeeServices: [
            { label: "Leave Application", icon: "calendar-star", screen: "ApplyLeaveScreen", color: "#09142D" },
            { label: "Calendar View", icon: "calendar-today", screen: "CalendarViewScreen", color: "#09142D" },
          ],
          toolsSettings: []
        };
      
      case 'telecaller':
      default:
        return {
          mainMenu: [
            { label: "Home", icon: "home", screen: "HomeScreen", color: "#FF8447" },
            { label: "Profile", icon: "account-circle", screen: "Profile", color: "#09142D" },
            { label: "Contact Book", icon: "contacts", screen: "ContactBook", color: "#09142D" },
            { label: "Virtual Business Card", icon: "card-account-details", screen: "VirtualBusinessCard", color: "#09142D" },
          ],
          productivity: [
            { label: "My Schedule", icon: "calendar", screen: "My Schedule", color: "#09142D" },
            { label: "My Script", icon: "note-text-outline", screen: "My Script", color: "#09142D" },
            { label: "Leaderboard", icon: "podium", screen: "Leaderboard", color: "#09142D" },
          ],
          employeeServices: [
            { label: "Leave Application", icon: "calendar-star", screen: "TelecallerLeaveApplication", color: "#09142D" },
          ],
          toolsSettings: [
            { label: "Settings", icon: "settings", screen: "TelecallerSettings", color: "#09142D" },
          ]
        };
    }
  };

  const getIconComponent = (iconName: string, color: string, size: number) => {
    switch (iconName) {
      case 'home':
        return <MaterialIcons name="home" size={size} color={color} />;
      case 'account-circle':
        return <MaterialCommunityIcons name="account-circle" size={size} color={color} />;
      case 'contacts':
        return <MaterialCommunityIcons name="contacts" size={size} color={color} />;
      case 'card-account-details':
        return <MaterialCommunityIcons name="card-account-details" size={size} color={color} />;
      case 'calendar':
        return <MaterialCommunityIcons name="calendar" size={size} color={color} />;
      case 'note-text-outline':
        return <MaterialCommunityIcons name="note-text-outline" size={size} color={color} />;
      case 'podium':
        return <MaterialCommunityIcons name="podium" size={size} color={color} />;
      case 'calendar-star':
        return <MaterialCommunityIcons name="calendar-star" size={size} color={color} />;
      case 'settings':
        return <MaterialIcons name="settings" size={size} color={color} />;
      case 'file-document-outline':
        return <MaterialCommunityIcons name="file-document-outline" size={size} color={color} />;
      case 'person':
        return <MaterialIcons name="person" size={size} color={color} />;
      case 'calendar-today':
        return <MaterialIcons name="calendar-today" size={size} color={color} />;
      default:
        return <MaterialIcons name="home" size={size} color={color} />;
    }
  };

  const renderSection = (title: string, items: any[]) => {
    if (items.length === 0) return null;

    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {items.map((item, index) => (
          <DrawerItem
            key={`${title}-${index}`}
            label={item.label}
            icon={({ size }) => getIconComponent(item.icon, item.color, size)}
            labelStyle={styles.menuText}
            style={styles.drawerItem}
            onPress={() => handleNavigate(item.screen)}
          />
        ))}
      </View>
    );
  };

  const navigationScreens = getNavigationScreens();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF8447', '#FF6D24']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.profileHeader}
      >
        <TouchableOpacity onPress={() => props.navigation.closeDrawer()} style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.profileContainer}
          onPress={() => handleNavigate('Profile')}
        >
          {isImageLoading ? (
            <ActivityIndicator size="small" color="#FFF" style={styles.profileImage} />
          ) : firebaseProfileImage ? (
            <Image
              source={{ uri: firebaseProfileImage }}
              style={styles.profileImage}
            />
          ) : (
            <View style={[styles.profileImage, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
              <MaterialIcons name="person" size={24} color="#999" />
            </View>
          )}
          <View style={styles.profileTextContainer}>
            <Text style={styles.profileName}>
              {userProfile?.name || userProfile?.firstName || auth.currentUser?.displayName || 'User'}
            </Text>
            <Text style={styles.profileEmail}>
              {userProfile?.email || auth.currentUser?.email || 'Not available'}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#FFF" style={styles.profileArrow} />
        </TouchableOpacity>
      </LinearGradient>

      <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
        {renderSection("MAIN MENU", navigationScreens.mainMenu)}
        {renderSection("PRODUCTIVITY", navigationScreens.productivity)}
        {renderSection("EMPLOYEE SERVICES", navigationScreens.employeeServices)}
        {renderSection("TOOLS & SETTINGS", navigationScreens.toolsSettings)}
      </DrawerContentScrollView>

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        disabled={loading}
      >
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
    backgroundColor: '#FFFFFF',
  },
  profileHeader: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  profileTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#FFF',
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  userRoleText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_500Medium',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
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
    color: '#9C9C9C',
    marginBottom: 12,
    fontFamily: "LexendDeca_600SemiBold",
    paddingHorizontal: 8,
    letterSpacing: 1,
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
    alignItems: 'center',
    paddingVertical: 12,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'LexendDeca_400Regular',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#FF7F41",
    padding: 15,
    margin: 16,
    marginBottom: 30,
    borderRadius: 12,
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
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