import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, Alert, ActivityIndicator } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { format, addHours } from 'date-fns';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

type RootStackParamList = {
  BDMAttendanceScreen: {
    photo?: { uri: string };
    location?: { coords: { latitude: number; longitude: number } };
    locationName?: string | null; 
    dateTime?: Date;
    isPunchIn?: boolean;
  };
  BDMCameraScreen: {
    type: 'in' | 'out';
  };
};

type BDMCameraScreenRouteProp = RouteProp<RootStackParamList, 'BDMCameraScreen'>;
type BDMCameraScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BDMCameraScreen'>;

const getISTTime = () => {
  const now = new Date();
  return addHours(now, 5.5); // Add 5 hours and 30 minutes for IST
};

const getNetworkTime = async (): Promise<Date | null> => {
  // List of reliable time servers
  const timeServers = [
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
      continue;
    }
  }
  return null;
};

const BDMCameraScreen = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hasPermission, setHasPermission] = useState(false);
  const [cameraType, setCameraType] = useState<number>(0);
  const [photo, setPhoto] = useState<{ uri: string } | null>(null);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [flash, setFlash] = useState<boolean>(false);
  const [isTimeValid, setIsTimeValid] = useState(true);
  const [timeValidationMessage, setTimeValidationMessage] = useState('');
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const locationTimeoutRef = useRef<NodeJS.Timeout>();

  const cameraRef = useRef<any>(null);
  const navigation = useNavigation<BDMCameraScreenNavigationProp>();
  const route = useRoute<BDMCameraScreenRouteProp>();
  const { type } = route.params;

  const fetchLocation = async (useHighAccuracy = false) => {
    try {
      const options: Location.LocationOptions = {
        accuracy: useHighAccuracy ? Location.Accuracy.Highest : Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      };

      const location = await Location.getCurrentPositionAsync(options);
      setLocation(location);
      
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
      // If low accuracy fails, try high accuracy
      if (!useHighAccuracy) {
        await fetchLocation(true);
      } else {
        setIsLocationLoading(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const startLocationFetch = async () => {
      if (isMounted) {
        setIsLocationLoading(true);
        await fetchLocation();
      }
    };

    startLocationFetch();

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
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (!isMounted) return;
      
      setHasPermission(cameraStatus === 'granted' && locationStatus === 'granted');
      
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
    
    const timer = setInterval(() => {
      if (isMounted) {
        setCurrentTime(getISTTime());
      }
    }, 1000);
    
    return () => {
      isMounted = false;
      clearInterval(timer);
      setPhoto(null);
      setIsConfirming(false);
    };
  }, []);

  useEffect(() => {
    return () => {
      setPhoto(null);
      setIsConfirming(false);
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setPhoto(null);
      setIsConfirming(false);
    }, [])
  );

  const validateDeviceTime = async () => {
    try {
      const networkTime = await getNetworkTime();
      
      const db = getFirestore();
      const timeCheckRef = doc(db, '_timeCheck', 'serverTime');
      const serverTime = await getDoc(timeCheckRef);
      const serverTimestamp = serverTime.data()?.timestamp;
      
      await setDoc(timeCheckRef, {
        timestamp: Timestamp.now()
      }, { merge: true });

      if (!serverTimestamp) {
        return false;
      }

      const deviceTime = new Date();
      const serverTimeDate = serverTimestamp.toDate();
      
      const serverTimeDiff = Math.abs(deviceTime.getTime() - serverTimeDate.getTime());
      const isServerTimeValid = serverTimeDiff <= 5 * 60 * 1000;
      
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
      setTimeValidationMessage('Unable to validate time. Please check your internet connection and try again.');
      setIsTimeValid(false);
      return false;
    }
  };

  const takePicture = async () => {
    const isValid = await validateDeviceTime();
    if (!isValid) {
      Alert.alert(
        'Time Sync Required',
        timeValidationMessage,
        [
          {
            text: 'Retry',
            onPress: async () => {
              const isValid = await validateDeviceTime();
              if (isValid) {
                setIsTimeValid(true);
                setTimeValidationMessage('');
              }
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

    if (cameraRef.current && location) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        setPhoto(photo);
      } catch (error) {
        Alert.alert('Error', 'Failed to take picture. Please try again.');
      }
    }
  };

  const flipCamera = () => {
    setCameraType(cameraType === 0 ? 1 : 0);
  };

  const handleConfirmPhoto = async () => {
    if (isConfirming) return;
    
    const isValid = await validateDeviceTime();
    if (!isValid) {
      Alert.alert(
        'Time Sync Required',
        timeValidationMessage,
        [
          {
            text: 'Retry',
            onPress: async () => {
              const isValid = await validateDeviceTime();
              if (isValid) {
                setIsTimeValid(true);
                setTimeValidationMessage('');
              }
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
        setIsConfirming(true);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        navigation.navigate('BDMAttendance' as never, {
          photo: { uri: photo.uri },
          location: {
            coords: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            }
          },
          dateTime: currentTime,
          locationName: locationAddress,
          isPunchIn: type === 'in',
        });
        
        setPhoto(null);
      } catch (error) {
        Alert.alert('Error', 'Failed to navigate to attendance screen. Please try again.');
      } finally {
        setIsConfirming(false);
      }
    } else {
      Alert.alert('Error', 'Location or photo not available. Please try again.');
    }
  };

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
              (!isTimeValid || isConfirming) && styles.disabledButton
            ]}
            onPress={handleConfirmPhoto}
            disabled={!isTimeValid || isConfirming}
          >
            {isConfirming ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#4CAF50" />
                <Text style={[styles.previewButtonText, { color: '#999' }]}>
                  Processing...
                </Text>
              </View>
            ) : (
              <>
                <MaterialIcons name="check" size={24} color={isTimeValid && !isConfirming ? "#4CAF50" : "#999"} />
                <Text style={[
                  styles.previewButtonText, 
                  { color: isTimeValid && !isConfirming ? "#4CAF50" : "#999" }
                ]}>
                  Confirm
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderLocationInfo = () => (
    <View style={styles.locationContainer}>
      <MaterialIcons name="location-on" size={24} color="#FF8447" />
      <Text style={styles.locationText}>
        {isLocationLoading 
          ? 'Getting location...' 
          : locationAddress || 'Location not available'}
      </Text>
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
                  (!location || !isTimeValid) && styles.disabledButton
                ]}
                onPress={takePicture}
                disabled={!location || !isTimeValid}
              >
                <Text style={styles.captureText}>
                  {type === 'in' ? 'Punch In' : 'Punch Out'}
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
  button: {
    backgroundColor: '#FF8447',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
  },
  retakeButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BDMCameraScreen;