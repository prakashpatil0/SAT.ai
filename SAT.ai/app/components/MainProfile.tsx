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
  Modal,
  Keyboard,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "expo-camera";
import BDMMainLayout from "@/app/components/BDMMainLayout";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import { auth, db, storage } from "@/firebaseConfig";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { LinearGradient } from "expo-linear-gradient";
import { useProfile } from "@/app/context/ProfileContext";
import FormInput from "@/app/components/FormInput";
import AppGradient from "@/app/components/AppGradient";
import WaveSkeleton from "@/app/components/WaveSkeleton";
import DateTimePickerModal from 'react-native-modal-datetime-picker';

const { width } = Dimensions.get("window");

type ProfileImage =
  | { uri: string }
  | { uri?: undefined; default: number };

interface User {
  id: string;
  name: string;
  designation: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: Date;
  profileImageUrl: string | null;
}

const ProfileSkeleton = () => {
  return (
    <View style={styles.skeletonContainer}>
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={["#FF8447", "#FF6D24"]}
          style={styles.headerGradient}
        >
          <WaveSkeleton
            width={120}
            height={120}
            style={styles.profileImageSkeleton}
          />
          <WaveSkeleton width={200} height={24} style={styles.skeletonText} />
          <WaveSkeleton width={150} height={16} style={styles.skeletonText} />
        </LinearGradient>
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <WaveSkeleton width={200} height={24} />
          </View>
          <View style={styles.formContainer}>
            <WaveSkeleton
              width="100%"
              height={60}
              style={styles.inputSkeleton}
            />
            <WaveSkeleton
              width="100%"
              height={60}
              style={styles.inputSkeleton}
            />
            <WaveSkeleton
              width="100%"
              height={60}
              style={styles.inputSkeleton}
            />
            <WaveSkeleton
              width="100%"
              height={60}
              style={styles.inputSkeleton}
            />
            <WaveSkeleton
              width="100%"
              height={60}
              style={styles.inputSkeleton}
            />
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
  const [role, setRole] = useState<"BDM" | "Telecaller">("BDM");
  const [formData, setFormData] = useState<User>({
    id: "",
    name: "",
    designation: "",
    email: "",
    phoneNumber: "",
    dateOfBirth: new Date(),
    profileImageUrl: "",
  });
  const [profileImage, setProfileImage] = useState<ProfileImage>({ uri: "" });
  const [errors, setErrors] = useState({ name: "", phoneNumber: "" });
  const [touched, setTouched] = useState({ name: false, phoneNumber: false });
  const scrollRef = useRef<ScrollView>(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(formData.dateOfBirth);
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [tempPhotoUri, setTempPhotoUri] = useState<string | null>(null);
  const [dobError, setDobError] = useState("");
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0)).current;

  // Profile cache
  const profileCache = useRef<{ data: User | null; timestamp: number }>({
    data: null,
    timestamp: 0,
  });
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Calculated animation values
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [250, 150],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.8],
    extrapolate: "clamp",
  });

  useEffect(() => {
    if (calendarVisible) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [calendarVisible]);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (contextProfileImage) {
      setProfileImage({ uri: contextProfileImage });
    }
  }, [contextProfileImage]);

  useEffect(() => {
    if (photoModalVisible) {
      Animated.spring(modalScale, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [photoModalVisible]);

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      // Check cache
      const now = Date.now();
      if (
        profileCache.current.data &&
        now - profileCache.current.timestamp < CACHE_DURATION
      ) {
        const data = profileCache.current.data!;
        setRole(
          data.designation?.toLowerCase() === "bdm" ? "BDM" : "Telecaller"
        );
        setFormData(data);
        setProfileImage(
          data.profileImageUrl ? { uri: data.profileImageUrl } : { uri: "" }
        );
        setIsLoading(false);
        return;
      }

      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const userRole =
          data.designation?.toLowerCase() === "bdm" ? "BDM" : "Telecaller";
        const userData: User = {
          id: userId,
          name: data.name || "",
          designation: data.designation || userRole,
          email: data.email || auth.currentUser?.email || "",
          phoneNumber: data.phoneNumber || "",
          dateOfBirth: data.dateOfBirth?.toDate() || new Date(),
          profileImageUrl: data.profileImageUrl || "",
        };

        setRole(userRole);
        setFormData(userData);
        profileCache.current = { data: userData, timestamp: now };

        if (data.profileImageUrl) {
          try {
            const response = await fetch(data.profileImageUrl);
            if (response.ok) {
              setProfileImage({ uri: data.profileImageUrl });
              updateProfileImage?.(data.profileImageUrl);
            } else {
              await loadDefaultImage(userRole);
            }
          } catch {
            await loadDefaultImage(userRole);
          }
        } else {
          await loadDefaultImage(userRole);
        }
      }
    } catch {
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setTimeout(() => setIsLoading(false), 1000);
    }
  };

  const loadDefaultImage = async (userRole: "BDM" | "Telecaller") => {
    try {
      const defaultImagePath =
        userRole === "BDM" ? "assets/person.png" : "assets/girl.png";
      const defaultImageRef = ref(storage, defaultImagePath);
      const url = await getDownloadURL(defaultImageRef);
      setProfileImage({ uri: url });
    } catch {
      setProfileImage({ uri: "" });
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("User not authenticated");

      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(
        storage,
        `profileImages/${userId}/profile_${Date.now()}.jpg`
      );
      const uploadResult = await uploadBytes(storageRef, blob);
      return await getDownloadURL(uploadResult.ref);
    } catch {
      throw new Error("Upload failed");
    }
  };

  const validateName = (text: string) => {
    // Only allow letters and spaces, remove numbers and special characters
    const filtered = text.replace(/[^A-Za-z ]/g, "");
    setFormData((prev) => ({ ...prev, name: filtered }));
    if (!touched.name) return true;

    if (!/^[A-Za-z ]+$/.test(filtered.trim())) {
      setErrors((prev) => ({
        ...prev,
        name: "Name can only contain letters and spaces",
      }));
      return false;
    } else if (filtered.trim().length < 3) {
      setErrors((prev) => ({
        ...prev,
        name: "Name must be at least 3 characters",
      }));
      return false;
    } else {
      setErrors((prev) => ({ ...prev, name: "" }));
      return true;
    }
  };

  const validatePhoneNumber = (text: string) => {
    // Only allow digits, and limit to 10 digits
    const cleaned = text.replace(/\D/g, "").slice(0, 10);
    setFormData((prev) => ({ ...prev, phoneNumber: cleaned }));
    if (cleaned.length === 10) {
      Keyboard.dismiss();
    }
    if (!touched.phoneNumber) return true;

    if (!/^\d{10}$/.test(cleaned)) {
      setErrors((prev) => ({
        ...prev,
        phoneNumber: "Phone number must be exactly 10 digits",
      }));
      return false;
    } else {
      setErrors((prev) => ({ ...prev, phoneNumber: "" }));
      return true;
    }
  };

  const isValidDOB = (date: Date) => {
    const today = new Date();
    const minDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    return date <= minDate;
  };

  const handleBlur = (field: keyof typeof touched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "name") validateName(formData.name);
    else if (field === "phoneNumber") validatePhoneNumber(formData.phoneNumber);
  };

  const handleSaveChanges = async () => {
    try {
      const isNameValid = validateName(formData.name);
      const isPhoneValid = validatePhoneNumber(formData.phoneNumber);
      const isDOBValid = isValidDOB(formData.dateOfBirth);
      if (!isNameValid || !isPhoneValid || !isDOBValid) {
        if (!isDOBValid) setDobError("You must be at least 18 years old.");
        return;
      } else {
        setDobError("");
      }

      setIsSaving(true);
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Error", "Please login to update profile");
        return;
      }

      let profileImageUrl = formData.profileImageUrl;
      if (
        "uri" in profileImage &&
        profileImage.uri &&
        profileImage.uri !== formData.profileImageUrl
      ) {
        profileImageUrl = await uploadImage(profileImage.uri);
      }

      const userRef = doc(db, "users", userId);
      const updateData = {
        name: formData.name,
        designation: formData.designation,
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        updatedAt: serverTimestamp(),
        profileImageUrl: profileImageUrl || formData.profileImageUrl,
      };

      await setDoc(userRef, updateData, { merge: true });
      profileCache.current = {
        data: { ...formData, profileImageUrl },
        timestamp: Date.now(),
      };
      if (profileImageUrl && updateProfileImage) {
        updateProfileImage(profileImageUrl);
      }

      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch {
      Alert.alert(
        "Error",
        "Failed to update profile. Please check your connection and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "You need to allow access to the camera."
      );
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      setTempPhotoUri(result.assets[0].uri);
      setPhotoModalVisible(true);
    }
  };

  const handleSavePhoto = () => {
    if (tempPhotoUri) {
      setProfileImage({ uri: tempPhotoUri });
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
    setPhotoModalVisible(false);
    setTempPhotoUri(null);
  };

  const handleRetakePhoto = async () => {
    setPhotoModalVisible(false);
    setTempPhotoUri(null);
    await handleOpenCamera();
  };

  const handleCancelPhoto = () => {
    setPhotoModalVisible(false);
    setTempPhotoUri(null);
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
      Alert.alert(
        "Permission Denied",
        "You need to allow access to the gallery."
      );
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.7,
      selectionLimit: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      setProfileImage({ uri: result.assets[0].uri });
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

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return date.toLocaleDateString(undefined, options);
  };

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => {
      const newMonth = prev === 0 ? 11 : prev - 1;
      if (prev === 0) setCalendarYear((prevYear) => prevYear - 1);
      return newMonth;
    });
  };

  const handleNextMonth = () => {
    setCalendarMonth((prev) => {
      const newMonth = prev === 11 ? 0 : prev + 1;
      if (prev === 11) setCalendarYear((prevYear) => prevYear + 1);
      return newMonth;
    });
  };

  const getCalendarMatrix = (year: number, month: number) => {
    const matrix = [];
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    let day = 1;
    for (let i = 0; i < 6; i++) {
      const row = [];
      for (let j = 0; j < 7; j++) {
        if ((i === 0 && j < firstDay) || day > totalDays) {
          row.push(null);
        } else {
          row.push(day++);
        }
      }
      matrix.push(row);
    }
    return matrix;
  };

  const showDatePicker = () => setDatePickerVisible(true);
  const hideDatePicker = () => setDatePickerVisible(false);
  const handleDateConfirm = (date: Date) => {
    if (!isValidDOB(date)) {
      setDobError("You must be at least 18 years old.");
      hideDatePicker();
      return;
    } else {
      setDobError("");
    }
    setSelectedDate(date);
    setFormData((prev) => ({ ...prev, dateOfBirth: date }));
    hideDatePicker();
  };

  const Layout = role === "BDM" ? BDMMainLayout : TelecallerMainLayout;

  if (isLoading) {
    return (
      <AppGradient>
        <Layout title="Profile" showBackButton showDrawer={role === "BDM"}>
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
        showDrawer={role === "BDM" || role === "Telecaller"}
        rightComponent={
          role === "BDM" || role === "Telecaller" ? (
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
          ) : null
        }
      >
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContainer,
            { paddingBottom: 100, minHeight: Dimensions.get("window").height + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
        >
          {/* Profile Header */}
          <Animated.View
            style={[
              styles.headerContainer,
              { height: headerHeight, opacity: headerOpacity },
            ]}
          >
            <LinearGradient
              colors={["#FF8447", "#FF6D24"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <TouchableWithoutFeedback
                onPress={isEditing ? openImagePicker : undefined}
              >
                <Animated.View
                  style={[
                    styles.profileImageContainer,
                    { transform: [{ scale: scaleAnim }] },
                  ]}
                >
                  {profileImage.uri ? (
                    <Image
                      source={{ uri: profileImage.uri }}
                      style={styles.profileImage}
                    />
                  ) : (
                    <View
                      style={[
                        styles.profileImage,
                        {
                          backgroundColor: "#f0f0f0",
                          justifyContent: "center",
                          alignItems: "center",
                        },
                      ]}
                    >
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
                {formData.name || "Your Name"}
              </Text>
              <Text style={styles.profileRole}>
                {formData.designation ||
                  (role === "BDM"
                    ? "Business Development Manager"
                    : "Telecaller")}
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
                      onChangeText={(text: string) => {
                        // Only allow letters and spaces
                        const filtered = text.replace(/[^A-Za-z ]/g, "");
                        setFormData((prev) => ({ ...prev, name: filtered }));
                        if (!touched.name) return;
                        validateName(filtered);
                      }}
                      onBlur={() => handleBlur("name")}
                      error={touched.name ? errors.name : undefined}
                      leftIcon="account"
                    />
                    <FormInput
                      label="Designation"
                      value={formData.designation}
                      onChangeText={() => {}}
                      leftIcon="briefcase"
                      disabled={true}
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
                      onChangeText={(text: string) => {
                        // Only allow digits, and limit to 10 digits
                        const cleaned = text.replace(/\D/g, "").slice(0, 10);
                        setFormData((prev) => ({ ...prev, phoneNumber: cleaned }));
                        if (!touched.phoneNumber) return;
                        validatePhoneNumber(cleaned);
                      }}
                      onBlur={() => handleBlur("phoneNumber")}
                      error={touched.phoneNumber ? errors.phoneNumber : undefined}
                      keyboardType="phone-pad"
                      leftIcon="phone"
                      autoComplete="tel"
                    />
                    <Text style={styles.datePickerLabel}>Date of Birth</Text>
                     <TouchableOpacity
                      onPress={showDatePicker}
                      style={styles.datePickerButton}
                    >
                      <View style={styles.datePickerContent}>
                        <MaterialIcons
                          name="calendar-today"
                          size={24}
                          color="#777"
                        />
                        <Text style={styles.datePickerValue}>
                          {formatDate(selectedDate)}
                        </Text>
                        <MaterialIcons
                          name="arrow-drop-down"
                          size={24}
                          color="#FF8447"
                        />
                      </View>
                    </TouchableOpacity>
                    <DateTimePickerModal
                      isVisible={isDatePickerVisible}
                      mode="date"
                      date={selectedDate}
                      maximumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
                      onConfirm={handleDateConfirm}
                      onCancel={hideDatePicker}
                    />
                  </>
                ) : (
                  <>
                    <View style={styles.infoRow}>
                      <MaterialIcons name="person" size={24} color="#FF8447" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Full Name</Text>
                        <Text style={styles.infoValue}>
                          {formData.name || "Not provided"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <MaterialIcons name="work" size={24} color="#FF8447" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Designation</Text>
                        <Text style={styles.infoValue}>
                          {formData.designation || "Not provided"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <MaterialIcons name="email" size={24} color="#FF8447" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Email</Text>
                        <Text style={styles.infoValue}>
                          {formData.email || "Not provided"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <MaterialIcons name="phone" size={24} color="#FF8447" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Phone Number</Text>
                        <Text style={styles.infoValue}>
                          {formData.phoneNumber || "Not provided"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <MaterialIcons
                        name="calendar-today"
                        size={24}
                        color="#FF8447"
                      />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Date of Birth</Text>
                        <Text style={styles.infoValue}>
                          {formData.dateOfBirth
                            ? formatDate(formData.dateOfBirth)
                            : "Not provided"}
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
                  colors={["#FF8447", "#FF6D24"]}
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

            {dobError ? (
              <Text style={{ color: '#FF5252', fontSize: 12, marginTop: 4 }}>{dobError}</Text>
            ) : null}
          </View>
        </Animated.ScrollView>

        {/* Custom Photo Options Modal */}
        <Modal
          visible={photoModalVisible}
          transparent
          animationType="none"
          onRequestClose={handleCancelPhoto}
        >
          <TouchableWithoutFeedback onPress={handleCancelPhoto}>
            <View style={modalStyles.modalOverlay}>
              <TouchableWithoutFeedback>
                <Animated.View
                  style={[
                    modalStyles.modalContainer,
                    { transform: [{ scale: modalScale }] },
                  ]}
                >
                  <Text style={modalStyles.modalTitle}>Photo Taken!</Text>
                  <Text style={modalStyles.modalSubtitle}>
                    What would you like to do with this photo?
                  </Text>
                  <View style={modalStyles.buttonContainer}>
                    <TouchableOpacity
                      style={modalStyles.button}
                      onPress={handleSavePhoto}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={["#FF8447", "#FF6D24"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={modalStyles.buttonGradient}
                      >
                        <Text style={modalStyles.buttonText}>Save Photo</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={modalStyles.button}
                      onPress={handleRetakePhoto}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={["#4B9CFA", "#2B7FFF"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={modalStyles.buttonGradient}
                      >
                        <Text style={modalStyles.buttonText}>Retake</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={modalStyles.cancelButton}
                      onPress={handleCancelPhoto}
                      activeOpacity={0.8}
                    >
                      <Text style={modalStyles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </Layout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 200,
  },
  headerContainer: {
    width: "100%",
    overflow: "hidden",
  },
  headerGradient: {
    flex: 1,
    alignItems: "center",
    paddingTop: 24,
  },
  datePickerLabel: {
    fontSize: 12,
    color: "#000",
    fontFamily: "LexendDeca_400",
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#fff",
    padding: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    position: "relative",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  editIconContainer: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: "#FF8447",
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  profileName: {
    fontSize: 24,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#fff",
    marginTop: 16,
  },
  profileRole: {
    fontSize: 16,
    fontFamily: "LexendDeca_400Regular",
    color: "#fff",
    marginTop: 8,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#FFF5F5",
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "LexendDeca_500Medium",
    color: "#FF6D24",
    marginLeft: 8,
  },
  formContainer: {
    padding: 16,
    backgroundColor: "#fff",
  },
  saveButton: {
    height: 56,
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 16,
    marginHorizontal: 16,
    elevation: 6,
    shadowColor: "#FF6D24",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
  },
  spacer: {
    height: 80,
  },
  editButton: {
    padding: 8,
    backgroundColor: "#FFF5F5",
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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: "#333",
  },
  calendarWrapper: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  monthYear: {
    fontSize: 16,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#333",
  },
  arrow: {
    fontSize: 20,
    color: "#FF6D24",
    paddingHorizontal: 8,
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dayText: {
    width: 40,
    textAlign: "center",
    fontSize: 14,
    fontFamily: "LexendDeca_500Medium",
    color: "#555",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dateCell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedDate: {
    backgroundColor: "#FF6D24",
  },
  dateText: {
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: "#333",
  },
  pickerContainer: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  yearScroll: {
    maxHeight: 100,
    borderBottomWidth: 1,
    borderColor: "#ddd",
    marginBottom: 8,
  },
  monthScroll: {
    paddingVertical: 8,
  },
  pickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: "#333",
    textAlign: "center",
  },
  datePickerButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: "#fff",
  },
  datePickerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  datePickerValue: {
    marginLeft: 12,
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: "#333",
    flex: 1,
  },
});

const modalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: width * 0.85,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#FF6D24",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
  },
  button: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonGradient: {
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: "#fff",
  },
  cancelButton: {
    paddingVertical: 14,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: "#333",
  },
});

export default ProfileScreen;