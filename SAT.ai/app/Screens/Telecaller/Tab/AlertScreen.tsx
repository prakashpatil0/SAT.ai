import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Vibration, TouchableWithoutFeedback } from "react-native";
import Svg, { G, Text as SvgText, Line } from "react-native-svg";
import { Audio } from "expo-av";
import { useNavigation } from "@react-navigation/native";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import AppGradient from "@/app/components/AppGradient";
import { useIdleTimer } from '@/context/IdleTimerContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getAuth, signOut } from 'firebase/auth';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  TelecallerIdleTimer: { activateImmediately: boolean };
  Login: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

const AlertScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { resetIdleTimer, isTimerActive } = useIdleTimer();
  const initialTime = 15 * 60; // 15 minutes in seconds
  const [secondsRemaining, setSecondsRemaining] = useState(initialTime);
  const [isRinging, setIsRinging] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [idleCount, setIdleCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const radius = 80;
  const strokeWidth = 4;
  const dashCount = 60;

  useEffect(() => {
    loadIdleCount();
    setupNotifications();
  }, []);

  const setupNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
    }
  };

  const loadIdleCount = async () => {
    try {
      const count = await AsyncStorage.getItem('idleLogoutCount');
      setIdleCount(count ? parseInt(count) : 0);
    } catch (error) {
      console.error('Error loading idle count:', error);
    }
  };

  const incrementIdleCount = async () => {
    try {
      const newCount = idleCount + 1;
      await AsyncStorage.setItem('idleLogoutCount', newCount.toString());
      setIdleCount(newCount);
    } catch (error) {
      console.error('Error incrementing idle count:', error);
    }
  };

  const sendLogoutNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Auto Logout Due to Inactivity',
          body: `You have been logged out due to ${initialTime / 60} minutes of inactivity. This is your ${idleCount + 1}th idle logout.`,
          data: { type: 'idle_logout' },
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      await incrementIdleCount();
      await sendLogoutNotification();
      const auth = getAuth();
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Error during logout:', error);
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    if (!isTimerActive) {
      setSecondsRemaining(initialTime);
      stopAlertSound();
      return;
    }

    if (secondsRemaining <= 0) {
      startAlertSound();
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsRemaining, isTimerActive]);

  const handleScreenPress = () => {
    if (isTimerActive && secondsRemaining < initialTime) {
      resetIdleTimer();
      setSecondsRemaining(initialTime);
      stopAlertSound();
    }
  };

  const startAlertSound = async () => {
    setIsRinging(true);
    Vibration.vibrate([500, 500, 500]);

    try {
      // First unload any existing sound
      if (sound) {
        await sound.unloadAsync();
      }

      // Configure audio mode before creating the sound
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
        interruptionModeIOS: 1, // DoNotMix
        interruptionModeAndroid: 1, // DoNotMix
      });

      // Create and load the sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        require("@/assets/sound/alarmsound.mp3"),
        { 
          shouldPlay: true,
          volume: 1.0,
          rate: 1.0,
          shouldCorrectPitch: true,
        }
      );

      if (!newSound) {
        throw new Error("Failed to create sound object");
      }

      // Set the sound and play it
      setSound(newSound);
      
      try {
        await newSound.playAsync();
      } catch (playError: any) {
        // Handle specific audio focus error
        if (playError.message && playError.message.includes("audio focus could not be acquired")) {
          console.warn("Audio focus could not be acquired, retrying with lower volume...");
          
          // Retry with lower volume
          await newSound.setVolumeAsync(0.5);
          await newSound.playAsync();
        } else {
          throw playError; // Re-throw if it's a different error
        }
      }
      
      // Navigate to TelecallerIdleTimer screen
      navigation.navigate('TelecallerIdleTimer', { activateImmediately: true });

      // Set timeout for auto logout
      setTimeout(() => {
        handleLogout();
      }, 5000); // 5 seconds delay before logout
    } catch (error) {
      console.error("Error playing sound:", error);
      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          stack: error.stack
        });
      }
      
      if (sound) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
          setSound(null);
        } catch (cleanupError) {
          console.error("Error cleaning up sound:", cleanupError);
        }
      }
      setIsRinging(false);
      
      // Even if sound fails, still navigate to the idle timer screen
      navigation.navigate('TelecallerIdleTimer', { activateImmediately: true });
    }
  };

  const stopAlertSound = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
    setIsRinging(false);
  };

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBackButton={true} title="Idle Timer">
        <TouchableWithoutFeedback onPress={handleScreenPress}>
          <View style={styles.container}>
            <View style={styles.svgContainer}>
              <Svg height="300" width="300" viewBox="0 0 200 200">
                <G rotation="-90" origin="100, 100">
                  {[...Array(60)].map((_, index) => {
                    const angle = (index * 6 * Math.PI) / 180;
                    const x1 = 100 + radius * Math.cos(angle);
                    const y1 = 100 + radius * Math.sin(angle);
                    const x2 = 100 + (radius + 10) * Math.cos(angle);
                    const y2 = 100 + (radius + 10) * Math.sin(angle);

                    return (
                      <Line
                        key={index}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={index < (initialTime - secondsRemaining) / 15 ? "#FF8447" : "#E0E0E0"}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                      />
                    );
                  })}
                </G>

                <SvgText
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dy=".3em"
                  fontSize="24"
                  fontFamily="LexendDeca_400Regular"
                  fill="#FF8447"
                >
                  {formatTime(secondsRemaining)}
                </SvgText>

                <SvgText
                  x="50%"
                  y="65%"
                  textAnchor="middle"
                  fontSize="14"
                  fontFamily="LexendDeca_400Regular"
                  fill="#FF8447"
                >
                  Total 15 minutes
                </SvgText>
              </Svg>
            </View>

            <Text style={styles.infoText}>
              {isTimerActive ? "Timer Active - Tap anywhere to reset" : "Timer Paused"}
            </Text>

            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsHeader}>Idle Timer Instructions</Text>
              <Text style={styles.instructionsText}>• The idle timer will ring after {initialTime / 60} minutes of inactivity.</Text>
              <Text style={styles.instructionsText}>• You will be automatically logged out after the timer ends.</Text>
              <Text style={styles.instructionsText}>• Timer resets when you interact with the screen.</Text>
              <Text style={styles.instructionsText}>• Total idle timeouts: {idleCount}</Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: "center",
  },
  header: {
    fontSize: 20,
    fontFamily: "LexendDeca_600SemiBold",
    marginBottom: 20,
    color: "#262626",
    flexDirection: "row",
  },
  svgContainer: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    backgroundColor: "#FFF",
    borderRadius: 15,
  },
  infoText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginTop: 10,
    fontFamily: "LexendDeca_500Medium",
  },
  instructionsContainer: {
    marginTop: 15,
    width: "100%",
    marginBottom: 60,
  },
  instructionsHeader: {
    fontSize: 16,
    color: "#293646",
    fontFamily: "LexendDeca_500Medium",
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 14,
    fontFamily: "LexendDeca_500Medium",
    color: "#293646",
    marginBottom: 5,
  },
});

export default AlertScreen;