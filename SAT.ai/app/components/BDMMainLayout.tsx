import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useProfile } from '@/app/context/ProfileContext';
import { LinearGradient } from 'expo-linear-gradient';
import BDMBottomTabs from '@/app/Screens/BDM/BDMBottomTabs';
import AppGradient from './AppGradient';
import { storage } from '@/firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';
import MeetingTickerPill from './MeetingTickerPill';

type BDMMainLayoutProps = {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  showDrawer?: boolean;
  showBottomTabs?: boolean;
  rightComponent?: React.ReactNode;
};

const BDMMainLayout: React.FC<BDMMainLayoutProps> = ({
  children,
  title,
  showBackButton = true,
  showDrawer = true,
  showBottomTabs = true,
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
        if (profileImage) {
          setFirebaseProfileImage(profileImage);
          setIsLoading(false);
          return;
        }
        
        if (userProfile?.profileImageUrl) {
          setFirebaseProfileImage(userProfile.profileImageUrl);
          setIsLoading(false);
          return;
        }
        
        try {
          const defaultImageRef = ref(storage, 'assets/person.png')
          const url = await getDownloadURL(defaultImageRef);
          setFirebaseProfileImage(url);
        } catch (error) {
          setFirebaseProfileImage(null);
        }
      } catch (error) {
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
        {/* Top Row - Drawer Menu, Meeting Pill, and Profile */}
        <View style={styles.topRow}>
          {showDrawer && (
            <TouchableOpacity 
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              style={styles.iconButton}
            >
              <MaterialIcons name="menu" size={24} color="#333" />
            </TouchableOpacity>
          )}
          <View style={styles.tickerPillWrapper}>
            <MeetingTickerPill role={userProfile?.role === 'telecaller' ? 'telecaller' : 'bdm'} />
          </View>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Profile' as never)}
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
                onPress={() => {
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                  }
                }}
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

      {showBottomTabs && <BDMBottomTabs />}
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
  tickerPillWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
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

export default BDMMainLayout;