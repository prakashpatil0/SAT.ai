import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, Image } from 'react-native';
import { Camera, CameraView, CameraType } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import * as Location from 'expo-location';

// Define the navigation types
type RootStackParamList = {
  AttendanceScreen: {
    photo: { uri: string };
    location: string;
    dateTime: Date;
    isPunchIn: boolean;
  };
  CameraScreen: {
    isPunchIn: boolean;
  };
};

type CameraScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CameraScreen'>;
type CameraScreenRouteProp = RouteProp<RootStackParamList, 'CameraScreen'>;

interface CameraScreenProps {
  route: CameraScreenRouteProp;
  navigation: CameraScreenNavigationProp;
}

const CameraScreen: React.FC<CameraScreenProps> = ({ route, navigation }) => {
  const { isPunchIn } = route.params;
  const [facing, setFacing] = useState<CameraType>('back');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
      }
      setHasPermission(status === 'granted');
    })();
  }, []);

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      setLoading(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true
      });

      if (!photo) return;
      setPhoto(photo.uri);
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const savePhoto = async () => {
    if (!photo) return;

    try {
      setLoading(true);
      const auth = getAuth();
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Create unique filename
      const now = new Date();
      const timestamp = now.toISOString().split('T')[0];
      const filename = `${userId}_${isPunchIn ? 'punchIn' : 'punchOut'}_${timestamp}.jpg`;
      const storage = getStorage();
      const storageRef = ref(storage, `attendance/${userId}/${filename}`);

      // Convert photo to blob
      const response = await fetch(photo);
      const blob = await response.blob();

      // Upload to Firebase Storage
      await uploadBytes(storageRef, blob);
      const photoUrl = await getDownloadURL(storageRef);

      // Get location
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Save to Firestore
      const db = getFirestore();
      const attendanceRef = doc(db, 'attendance', userId, timestamp, isPunchIn ? 'punchIn' : 'punchOut');

      await setDoc(attendanceRef, {
        photoUrl,
        timestamp: serverTimestamp(),
        location: {
          latitude,
          longitude,
          accuracy: location.coords.accuracy
        },
        type: isPunchIn ? 'punchIn' : 'punchOut'
      });

      // Navigate back with attendance data
      navigation.navigate('Attendance', {
        photo: { uri: photoUrl },
        location: `${latitude}, ${longitude}`,
        dateTime: now,
        isPunchIn,
      });
    } catch (error) {
      console.error('Storage Error:', error);
      let errorMessage = 'Failed to save photo. Please try again.';
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'You do not have permission to upload photos. Please contact support.';
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
  };

  if (hasPermission === null) {
    return <View />;
  }
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No access to camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Click a Picture</Text>
      </View>

      {photo ? (
        // Photo Preview
        <View style={styles.previewContainer}>
          <Image source={{ uri: photo }} style={styles.preview} />
          <View style={styles.previewControls}>
            <TouchableOpacity 
              style={[styles.button, styles.retakeButton]} 
              onPress={retakePhoto}
            >
              <MaterialIcons name="replay" size={24} color="#333" />
              <Text style={styles.buttonText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.saveButton]} 
              onPress={savePhoto}
              disabled={loading}
            >
              <MaterialIcons name="check" size={24} color="#FFF" />
              <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Camera View
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        >
          <View style={styles.controlsContainer}>
            {/* Camera Flip Button */}
            <TouchableOpacity 
              style={styles.flipButton} 
              onPress={toggleCameraFacing}
            >
              <MaterialIcons name="flip-camera-ios" size={28} color="white" />
            </TouchableOpacity>

            {/* Capture Button */}
            <TouchableOpacity 
              style={styles.captureButton} 
              onPress={takePicture}
              disabled={loading}
            >
              <View style={styles.captureInner}>
                {loading && <View style={styles.loadingIndicator} />}
              </View>
            </TouchableOpacity>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  camera: {
    flex: 1,
  },
  controlsContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingBottom: 30,
  },
  flipButton: {
    position: 'absolute',
    left: 30,
    bottom: 40,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#000',
  },
  loadingIndicator: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 31,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  preview: {
    flex: 1,
    width: '100%',
  },
  previewControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  retakeButton: {
    backgroundColor: 'white',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
  },
  saveButtonText: {
    color: 'white',
  },
});

export default CameraScreen;