import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  Alert,
  Animated,
  ActivityIndicator,
  FlatList
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import { auth, db, storage } from "@/firebaseConfig";
import { doc, setDoc, getDoc, serverTimestamp, collection, query, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import LinearGradient from 'react-native-linear-gradient';
import AppGradient from "@/app/components/AppGradient";
import { useProfile } from '@/app/context/ProfileContext';


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
  const { profileImage: contextProfileImage, updateProfileImage } = useProfile();
  const [formData, setFormData] = useState({
    name: "",
    designation: "",
    mobileNumber: "",
    dateOfBirth: new Date(),
    profileImageUrl: "",
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [profileImage, setProfileImage] = useState<ProfileImage>({ 
    default: require("@/assets/images/girlprofile.png") 
  });
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Animation for profile image
  const scaleAnim = new Animated.Value(1);

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
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setFormData({
          name: data.name || "",
          designation: data.designation || "",
          mobileNumber: data.mobileNumber || "",
          dateOfBirth: data.dateOfBirth?.toDate() || new Date(),
          profileImageUrl: data.profileImageUrl || "",
        });
        if (data.profileImageUrl) {
          setProfileImage({ uri: data.profileImageUrl });
          updateProfileImage(data.profileImageUrl);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      Alert.alert("Error", "Failed to load profile data");
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      console.log("Starting upload for user:", userId); // Debug log

      // Convert image URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Create storage reference with user-specific path
      const storageRef = ref(storage, `users/${userId}/profile_${Date.now()}.jpg`);
      console.log("Storage path:", storageRef.fullPath); // Debug log

      // Upload the image
      const uploadResult = await uploadBytes(storageRef, blob);
      console.log("Upload completed:", uploadResult); // Debug log

      // Get the download URL
      const downloadURL = await getDownloadURL(uploadResult.ref);
      console.log("Download URL obtained:", downloadURL); // Debug log

      return downloadURL;
    } catch (error) {
      console.error("Upload error:", {
        message: error.message,
        code: error.code,
        fullError: error
      });
      throw error;
    }
  };

  const handleSaveChanges = async () => {
    try {
      setIsLoading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Error", "Please login to update profile");
        return;
      }

      let profileImageUrl = formData.profileImageUrl;

      // Only attempt upload if there's a new image
      if ('uri' in profileImage && profileImage.uri && profileImage.uri !== formData.profileImageUrl) {
        try {
          console.log("Attempting to upload new profile image");
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
        mobileNumber: formData.mobileNumber,
        dateOfBirth: formData.dateOfBirth,
        updatedAt: serverTimestamp(),
      };

      if (profileImageUrl) {
        updateData.profileImageUrl = profileImageUrl;
      }

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
      setIsLoading(false);
    }
  };

  const handleShowDatePicker = () => {
    setShowDatePicker(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setFormData(prev => ({ ...prev, dateOfBirth: selectedDate }));
    }
    setShowDatePicker(false);
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
    }
  };
  

  const handleOpenCamera = async () => {
    // Request camera permission
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
  };
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 1.1,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // Add function to fetch all users
  const fetchAllUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const usersRef = collection(db, "users");
      const q = query(usersRef);
      const querySnapshot = await getDocs(q);
      
      const users: User[] = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        users.push({
          id: doc.id,
          name: userData.name || 'No Name',
          designation: userData.designation || 'No Designation',
          profileImageUrl: userData.profileImageUrl || null
        });
      });
      
      setAllUsers(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      Alert.alert("Error", "Failed to load users");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Add useEffect to fetch users
  useEffect(() => {
    fetchAllUsers();
  }, []);

  // Add render function for user item
  const renderUserItem = ({ item }: { item: User }) => (
    <View style={styles.userCard}>
      <Image 
        source={item.profileImageUrl ? { uri: item.profileImageUrl } : require("@/assets/images/girlprofile.png")}
        style={styles.userImage}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userDesignation}>{item.designation}</Text>
      </View>
    </View>
  );

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBottomTabs={true} showBackButton={true}>
        <View style={styles.container}>
          <View style={styles.imageContainer}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity 
                onPressIn={handlePressIn} 
                onPressOut={handlePressOut} 
                onPress={openImagePicker}
              >
                <Image 
                  source={'uri' in profileImage ? { uri: profileImage.uri } : profileImage.default} 
                  style={styles.profileImage} 
                />
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity style={styles.cameraIcon} onPress={openImagePicker}>
              <Ionicons name="camera" size={20} color="white" />
            </TouchableOpacity>

          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput 
            style={styles.input} 
            value={formData.name} 
            onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            placeholder="Enter your name"
          />

          <Text style={styles.label}>Designation</Text>
          <TextInput 
            style={styles.input} 
            value={formData.designation} 
            onChangeText={(text) => setFormData(prev => ({ ...prev, designation: text }))}
            placeholder="Enter your designation"
          />

          <Text style={styles.label}>Mobile Number</Text>
          <TextInput 
            style={styles.input} 
            value={formData.mobileNumber} 
            onChangeText={(text) => setFormData(prev => ({ ...prev, mobileNumber: text }))}
            placeholder="Enter mobile number"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity onPress={handleShowDatePicker} style={styles.dobContainer}>
            <TextInput style={styles.dobInput} value={formData.dateOfBirth.toLocaleDateString()} editable={false} />
            <Ionicons name="calendar" size={24} color="#F36F3C" />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker value={formData.dateOfBirth} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={handleDateChange} />
          )}

          <TouchableOpacity 
            style={[styles.saveButton, isLoading && styles.disabledButton]}
            onPress={handleSaveChanges}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          {/* Add Users List Section */}
          {/* <Text style={styles.sectionTitle}>All Users</Text>
          {isLoadingUsers ? (
            <ActivityIndicator size="large" color="#F36F3C" />
          ) : (
            <FlatList
              data={allUsers}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id}
              style={styles.usersList}
            />
          )} */}
        </View>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent", marginLeft: 20, marginRight: 20 },
  imageContainer: { alignItems: "center", justifyContent: "center", position: "relative", marginBottom: -40, top: -20 },
  profileImage: { width: 145, height: 145, borderRadius: 75, borderWidth: 2, borderColor: "#F36F3C" },
  cameraIcon: {
    position: "relative",
    left: 40,
    bottom: 30,
    right: 1,
    backgroundColor: "#F36F3C",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "white",
  },
  label: { fontSize: 16, fontFamily: "LexendDeca_400Regular", marginTop: 10, color: "#000" },
  input: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    marginTop: 5,
    borderWidth: 1,
    borderColor: "#ddd",
    fontFamily: "LexendDeca_400Regular",
  },
  dobContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    marginTop: 5,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  dobInput: { flex: 1, fontFamily: "LexendDeca_400Regular", },
  saveButton: {
    backgroundColor: "#F36F3C",
    borderRadius: 10,
    padding: 12,
    marginTop: 30,
    alignItems: "center",
    alignSelf: "center",
    width: 200,
  },
  saveButtonText: { color: "#fff", fontFamily: "Poppins_600SemiBold", fontSize: 16 },
  disabledButton: {
    opacity: 0.7,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
    color: "#333",
    marginTop: 20,
    marginBottom: 10,
  },
  usersList: {
    marginTop: 10,
  },
  userCard: {
    flexDirection: "row",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontFamily: "LexendDeca_500Medium",
    color: "#333",
  },
  userDesignation: {
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: "#666",
    marginTop: 2,
  },
});

export default ProfileScreen;
