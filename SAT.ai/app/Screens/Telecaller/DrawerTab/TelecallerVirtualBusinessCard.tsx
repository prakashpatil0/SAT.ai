import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking, Share, Animated, Alert } from 'react-native';
import ViewShot, { ViewShotProperties } from 'react-native-view-shot';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Animatable from "react-native-animatable";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import AppGradient from '@/app/components/AppGradient';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';
import { useProfile } from '@/app/context/ProfileContext';

interface UserProfile {
  name: string;
  designation: string;
  phoneNumber: string;
  email: string;
  dateOfBirth: Date;
  profileImageUrl: string | null;
  address?: string;
  companyName?: string;
  website?: string;
}

const VirtualBusinessCard = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const viewShotRef = useRef<ViewShot>(null); 
  const navigation = useNavigation();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { profileImage } = useProfile();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          setError('User not authenticated');
          return;
        }

        const userDocRef = doc(db, 'users', userId);
        
        const unsubscribe = onSnapshot(userDocRef, (doc) => {
          if (!doc.exists()) {
            setError('User profile not found');
            return;
          }

          const userData = doc.data();
          setUserProfile({
            name: userData.name || '',
            designation: userData.designation || 'Telecaller',
            phoneNumber: userData.phoneNumber || '',
            email: userData.email || auth.currentUser?.email || '',
            dateOfBirth: userData.dateOfBirth?.toDate() || new Date(),
            profileImageUrl: userData.profileImageUrl || null,
            address: userData.address || 'Office No. B-03, KPCT Mall, Near Vishal Mega Mart, Fatima Nagar, Wanawadi, Pune 411013.',
            companyName: userData.companyName || 'Policy Planner',
            website: userData.website || 'www.policyplanner.com'
          });
        }, (error) => {
          console.error('Error in profile listener:', error);
          setError('Failed to load profile data');
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setError('Failed to load profile data');
      }
    };

    fetchUserProfile();
  }, []);

  // Animate Card Entry
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Share Business Card
  const handleShare = async () => {
    try {
      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      } else {
        Alert.alert('Error', 'Unable to capture business card');
      }
    } catch (error) {
      console.error('Error sharing the business card:', error);
      Alert.alert('Error', 'Failed to share business card');
    }
  };

  // Download Business Card
  const handleDownload = async () => {
    try {
      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        const fileUri = `${FileSystem.documentDirectory}business_card.png`;

        await FileSystem.moveAsync({
          from: uri,
          to: fileUri,
        });

        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(fileUri);
          Alert.alert('Download Successful', 'Your business card has been saved to your gallery.');
        } else {
          Alert.alert('Permission Denied', 'Allow access to save images.');
        }
      } else {
        Alert.alert('Error', 'Unable to capture business card');
      }
    } catch (error) {
      console.error('Error downloading the business card:', error);
      Alert.alert('Download Failed', 'Something went wrong while saving the image.');
    }
  };

  if (error) {
    return (
      <AppGradient>
        <TelecallerMainLayout showDrawer showBottomTabs={true} showBackButton={true} title='Virtual Business Card'>
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </TelecallerMainLayout>
      </AppGradient>
    );
  }

  if (!userProfile) {
    return (
      <AppGradient>
        <TelecallerMainLayout showDrawer showBottomTabs={true} showBackButton={true} title='Virtual Business Card'>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </TelecallerMainLayout>
      </AppGradient>
    );
  }

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBottomTabs={true} showBackButton={true} title='Virtual Business Card'>
        <View style={styles.container}>
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
            <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
              <View style={styles.cardTop}>
                <LinearGradient
                  colors={['#FCE8DC', '#FFFFFF']}
                  style={styles.wavyBackground}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Image 
                  source={userProfile?.profileImageUrl ? { uri: userProfile.profileImageUrl } : require("@/assets/images/policy_planner_logo.png")} 
                  style={styles.logo} 
                />
              </View>

              <Text style={styles.name}>
                {userProfile?.name}
              </Text>
              <Text style={styles.designation}>{userProfile?.designation}</Text>

              <View style={styles.infoContainer}>
                <View style={styles.infoRow}>
                  <MaterialIcons name="phone" size={20} color="#ff7b42" />
                  <Text style={styles.infoText}>{userProfile?.phoneNumber || 'Not provided'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="email" size={20} color="#ff7b42" />
                  <Text style={styles.infoText}>{userProfile?.email || 'Not provided'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="language" size={20} color="#ff7b42" />
                  <Text style={[styles.infoText, styles.website]} onPress={() => Linking.openURL(userProfile?.website || "https://www.policyplanner.com")}>
                    {userProfile?.website}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="location-on" size={20} color="#ff7b42" />
                  <Text style={styles.infoText}>{userProfile?.address}</Text>
                </View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="phone" size={20} color="#ff7b42" />
                  <Text style={styles.infoText}>18001200771</Text>
                </View>
              </View>
              <View style={styles.bottomLine} />
            </Animated.View>
          </ViewShot>

          <Animatable.View animation="pulse" iterationCount="infinite" duration={1500}>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                <Feather name="share-2" size={24} color="#333" />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            
              <TouchableOpacity style={styles.actionButton} onPress={handleDownload}>
                <Feather name="download" size={24} color="#333" />
                <Text style={styles.actionText}>Download</Text>
              </TouchableOpacity>
            </View>
          </Animatable.View>
        </View>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    // alignItems: 'center',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  headerText: {
    fontSize: 20,
    fontFamily: "LexendDeca_600SemiBold",
    color: '#262626',
    textAlign: "center",
    position: "absolute",
    marginLeft: 80,
    
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 20,
    padding: 0,
    width: 300,
    height: 430,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    // left: 8,
    marginLeft: 30,
    justifyContent: "center",
    top: 10,
  },
  cardTop: {
    alignItems: "flex-start",
    marginBottom: 20,
  },
  wavyBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  logo: {
    width: 120,
    height: 100,
    resizeMode: 'contain',
    alignSelf: "flex-start",
    marginLeft: 20,
  },
  name: {
    fontSize: 20,
    fontFamily: "Inter_400Regular",
    textAlign: "left",
    color: '#004a77',
    marginLeft: 20,
    marginTop: 5,
  },
  designation: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: 'left',
    color: '#161616',
    marginBottom: 10,
    marginLeft: 20,
  },
  infoContainer: {
    marginTop: 10,
    marginLeft: 20,
    marginRight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 10,
  },
  infoText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: '#333',
    marginLeft: 8,
  },
  website: {
    color: '#007aff',
    textDecorationLine: 'underline',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 15,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: '#5F6368',
    marginTop: 5,
  },
  bottomLine: {
    height: 10,
    backgroundColor: '#EC691F', 
    width: 300,
    marginTop: 0, 
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    alignSelf: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF0000',
    textAlign: 'center',
    padding: 20,
  },
});
export default VirtualBusinessCard;
