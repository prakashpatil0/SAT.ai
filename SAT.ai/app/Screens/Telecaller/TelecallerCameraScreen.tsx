import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, Alert, Linking } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { format, addHours, differenceInSeconds } from 'date-fns';
import { collection, addDoc, getDocs, query, where, Timestamp, updateDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { detectFakeLocation, validateLocation, LocationValidationResult, LocationHistoryEntry } from '../../utils/fakeLocationDetector';

type RootStackParamList = {
  AttendanceScreen: {
    photo?: { uri: string };
    location?: { coords: { latitude: number; longitude: number } };
    locationName?: string | null;
    dateTime?: Date;
    isPunchIn?: boolean;
    isAutoPunchOut?: boolean;
    locationValidation?: LocationValidationResult;
  };
  CameraScreen: {
    isPunchIn: boolean;
  };
};

type CameraScreenRouteProp = RouteProp<RootStackParamList, 'CameraScreen'>;
type CameraScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CameraScreen'>;

const CameraScreen = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hasPermission, setHasPermission] = useState(false);
  const [cameraType, setCameraType] = useState<number>(0); // 0 is front, 1 is back
  const [photo, setPhoto] = useState<{ uri: string } | null>(null);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [flash, setFlash] = useState<boolean>(false);
  const [locationValidation, setLocationValidation] = useState<LocationValidationResult | null>(null);
  const [isValidatingLocation, setIsValidatingLocation] = useState(false);
  const [locationHistory, setLocationHistory] = useState<LocationHistoryEntry[]>([]);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
  
  const cameraRef = useRef<any>(null);
  const navigation = useNavigation<CameraScreenNavigationProp>();
  const route = useRoute<CameraScreenRouteProp>();
  const { isPunchIn } = route.params;
  const [isTimeValid, setIsTimeValid] = useState(true);
  const [timeValidationMessage, setTimeValidationMessage] = useState('');
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const locationTimeoutRef = useRef<NodeJS.Timeout>();

  // Function to get current IST time
  const getISTTime = () => {
    const now = new Date();
    // Add 5 hours and 30 minutes to convert to IST
    return addHours(now, 5.5);
  };

  // Reset photo when component mounts or isPunchIn changes
  useEffect(() => {
    setPhoto(null);
  }, [isPunchIn]);

  const getNetworkTime = async (): Promise<Date | null> => {
    // List of reliable time servers
    const timeServers = [
      // 'https://worldtimeapi.org/api/timezone/Asia/Kolkata',
      'https://timeapi.io/api/Time/current/zone?timeZone=Asia/Kolkata',
      'https://api.timezonedb.com/v2.1/get-time-zone?key=YOUR_API_KEY&format=json&by=zone&zone=Asia/Kolkata'
    ];

    for (const server of timeServers) {
      try {
        const response = await fetch(server);
        if (!response.ok) continue;
        
        const data = await response.json();
        // Different APIs return time in different formats
        if (data.datetime) {
          return new Date(data.datetime);
        } else if (data.dateTime) {
          return new Date(data.dateTime);
        } else if (data.formatted) {
          return new Date(data.formatted);
        }
      } catch (error) {
        console.log(`Failed to fetch from ${server}:`, error);
        continue;
      }
    }
    return null;
  };

  const validateDeviceTime = async () => {
    try {
      // Get network time (IST)
      const networkTime = await getNetworkTime();
      
      // Get server time
      const db = getFirestore();
      const timeCheckRef = doc(db, '_timeCheck', 'serverTime');
      const serverTime = await getDoc(timeCheckRef);
      const serverTimestamp = serverTime.data()?.timestamp;
      
      // Update server time
      await setDoc(timeCheckRef, {
        timestamp: Timestamp.now()
      }, { merge: true });

      if (!serverTimestamp) {
        console.error('Failed to get server timestamp');
        return false;
      }

      const deviceTime = new Date();
      const serverTimeDate = serverTimestamp.toDate();
      
      // Calculate server time difference
      const serverTimeDiff = Math.abs(deviceTime.getTime() - serverTimeDate.getTime());
      const isServerTimeValid = serverTimeDiff <= 5 * 60 * 1000; // 5 minutes tolerance
      
      // If we couldn't get network time, fall back to server time only
      if (!networkTime) {
        if (!isServerTimeValid) {
          const serverDiffMinutes = Math.round(serverTimeDiff / (60 * 1000));
          setTimeValidationMessage(
            `Device time differs from server time by ${serverDiffMinutes} minutes. ` +
            'Please sync your device time with network time to continue.'
          );
          setIsTimeValid(false);
          return false;
        }
        setTimeValidationMessage('');
        setIsTimeValid(true);
        return true;
      }
      
      // If we have network time, validate against both
      const networkTimeDiff = Math.abs(deviceTime.getTime() - networkTime.getTime());
      const isNetworkTimeValid = networkTimeDiff <= 5 * 60 * 1000;
      
      const isValid = isServerTimeValid && isNetworkTimeValid;
      
      if (!isValid) {
        let message = 'Time validation failed: ';
        if (!isServerTimeValid) {
          const serverDiffMinutes = Math.round(serverTimeDiff / (60 * 1000));
          message += `Device time differs from server time by ${serverDiffMinutes} minutes. `;
        }
        if (!isNetworkTimeValid) {
          const networkDiffMinutes = Math.round(networkTimeDiff / (60 * 1000));
          message += `Device time differs from network time by ${networkDiffMinutes} minutes. `;
        }
        message += 'Please sync your device time with network time to continue.';
        
        setTimeValidationMessage(message);
        setIsTimeValid(false);
        return false;
      }
      
      setTimeValidationMessage('');
      setIsTimeValid(true);
      return true;
    } catch (error) {
      console.error('Time validation error:', error);
      setTimeValidationMessage('Unable to validate time. Please check your internet connection and try again.');
      setIsTimeValid(false);
      return false;
    }
  };

  // Enhanced location fetching with fake location detection
  const fetchLocation = async (useHighAccuracy = false) => {
    try {
      const options: Location.LocationOptions = {
        accuracy: useHighAccuracy ? Location.Accuracy.Highest : Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      };

      const location = await Location.getCurrentPositionAsync(options);
      
      // Validate location before setting it
      setIsValidatingLocation(true);
      const validationResult = await detectFakeLocation(location);
      setLocationValidation(validationResult);
      
      if (validationResult.isFakeLocation) {
        Alert.alert(
          'Suspicious Location Detected',
          `We detected potential location spoofing:\n\n${validationResult.warnings.join('\n')}\n\nConfidence: ${validationResult.confidence}%\n\nPlease ensure you are at your actual work location and try again.`,
          [
            {
              text: 'Try Again',
              onPress: () => {
                setIsValidatingLocation(false);
                fetchLocation(true);
              }
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => navigation.goBack()
            }
          ]
        );
        setIsValidatingLocation(false);
        return;
      }

      setLocation(location);
      setIsValidatingLocation(false);
      
      // Get address from coordinates
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      if (geocode.length > 0) {
        const address = geocode[0];
        const addressString = [
          address.name,
          address.street,
          address.district,
          address.city,
          address.region,
          address.postalCode,
          address.country
        ]
          .filter(Boolean)
          .join(', ');
        
        setLocationAddress(addressString);
      }
      
      setIsLocationLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setIsValidatingLocation(false);
      // If low accuracy fails, try high accuracy
      if (!useHighAccuracy) {
        await fetchLocation(true);
      } else {
        setIsLocationLoading(false);
      }
    }
  };

  // Start continuous location monitoring
  const startLocationMonitoring = async () => {
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000, // Check every 10 seconds
          distanceInterval: 5, // Update if moved 5 meters
        },
        async (newLocation) => {
          // Validate new location
          const validationResult = await detectFakeLocation(newLocation);
          setLocationValidation(validationResult);
          
          if (!validationResult.isFakeLocation) {
            setLocation(newLocation);
          }
        }
      );
      
      setLocationSubscription(subscription);
    } catch (error) {
      console.error('Error starting location monitoring:', error);
    }
  };

  // Start location fetching immediately
  useEffect(() => {
    let isMounted = true;
    
    const startLocationFetch = async () => {
      if (isMounted) {
        setIsLocationLoading(true);
        await fetchLocation();
        await startLocationMonitoring();
      }
    };

    startLocationFetch();

    // Set a timeout to try high accuracy if location takes too long
    locationTimeoutRef.current = setTimeout(() => {
      if (isMounted && isLocationLoading) {
        fetchLocation(true);
      }
    }, 5000);

    return () => {
      isMounted = false;
      if (locationTimeoutRef.current) {
        clearTimeout(locationTimeoutRef.current);
      }
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Modify the existing useEffect to remove location fetching
  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (!isMounted) return;
      
      setHasPermission(cameraStatus === 'granted' && locationStatus === 'granted');
      
      // Add time validation
      const isTimeValid = await validateDeviceTime();
      if (!isTimeValid && isMounted) {
        Alert.alert(
          'Time Sync Required',
          timeValidationMessage,
          [
            {
              text: 'Retry',
              onPress: async () => {
                const isValid = await validateDeviceTime();
                if (isValid && isMounted) {
                  setIsTimeValid(true);
                  setTimeValidationMessage('');
                }
              }
            },
            {
              text: 'Cancel',
              onPress: () => navigation.goBack(),
              style: 'cancel'
            }
          ]
        );
      }
    })();
    
    // Update the time every second with IST
    const timer = setInterval(() => {
      if (isMounted) {
        setCurrentTime(getISTTime());
      }
    }, 1000);
    
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Enhanced takePicture with location validation
  const takePicture = async () => {
    if (!isTimeValid) {
      Alert.alert(
        'Time Sync Required',
        timeValidationMessage,
        [
          {
            text: 'Retry',
            onPress: validateDeviceTime
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
      return;
    }

    if (!location) {
      Alert.alert(
        'Location Required',
        'Please wait for location to be detected or check your location permissions.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (isValidatingLocation) {
      Alert.alert(
        'Validating Location',
        'Please wait while we validate your location...',
        [{ text: 'OK' }]
      );
      return;
    }

    if (locationValidation?.isFakeLocation) {
      Alert.alert(
        'Suspicious Location Detected',
        'Please ensure you are at your actual work location and try again.',
        [
          {
            text: 'Try Again',
            onPress: () => fetchLocation(true)
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
      return;
    }

    if (cameraRef.current && location) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        setPhoto(photo);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture. Please try again.');
      }
    }
  };

  const flipCamera = () => {
    setCameraType(cameraType === 0 ? 1 : 0);
  };

  // Enhanced renderPhotoPreview with location validation info
  const renderPhotoPreview = () => {
    return (
      <View style={styles.previewContainer}>
        {photo && <Image source={{ uri: photo.uri }} style={styles.preview} />}
        <View style={styles.previewOverlay}>
          <View style={styles.previewAddress}>
            <Text style={styles.previewAddressText}>
              {locationAddress || 'Location captured'}
            </Text>
          </View>
          <View style={styles.previewDate}>
            <MaterialIcons name="event" size={20} color="#FF8447" />
            <Text style={styles.previewDateText}>
              {format(currentTime, 'dd MMM yyyy, h:mm a')}
            </Text>
          </View>
          
          {/* Location validation status */}
          {locationValidation && (
            <View style={[
              styles.locationValidationContainer,
              { backgroundColor: locationValidation.isFakeLocation ? 'rgba(255, 82, 82, 0.9)' : 'rgba(76, 175, 80, 0.9)' }
            ]}>
              <MaterialIcons 
                name={locationValidation.isFakeLocation ? "warning" : "check-circle"} 
                size={20} 
                color="white" 
              />
              <Text style={styles.locationValidationText}>
                {locationValidation.isFakeLocation 
                  ? `Location Suspicious (${locationValidation.confidence}% confidence)`
                  : 'Location Validated'
                }
              </Text>
            </View>
          )}

          {!isTimeValid && (
            <View style={styles.timeWarningContainer}>
              <MaterialIcons name="warning" size={20} color="#FF5252" />
              <Text style={styles.timeWarningText}>{timeValidationMessage}</Text>
            </View>
          )}
        </View>
        <View style={styles.previewButtons}>
          <TouchableOpacity 
            style={styles.previewButton}
            onPress={() => setPhoto(null)}
          >
            <MaterialIcons name="replay" size={24} color="#FF5252" />
            <Text style={[styles.previewButtonText, { color: '#FF5252' }]}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.previewButton, 
              styles.confirmButton,
              (!isTimeValid || (locationValidation?.isFakeLocation)) && styles.disabledButton
            ]}
            onPress={async () => {
              if (!isTimeValid) {
                Alert.alert(
                  'Time Sync Required',
                  timeValidationMessage,
                  [
                    {
                      text: 'Retry',
                      onPress: validateDeviceTime
                    },
                    {
                      text: 'Cancel',
                      style: 'cancel'
                    }
                  ]
                );
                return;
              }

              if (locationValidation?.isFakeLocation) {
                Alert.alert(
                  'Suspicious Location Detected',
                  'Please ensure you are at your actual work location and try again.',
                  [
                    {
                      text: 'Try Again',
                      onPress: () => {
                        setPhoto(null);
                        fetchLocation(true);
                      }
                    },
                    {
                      text: 'Cancel',
                      style: 'cancel'
                    }
                  ]
                );
                return;
              }

              if (location && photo) {
                try {
                  const istTime = getISTTime();
                  const currentHour = istTime.getHours();
                  const isAutoPunchOut = !isPunchIn && currentHour >= 23;

                  navigation.navigate('Attendance' as never, {
                    photo: { uri: photo.uri },
                    location: {
                      coords: {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude
                      }
                    },
                    locationName: locationAddress,
                    dateTime: istTime,
                    isPunchIn,
                    isAutoPunchOut,
                    locationValidation: locationValidation || undefined
                  });
                } catch (error) {
                  console.error('Navigation error:', error);
                  Alert.alert('Error', 'Failed to navigate to attendance screen. Please try again.');
                }
              } else {
                Alert.alert('Error', 'Location or photo not available. Please try again.');
              }
            }}
            disabled={!isTimeValid || (locationValidation?.isFakeLocation || false)}
          >
            <MaterialIcons name="check" size={24} color={isTimeValid && !locationValidation?.isFakeLocation ? "#4CAF50" : "#999"} />
            <Text style={[
              styles.previewButtonText, 
              { color: isTimeValid && !locationValidation?.isFakeLocation ? "#4CAF50" : "#999" }
            ]}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Enhanced location display with validation status
  const renderLocationInfo = () => (
    <View style={styles.locationContainer}>
      <MaterialIcons name="location-on" size={24} color="#FF8447" />
      <Text style={styles.locationText}>
        {isLocationLoading 
          ? 'Getting location...' 
          : isValidatingLocation
          ? 'Validating location...'
          : locationAddress || 'Location not available'}
      </Text>
      {locationValidation && (
        <View style={[
          styles.locationStatusIndicator,
          { backgroundColor: locationValidation.isFakeLocation ? '#FF5252' : '#4CAF50' }
        ]}>
          <MaterialIcons 
            name={locationValidation.isFakeLocation ? "warning" : "check-circle"} 
            size={16} 
            color="white" 
          />
        </View>
      )}
    </View>
  );

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera and location permissions are required.</Text>
        <TouchableOpacity style={styles.captureButton} onPress={() => navigation.goBack()}>
          <Text style={styles.captureText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {photo ? (
        renderPhotoPreview()
      ) : (
        <CameraView 
          ref={cameraRef}
          style={styles.camera}
          facing={cameraType === 0 ? "front" : "back"}
        >
          <View style={styles.overlay}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.flipButton}
              onPress={flipCamera}
            >
              <MaterialIcons name="flip-camera-android" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.flashButton}
              onPress={() => {
                setFlash(!flash);
                if (cameraRef.current) {
                  console.log('Flash toggled:', !flash);
                }
              }}
            >
              <MaterialIcons 
                name={flash ? "flash-on" : "flash-off"} 
                size={24} 
                color="white" 
              />
            </TouchableOpacity>

            {renderLocationInfo()}

            <View style={styles.dateTimeContainer}>
              <MaterialIcons name="event" size={24} color="#FF8447" />
              <Text style={styles.dateTimeText}>
                {format(getISTTime(), 'dd-MM-yyyy')}
              </Text>
            </View>

            <View style={styles.timeContainer}>
              <MaterialIcons name="access-time" size={24} color="#FF8447" />
              <Text style={styles.dateTimeText}>
                {format(getISTTime(), 'h:mm:ss a')}
              </Text>
            </View>

            {!isTimeValid && (
              <View style={styles.timeWarningBanner}>
                <MaterialIcons name="warning" size={24} color="#FFF" />
                <Text style={styles.timeWarningBannerText}>{timeValidationMessage}</Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.captureButton, 
                  (!location || !isTimeValid || isValidatingLocation) && styles.disabledButton
                ]}
                onPress={takePicture}
                disabled={!location || !isTimeValid || isValidatingLocation}
              >
                <Text style={styles.captureText}>
                  {isValidatingLocation 
                    ? 'Validating...' 
                    : isPunchIn ? 'Punch In' : 'Punch Out'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 20,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 1,
    padding: 10,
  },
  flipButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  flashButton: {
    position: 'absolute',
    top: 40,
    right: 80,
    zIndex: 1,
    padding: 10,
  },
  locationContainer: {
    position: 'absolute',
    bottom: 180,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  locationText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    marginLeft: 10,
    flex: 1,
  },
  locationStatusIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  dateTimeContainer: {
    position: 'absolute',
    bottom: 130,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  timeContainer: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 8,
  },
  dateTimeText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    marginLeft: 10,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    backgroundColor: '#FF8447',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
    opacity: 0.7,
  },
  captureText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
  },
  previewContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  preview: {
    flex: 1,
    width: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 15,
  },
  previewAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewDate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewAddressText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    marginLeft: 10,
    flex: 1,
  },
  previewDateText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    marginLeft: 10,
  },
  locationValidationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  locationValidationText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    marginLeft: 8,
    flex: 1,
  },
  previewButtons: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
  },
  confirmButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  previewButtonText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    marginLeft: 8,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    marginBottom: 20,
    textAlign: 'center',
    padding: 20,
  },
  timeWarningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.9)',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  timeWarningText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    marginLeft: 8,
    flex: 1,
  },
  timeWarningBanner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.9)',
    padding: 12,
    borderRadius: 8,
  },
  timeWarningBannerText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    marginLeft: 8,
    flex: 1,
  },
});

export default CameraScreen;