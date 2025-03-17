import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  AlertScreen: undefined;
  Login: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

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
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
    const TIMER_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
    let idleTimer: NodeJS.Timeout;
    let timerCheckInterval: NodeJS.Timeout;

    const checkIdleTime = () => {
      const currentTime = Date.now();
      const timeSinceLastActivity = currentTime - lastActivity;

      if (timeSinceLastActivity >= IDLE_TIMEOUT && !isTimerActive) {
        // Start 15-minute timer after 5 minutes of inactivity
        setIsTimerActive(true);
        setIsIdle(true);
        navigation.navigate('AlertScreen');
      } else if (timeSinceLastActivity >= TIMER_DURATION && isTimerActive) {
        // If 15 minutes have passed since timer started
        navigation.navigate('AlertScreen');
      }
    };

    // Reset timer on any navigation state change
    const unsubscribe = navigation.addListener('state', () => {
      if (!isTimerActive) {
        setLastActivity(Date.now());
        setIsIdle(false);
      }
    });

    // Check idle time every minute
    idleTimer = setInterval(checkIdleTime, 60000);

    // More frequent checks when timer is active
    if (isTimerActive) {
      timerCheckInterval = setInterval(checkIdleTime, 1000);
    }

    return () => {
      clearInterval(idleTimer);
      if (timerCheckInterval) clearInterval(timerCheckInterval);
      unsubscribe();
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