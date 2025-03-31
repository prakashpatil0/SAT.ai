import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_PROFILE_IMAGE = require('@/assets/images/girl.png'); // Replace with your default image URL

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
    return photo || DEFAULT_PROFILE_IMAGE;
  } catch (error) {
    console.error('Error getting profile photo:', error);
    return DEFAULT_PROFILE_IMAGE;
  }
};

const profileStorage = {
  saveProfilePhoto,
  getProfilePhoto
};

export default profileStorage; 