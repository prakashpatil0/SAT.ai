import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { getAuth, signOut } from 'firebase/auth';
import { BDMStackParamList } from '@/app/index';

const BDMDrawer = (props: DrawerContentComponentProps) => {
  const navigation = useNavigation();
  const auth = getAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Logout',
          onPress: async () => {
            try {
              await signOut(auth);
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' as never }]
              });
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
  };

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
        <View style={styles.menuSection}>
          <TouchableOpacity onPress={() => props.navigation.navigate('BDMHomeScreen')}>
            <Text style={styles.sectionTitle}>Home</Text>
          </TouchableOpacity>
          
          <DrawerItem
            label="Profile"
            icon={() => <MaterialCommunityIcons name="account-circle" size={24} color="#09142D" />}
            labelStyle={styles.menuText}
            onPress={() => props.navigation.navigate('BDMProfile')}
          />

          <DrawerItem
            label="Virtual Business Card"
            icon={() => <MaterialCommunityIcons name="card-account-details" size={24} color="#09142D" />}
            labelStyle={styles.menuText}
            onPress={() => props.navigation.navigate('BDMVirtualBusinessCard')}
          />

          <DrawerItem
            label="My Schedule"
            icon={() => <MaterialCommunityIcons name="calendar" size={24} color="#09142D" />}
            labelStyle={styles.menuText}
            onPress={() => props.navigation.navigate('BDMMyScheduleScreen')}
          />

          <DrawerItem
            label="My Notes"
            icon={() => <MaterialCommunityIcons name="note-text-outline" size={24} color="#09142D" />}
            labelStyle={styles.menuText}
            onPress={() => props.navigation.navigate('BDMMyNotesScreen')}
          />

          <DrawerItem
            label="Leaderboard"
            icon={() => <MaterialCommunityIcons name="podium" size={24} color="#09142D" />}
            labelStyle={styles.menuText}
            onPress={() => props.navigation.navigate('BDMLeaderBoard')}
          />
        </View>
      </DrawerContentScrollView>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <MaterialCommunityIcons name="logout" size={24} color="#FFFFFF" style={styles.logoutIcon} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#FFFFFF' 
  },
  drawerContent: { 
    paddingHorizontal: 15 
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  logoContainer: {
    alignItems: "flex-end",
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },
  menuSection: { 
    marginTop: 20 
  },
  sectionTitle: {
    fontSize: 14,
    color: '#9C9C9C',
    marginBottom: 5,
    fontFamily: "LexendDeca_400Regular",
    paddingHorizontal: 8,
  },
  menuText: {
    fontSize: 16,
    color: "#09142D",
    fontFamily: "LexendDeca_400Regular",
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#FF7F41",
    padding: 15,
    margin: 20,
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

export default BDMDrawer;
