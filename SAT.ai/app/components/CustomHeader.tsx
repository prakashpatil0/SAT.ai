import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useProfile } from '@/app/context/ProfileContext';
import { storage } from '@/firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';

const CustomHeader = () => {
  const { userProfile, profileImage } = useProfile();
  const [defaultProfileImage, setDefaultProfileImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    loadDefaultProfileImage();
  }, []);

  const loadDefaultProfileImage = async () => {
    try {
      console.log('Loading default profile image from Firebase Storage');
      const imageRef = ref(storage, 'assets/person.png');
      const url = await getDownloadURL(imageRef);
      console.log('Successfully loaded default profile image URL:', url);
      setDefaultProfileImage(url);
    } catch (error) {
      console.error('Error loading default profile image:', error);
    } finally {
      setImageLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.profileSection}>
        {imageLoading ? (
          <View style={[styles.profileImage, { justifyContent: 'center', alignItems: 'center' }]}>
            <MaterialIcons name="person" size={24} color="#FFF" />
          </View>
        ) : (
          <Image
            source={profileImage ? { uri: profileImage } : { uri: defaultProfileImage || '' }}
            style={styles.profileImage}
          />
        )}
        <View style={styles.textContainer}>
          <Text style={styles.name}>{userProfile?.name || userProfile?.firstName || 'User'}</Text>
          <Text style={styles.email}>{userProfile?.email || 'Not available'}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  textContainer: {
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
});

export default CustomHeader;
