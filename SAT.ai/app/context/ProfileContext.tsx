import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '@/firebaseConfig';
import api from '@/app/services/api';

interface UserProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
  name?: string;
  // Add other profile fields as needed
}

interface ProfileContextType {
  userProfile: UserProfile | null;
  updateProfile: (profile: UserProfile) => void;
  refreshProfile: () => Promise<void>;
  isLoading: boolean;
  profilePhotoUri: string | null;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);

  const updateProfile = (profile: UserProfile) => {
    setUserProfile(profile);
  };

  const refreshProfile = async () => {
    try {
      setIsLoading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userData = await api.getUserProfile(userId);
      if (userData) {
        setUserProfile(userData);
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial profile fetch
  useEffect(() => {
    const fetchInitialProfile = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          setIsLoading(false);
          return;
        }

        const userData = await api.getUserProfile(userId);
        if (userData) {
          setUserProfile(userData);
        }
      } catch (error) {
        console.error('Error fetching initial profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchInitialProfile();
      } else {
        setUserProfile(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <ProfileContext.Provider value={{ 
      userProfile, 
      updateProfile, 
      refreshProfile, 
      isLoading,
      profilePhotoUri
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}; 