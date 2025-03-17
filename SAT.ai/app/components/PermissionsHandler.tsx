import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';

type PermissionsHandlerProps = {
  onPermissionsGranted: () => void;
};

const PermissionsHandler = ({ onPermissionsGranted }: PermissionsHandlerProps) => {
  const [status, setStatus] = useState<'checking' | 'denied' | 'granted'>('checking');

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const { status: cameraStatus } = await Camera.getCameraPermissionsAsync();
    const { status: locationStatus } = await Location.getForegroundPermissionsAsync();

    if (cameraStatus === 'granted' && locationStatus === 'granted') {
      setStatus('granted');
      onPermissionsGranted();
    } else {
      requestPermissions();
    }
  };

  const requestPermissions = async () => {
    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();

    if (cameraStatus === 'granted' && locationStatus === 'granted') {
      setStatus('granted');
      onPermissionsGranted();
    } else {
      setStatus('denied');
    }
  };

  const openSettings = () => {
    Linking.openSettings();
  };

  if (status === 'checking') {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Checking permissions...</Text>
      </View>
    );
  }

  if (status === 'denied') {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>
          This app requires camera and location permissions to function properly.
        </Text>
        <TouchableOpacity style={styles.button} onPress={openSettings}>
          <Text style={styles.buttonText}>Open Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={requestPermissions}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 20,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
  },
  button: {
    backgroundColor: '#FF8447',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
  },
});

export default PermissionsHandler; 