import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text, SafeAreaView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useProfile } from '@/app/context/ProfileContext';
import { LinearGradient } from 'expo-linear-gradient';
import TelecallerBottomTabs from '@/app/components/TelecallerBottomTabs';
import AppGradient from './AppGradient';
import { storage } from '@/firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';

type TelecallerMainLayoutProps = {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  showDrawer?: boolean;
  showBottomTabs?: boolean;
  rightComponent?: React.ReactNode; // ✅ updated
};


const TelecallerMainLayout: React.FC<TelecallerMainLayoutProps> = ({
  children,
  title,
  showBackButton = true,
  showDrawer = true,
  showBottomTabs = true,
  rightComponent, // ✅ updated
}) => {

  const navigation = useNavigation();
  const { userProfile, profilePhotoUri } = useProfile();
  const [defaultProfileImage, setDefaultProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDefaultProfileImage();
  }, []);

  const loadDefaultProfileImage = async () => {
    try {
      console.log('Loading default profile image from Firebase Storage');
      const imageRef = ref(storage, 'assets/girl.png');
      const url = await getDownloadURL(imageRef);
      console.log('Successfully loaded default profile image URL:', url);
      setDefaultProfileImage(url);
    } catch (error) {
      console.error('Error loading default profile image:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get the profile image from multiple possible sources
  const profileImage = userProfile?.profileImageUrl || profilePhotoUri || defaultProfileImage;

  return (
    <SafeAreaView style={styles.safeArea}>
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
              onPress={() => navigation.navigate('Profile' as never)}
              style={styles.profileButton}
            >
              {loading ? (
                <View style={[styles.profileImage, { justifyContent: 'center', alignItems: 'center' }]}>
                  <MaterialIcons name="person" size={24} color="#999" />
                </View>
              ) : (
                <Image 
                  source={profileImage ? { uri: profileImage } : { uri: defaultProfileImage || '' }} 
                  style={styles.profileImage}
                />
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

        <View style={styles.contentContainer}>
          <AppGradient style={styles.gradientContainer}>
            {children}
          </AppGradient>
        </View>

        {showBottomTabs && (
          <View style={styles.bottomTabsContainer}>
            <TelecallerBottomTabs />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

// Same styles as BDMMainLayout but with fixed bottom tabs
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: 20,
    backgroundColor: 'transparent',
    zIndex: 10,
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
    backgroundColor: '#F8F8F8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
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
  leftContainer: {
    width: 40,
  },
  rightContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
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

export default TelecallerMainLayout; 