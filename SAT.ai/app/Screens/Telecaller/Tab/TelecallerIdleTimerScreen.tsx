import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  BackHandler,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Device from 'expo-device';
import { Audio } from 'expo-av';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import AppGradient from '@/app/components/AppGradient';

const TOTAL_DOTS = 40;
const TIMER_DURATION = 1 * 60; // 15 minutes in seconds
const RING_TOTAL = 3;

const TelecallerIdleTimerScreen = () => {
  const navigation = useNavigation();
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [ringCount, setRingCount] = useState(2); // Starting at 2 as per requirement
  const timerRef = useRef<NodeJS.Timeout>();
  const soundRef = useRef<Audio.Sound>();

  useEffect(() => {
    loadSound();
    startTimer();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      unloadSound();
    };
  }, []);

  const loadSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('@/app/assets/sound/alarmsound.mp3')
      );
      soundRef.current = sound;
    } catch (error) {
      console.error('Error loading sound:', error);
    }
  };

  const unloadSound = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }
  };

  const playAlarmSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          handleTimerComplete();
          return TIMER_DURATION;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  const handleTimerComplete = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Play alarm sound
    await playAlarmSound();

    // Navigate to alert screen
    navigation.navigate('TelecallerIdleAlertScreen' as never);

    if (ringCount >= RING_TOTAL - 1) {
      // On third ring, lock the device
      if (Platform.OS === 'android') {
        try {
          // Add a small delay to ensure the alert screen is shown
          setTimeout(async () => {
            try {
              // Note: Device.lockAsync() might not be available in all versions
              // You may need to implement a custom solution for device locking
              await BackHandler.exitApp(); // Alternative approach
            } catch (error) {
              console.error('Failed to lock device:', error);
            }
          }, 2000);
        } catch (error) {
          console.error('Failed to lock device:', error);
        }
      }
    } else {
      setRingCount((prev) => prev + 1);
      startTimer();
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const calculateDotColor = (index: number) => {
    const dotsPerSecond = TOTAL_DOTS / TIMER_DURATION;
    const activeDots = Math.ceil(timeLeft * dotsPerSecond);
    const isActive = index < activeDots;
    
    // First half of the circle is green, second half is orange
    const isFirstHalf = index < TOTAL_DOTS / 2;
    return isActive ? (isFirstHalf ? '#2E7D32' : '#FF8447') : '#E0E0E0';
  };

  return (
    <AppGradient>
      <TelecallerMainLayout title="Idle Timer" showBackButton={true} showBottomTabs={true}>
        <View style={styles.container}>
          <View style={styles.header}>
          </View>

          <View style={styles.timerContainer}>
            <View style={styles.dotContainer}>
              {Array.from({ length: TOTAL_DOTS }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    { backgroundColor: calculateDotColor(index) },
                    {
                      transform: [
                        {
                          rotate: `${(index * (360 / TOTAL_DOTS))}deg`,
                        },
                        { translateY: -140 },
                      ],
                    },
                  ]}
                />
              ))}
            </View>

            <View style={styles.timeTextContainer}>
              <Text style={styles.timeText}>{formatTime(timeLeft)}</Text>
              <Text style={styles.totalTimeText}>Total 15 minutes</Text>
            </View>
            <Text style={styles.ringCountText}>
              Rung {ringCount} Times so far
            </Text>
          </View>

          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>Idle Timer Instructions</Text>
            <View style={styles.instructionsList}>
              <Text style={styles.instructionText}>• The idle timer will ring a total of three times.</Text>
              <Text style={styles.instructionText}>• On the third ring, your phone will automatically lock.</Text>
              <Text style={styles.instructionText}>• Once locked, please visit management to have your phone unlocked so you can resume work.</Text>
            </View>
          </View>
        </View>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#000',
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    height: 260,
  },
  dotContainer: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  dot: {
    width: 6,
    height: 20,
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderRadius: 4,
  },
  timeTextContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 48,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#FF8447',
  },
  totalTimeText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 8,
  },
  ringCountText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 16,
  },
  instructionsContainer: {
    padding: 24,
    marginTop: 10,
  },
  instructionsTitle: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#000',
    marginBottom: 16,
  },
  instructionsList: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
  },
  instructionText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default TelecallerIdleTimerScreen; 