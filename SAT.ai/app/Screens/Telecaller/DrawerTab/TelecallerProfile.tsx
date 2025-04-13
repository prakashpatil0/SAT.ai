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
  TextInput,
  Easing
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
  const [isEditing, setIsEditing] = useState(false);
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
  const [birthDate, setBirthDate] = useState("");
  const [dateError, setDateError] = useState("");
  const [profileImage, setProfileImage] = useState<ProfileImage>({ uri: "" });
  const [defaultProfileImage, setDefaultProfileImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
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
  const waveAnimation = useRef(new Animated.Value(0)).current;
  
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

  // Load default profile image from Firebase Storage
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
      setProfileImage({ uri: url });
    } catch (error) {
      console.error('Error loading default profile image:', error);
    } finally {
      setImageLoading(false);
    }
  };

  // Fetch existing profile data
  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Update profile image when context changes
  useEffect(() => {
    if (contextProfileImage) {
      console.log("Profile image updated from context:", contextProfileImage);
      setProfileImage({ uri: contextProfileImage });
    }
  }, [contextProfileImage]);

  // Add this useEffect for wave animation
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnimation, {
            toValue: 1,
            duration: 1000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      waveAnimation.setValue(0);
    }
  }, [isLoading]);

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
          console.log("Loading profile image from Firestore:", data.profileImageUrl);
          try {
            // Verify the image URL is accessible
            const response = await fetch(data.profileImageUrl);
            if (response.ok) {
              setProfileImage({ uri: data.profileImageUrl });
              updateProfileImage?.(data.profileImageUrl);
              console.log("Profile image loaded successfully");
            } else {
              console.error("Profile image URL not accessible:", response.status);
              // Use default profile image from Firebase Storage
              if (defaultProfileImage) {
                setProfileImage({ uri: defaultProfileImage });
              }
            }
          } catch (error) {
            console.error("Error loading profile image:", error);
            // Use default profile image from Firebase Storage
            if (defaultProfileImage) {
              setProfileImage({ uri: defaultProfileImage });
            }
          }
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
      console.log("Starting image upload to Firebase Storage");
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Convert image URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Create storage reference with path that matches Firebase Storage rules
      // Using the exact path structure from the rules: /profileImages/{userId}/{fileName}
      const timestamp = Date.now();
      const storageRef = ref(storage, `profileImages/${userId}/profile_${timestamp}.jpg`);

      // Upload the image
      console.log("Uploading image to Firebase Storage...");
      const uploadResult = await uploadBytes(storageRef, blob);

      // Get the download URL
      console.log("Getting download URL...");
      const downloadURL = await getDownloadURL(uploadResult.ref);
      console.log("Image uploaded successfully:", downloadURL);

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

  const handleEditPress = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form data to original values
    fetchUserProfile();
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

      // First, update the UI immediately for better user experience
      const userRef = doc(db, "users", userId);
      
      // Prepare the update data
      const updateData: {
        name: string;
        designation: string;
        phoneNumber: string;
        dateOfBirth: Date;
        updatedAt: any;
        profileImageUrl?: string;
      } = {
        name: formData.name,
        designation: formData.designation,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        updatedAt: serverTimestamp(),
      };

      // Handle profile image separately to avoid Firebase Storage errors
      let profileImageUrl = formData.profileImageUrl;
      
      // Only attempt upload if there's a new image and it's not the default image
      if ('uri' in profileImage && profileImage.uri && 
          profileImage.uri !== formData.profileImageUrl && 
          profileImage.uri !== defaultProfileImage) {
        try {
          console.log("Uploading new profile image...");
          profileImageUrl = await uploadImage(profileImage.uri);
          console.log("New profile image uploaded:", profileImageUrl);
          
          // Add the profile image URL to the update data
          updateData.profileImageUrl = profileImageUrl;
        } catch (uploadError) {
          console.error("Profile image upload failed:", uploadError);
          // Continue with the update even if image upload fails
          // We'll keep the existing profile image URL
        }
      } else if ('default' in profileImage && profileImage.default === 1) {
        // If user selected to remove photo, use the default profile image
        profileImageUrl = defaultProfileImage || "";
        updateData.profileImageUrl = profileImageUrl;
      }

      // Update Firestore document
      await setDoc(userRef, updateData, { merge: true });
      
      // Update context and local state
      if (profileImageUrl && updateProfileImage) {
        updateProfileImage(profileImageUrl);
      }

      Alert.alert("Success", "Profile updated successfully");
      setIsEditing(false);
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

  const validateBirthDate = (text: string) => {
    // Remove any non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    
    // Format the date as user types
    let formattedDate = '';
    if (cleaned.length > 0) {
      // Add first two digits (day)
      formattedDate = cleaned.substring(0, 2);
      if (cleaned.length > 2) {
        // Add month after day
        formattedDate += '/' + cleaned.substring(2, 4);
        if (cleaned.length > 4) {
          // Add year after month
          formattedDate += '/' + cleaned.substring(4, 8);
        }
      }
    }
    
    setBirthDate(formattedDate);

    // Validate the date
    if (formattedDate.length === 10) {
      const [day, month, year] = formattedDate.split('/').map(Number);
      
      // Basic validation
      if (day < 1 || day > 31) {
        setDateError("Day must be between 1 and 31");
        return false;
      }
      if (month < 1 || month > 12) {
        setDateError("Month must be between 1 and 12");
        return false;
      }
      if (year < 1950 || year > new Date().getFullYear()) {
        setDateError(`Year must be between 1950 and ${new Date().getFullYear()}`);
        return false;
      }

      // Check if the date actually exists
      const date = new Date(year, month - 1, day);
      if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
        setDateError("Please enter a valid date (e.g., 31/02/2024 is invalid)");
        return false;
      }

      // Check if date is in the future
      if (date > new Date()) {
        setDateError("Date of birth cannot be in the future");
        return false;
      }

      setDateError("");
      setFormData(prev => ({ ...prev, dateOfBirth: date }));
      return true;
    } else if (formattedDate.length > 0) {
      setDateError("Please enter a complete date in DD/MM/YYYY format");
      return false;
    }
    return true;
  };

  const openImagePicker = () => {
    Alert.alert(
      "Upload Profile Picture", 
      "Choose an option", 
      [
        { text: "Take Photo", onPress: handleOpenCamera },
        { text: "Choose from Gallery", onPress: handleImagePicker },
        { text: "Remove Photo", onPress: handleRemovePhoto },
        { text: "Cancel", style: "cancel", onPress: () => console.log("Cancel pressed") },
      ],
      { cancelable: true }
    );
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
    
    // Use Image Picker camera instead of navigating to camera screen
    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
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

  const handleRemovePhoto = () => {
    // Set profile image to default
    if (defaultProfileImage) {
      setProfileImage({ uri: defaultProfileImage });
    } else {
      setProfileImage({ default: 1 });
    }
    
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
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const renderWaveSkeleton = () => {
    const translateX = waveAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [-width, width],
    });

    return (
      <View style={styles.skeletonContainer}>
        {/* Profile Header Skeleton */}
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonProfileImage} />
          <View style={styles.skeletonName} />
          <View style={styles.skeletonDesignation} />
        </View>

        {/* Personal Information Skeleton */}
        <View style={styles.skeletonSection}>
          <View style={styles.skeletonSectionHeader}>
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonTitle} />
          </View>
          
          <View style={styles.skeletonFormContainer}>
            {[1, 2, 3, 4, 5].map((_, index) => (
              <View key={index} style={styles.skeletonInfoRow}>
                <View style={styles.skeletonInfoIcon} />
                <View style={styles.skeletonInfoContent}>
                  <View style={styles.skeletonInfoLabel} />
                  <View style={styles.skeletonInfoValue} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Wave Animation Overlay */}
        <Animated.View
          style={[
            styles.waveOverlay,
            {
              transform: [{ translateX }],
            },
          ]}
        />
      </View>
    );
  };

  if (isLoading) {
    return (
      <AppGradient>
        <TelecallerMainLayout title="Profile" showBackButton>
          {renderWaveSkeleton()}
        </TelecallerMainLayout>
      </AppGradient>
    );
  }

  return (
    
    <AppGradient>
    <TelecallerMainLayout title="Profile" showBackButton>
    <ScrollView>
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
            <TouchableWithoutFeedback onPress={isEditing ? openImagePicker : undefined}>
              <Animated.View style={[
                styles.profileImageContainer,
                { transform: [{ scale: scaleAnim }] }
              ]}>
                {imageLoading ? (
                  <View style={[styles.profileImage, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  </View>
                ) : (
                  <Image
                    source={
                      'uri' in profileImage && profileImage.uri
                        ? { uri: profileImage.uri }
                        : defaultProfileImage
                          ? { uri: defaultProfileImage }
                          : undefined
                    }
                    style={styles.profileImage}
                  />
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
              {!isEditing ? (
                <TouchableOpacity style={styles.editButton} onPress={handleEditPress}>
                  <MaterialIcons name="edit" size={24} color="#FF8447" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
                  <MaterialIcons name="close" size={24} color="#FF8447" />
                </TouchableOpacity>
              )}
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
                  
                  <FormInput
                    label="Date of Birth"
                    value={birthDate}
                    onChangeText={validateBirthDate}
                    placeholder="DD/MM/YYYY"
                    error={dateError}
                    leftIcon="calendar-today"
                    keyboardType="numeric"
                    autoComplete="off"
                  />
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
          
          {/* Save Button - Only show when editing */}
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
      </ScrollView>
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
  editButton: {
    marginLeft: 'auto',
    padding: 8,
  },
  cancelButton: {
    marginLeft: 'auto',
    padding: 8,
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
  skeletonContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  skeletonHeader: {
    height: 250,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  skeletonProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e0e0e0',
  },
  skeletonName: {
    width: 200,
    height: 30,
    backgroundColor: '#e0e0e0',
    marginTop: 16,
    borderRadius: 4,
  },
  skeletonDesignation: {
    width: 150,
    height: 20,
    backgroundColor: '#e0e0e0',
    marginTop: 8,
    borderRadius: 4,
  },
  skeletonSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    overflow: 'hidden',
  },
  skeletonSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  skeletonIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
  },
  skeletonTitle: {
    width: 150,
    height: 20,
    backgroundColor: '#e0e0e0',
    marginLeft: 10,
    borderRadius: 4,
  },
  skeletonFormContainer: {
    padding: 16,
  },
  skeletonInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  skeletonInfoIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
  },
  skeletonInfoContent: {
    marginLeft: 12,
    flex: 1,
  },
  skeletonInfoLabel: {
    width: 80,
    height: 12,
    backgroundColor: '#e0e0e0',
    marginBottom: 4,
    borderRadius: 4,
  },
  skeletonInfoValue: {
    width: 150,
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  waveOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    transform: [{ translateX: 0 }],
  },
})

export default ProfileScreen;
