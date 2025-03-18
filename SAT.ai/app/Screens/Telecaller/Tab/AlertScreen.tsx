import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Alert, Vibration, TouchableWithoutFeedback } from "react-native";
import Svg, { G, Text as SvgText, Line } from "react-native-svg";
import { Audio } from "expo-av";
import * as ScreenOrientation from "expo-screen-orientation";
import { useNavigation } from "@react-navigation/native";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import AppGradient from "@/app/components/AppGradient";
import { useIdleTimer } from '@/context/IdleTimerContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AlertScreen = () => {
  const navigation = useNavigation();
  const { resetIdleTimer, isTimerActive } = useIdleTimer();
  const initialTime = 600; // 10 minutes in seconds
  const [secondsRemaining, setSecondsRemaining] = useState(initialTime);
  const [isRinging, setIsRinging] = useState(false);
  const [sound, setSound] = useState(null);
  const [idleCount, setIdleCount] = useState(0);

  const radius = 80;
  const strokeWidth = 4;
  const dashCount = 60; // 60 dashes
  const dashAngle = 360 / dashCount; // Angle between each dash

  useEffect(() => {
    loadIdleCount();
  }, []);

  const loadIdleCount = async () => {
    try {
      const count = await AsyncStorage.getItem('idleLogoutCount');
      setIdleCount(count ? parseInt(count) : 0);
    } catch (error) {
      console.error('Error loading idle count:', error);
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
      const { sound } = await Audio.Sound.createAsync(
        require("@/assets/Sounds/alarm-siren-sound.mp3"),
        { shouldPlay: true }
      );
      await sound.playAsync();
      setSound(sound as any);
    } catch (error) {
      console.error("Error playing sound", error);
    }
    navigation.navigate('TelecallerIdleTimer' as never);
  };

  const stopAlertSound = async () => {
    if (sound) {
      await (sound as Audio.Sound).stopAsync();
      await (sound as Audio.Sound).unloadAsync();
      setSound(null);
    }
    setIsRinging(false);
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  return (
    <AppGradient>
      <TelecallerMainLayout showDrawer showBackButton={true} title="Idle Timer">
        <TouchableWithoutFeedback onPress={handleScreenPress}>
          <View style={styles.container}>
            <View style={styles.svgContainer}>
              <Svg height="300" width="300" viewBox="0 0 200 200">
                <G rotation="-90" origin="100, 100">
                  {[...Array(dashCount)].map((_, index) => {
                    const angle = (index * dashAngle * Math.PI) / 180;
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
                        stroke={index < (initialTime - secondsRemaining) / 10 ? "#FF8447" : "#E0E0E0"}
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
                  fontSize="30"
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
                  Total 10 minutes
                </SvgText>
              </Svg>
            </View>

            <Text style={styles.infoText}>
              {isTimerActive ? "Timer Active - Tap anywhere to reset" : "Timer Paused"}
            </Text>

            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsHeader}>Idle Timer Instructions</Text>
              <Text style={styles.instructionsText}>• The idle timer will ring a total of three times.</Text>
              <Text style={styles.instructionsText}>• On the third ring, your phone will automatically lock.</Text>
              <Text style={styles.instructionsText}>
                • Once locked, please visit management to have your phone unlocked.
              </Text>
              <Text style={styles.instructionsText}>
                • Timer resets when you interact with the screen.
              </Text>
              <Text style={styles.instructionsText}>
                • Timer restarts after 5 minutes of inactivity.
              </Text>
              <Text style={styles.instructionsText}>
                • Total idle timeouts: {idleCount}
              </Text>
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
    marginTop: 20,
    width: "100%",
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