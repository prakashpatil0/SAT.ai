import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useProfile } from '@/app/context/ProfileContext';
import BottomTabSwitcherComponent from '@/app/components/BottomTab/BottomTabSwitcher';
import AppGradient from '@/app/components/AppGradient';
import { storage } from '@/firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';

type MainLayoutProps = {
  children?: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  showDrawer?: boolean;
  showBottomTabs?: boolean;
  rightIcon?: React.ReactNode;
};

const MainLayoutSwitcher: React.FC<MainLayoutProps> = ({
  children,
  title,
  showBackButton = true,
  showDrawer = true,
  showBottomTabs = true,
  rightIcon,
}) => {
  const navigation = useNavigation();
  const { userProfile, profilePhotoUri } = useProfile();
  const [defaultProfileImage, setDefaultProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDefaultProfileImage = async () => {
      try {
        const imageRef = ref(storage, 'assets/girl.png');
        const url = await getDownloadURL(imageRef);
        setDefaultProfileImage(url);
      } catch (error) {
        console.error('Error loading default profile image:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDefaultProfileImage();
  }, []);

  const profileImage = userProfile?.profileImageUrl || profilePhotoUri || defaultProfileImage;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* HEADER */}
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
              onPress={() => navigation.navigate('Profile' as never)}
              style={styles.profileButton}
            >
              {loading ? (
                <View style={[styles.profileImage, { justifyContent: 'center', alignItems: 'center' }]}>
                  <MaterialIcons name="person" size={24} color="#999" />
                </View>
              ) : (
                <Image
                  source={{ uri: profileImage || '' }}
                  style={styles.profileImage}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Bottom Row - Back Button and Title */}
          <View style={styles.bottomRow}>
            <View style={styles.leftContainer}>
              {showBackButton && (
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                  <MaterialIcons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
              )}
            </View>
            {title && <Text style={styles.title}>{title}</Text>}
            <View style={styles.rightContainer}>{rightIcon}</View>
          </View>
        </View>

        {/* CONTENT */}
        <View style={styles.contentContainer}>
          <AppGradient style={styles.gradientContainer}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('DashboardDetails' as never)} // ⬅️ Replace with your actual target screen
            >
              {children ? (
                children
              ) : (
                <View style={styles.defaultContent}>
                  <Text>Tap anywhere to go to DashboardDetails</Text>
                </View>
              )}
            </TouchableOpacity>
          </AppGradient>
        </View>

        {/* BOTTOM TABS */}
        {showBottomTabs && (
          <View style={styles.bottomTabsContainer}>
            <BottomTabSwitcherComponent role="Telecaller" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: 'transparent',
    paddingTop: 20,
    zIndex: 10,
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
  iconButton: {
    padding: 4,
  },
  backButton: {
    padding: 4,
  },
  leftContainer: {
    width: 40,
  },
  rightContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  contentContainer: {
    flex: 1,
  },
  gradientContainer: {
    flex: 1,
  },
  bottomTabsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 10,
  },
  defaultContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MainLayoutSwitcher;
