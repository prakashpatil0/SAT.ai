import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '@/firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';

// Default profile image URL from Firebase Storage
let DEFAULT_PROFILE_IMAGE_URL: string | null = null;

// Function to load the default profile image from Firebase Storage
export const loadDefaultProfileImage = async (): Promise<string> => {
  try {
    if (DEFAULT_PROFILE_IMAGE_URL) {
      return DEFAULT_PROFILE_IMAGE_URL;
    }
    
    console.log('Loading default profile image from Firebase Storage');
    const imageRef = ref(storage, 'assets/person.png');
    const url = await getDownloadURL(imageRef);
    console.log('Successfully loaded default profile image URL:', url);
    DEFAULT_PROFILE_IMAGE_URL = url;
    return url;
  } catch (error) {
    console.error('Error loading default profile image:', error);
    // Fallback to a placeholder image if Firebase Storage fails
    return 'https://via.placeholder.com/150';
  }
};

export const saveProfilePhoto = async (photoUri: string) => {
  try {
    await AsyncStorage.setItem('profilePhoto', photoUri);
  } catch (error) {
    console.error('Error saving profile photo:', error);
  }
};

export const getProfilePhoto = async () => {
  try {
    const photo = await AsyncStorage.getItem('profilePhoto');
    if (photo) {
      return photo;
    }
    
    // If no profile photo is saved, return the default from Firebase Storage
    return await loadDefaultProfileImage();
  } catch (error) {
    console.error('Error getting profile photo:', error);
    // Fallback to the default image from Firebase Storage
    return await loadDefaultProfileImage();
  }
};

const profileStorage = {
  saveProfilePhoto,
  getProfilePhoto,
  loadDefaultProfileImage
};

export default profileStorage; 