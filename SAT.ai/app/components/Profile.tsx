import { api } from '@/app/services/api';
import { Alert } from 'react-native';

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

    // Update profile through API
    await api.updateUserProfile(userId, {
      ...formData,
      profileImageUrl,
      updatedAt: new Date()
    });

    Alert.alert('Success', 'Profile updated successfully');
  } catch (error) {
    console.error('Error saving profile:', error);
    Alert.alert('Error', 'Failed to update profile');
  } finally {
    setIsLoading(false);
  }
}; 