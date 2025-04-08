import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, Dimensions, AppState, TouchableOpacity, Platform } from "react-native";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import AppGradient from "@/app/components/AppGradient";
import * as Animatable from "react-native-animatable";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "@/app/types/navigation"; // Adjust the path if needed
import { storage } from '@/firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type TelecallerIdleTimerRouteProp = RouteProp<RootStackParamList, 'TelecallerIdleTimer'>;

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const FINAL_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const WARNING_INTERVALS = [5, 3, 1]; // Minutes before final timeout

const TelecallerIdleTimer = () => {
  const navigation = useNavigation();
  const route = useRoute<TelecallerIdleTimerRouteProp>();

  const [idleTime, setIdleTime] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [idleCount, setIdleCount] = useState(0);
  const [sirenGifUrl, setSirenGifUrl] = useState<string | null>(null);
  const [alarmSoundUrl, setAlarmSoundUrl] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (route.params?.activateImmediately) {
      setIsActive(true);
    }
  }, [route.params]);

  useEffect(() => {
    loadIdleCount();
    loadFirebaseAssets();
    return () => {
      // Clean up sound when component unmounts
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const loadFirebaseAssets = async () => {
    try {
      setLoading(true);
      // Load siren GIF from Firebase Storage
      const sirenRef = ref(storage, 'assets/siren.gif');
      const sirenUrl = await getDownloadURL(sirenRef);
      setSirenGifUrl(sirenUrl);
      
      // Load alarm sound from Firebase Storage
      const alarmRef = ref(storage, 'assets/alarmsound.mp3');
      const alarmUrl = await getDownloadURL(alarmRef);
      setAlarmSoundUrl(alarmUrl);
      
      // Load the sound file
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: alarmUrl },
        { shouldPlay: false }
      );
      setSound(newSound);
      
      console.log('Firebase assets loaded successfully');
    } catch (error) {
      console.error('Error loading Firebase assets:', error);
    } finally {
      setLoading(false);
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
      return newCount;
    } catch (error) {
      console.error('Error incrementing idle count:', error);
      return idleCount;
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let lastActivity = Date.now();

    const setupNotifications = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Please enable notifications to receive idle warnings');
      }
    };

    const resetTimer = () => {
      lastActivity = Date.now();
      setIdleTime(0);
      setWarningCount(0);
      setIsActive(false);
    };

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        resetTimer();
      }
    };

    const checkIdleTime = () => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastActivity;

      if (timeDiff >= FINAL_TIMEOUT) {
        handleLogout();
      } else if (timeDiff >= IDLE_TIMEOUT) {
        setIdleTime(timeDiff);
        setIsActive(true);

        const remainingTime = (FINAL_TIMEOUT - timeDiff) / (60 * 1000);
        if (WARNING_INTERVALS.includes(Math.floor(remainingTime)) && warningCount < WARNING_INTERVALS.length) {
          showWarningNotification(Math.floor(remainingTime));
          playAlarmSound();
          setWarningCount(prev => prev + 1);
        }
      }
    };

    const playAlarmSound = async () => {
      try {
        if (sound) {
          await sound.setPositionAsync(0);
          try {
            await sound.playAsync();
          } catch (playError: any) {
            // Handle specific audio focus error
            if (playError.message && playError.message.includes("audio focus could not be acquired")) {
              console.warn("Audio focus could not be acquired, retrying with lower volume...");
              
              // Retry with lower volume
              await sound.setVolumeAsync(0.5);
              await sound.playAsync();
            } else {
              throw playError; // Re-throw if it's a different error
            }
          }
        }
      } catch (error) {
        console.error('Error playing alarm sound:', error);
      }
    };

    const showWarningNotification = async (minutesLeft: number) => {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Inactivity Warning',
          body: `You have been inactive for ${10 - minutesLeft} minutes. System will log you out in ${minutesLeft} minutes.`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
    };

    const handleLogout = async () => {
      const newCount = await incrementIdleCount();

      if (newCount >= 3) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Session Terminated',
            body: `You have been logged out due to inactivity. This is your ${newCount}${getOrdinalSuffix(newCount)} idle timeout.`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null,
        });

        await AsyncStorage.clear();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' as never }],
        });
      }
    };

    setupNotifications();
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    timer = setInterval(checkIdleTime, 1000);

    return () => {
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [navigation, isActive, warningCount, idleCount, sound]);

  const getOrdinalSuffix = (n: number) => {
    const j = n % 10;
    const k = n % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isActive) {
    return (
      <AppGradient>
        <TelecallerMainLayout showDrawer showBackButton={true} title="Idle Timer Warning">
          <View style={styles.container}>
            {loading ? (
              <View style={[styles.imageContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.loadingText}>Loading assets...</Text>
              </View>
            ) : (
              <Animatable.View
                animation="pulse"
                easing="ease-out"
                iterationCount="infinite"
                duration={2000}
                style={styles.imageContainer}
              >
                <Image
                  source={sirenGifUrl ? { uri: sirenGifUrl } : undefined}
                  style={styles.alertImage}
                  resizeMode="contain"
                />
              </Animatable.View>
            )}
  
            <Animatable.Text
              animation="flash"
              iterationCount="infinite"
              duration={2000}
              style={styles.infoText}
            >
              You have been Idle for {formatTime(idleTime)}
            </Animatable.Text>
  
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>
                Auto logout in: {formatTime(FINAL_TIMEOUT - idleTime)}
              </Text>
            </View>
  
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsHeader}>Warning Information</Text>
              <View style={styles.instructionItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.instructionsText}>The idle timer will ring a total of three times.</Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.instructionsText}>On the third ring, your phone will automatically lock.</Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.instructionsText}>Once locked, please visit management to have your phone unlocked so you can resume work.</Text>
              </View>
            </View>
          </View>
        </TelecallerMainLayout>
      </AppGradient>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  imageContainer: {
    width: width * 0.6,
    height: width * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  alertImage: {
    width: 300,
    height: 300,
  },
  infoText: {
    fontSize: 18,
    color: '#FF3B30',
    textAlign: "center",
    marginVertical: 20,
    fontFamily: "LexendDeca_600SemiBold",
  },
  timerContainer: {
    borderRadius: 10,
    marginBottom: 15,
  },
  timerText: {
    fontSize: 16,
    color: '#FF3B30',
    fontFamily: "LexendDeca_500Medium",
  },
  instructionsContainer: {
    backgroundColor: 'white',
    borderRadius: 15,
    width: '100%',
    marginBottom: 60,
  },
  instructionsHeader: {
    fontSize: 18,
    color: "#293646",
    fontFamily: "LexendDeca_600SemiBold",
    marginBottom: 15,
    textAlign: 'center',
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  bulletPoint: {
    fontSize: 14,
    color: "#FF8447",
    marginRight: 8,
    fontFamily: "LexendDeca_500Medium",
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "LexendDeca_500Medium",
    color: "#293646",
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    fontFamily: "LexendDeca_500Medium",
  }
});

export default TelecallerIdleTimer;