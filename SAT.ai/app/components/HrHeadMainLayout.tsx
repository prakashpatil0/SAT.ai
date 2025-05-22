import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useProfile } from '@/app/context/ProfileContext';
import { LinearGradient } from 'expo-linear-gradient';
import HrBottomTabs from '@/app/HRMS/HrBottomTabs';
import AppGradient from './AppGradient';
import { storage } from '@/firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';

type HrHeadMainLayoutProps = {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  showDrawer?: boolean;
  showBottomTabs?: boolean;
  rightComponent?: React.ReactNode;
};

const HrHeadMainLayout: React.FC<HrHeadMainLayoutProps> = ({
  children,
  title,
  showBackButton = true,
  showDrawer = true,
  showBottomTabs = false,
  rightComponent,
}) => {
  const navigation = useNavigation();
  const { userProfile, profileImage } = useProfile();
  const [firebaseProfileImage, setFirebaseProfileImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProfileImage = async () => {
      try {
        setIsLoading(true);
        // First try to use the profileImage from context if available
        if (profileImage) {
          console.log('Using profile image from context:', profileImage);
          setFirebaseProfileImage(profileImage);
          setIsLoading(false);
          return;
        }
        
        // If no profileImage in context, try to get from userProfile
        if (userProfile?.profileImageUrl) {
          console.log('Using profile image from userProfile:', userProfile.profileImageUrl);
          setFirebaseProfileImage(userProfile.profileImageUrl);
          setIsLoading(false);
          return;
        }
        
        // If no profile image URL in userProfile, try to get default from Firebase Storage
        try {
          console.log('Attempting to load default profile image from Firebase Storage');
          const defaultImageRef = ref(storage, 'assets/person.png')
          const url = await getDownloadURL(defaultImageRef);
          console.log('Successfully loaded default profile image URL:', url);
          setFirebaseProfileImage(url);
        } catch (error: any) {
          console.error('Error loading default profile image:', error);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          // If Firebase Storage fails, set to null
          setFirebaseProfileImage(null);
        }
      } catch (error) {
        console.error('Error in loadProfileImage:', error);
        setFirebaseProfileImage(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileImage();
  }, [userProfile, profileImage]);

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
            onPress={() => navigation.navigate('HrHeadProfile' as never)}
            style={styles.profileButton}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FF8447" style={styles.profileImage} />
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
          <View style={styles.rightContainer}>
            {rightComponent}
          </View>
        </View>
      </View>

      {/* <AppGradient> */}
        {children}
      {/* </AppGradient> */}

      {showBottomTabs && <HrBottomTabs />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: 'transparent',
    paddingTop: 20,
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
  rightContainer: {
    width: 40,
    alignItems: 'flex-end',
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
});

export default HrHeadMainLayout; 