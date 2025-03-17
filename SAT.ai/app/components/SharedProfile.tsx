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
  ActivityIndicator
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from "@/firebaseConfig";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import AppGradient from "@/app/components/AppGradient";

type ProfileImage = {
  uri: string;
} | {
  uri?: undefined;
  default: number;
};

interface SharedProfileProps {
  role: 'telecaller' | 'bdm';
  MainLayout: React.ComponentType<any>;
}

const SharedProfile: React.FC<SharedProfileProps> = ({ role, MainLayout }) => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    designation: role === 'telecaller' ? "Telecaller" : "BDM",
    mobileNumber: "",
    dateOfBirth: new Date(),
    profileImageUrl: "",
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [profileImage, setProfileImage] = useState<ProfileImage>({ 
    default: require("@/assets/images/girlprofile.png") 
  });

  // Animation for profile image
  const scaleAnim = new Animated.Value(1);

  // Fetch existing profile data
  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setFormData({
          name: data.name || "",
          designation: data.designation || role === 'telecaller' ? "Telecaller" : "BDM",
          mobileNumber: data.mobileNumber || "",
          dateOfBirth: data.dateOfBirth?.toDate() || new Date(),
          profileImageUrl: data.profileImageUrl || "",
        });
        if (data.profileImageUrl) {
          setProfileImage({ uri: data.profileImageUrl });
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      Alert.alert("Error", "Failed to load profile data");
    }
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleShowDatePicker = () => {
    setShowDatePicker(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setFormData(prev => ({ ...prev, dateOfBirth: selectedDate }));
    }
    setShowDatePicker(false);
  };

  const uploadImage = async (uri: string) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `profile_images/${userId}`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsLoading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      // Upload image if changed
      let profileImageUrl = formData.profileImageUrl;
      if (profileImage?.uri && profileImage.uri !== formData.profileImageUrl) {
        profileImageUrl = await uploadImage(profileImage.uri);
      }

      // Update profile in Firestore
      await setDoc(doc(db, "users", userId), {
        ...formData,
        profileImageUrl,
        role,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const openImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage({ uri: result.assets[0].uri });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  return (
    <AppGradient>
      <MainLayout showDrawer showBottomTabs={true} showBackButton={true}>
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
            style={[styles.input, styles.disabledInput]} 
            value={formData.designation} 
            editable={false}
            placeholder="Your designation"
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
          <TouchableOpacity style={styles.dobContainer} onPress={handleShowDatePicker}>
            <Text style={styles.dobInput}>
              {formData.dateOfBirth.toLocaleDateString()}
            </Text>
            <Ionicons name="calendar" size={20} color="#666" />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={formData.dateOfBirth}
              mode="date"
              display="default"
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}

          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.disabledButton]}
            onPress={handleSaveProfile}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </MainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "transparent", 
    marginLeft: 20, 
    marginRight: 20 
  },
  imageContainer: { 
    alignItems: "center", 
    justifyContent: "center", 
    position: "relative", 
    marginBottom: -40, 
    top: -20 
  },
  profileImage: { 
    width: 145, 
    height: 145, 
    borderRadius: 75, 
    borderWidth: 2, 
    borderColor: "#F36F3C" 
  },
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
  label: { 
    fontSize: 16, 
    fontFamily: "LexendDeca_400Regular", 
    marginTop: 10, 
    color: "#000" 
  },
  input: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    marginTop: 5,
    borderWidth: 1,
    borderColor: "#ddd",
    fontFamily: "LexendDeca_400Regular",
  },
  disabledInput: {
    backgroundColor: "#f5f5f5",
    color: "#666",
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
  dobInput: { 
    flex: 1, 
    fontFamily: "LexendDeca_400Regular",
  },
  saveButton: {
    backgroundColor: "#F36F3C",
    borderRadius: 10,
    padding: 12,
    marginTop: 30,
    alignItems: "center",
    alignSelf: "center",
    width: 200,
  },
  saveButtonText: { 
    color: "#fff", 
    fontFamily: "Poppins_600SemiBold", 
    fontSize: 16 
  },
  disabledButton: {
    opacity: 0.7,
  },
});

export default SharedProfile; 