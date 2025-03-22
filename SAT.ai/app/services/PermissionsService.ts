import * as Location from 'expo-location';
import { Platform, Alert, Linking } from 'react-native';

class PermissionsService {
  async requestLocationPermission(): Promise<boolean> {
    try {
      // Check if location services are enabled
      const hasLocationServicesEnabled = await Location.hasServicesEnabledAsync();
      
      if (!hasLocationServicesEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services to use this feature.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => Linking.openSettings() 
            }
          ]
        );
        return false;
      }
      
      // Request foreground location permission
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'This app needs location permission to function properly.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => Linking.openSettings() 
            }
          ]
        );
        return false;
      }
      
      // If on Android, also request background location permission for better tracking
      if (Platform.OS === 'android' && Platform.Version >= 29) {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          console.log('Background location permission not granted');
          // We can still proceed without background permission
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }
  
  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const hasPermission = await this.requestLocationPermission();
      
      if (!hasPermission) {
        return null;
      }
      
      // Try to get precise location with timeout
      try {
        const location = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Location timeout')), 10000)
          )
        ]) as Location.LocationObject;
        
        return location;
      } catch (error) {
        console.warn('Error getting current position:', error);
        
        // Try to get last known position as fallback
        const lastKnownPosition = await Location.getLastKnownPositionAsync();
        if (lastKnownPosition) {
          return lastKnownPosition;
        }
        
        return null;
      }
    } catch (error) {
      console.error('Error in getCurrentLocation:', error);
      return null;
    }
  }
}

export default new PermissionsService(); 