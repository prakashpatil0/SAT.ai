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
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { launchImageLibrary, launchCamera } from "react-native-image-picker";
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import BDMScreenHeader from '@/app/Screens/BDM/BDMScreenHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { saveProfilePhoto, getProfilePhoto, DEFAULT_PROFILE_IMAGE } from '@/app/utils/profileStorage';
import { useProfile } from '@/app/context/ProfileContext';
import MainLayout from '@/app/components/MainLayout';
import AppGradient from "@/app/components/AppGradient";

const BDMProfile = () => {
  const navigation = useNavigation();
  const { profileImage, updateProfileImage } = useProfile();
  const [name, setName] = useState("Samiksha Shetty");
  const [designation, setDesignation] = useState("Telecaller");
  const [mobileNumber, setMobileNumber] = useState("+91 87392 83729");
  const [dob, setDob] = useState(new Date(2002, 10, 20));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Animation for profile image
  const scaleAnim = new Animated.Value(1);

  useEffect(() => {
    loadProfilePhoto();
  }, []);

  const loadProfilePhoto = async () => {
    const photo = await getProfilePhoto();
    updateProfileImage(photo);
  };

  const handleShowDatePicker = () => {
    setShowDatePicker(true);
  };

  const handleDateChange = (event, selectedDate) => {
    if (selectedDate) {
      setDob(selectedDate);
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
      const photoUri = result.assets[0].uri;
      await saveProfilePhoto(photoUri);
      updateProfileImage(photoUri);
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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to change profile photo!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const photoUri = result.assets[0].uri;
      await saveProfilePhoto(photoUri);
      updateProfileImage(photoUri);
    }
  };

  return (
    <AppGradient>
    <MainLayout 
      title="Profile"
      showBackButton
      showDrawer={true} 
    >
      <View style={styles.container}>
      <View style={styles.imageContainer}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={pickImage}>
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.cameraIcon} onPress={openImagePicker}>
          <MaterialIcons name="edit" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Designation</Text>
      <TextInput style={styles.input} value={designation} onChangeText={setDesignation} />

      <Text style={styles.label}>Mobile Number</Text>
      <TextInput style={styles.input} value={mobileNumber} keyboardType="phone-pad" onChangeText={setMobileNumber} />

      <Text style={styles.label}>Date of Birth</Text>
      <TouchableOpacity onPress={handleShowDatePicker} style={styles.dobContainer}>
        <TextInput style={styles.dobInput} value={dob.toLocaleDateString()} editable={false} />
        <Ionicons name="calendar" size={24} color="#F36F3C" />
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker value={dob} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={handleDateChange} />
      )}
      </View>
      <TouchableOpacity style={styles.saveButton}>
        <Text style={styles.saveButtonText}>Save Changes</Text>
      </TouchableOpacity>
    </MainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9", padding: 10, marginBottom: -40, top: -20},
  imageContainer: { alignItems: "center", justifyContent: "center", position: "relative", marginBottom: -40  },
  backButton: { padding: 1 },
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
    marginTop: 10,
    marginBottom: 30,
    alignItems: "center",
    alignSelf: "center",
    width: 200,
  },
  saveButtonText: { color: "#fff", fontFamily: "Poppins_600SemiBold", fontSize: 16 },
});

export default BDMProfile;
