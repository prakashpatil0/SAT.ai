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

const { width } = Dimensions.get("window");

type ProfileImage =
  | {
      uri: string;
    }
  | {
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
  // Updated Month Navigation Logic with year carry-over
  const handlePrevMonth = (p0: (prev: any) => number) => {
    setCalendarMonth((prevMonth) => {
      const newMonth = prevMonth === 0 ? 11 : prevMonth - 1;
      if (prevMonth === 0) setCalendarYear((prevYear) => prevYear - 1);
      return newMonth;
    });
  };

  const handleNextMonth = (p0: (prev: any) => any) => {
    setCalendarMonth((prevMonth) => {
      const newMonth = prevMonth === 11 ? 0 : prevMonth + 1;
      if (prevMonth === 11) setCalendarYear((prevYear) => prevYear + 1);
      return newMonth;
    });
  };

  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { profileImage: contextProfileImage, updateProfileImage } =
    useProfile();
  const [role, setRole] = useState<"BDM" | "Telecaller">("BDM"); // Default to BDM, will fetch from Firestore
  const [formData, setFormData] = useState<User>({
    id: "",
    name: "",
    designation: "",
    email: "",
    phoneNumber: "",
    dateOfBirth: new Date(),
    profileImageUrl: "",
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [profileImage, setProfileImage] = useState<ProfileImage>({ uri: "" });
  const [errors, setErrors] = useState({
    name: "",
    phoneNumber: "",
  });
  const [touched, setTouched] = useState({
    name: false,
    phoneNumber: false,
  });

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

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
// Declare FIRST
const scrollRef = useRef<ScrollView>(null); 
const [calendarVisible, setCalendarVisible] = useState(false);

// Then useEffect
useEffect(() => {
  if (calendarVisible) {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 300);
  }
}, [calendarVisible]);

  // Fetch user profile and role
  useEffect(() => {
    fetchUserProfile();
  }, []);
useEffect(() => {
  if (calendarVisible) {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 300);
  }
}, [calendarVisible]);
  // State hooks:
  // const [calendarVisible, setCalendarVisible] = useState(false);
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(formData.dateOfBirth);
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [yearPickerVisible, setYearPickerVisible] = useState(false);

  // Helper function:
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
        const userRole =
          data.designation?.toLowerCase() === "bdm" ? "BDM" : "Telecaller";

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

  const loadDefaultImage = async (userRole: "BDM" | "Telecaller") => {
    try {
      const defaultImagePath =
        userRole === "BDM" ? "assets/person.png" : "assets/girl.png";
      const defaultImageRef = ref(storage, defaultImagePath);
      const url = await getDownloadURL(defaultImageRef);
      setProfileImage({ uri: url });
    } catch (error) {
      console.error("Error loading default profile image:", error);
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
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  };

  const validateName = (text: string) => {
    setFormData((prev) => ({ ...prev, name: text }));
    if (!touched.name) return true;

    if (text.trim().length < 3) {
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
    const cleaned = text.replace(/\D/g, "");
    setFormData((prev) => ({ ...prev, phoneNumber: cleaned }));
    if (!touched.phoneNumber) return true;

    if (cleaned.length < 10) {
      setErrors((prev) => ({
        ...prev,
        phoneNumber: "Phone number must be at least 10 digits",
      }));
      return false;
    } else {
      setErrors((prev) => ({ ...prev, phoneNumber: "" }));
      return true;
    }
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
      if (!isNameValid || !isPhoneValid) return;

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
      if (profileImageUrl && updateProfileImage) {
        updateProfileImage(profileImageUrl);
      }

      setIsEditing(false);
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

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    setShowDatePicker(Platform.OS === "android" ? false : showDatePicker);
    if (selectedDate) {
      setFormData((prev) => ({ ...prev, dateOfBirth: selectedDate }));
    }
    if (Platform.OS === "ios") setShowDatePicker(false);
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
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
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
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
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
  ref={scrollRef} // attach scroll ref
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
                      onChangeText={validateName}
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
                      onChangeText={validatePhoneNumber}
                      onBlur={() => handleBlur("phoneNumber")}
                      error={
                        touched.phoneNumber ? errors.phoneNumber : undefined
                      }
                      keyboardType="phone-pad"
                      leftIcon="phone"
                      autoComplete="tel"
                    />

                    {/* Calendar Trigger */}
                    <Text style={styles.datePickerLabel}>Date of Birth</Text>
                    <TouchableOpacity
                      onPress={() => setCalendarVisible(!calendarVisible)}
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

                    {/* Custom Calendar */}
                    {calendarVisible && (
                      <View style={styles.calendarWrapper}>
                        <View style={styles.calendarHeader}>
                          <TouchableOpacity
                            onPress={() =>
                              handlePrevMonth((prev) =>
                                prev === 0 ? 11 : prev - 1
                              )
                            }
                          >
                            <Text style={styles.arrow}>◀</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() =>
                              setYearPickerVisible(!yearPickerVisible)
                            }
                          >
                            <Text style={styles.monthYear}>
                              {new Date(
                                calendarYear,
                                calendarMonth
                              ).toLocaleString("default", {
                                month: "long",
                              })}{" "}
                              {calendarYear}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() =>
                              handleNextMonth((prev) =>
                                prev === 11 ? 0 : prev + 1
                              )
                            }
                          >
                            <Text style={styles.arrow}>▶</Text>
                          </TouchableOpacity>
                        </View>

                        {yearPickerVisible && (
                          <View style={styles.pickerContainer}>
                            <ScrollView style={styles.yearScroll} horizontal>
                              {[...Array(60)].map((_, i) => {
                                const year = 1970 + i;
                                return (
                                  <TouchableOpacity
                                    key={year}
                                    onPress={() => setCalendarYear(year)}
                                  >
                                    <Text style={styles.pickerItem}>
                                      {year}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                            <ScrollView style={styles.monthScroll} horizontal>
                              {Array.from({ length: 12 }, (_, i) => i).map(
                                (month) => (
                                  <TouchableOpacity
                                    key={month}
                                    onPress={() => {
                                      setCalendarMonth(month); // ❗ Here 'month' is likely 1-based instead of 0-based
                                      setYearPickerVisible(false);
                                    }}
                                  >
                                    <Text style={styles.pickerItem}>
                                      {new Date(0, month).toLocaleString(
                                        "default",
                                        {
                                          month: "short",
                                        }
                                      )}
                                    </Text>
                                  </TouchableOpacity>
                                )
                              )}
                            </ScrollView>
                          </View>
                        )}

                        <View style={styles.daysRow}>
                          {[
                            "Sun",
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                          ].map((day, i) => (
                            <Text key={i} style={styles.dayText}>
                              {day}
                            </Text>
                          ))}
                        </View>

                        {getCalendarMatrix(calendarYear, calendarMonth).map(
                          (week, rowIdx) => (
                            <View key={rowIdx} style={styles.weekRow}>
                              {week.map((date, colIdx) => (
                                <TouchableOpacity
                                  key={colIdx}
                                  style={[
                                    styles.dateCell,
                                    date &&
                                    new Date(
                                      calendarYear,
                                      calendarMonth,
                                      date
                                    ).toDateString() ===
                                      selectedDate.toDateString()
                                      ? styles.selectedDate
                                      : null,
                                  ]}
                                  onPress={() => {
                                    const chosenDate = new Date(
                                      calendarYear,
                                      calendarMonth,
                                      date ?? 1
                                    );

                                    setSelectedDate(chosenDate);
                                    setFormData((prev) => ({
                                      ...prev,
                                      dateOfBirth: chosenDate,
                                    }));
                                    setCalendarVisible(false);
                                  }}
                                  disabled={!date}
                                >
                                  <Text
                                    style={[
                                      styles.dateText,
                                      !date && { color: "#ccc" },
                                    ]}
                                  >
                                    {date || ""}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )
                        )}
                      </View>
                    )}
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
          </View>
        </Animated.ScrollView>
      </Layout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
   scrollContainer: {
    flexGrow: 1,
    paddingBottom: 200, // ✅ ensures calendar has room to scroll into view
  },
  headerContainer: {
    width: "100%",
    overflow: "hidden",
  },
  headerGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
  },
datePickerLabel: {
  fontSize: 12,
  color: "#000000",  // ✅ Black color
  fontFamily: "LexendDeca_400Regular",
},

  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "white",
    padding: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
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
    borderColor: "white",
  },
  profileName: {
    fontSize: 24,
    fontFamily: "LexendDeca_600SemiBold",
    color: "white",
    marginTop: 16,
  },
  profileRole: {
    fontSize: 16,
    fontFamily: "LexendDeca_400Regular",
    color: "white",
    marginTop: 4,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#FFF5E6",
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "LexendDeca_500Medium",
    color: "#FF8447",
    marginLeft: 10,
  },
  formContainer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
 
  dateIcon: {
    marginRight: 12,
    color: "#FF8447",
  },
 

  saveButton: {
    height: 56,
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 16,
    elevation: 4,
    shadowColor: "#FF8447",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  saveGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FF8447",
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
    backgroundColor: "#FFF5E6",
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
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
    padding: 10,
    elevation: 2,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  monthYear: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#333",
  },
  arrow: {
    fontSize: 20,
    color: "#FF6D24",
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  dayText: {
    width: 32,
    textAlign: "center",
    fontWeight: "bold",
    color: "#555",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  dateCell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedDate: {
    backgroundColor: "#FF6D24",
  },
  dateText: {
    color: "#333",
  },
  calendarButton: {
    padding: 10,
    backgroundColor: "#FF6D24",
    borderRadius: 8,
    alignItems: "center",
  },
  calendarButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },

  pickerContainer: {
    backgroundColor: "#f9f9f9",
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    borderColor: "#ccc",
    borderWidth: 1,
  },
  yearScroll: {
    maxHeight: 120,
    borderBottomWidth: 1,
    borderColor: "#ddd",
    marginBottom: 5,
  },
  monthScroll: {
    paddingVertical: 6,
  },
  pickerItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#333",
    textAlign: "center",
  },
  datePickerButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 10,
  },
  datePickerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  datePickerValue: {
    marginLeft: 10,
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
});

export default ProfileScreen;
