import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, Alert } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { format } from 'date-fns';
import { collection, addDoc, getDocs, query, where, Timestamp, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';

type RootStackParamList = {
  AttendanceScreen: {
    photo?: { uri: string };
    location?: { coords: { latitude: number; longitude: number } };
    dateTime?: Date;
    isPunchIn?: boolean;
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
  const cameraRef = useRef<any>(null);
  const navigation = useNavigation<CameraScreenNavigationProp>();
  const route = useRoute<CameraScreenRouteProp>();
  const { isPunchIn } = route.params;

  // Reset photo when component mounts or isPunchIn changes
  useEffect(() => {
    setPhoto(null);
  }, [isPunchIn]);

  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      
      setHasPermission(cameraStatus === 'granted' && locationStatus === 'granted');
      
      if (locationStatus === 'granted') {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest
          });
          setLocation(location);
          
          // Get the address from coordinates
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
        } catch (error) {
          console.error('Error getting location:', error);
        }
      }
    })();
    
    // Update the time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const takePicture = async () => {
    if (cameraRef.current && location) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        console.log("Photo taken:", photo);
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

  const renderPhotoPreview = () => {
    return (
      <View style={styles.previewContainer}>
        {photo && <Image source={{ uri: photo.uri }} style={styles.preview} />}
        <View style={styles.previewOverlay}>
          <View style={styles.previewAddress}>
            <MaterialIcons name="location-on" size={20} color="#FF8447" />
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
            style={[styles.previewButton, styles.confirmButton]}
            onPress={async () => {
              if (location && photo) {
                try {
                  // Navigate to AttendanceScreen with the required data
                  navigation.navigate('Attendance' as never, {
                    photo: { uri: photo.uri },
                    location: {
                      coords: {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude
                      }
                    },
                    dateTime: currentTime,
                    isPunchIn
                  });
                } catch (error) {
                  console.error('Navigation error:', error);
                  Alert.alert('Error', 'Failed to navigate to attendance screen. Please try again.');
                }
              } else {
                Alert.alert('Error', 'Location or photo not available. Please try again.');
              }
            }}
          >
            <MaterialIcons name="check" size={24} color="#4CAF50" />
            <Text style={[styles.previewButtonText, { color: '#4CAF50' }]}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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

            <View style={styles.locationContainer}>
              <MaterialIcons name="location-on" size={24} color="#FF8447" />
              <Text style={styles.locationText}>
                {locationAddress || 'Getting location...'}
              </Text>
            </View>

            <View style={styles.dateTimeContainer}>
              <MaterialIcons name="event" size={24} color="#FF8447" />
              <Text style={styles.dateTimeText}>
                {format(currentTime, 'dd-MM-yyyy')}
              </Text>
            </View>

            <View style={styles.timeContainer}>
              <MaterialIcons name="access-time" size={24} color="#FF8447" />
              <Text style={styles.dateTimeText}>
                {format(currentTime, 'h:mm:ss a')}
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.captureButton, location ? {} : styles.disabledButton]}
                onPress={takePicture}
                disabled={!location}
              >
                <Text style={styles.captureText}>
                  {isPunchIn ? 'Punch In' : 'Punch Out'}
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
    backgroundColor: '#aaa',
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
});

export default CameraScreen;