import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking, Share, Animated, Alert, Modal, TextInput } from 'react-native';
import ViewShot, { ViewShotProperties } from 'react-native-view-shot';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Animatable from "react-native-animatable";
import { useNavigation } from "@react-navigation/native";
import BDMMainLayout from "@/app/components/BDMMainLayout";
import { auth, db } from "@/firebaseConfig";
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useProfile } from '@/app/context/ProfileContext';
import AppGradient from '@/app/components/AppGradient';
import * as ImagePicker from 'expo-image-picker';

interface UserProfile {
  firstName: string;
  lastName: string;
  designation: string;
  phoneNumber: string;
  email: string;
  profileImage?: string;
  dateOfBirth: Date;
  profileImageUrl: string | null;
  address?: string;
  companyName?: string;
  website?: string;
  tollFreeNumber?: string;
  companyLogo?: string;
}

const BDMVirtualBusinessCard = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const viewShotRef = useRef<ViewShot | null>(null); 
  const navigation = useNavigation();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { profileImage } = useProfile();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [tollFreeNumber, setTollFreeNumber] = useState('18001200771');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editLabel, setEditLabel] = useState('');
  
  // Fetch user profile data with real-time updates
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setIsLoading(true);
        const userId = auth.currentUser?.uid;
        if (!userId) {
          setError('User not authenticated');
          setIsLoading(false);
          return;
        }

        // Get user document from users collection
        const userDocRef = doc(db, 'users', userId);
        
        // Set up real-time listener for updates
        const unsubscribe = onSnapshot(userDocRef, (doc) => {
          if (!doc.exists()) {
            setError('User profile not found');
            setIsLoading(false);
            return;
          }

          const userData = doc.data();
          const fullName = userData.name || '';
          const nameParts = fullName.split(' ');
          
          setUserProfile({
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            designation: userData.designation || 'Business Development Manager',
            phoneNumber: userData.phoneNumber || '',
            email: userData.email || auth.currentUser?.email || '',
            profileImage: userData.profileImageUrl,
            dateOfBirth: userData.dateOfBirth || new Date(),
            profileImageUrl: userData.profileImageUrl,
            address: userData.address,
            companyName: userData.companyName,
            website: userData.website,
            tollFreeNumber: userData.tollFreeNumber || '18001200771',
            companyLogo: userData.companyLogo,
          });
          
          setIsLoading(false);
        }, (error) => {
          console.error('Error in profile listener:', error);
          setError('Failed to load profile data');
          setIsLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setError('Failed to load profile data');
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  // Animate Card Entry
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Share Business Card
  const handleShare = async () => {
    try {
      if (viewShotRef.current) {
        const uri = await viewShotRef.current.capture?.();
        if (uri) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png' });
        } else {
          Alert.alert('Error', 'Unable to capture business card');
        }
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
      if (viewShotRef.current) {
        const uri = await viewShotRef.current.capture?.();
        if (uri) {
          const fileUri = `${FileSystem.documentDirectory}business_card.png`;

          //save captured image to file system
          await FileSystem.moveAsync({
            from: uri,
            to: fileUri,
          });

          //Request permission to save image
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
      } else {
        Alert.alert('Error', 'Unable to capture business card');
      }
    } catch (error) {
      console.error('Error downloading the business card:', error);
      Alert.alert('Download Failed', 'Something went wrong while saving the image.');
    }
  };

  // Add this function to handle logo selection
  const handleLogoSelection = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setCompanyLogo(result.assets[0].uri);
        // Update Firestore with new logo
        if (auth.currentUser?.uid) {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            companyLogo: result.assets[0].uri
          });
        }
      }
    } catch (error) {
      console.error('Error selecting logo:', error);
      Alert.alert('Error', 'Failed to update logo');
    }
  };

  // Function to open edit modal for any field
  const openEditModal = (field: string, value: string, label: string) => {
    setEditingField(field);
    setEditValue(value);
    setEditLabel(label);
    setIsEditModalVisible(true);
  };

  // Function to handle field updates
  const handleFieldUpdate = async () => {
    try {
      if (auth.currentUser?.uid && editingField) {
        const updateData: any = {};
        
        // Map the editing field to the correct Firestore field
        switch (editingField) {
          case 'firstName':
            updateData.name = `${editValue} ${userProfile?.lastName || ''}`;
            break;
          case 'lastName':
            updateData.name = `${userProfile?.firstName || ''} ${editValue}`;
            break;
          case 'designation':
            updateData.designation = editValue;
            break;
          case 'phoneNumber':
            updateData.phoneNumber = editValue;
            break;
          case 'email':
            updateData.email = editValue;
            break;
          case 'website':
            updateData.website = editValue;
            break;
          case 'address':
            updateData.address = editValue;
            break;
          case 'tollFreeNumber':
            updateData.tollFreeNumber = editValue;
            break;
          default:
            break;
        }
        
        await updateDoc(doc(db, 'users', auth.currentUser.uid), updateData);
        setIsEditModalVisible(false);
        Alert.alert('Success', `${editLabel} updated successfully`);
      }
    } catch (error) {
      console.error(`Error updating ${editingField}:`, error);
      Alert.alert('Error', `Failed to update ${editLabel}`);
    }
  };

  // Add this useEffect to load initial values
  useEffect(() => {
    if (userProfile) {
      setTollFreeNumber(userProfile.tollFreeNumber || '18001200771');
      setCompanyLogo(userProfile.companyLogo || null);
    }
  }, [userProfile]);

  if (isLoading) {
    return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading business card...</Text>
        </View>
    );
  }

  if (error) {
    return (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
    );
  }

  return (
    <AppGradient>
    <BDMMainLayout title="Virtual Business Card" showBackButton showDrawer={true}>
      <View style={styles.container}>
        {/* Capture Card for Sharing */}
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            {/* Card Top with Wavy Background */}
            <View style={styles.cardTop}>
              <Svg width={300} height={120} viewBox="0 0 300 100" style={styles.wavyBackground}>
                <Path fill="#FCE8DC" d="M0,0 C100,100 200,-50 300,0 L300,100 L0,100 Z" />
              </Svg>
              <TouchableOpacity onPress={handleLogoSelection}>
                <Image 
                  source={companyLogo ? { uri: companyLogo } : require("@/assets/images/policy_planner_logo.png")} 
                  style={styles.logo} 
                />
              </TouchableOpacity>
            </View>

            {/* Business Card Details */}
            <TouchableOpacity onPress={() => openEditModal('firstName', userProfile?.firstName || '', 'First Name')}>
              <Text style={styles.name}>
                {userProfile?.firstName || ''} <Text style={styles.highlight}>{userProfile?.lastName || ''}</Text>
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openEditModal('designation', userProfile?.designation || '', 'Designation')}>
              <Text style={styles.designation}>{userProfile?.designation || ''}</Text>
            </TouchableOpacity>

            {/* Contact Details */}
            <View style={styles.infoContainer}>
              <TouchableOpacity style={styles.infoRow} onPress={() => openEditModal('phoneNumber', userProfile?.phoneNumber || '', 'Phone Number')}>
                <MaterialIcons name="phone" size={20} color="#ff7b42" />
                <Text style={styles.infoText}>{userProfile?.phoneNumber || 'Not provided'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.infoRow} onPress={() => openEditModal('email', userProfile?.email || '', 'Email')}>
                <MaterialIcons name="email" size={20} color="#ff7b42" />
                <Text style={styles.infoText}>{userProfile?.email || 'Not provided'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.infoRow} onPress={() => openEditModal('website', userProfile?.website || '', 'Website')}>
                <MaterialIcons name="language" size={20} color="#ff7b42" />
                <Text style={[styles.infoText, styles.website]} onPress={() => Linking.openURL("https://www.policyplanner.com")}>
                  {userProfile?.website || 'www.policyplanner.com'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.infoRow} onPress={() => openEditModal('address', userProfile?.address || '', 'Address')}>
                <MaterialIcons name="location-on" size={20} color="#ff7b42" />
                <Text style={styles.infoText}>
                  {userProfile?.address || 'Office No. B-03, KPCT Mall, Near Vishal Mega Mart, Fatima Nagar, Wanawadi, Pune 411013.'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.infoRow} onPress={() => openEditModal('tollFreeNumber', tollFreeNumber, 'Toll-free Number')}>
                <MaterialIcons name="phone" size={20} color="#ff7b42" />
                <Text style={styles.infoText}>{tollFreeNumber}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bottomLine} />
          </Animated.View>
        </ViewShot>

        {/* Share & Download Buttons */}
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

        {/* Edit Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isEditModalVisible}
          onRequestClose={() => setIsEditModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit {editLabel}</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{editLabel}</Text>
                <TextInput
                  style={styles.input}
                  value={editValue}
                  onChangeText={setEditValue}
                  placeholder={`Enter ${editLabel.toLowerCase()}`}
                  keyboardType={editingField === 'email' ? 'email-address' : 'default'}
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]} 
                  onPress={() => setIsEditModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]} 
                  onPress={handleFieldUpdate}
                >
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF0000',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
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
    alignSelf: "flex-start",
    top: -10,
    left: 0,
    width: '100%',
    height: '100%',
    transform: [{ rotate: '180deg' }],
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
    top: 45,
  },
  highlight: {
    color: '#EC691F',
    fontSize: 20,
    fontFamily: "Inter_400Regular",
    top: 40,
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
    marginTop: 15,
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
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    alignSelf: "center",
  },
  editIcon: {
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "LexendDeca_600SemiBold",
    color: '#262626',
    marginBottom: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    width: '45%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f2f2f2',
  },
  saveButton: {
    backgroundColor: '#ff7b42',
  },
  buttonText: {
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: '#fff',
  },
});

export default BDMVirtualBusinessCard;
