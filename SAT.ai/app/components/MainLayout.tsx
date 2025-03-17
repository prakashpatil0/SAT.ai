import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useProfile } from '@/app/context/ProfileContext';
import { LinearGradient } from 'expo-linear-gradient';

type MainLayoutProps = {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  showDrawer?: boolean;
};

const MainLayout = ({ 
  children, 
  title, 
  showBackButton = false,
  showDrawer = true 
}: MainLayoutProps) => {
  const navigation = useNavigation();
  const { profileImage } = useProfile();

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        {/* Top Row - Drawer Menu and Profile */}
        <View style={styles.topRow}>
          {showDrawer && (
            <TouchableOpacity 
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              style={styles.iconButton}
            >
              <MaterialIcons name="menu" size={24} color="#333" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            onPress={() => navigation.navigate('Profile')}
            style={styles.profileButton}
          >
            <Image 
              source={{ uri: profileImage }} 
              style={styles.profileImage}
            />
          </TouchableOpacity>
        </View>

        {/* Bottom Row - Back Button and Title */}
        <View style={styles.bottomRow}>
          <View style={styles.leftContainer}>
            {showBackButton && (
              <TouchableOpacity 
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <MaterialIcons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
            )}
          </View>
          {title && (
            <Text style={styles.title}>{title}</Text>
          )}
          <View style={styles.rightPlaceholder} />
        </View>
      </View>

      <LinearGradient 
        colors={['#FFF8F0', '#FFF']} 
        style={styles.content}
      >
        {children}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: 'white',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    paddingTop: 40,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  leftContainer: {
    width: 40,
  },
  rightPlaceholder: {
    width: 40, // Same width as leftContainer for symmetry
  },
  iconButton: {
    padding: 4,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  profileButton: {
    width: 40,
    height: 40,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FF8447',
  },
  content: {
    flex: 1,
  },
});

export default MainLayout; 