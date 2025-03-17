import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { DrawerContentComponentProps } from "@react-navigation/drawer";


type RootStackParamList = {
  BDMHomeScreen: undefined;
  Profile: undefined;
  VirtualBusinessCard: undefined;
  MySchedule: undefined;
  BDMMyNotesScreen: undefined;
  Leaderboard: undefined;
  Login: undefined;
};

const BDMDrawer = (props: DrawerContentComponentProps) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const menuItems = [
    { 
      id: 1, 
      title: 'Profile',
      screen: 'BDMProfile',
      icon: 'person',
      color: '#666'
    },
    { 
      id: 2, 
      title: 'Virtual Business Card',
      screen: 'BDMVirtualBusinessCard',
      icon: 'credit-card',
      color: '#666'
    },
    { 
      id: 3, 
      title: 'My Schedule',
      screen: 'BDMMyScheduleScreen',
      icon: 'event',
      color: '#666'
    },
    { 
      id: 4, 
      title: 'My Notes',
      screen: 'BDMMyNotesScreen',
      icon: 'edit',
      color: '#666'
    },
    { 
      id: 5, 
      title: 'Leaderboard',
      screen: 'BDMLeaderBoard',
      icon: 'leaderboard',
      color: '#666'
    },
  ];

  return (
    <View style={styles.container}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
        {/* Header Section */}
        <View style={styles.header}>
          {/* Close Button (Left Side) */}
          <TouchableOpacity onPress={() => props.navigation.closeDrawer()} style={styles.closeButton}>
            <MaterialIcons name="close" size={28} color="black" />
          </TouchableOpacity>

          {/* Logo (Right Side) */}
          <View style={styles.logoContainer}>
            <Image source={require("@/assets/images/image.png")} style={styles.logo} />
          </View>
        </View>

      {/* Menu Items */}
      <ScrollView style={styles.menuContainer}>
        <TouchableOpacity onPress={() => navigation.navigate("BDMHomeScreen")}>
          <Text style={styles.sectionTitle}>Home</Text>
        </TouchableOpacity>
        {menuItems.map((item) => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.screen as keyof RootStackParamList)}
          >
            <View style={styles.menuItemContent}>
              <MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={24} color={item.color} />
              <Text style={styles.menuText}>{item.title}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      </DrawerContentScrollView>

      {/* Logout Button */}
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 10,
  },
  drawerContent: { paddingHorizontal: 15 },
  /** Header Section **/
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", // Space between Close Button & Logo
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  
  /** Close Button (Left Side) **/
  closeButton: {
    position: "relative",
  },
  /** Logo (Right Side) **/
  logoContainer: {
    alignItems: "flex-end",
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },
  menuContainer: {
    flex: 1,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    color: "#9C9C9C",
    marginBottom: 5,
    fontFamily: "LexendDeca_400Regular",
    
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
  },
  logoutButton: {
    margin: 20,
    backgroundColor: '#FF8447',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
  },
});

export default BDMDrawer;
