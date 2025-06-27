import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '@/firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';

// Default profile image URLs from Firebase Storage
let DEFAULT_TELECALLER_IMAGE_URL: string | null = null;
let DEFAULT_BDM_IMAGE_URL: string | null = null;

// Function to load the default profile image from Firebase Storage based on role
export const loadDefaultProfileImage = async (role: string = 'telecaller'): Promise<string> => {
  try {
    let imagePath: string;
    let cachedUrl: string | null = null;
    
    switch (role.toLowerCase()) {
      case 'telecaller':
        imagePath = 'assets/girl.png';
        cachedUrl = DEFAULT_TELECALLER_IMAGE_URL;
        break;
      case 'bdm':
      case 'hr':
      default:
        imagePath = 'assets/person.png';
        cachedUrl = DEFAULT_BDM_IMAGE_URL;
        break;
    }
    
    if (cachedUrl) {
      return cachedUrl;
    }
    
    console.log(`Loading default profile image for ${role} from Firebase Storage`);
    const imageRef = ref(storage, imagePath);
    const url = await getDownloadURL(imageRef);
    console.log('Successfully loaded default profile image URL:', url);
    
    // Cache the URL based on role
    if (role.toLowerCase() === 'telecaller') {
      DEFAULT_TELECALLER_IMAGE_URL = url;
    } else {
      DEFAULT_BDM_IMAGE_URL = url;
    }
    
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

export const getProfilePhoto = async (role?: string) => {
  try {
    const photo = await AsyncStorage.getItem('profilePhoto');
    if (photo) {
      return photo;
    }
    
    // If no profile photo is saved, return the default based on role
    return await loadDefaultProfileImage(role);
  } catch (error) {
    console.error('Error getting profile photo:', error);
    // Fallback to the default image based on role
    return await loadDefaultProfileImage(role);
  }
};

const profileStorage = {
  saveProfilePhoto,
  getProfilePhoto,
  loadDefaultProfileImage
};

export default profileStorage; 