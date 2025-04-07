import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

type IdleTimerContextType = {
  resetIdleTimer: () => void;
  isIdle: boolean;
  isTimerActive: boolean;
};

const IdleTimerContext = createContext<IdleTimerContextType | undefined>(undefined);

export const IdleTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isIdle, setIsIdle] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const navigation = useNavigation();

  // Configure notifications
  useEffect(() => {
    const setupNotifications = async () => {
      if (Platform.OS !== 'web') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('Notification permissions not granted');
        }
      }
    };

    setupNotifications();
  }, []);

  useEffect(() => {
    const IDLE_TIMEOUT = 1 * 60 * 1000; // 5 minutes
    let idleCheckInterval: NodeJS.Timeout;

    const checkIdleTime = () => {
      const currentTime = Date.now();
      const timeSinceLastActivity = currentTime - lastActivity;

      if (timeSinceLastActivity >= IDLE_TIMEOUT && !isTimerActive) {
        setIsTimerActive(true);
        setIsIdle(true);
        navigation.navigate('AlertScreen' as never);
      }
    };

    // Handle app state changes
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        setLastActivity(Date.now());
      }
    };

    // Set up app state listener
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Set up navigation state listener
    const unsubscribeNavigation = navigation.addListener('state', () => {
      if (!isTimerActive) {
        setLastActivity(Date.now());
        setIsIdle(false);
      }
    });

    // Start idle check interval
    idleCheckInterval = setInterval(checkIdleTime, 60000); // Check every minute

    return () => {
      clearInterval(idleCheckInterval);
      appStateSubscription.remove();
      unsubscribeNavigation();
    };
  }, [lastActivity, navigation, isTimerActive]);

  const resetIdleTimer = () => {
    setLastActivity(Date.now());
    setIsIdle(false);
    setIsTimerActive(false);
  };

  return (
    <IdleTimerContext.Provider value={{ resetIdleTimer, isIdle, isTimerActive }}>
      {children}
    </IdleTimerContext.Provider>
  );
};

export const useIdleTimer = () => {
  const context = useContext(IdleTimerContext);
  if (context === undefined) {
    throw new Error('useIdleTimer must be used within an IdleTimerProvider');
  }
  return context;
}; 