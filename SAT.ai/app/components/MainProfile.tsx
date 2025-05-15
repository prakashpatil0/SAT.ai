import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  Alert,
  Animated,
  ActivityIndicator,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import BDMMainLayout from "@/app/components/BDMMainLayout";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import { auth, db, storage } from "@/firebaseConfig";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { LinearGradient } from 'expo-linear-gradient';
import { useProfile } from '@/app/context/ProfileContext';
import FormInput from "@/app/components/FormInput";
import AppGradient from "@/app/components/AppGradient";
import WaveSkeleton from '@/app/components/WaveSkeleton';

const { width } = Dimensions.get('window');

type ProfileImage = {
  uri: string;
} | {
  uri?: undefined;
  default: number;
};

interface User {
  id: string;
  name: string;
  designation: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: Date;
  profileImageUrl: string | null;
}

interface DateTimePickerEvent {
  type: string;
  nativeEvent: {
    timestamp: number;
  };
}

const ProfileSkeleton = () => {
  return (
    <View style={styles.skeletonContainer}>
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#FF8447', '#FF6D24']}
          style={styles.headerGradient}
        >
          <WaveSkeleton 
            width={120} 
            height={120} 
            style={styles.profileImageSkeleton} 
          />
          <WaveSkeleton 
            width={200} 
            height={24} 
            style={styles.skeletonText} 
          />
          <WaveSkeleton 
            width={150} 
            height={16} 
            style={styles.skeletonText} 
          />
        </LinearGradient>
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <WaveSkeleton width={200} height={24} />
          </View>
          <View style={styles.formContainer}>
            <WaveSkeleton width="100%" height={60} style={styles.inputSkeleton} />
            <WaveSkeleton width="100%" height={60} style={styles.inputSkeleton} />
            <WaveSkeleton width="100%" height={60} style={styles.inputSkeleton} />
            <WaveSkeleton width="100%" height={60} style={styles.inputSkeleton} />
            <WaveSkeleton width="100%" height={60} style={styles.inputSkeleton} />
          </View>
        </View>
      </View>
    </View>
  );
};

const ProfileScreen = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { profileImage: contextProfileImage, updateProfileImage } = useProfile();
  const [role, setRole] = useState<'BDM' | 'Telecaller'>('BDM'); // Default to BDM, will fetch from Firestore
  const [formData, setFormData] = useState<User>({
    id: '',
    name: '',
    designation: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: new Date(),
    profileImageUrl: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [profileImage, setProfileImage] = useState<ProfileImage>({ uri: '' });
  const [errors, setErrors] = useState({
    name: '',
    phoneNumber: ''
  });
  const [touched, setTouched] = useState({
    name: false,
    phoneNumber: false
  });

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Calculated animation values
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [250, 150],
    extrapolate: 'clamp'
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.8],
    extrapolate: 'clamp'
  });

  // Fetch user profile and role
  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Update profile image when context changes
  useEffect(() => {
    if (contextProfileImage) {
      setProfileImage({ uri: contextProfileImage });
    }
  }, [contextProfileImage]);

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const userRole = data.designation === 'BDM' ? 'BDM' : 'Telecaller';
        setRole(userRole);
        setFormData({
          id: userId,
          name: data.name || "",
          designation: data.designation || userRole,
          email: data.email || auth.currentUser?.email || "",
          phoneNumber: data.phoneNumber || "",
          dateOfBirth: data.dateOfBirth?.toDate() || new Date(),
          profileImageUrl: data.profileImageUrl || "",
        });
        if (data.profileImageUrl) {
          try {
            const response = await fetch(data.profileImageUrl);
            if (response.ok) {
              setProfileImage({ uri: data.profileImageUrl });
              updateProfileImage?.(data.profileImageUrl);
            } else {
              loadDefaultImage(userRole);
            }
          } catch (error) {
            loadDefaultImage(userRole);
          }
        } else {
          loadDefaultImage(userRole);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setTimeout(() => setIsLoading(false), 1000);
    }
  };

  const loadDefaultImage = async (userRole: 'BDM' | 'Telecaller') => {
    try {
      const defaultImagePath = userRole === 'BDM' ? 'assets/person.png' : 'assets/girl.png';
      const defaultImageRef = ref(storage, defaultImagePath);
      const url = await getDownloadURL(defaultImageRef);
      setProfileImage({ uri: url });
    } catch (error) {
      console.error("Error loading default profile image:", error);
      setProfileImage({ uri: '' });
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("User not authenticated");

      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `profileImages/${userId}/profile_${Date.now()}.jpg`);
      const uploadResult = await uploadBytes(storageRef, blob);
      return await getDownloadURL(uploadResult.ref);
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  };

  const validateName = (text: string) => {
    setFormData(prev => ({ ...prev, name: text }));
    if (!touched.name) return true;

    if (text.trim().length < 3) {
      setErrors(prev => ({ ...prev, name: "Name must be at least 3 characters" }));
      return false;
    } else {
      setErrors(prev => ({ ...prev, name: "" }));
      return true;
    }
  };

  const validatePhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, phoneNumber: cleaned }));
    if (!touched.phoneNumber) return true;

    if (cleaned.length < 10) {
      setErrors(prev => ({ ...prev, phoneNumber: "Phone number must be at least 10 digits" }));
      return false;
    } else {
      setErrors(prev => ({ ...prev, phoneNumber: "" }));
      return true;
    }
  };

  const handleBlur = (field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    if (field === 'name') validateName(formData.name);
    else if (field === 'phoneNumber') validatePhoneNumber(formData.phoneNumber);
  };

  const handleSaveChanges = async () => {
    try {
      const isNameValid = validateName(formData.name);
      const isPhoneValid = validatePhoneNumber(formData.phoneNumber);
      if (!isNameValid || !isPhoneValid) return;

      setIsSaving(true);
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Error", "Please login to update profile");
        return;
      }

      let profileImageUrl = formData.profileImageUrl;
      if ('uri' in profileImage && profileImage.uri && profileImage.uri !== formData.profileImageUrl) {
        profileImageUrl = await uploadImage(profileImage.uri);
      }

      const userRef = doc(db, "users", userId);
      const updateData = {
        name: formData.name,
        designation: formData.designation,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        updatedAt: serverTimestamp(),
        profileImageUrl: profileImageUrl || formData.profileImageUrl
      };

      await setDoc(userRef, updateData, { merge: true });
      if (profileImageUrl && updateProfileImage) {
        updateProfileImage(profileImageUrl);
      }

      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      console.error("Save changes error:", error);
      Alert.alert("Error", "Failed to update profile. Please check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleShowDatePicker = () => {
    setShowDatePicker(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'android' ? false : showDatePicker);
    if (selectedDate) {
      setFormData(prev => ({ ...prev, dateOfBirth: selectedDate }));
    }
    if (Platform.OS === 'ios') setShowDatePicker(false);
  };

  const openImagePicker = () => {
    Alert.alert("Upload Profile Picture", "Choose an option", [
      { text: "Take Photo", onPress: handleOpenCamera },
      { text: "Choose from Gallery", onPress: handleImagePicker },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleImagePicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "You need to allow access to the gallery.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
      selectionLimit: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      setProfileImage({ uri: result.assets[0].uri });
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  };

  const handleOpenCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "You need to allow access to the camera.");
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      setProfileImage({ uri: result.assets[0].uri });
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString(undefined, options);
  };

  const Layout = role === 'BDM' ? BDMMainLayout : TelecallerMainLayout;

  if (isLoading) {
    return (
      <AppGradient>
        <Layout title="Profile" showBackButton showDrawer={role === 'BDM'}>
          <ProfileSkeleton />
        </Layout>
      </AppGradient>
    );
  }

  return (
    <AppGradient>
      <Layout
        title="Profile"
        showBackButton
        showDrawer={role === 'BDM'}
        
        rightComponent={
          <TouchableOpacity
            onPress={() => setIsEditing(!isEditing)}
            style={styles.editButton}
          >
            <MaterialIcons
              name={isEditing ? "close" : "edit"}
              size={24}
              color="#FF8447"
            />
          </TouchableOpacity>
        }
      >
        <Animated.ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
        >
          {/* Profile Header */}
          <Animated.View style={[
            styles.headerContainer,
            { height: headerHeight, opacity: headerOpacity }
          ]}>
            <LinearGradient
              colors={['#FF8447', '#FF6D24']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <TouchableWithoutFeedback onPress={isEditing ? openImagePicker : undefined}>
                <Animated.View style={[
                  styles.profileImageContainer,
                  { transform: [{ scale: scaleAnim }] }
                ]}>
                  {profileImage.uri ? (
                    <Image
                      source={{ uri: profileImage.uri }}
                      style={styles.profileImage}
                    />
                  ) : (
                    <View style={[styles.profileImage, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                      <MaterialIcons name="person" size={40} color="#999" />
                    </View>
                  )}
                  {isEditing && (
                    <View style={styles.editIconContainer}>
                      <MaterialIcons name="camera-alt" size={18} color="#FFF" />
                    </View>
                  )}
                </Animated.View>
              </TouchableWithoutFeedback>
              <Text style={styles.profileName}>
                {formData.name || 'Your Name'}
              </Text>
              <Text style={styles.profileRole}>
                {formData.designation || (role === 'BDM' ? 'Business Development Manager' : 'Telecaller')}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Profile Content */}
          <View style={styles.contentContainer}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="person" size={22} color="#FF8447" />
                <Text style={styles.sectionTitle}>Personal Information</Text>
              </View>

              <View style={styles.formContainer}>
                {isEditing ? (
                  <>
                    <FormInput
                      label="Full Name"
                      value={formData.name}
                      onChangeText={validateName}
                      onBlur={() => handleBlur('name')}
                      error={touched.name ? errors.name : undefined}
                      leftIcon="account"
                    />
                    <FormInput
                      label="Designation"
                      value={formData.designation}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, designation: text }))}
                      leftIcon="briefcase"
                      disabled={role === 'BDM'}
                    />
                    <FormInput
                      label="Email"
                      value={formData.email}
                      onChangeText={() => {}}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      leftIcon="email"
                      autoComplete="email"
                      disabled
                    />
                    <FormInput
                      label="Phone Number"
                      value={formData.phoneNumber}
                      onChangeText={validatePhoneNumber}
                      onBlur={() => handleBlur('phoneNumber')}
                      error={touched.phoneNumber ? errors.phoneNumber : undefined}
                      keyboardType="phone-pad"
                      leftIcon="phone"
                      autoComplete="tel"
                    />
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={handleShowDatePicker}
                    >
                      <View style={styles.datePickerContent}>
                        <MaterialIcons name="calendar-today" size={24} color="#777" style={styles.dateIcon} />
                        <View>
                          <Text style={styles.datePickerLabel}>Date of Birth</Text>
                          <Text style={styles.datePickerValue}>
                            {formatDate(formData.dateOfBirth)}
                          </Text>
                        </View>
                        <MaterialIcons name="arrow-drop-down" size={24} color="#FF8447" />
                      </View>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={formData.dateOfBirth}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={handleDateChange}
                        maximumDate={new Date()}
                        minimumDate={new Date(1950, 0, 1)}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <View style={styles.infoRow}>
                      <MaterialIcons name="person" size={24} color="#FF8447" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Full Name</Text>
                        <Text style={styles.infoValue}>{formData.name || 'Not provided'}</Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <MaterialIcons name="work" size={24} color="#FF8447" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Designation</Text>
                        <Text style={styles.infoValue}>{formData.designation || 'Not provided'}</Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <MaterialIcons name="email" size={24} color="#FF8447" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Email</Text>
                        <Text style={styles.infoValue}>{formData.email || 'Not provided'}</Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <MaterialIcons name="phone" size={24} color="#FF8447" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Phone Number</Text>
                        <Text style={styles.infoValue}>{formData.phoneNumber || 'Not provided'}</Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <MaterialIcons name="calendar-today" size={24} color="#FF8447" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Date of Birth</Text>
                        <Text style={styles.infoValue}>
                          {formData.dateOfBirth ? formatDate(formData.dateOfBirth) : 'Not provided'}
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>

            {isEditing && (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveChanges}
                disabled={isSaving}
              >
                <LinearGradient
                  colors={['#FF8447', '#FF6D24']}
                  style={styles.saveGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            <View style={styles.spacer} />
          </View>
        </Animated.ScrollView>
      </Layout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  headerContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  headerGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'white',
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  editIconContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#FF8447',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileName: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: 'white',
    marginTop: 16,
  },
  profileRole: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: 'white',
    marginTop: 4,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#FFF5E6',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF8447',
    marginLeft: 10,
  },
  formContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  datePickerButton: {
    marginTop: 8,
    marginBottom: 8,
  },
  datePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    padding: 12,
  },
  dateIcon: {
    marginRight: 12,
    color: '#FF8447',
  },
  datePickerLabel: {
    fontSize: 12,
    color: '#FF8447',
    fontFamily: 'LexendDeca_400Regular',
  },
  datePickerValue: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'LexendDeca_400Regular',
  },
  saveButton: {
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 16,
    elevation: 4,
    shadowColor: '#FF8447',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  saveGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF8447',
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
  },
  spacer: {
    height: 40,
  },
  editButton: {
    padding: 8,
    backgroundColor: '#FFF5E6',
    borderRadius: 8,
  },
  skeletonContainer: {
    flex: 1,
  },
  profileImageSkeleton: {
    borderRadius: 60,
    marginBottom: 16,
  },
  skeletonText: {
    borderRadius: 4,
    marginVertical: 4,
  },
  inputSkeleton: {
    borderRadius: 8,
    marginVertical: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
});

export default ProfileScreen;