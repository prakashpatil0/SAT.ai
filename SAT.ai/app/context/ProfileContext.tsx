import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
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
  profileImageUrl?: string;
  companyId?: string;
  // Add other profile fields as needed
}

interface ProfileContextType {
  userProfile: UserProfile | null;
  updateProfile: (profile: UserProfile) => void;
  refreshProfile: () => Promise<void>;
  isLoading: boolean;
  profileImage: string | null;
  updateProfileImage?: (url: string) => void;
  profilePhotoUri: string | null;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);

  const updateProfile = useCallback((profile: UserProfile) => {
    setUserProfile(profile);
  }, []);

  const refreshProfile = useCallback(async () => {
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
  }, []);

  // Initial profile fetch with debounce
  useEffect(() => {
    let isMounted = true;
    const fetchInitialProfile = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          setIsLoading(false);
          return;
        }

        const userData = await api.getUserProfile(userId);
        if (userData && isMounted) {
          setUserProfile(userData);
        }
      } catch (error) {
        console.error('Error fetching initial profile:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(fetchInitialProfile, 100); // Small delay to prevent race conditions
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && isMounted) {
        fetchInitialProfile();
      } else if (isMounted) {
        setUserProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  const contextValue = useMemo(() => ({
    userProfile,
    updateProfile,
    refreshProfile,
    isLoading,
    profileImage: userProfile?.profileImageUrl || null,
    updateProfileImage: (url: string) => {
      if (userProfile) {
        setUserProfile({ ...userProfile, profileImageUrl: url });
      }
    },
    profilePhotoUri
  }), [userProfile, isLoading, profilePhotoUri, updateProfile, refreshProfile]);

  return (
    <ProfileContext.Provider value={contextValue}>
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