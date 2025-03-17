import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';

type RouteParams = {
  onPhotoCapture: (time: string) => void;
  type: 'in' | 'out';
};

const BDMCameraScreen = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [type, setType] = useState(Camera.Constants.Type.front);
  const cameraRef = useRef<any>(null);
  const navigation = useNavigation();
  const route = useRoute();
  const { onPhotoCapture, type: punchType } = route.params as RouteParams;

  useEffect(() => {
    (async () => {
      const location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        const currentTime = format(new Date(), 'hh:mm a');
        onPhotoCapture(currentTime);
        navigation.goBack();
      } catch (error) {
        console.error('Error taking picture:', error);
      }
    }
  };

  if (location === null) {
    return <View style={styles.container}><Text>Requesting location...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Camera 
        ref={cameraRef}
        type={Camera.Constants.Type.front}
        style={styles.camera}
      >
        <View style={styles.overlay}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              {format(new Date(), 'dd MMMM yyyy')}
            </Text>
            <Text style={styles.infoText}>
              {format(new Date(), 'hh:mm a')}
            </Text>
            {location && (
              <Text style={styles.infoText}>
                Location verified ✓
              </Text>
            )}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePicture}
            >
              <Text style={styles.captureText}>
                Take {punchType === 'in' ? 'Punch In' : 'Punch Out'} Photo
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Camera>
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
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 1,
    padding: 10,
  },
  infoContainer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
  },
  infoText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    marginBottom: 8,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    backgroundColor: '#FF8447',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  captureText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    marginBottom: 8,
    textAlign: 'center',
  },
});

export default BDMCameraScreen; 