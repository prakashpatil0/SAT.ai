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
  Switch,
  TouchableWithoutFeedback,
  TextInput
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import { auth, db, storage } from "@/firebaseConfig";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { LinearGradient } from 'expo-linear-gradient';
import AppGradient from "@/app/components/AppGradient";
import { useProfile } from '@/app/context/ProfileContext';
import FormInput from "@/app/components/FormInput";

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

const ProfileScreen = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { profileImage: contextProfileImage, updateProfileImage } = useProfile();
  const [formData, setFormData] = useState<User>({
    id: '',
    name: "",
    designation: "",
    email: "",
    phoneNumber: "",
    dateOfBirth: new Date(),
    profileImageUrl: "",
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [profileImage, setProfileImage] = useState<ProfileImage>({ 
    default: require("@/assets/images/girl.png") 
  });
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
  const profileOpacity = useRef(new Animated.Value(1)).current;
  
  // Calculated values
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

  // Add new state for manual date input
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualDate, setManualDate] = useState({
    day: '',
    month: '',
    year: ''
  });

  // Fetch existing profile data
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
        setFormData({
          id: userId,
          name: data.name || "",
          designation: data.role || "",
          email: data.email || auth.currentUser?.email || "",
          phoneNumber: data.phoneNumber || "",
          dateOfBirth: data.dateOfBirth?.toDate() || new Date(),
          profileImageUrl: data.profileImageUrl || "",
        });
        if (data.profileImageUrl) {
          setProfileImage({ uri: data.profileImageUrl });
          updateProfileImage?.(data.profileImageUrl);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setIsLoading(false);
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Convert image URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Create storage reference with user-specific path
      const storageRef = ref(storage, `users/${userId}/profile_${Date.now()}.jpg`);

      // Upload the image
      const uploadResult = await uploadBytes(storageRef, blob);

      // Get the download URL
      const downloadURL = await getDownloadURL(uploadResult.ref);

      return downloadURL;
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
    // Keep only numbers
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
    setTouched(prev => ({
      ...prev,
      [field]: true
    }));
    
    // Validate field on blur
    if (field === 'name') {
      validateName(formData.name);
    } else if (field === 'phoneNumber') {
      validatePhoneNumber(formData.phoneNumber);
    }
  };

  const handleSaveChanges = async () => {
    try {
      // Validate all fields
      const isNameValid = validateName(formData.name);
      const isPhoneNumberValid = validatePhoneNumber(formData.phoneNumber);
      
      if (!isNameValid || !isPhoneNumberValid) {
        return;
      }
      
      setIsSaving(true);
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Error", "Please login to update profile");
        return;
      }

      let profileImageUrl = formData.profileImageUrl;

      // Only attempt upload if there's a new image
      if ('uri' in profileImage && profileImage.uri && profileImage.uri !== formData.profileImageUrl) {
        try {
          profileImageUrl = await uploadImage(profileImage.uri);
        } catch (uploadError) {
          console.error("Profile image upload failed:", uploadError);
          Alert.alert(
            "Upload Error",
            "Failed to upload profile image. Please try again later."
          );
          return;
        }
      }

      // Update Firestore document
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
      
      // Update context and local state
      if (profileImageUrl && updateProfileImage) {
        updateProfileImage(profileImageUrl);
      }

      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      console.error("Save changes error:", error);
      Alert.alert(
        "Error",
        "Failed to update profile. Please check your connection and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleShowDatePicker = () => {
    setShowDatePicker(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'set' && selectedDate) {
      // Ensure the selected date is not in the future
      const maxDate = new Date();
      const finalDate = selectedDate > maxDate ? maxDate : selectedDate;
      setFormData(prev => ({ ...prev, dateOfBirth: finalDate }));
    }
    setShowDatePicker(Platform.OS === 'ios');
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
      
      // Animate the profile image
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };
  
  const handleOpenCamera = async () => {
    // Request camera permission
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "You need to allow access to the camera.");
      return;
    }
    
    // Navigate to camera screen
    navigation.navigate('CameraScreen' as never);
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString(undefined, options);
  };

  // Add new function to handle manual date input
  const handleManualDateSubmit = () => {
    const day = parseInt(manualDate.day);
    const month = parseInt(manualDate.month) - 1; // JavaScript months are 0-based
    const year = parseInt(manualDate.year);

    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      Alert.alert('Error', 'Please enter valid date values');
      return;
    }

    const date = new Date(year, month, day);
    if (date.toString() === 'Invalid Date') {
      Alert.alert('Error', 'Please enter a valid date');
      return;
    }

    // Ensure the date is not in the future
    const maxDate = new Date();
    const finalDate = date > maxDate ? maxDate : date;
    
    setFormData(prev => ({ ...prev, dateOfBirth: finalDate }));
    setShowManualInput(false);
    setManualDate({ day: '', month: '', year: '' });
  };

  if (isLoading) {
    return (
      <TelecallerMainLayout title="Profile" showBackButton>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF8447" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </TelecallerMainLayout>
    );
  }

  return (
    <AppGradient>
    <TelecallerMainLayout title="Profile" showBackButton>
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
          { 
            height: headerHeight,
            opacity: headerOpacity
          }
        ]}>
          <LinearGradient
            colors={['#FF8447', '#FF6D24']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <TouchableWithoutFeedback onPress={openImagePicker}>
              <Animated.View style={[
                styles.profileImageContainer,
                { transform: [{ scale: scaleAnim }] }
              ]}>
                <Image
                  source={
                    'uri' in profileImage
                      ? { uri: profileImage.uri }
                      : profileImage.default
                  }
                  style={styles.profileImage}
                />
                <View style={styles.editIconContainer}>
                  <MaterialIcons name="camera-alt" size={18} color="#FFF" />
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
            
            <Text style={styles.profileName}>
              {formData.name || 'Your Name'}
            </Text>
            <Text style={styles.profileRole}>
              {formData.designation || 'Your Designation'}
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Profile Content */}
        <View style={styles.contentContainer}>
          {/* Personal Information Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="person" size={22} color="#FF8447" />
              <Text style={styles.sectionTitle}>Personal Information</Text>
            </View>
            
            <View style={styles.formContainer}>
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
              />
              
              <FormInput
                label="Email"
                value={formData.email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="email"
                autoComplete="email"
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
                onPress={() => {
                  if (Platform.OS === 'android') {
                    setShowDatePicker(true);
                  } else {
                    setShowManualInput(true);
                  }
                }}
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
                  display={Platform.OS === "ios" ? "spinner" : "calendar"}
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  minimumDate={new Date(1950, 0, 1)}
                  style={{ width: '100%', backgroundColor: 'white' }}
                />
              )}

              {showManualInput && (
                <View style={styles.manualDateContainer}>
                  <View style={styles.manualDateInputs}>
                    <TextInput
                      style={styles.manualDateInput}
                      placeholder="DD"
                      value={manualDate.day}
                      onChangeText={(text) => setManualDate(prev => ({ ...prev, day: text }))}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <Text style={styles.dateSeparator}>/</Text>
                    <TextInput
                      style={styles.manualDateInput}
                      placeholder="MM"
                      value={manualDate.month}
                      onChangeText={(text) => setManualDate(prev => ({ ...prev, month: text }))}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <Text style={styles.dateSeparator}>/</Text>
                    <TextInput
                      style={styles.manualDateInput}
                      placeholder="YYYY"
                      value={manualDate.year}
                      onChangeText={(text) => setManualDate(prev => ({ ...prev, year: text }))}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                  <View style={styles.manualDateActions}>
                    <TouchableOpacity 
                      style={[styles.manualDateButton, styles.cancelButton]}
                      onPress={() => {
                        setShowManualInput(false);
                        setManualDate({ day: '', month: '', year: '' });
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.manualDateButton, styles.submitButton]}
                      onPress={handleManualDateSubmit}
                    >
                      <Text style={styles.submitButtonText}>Set Date</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
          
          {/* Save Button */}
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
          
          <View style={styles.spacer} />
        </View>
      </Animated.ScrollView>
    </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#555',
    fontFamily: 'LexendDeca_400Regular',
  },
  headerContainer: {
    height: 250,
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
    color: 'rgba(255, 255, 255, 0.9)',
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
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginLeft: 10,
  },
  formContainer: {
    padding: 16,
  },
  datePickerButton: {
    marginTop: 8,
    marginBottom: 8,
  },
  datePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
  },
  dateIcon: {
    marginRight: 12,
  },
  datePickerLabel: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  datePickerValue: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'LexendDeca_400Regular',
  },
  saveButton: {
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 30,
    elevation: 4,
    shadowColor: '#FF8447',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    marginBottom: 40,
  },
  saveGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
  },
  spacer: {
    height: 40,
  },
  manualDateContainer: {
    marginTop: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  manualDateInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  manualDateInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 4,
  },
  dateSeparator: {
    fontSize: 18,
    color: '#666',
    marginHorizontal: 4,
  },
  manualDateActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  manualDateButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  submitButton: {
    backgroundColor: '#FF8447',
  },
  cancelButtonText: {
    color: '#666',
    fontFamily: 'LexendDeca_500Medium',
  },
  submitButtonText: {
    color: 'white',
    fontFamily: 'LexendDeca_500Medium',
  },
})

export default ProfileScreen;
