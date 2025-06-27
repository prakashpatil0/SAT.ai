import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInSeconds } from 'date-fns';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface LocationValidationResult {
  isFakeLocation: boolean;
  confidence: number;
  detectionMethods: string[];
  warnings: string[];
  locationHistory: LocationHistoryEntry[];
  speedAnomaly: boolean;
  accuracyAnomaly: boolean;
  providerAnomaly: boolean;
}

export interface LocationHistoryEntry {
  timestamp: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  provider?: string;
}

// Calculate distance between two coordinates using Haversine formula
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Save location to history
export const saveLocationToHistory = async (location: Location.LocationObject): Promise<void> => {
  try {
    const history = await getLocationHistory();
    const newEntry: LocationHistoryEntry = {
      timestamp: Date.now(),
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy || 0,
      speed: location.coords.speed || 0,
      provider: (location.coords as any).provider || 'unknown'
    };

    // Keep only last 50 entries
    const updatedHistory = [...history, newEntry].slice(-50);
    await AsyncStorage.setItem('locationHistory', JSON.stringify(updatedHistory));
  } catch (error) {
    console.error('Error saving location history:', error);
  }
};

// Get location history
export const getLocationHistory = async (): Promise<LocationHistoryEntry[]> => {
  try {
    const history = await AsyncStorage.getItem('locationHistory');
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('Error getting location history:', error);
    return [];
  }
};

// Enhanced fake location detection methods
export const detectFakeLocation = async (currentLocation: Location.LocationObject): Promise<LocationValidationResult> => {
  const detectionMethods: string[] = [];
  const warnings: string[] = [];
  let confidence = 0;
  let isFakeLocation = false;
  let speedAnomaly = false;
  let accuracyAnomaly = false;
  let providerAnomaly = false;

  try {
    // Method 1: Check location accuracy
    accuracyAnomaly = (currentLocation.coords.accuracy || 0) > 100; // Suspicious if accuracy > 100m
    if (accuracyAnomaly) {
      detectionMethods.push('Low Accuracy');
      warnings.push('Location accuracy is suspiciously low');
      confidence += 20;
    }

    // Method 2: Check for speed anomalies
    speedAnomaly = currentLocation.coords.speed !== null && 
      (currentLocation.coords.speed > 1000 || currentLocation.coords.speed < 0);
    if (speedAnomaly) {
      detectionMethods.push('Speed Anomaly');
      warnings.push('Unrealistic speed detected');
      confidence += 30;
    }

    // Method 3: Check location history for sudden jumps
    const locationHistory = await getLocationHistory();
    if (locationHistory.length > 0) {
      const lastLocation = locationHistory[locationHistory.length - 1];
      const timeDiff = differenceInSeconds(new Date(), new Date(lastLocation.timestamp));
      const distance = calculateDistance(
        lastLocation.latitude,
        lastLocation.longitude,
        currentLocation.coords.latitude,
        currentLocation.coords.longitude
      );
      
      // Calculate speed in m/s
      const calculatedSpeed = distance / timeDiff;
      const speedAnomaly = calculatedSpeed > 50; // More than 50 m/s (180 km/h) is suspicious
      
      if (speedAnomaly && timeDiff > 0) {
        detectionMethods.push('Location Jump');
        warnings.push(`Unrealistic movement detected: ${calculatedSpeed.toFixed(1)} m/s`);
        confidence += 40;
      }
    }

    // Method 4: Check for common fake location coordinates
    const fakeLocationPatterns = [
      { lat: 0, lng: 0, name: 'Null Island' },
      { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
      { lat: 40.7128, lng: -74.0060, name: 'New York' },
      { lat: 51.5074, lng: -0.1278, name: 'London' },
      { lat: 48.8566, lng: 2.3522, name: 'Paris' },
      { lat: 35.6762, lng: 139.6503, name: 'Tokyo' },
      { lat: -33.8688, lng: 151.2093, name: 'Sydney' },
    ];

    for (const pattern of fakeLocationPatterns) {
      const distance = calculateDistance(
        pattern.lat,
        pattern.lng,
        currentLocation.coords.latitude,
        currentLocation.coords.longitude
      );
      
      if (distance < 1000) { // Within 1km of known fake locations
        detectionMethods.push('Known Fake Location');
        warnings.push(`Location near known fake location: ${pattern.name}`);
        confidence += 50;
        break;
      }
    }

    // Method 5: Check for India-specific location validation
    const isInIndia = currentLocation.coords.latitude >= 6.0 && 
                     currentLocation.coords.latitude <= 37.0 &&
                     currentLocation.coords.longitude >= 68.0 && 
                     currentLocation.coords.longitude <= 97.0;
    
    if (!isInIndia) {
      detectionMethods.push('Outside India');
      warnings.push('Location is outside India');
      confidence += 60;
    }

    // Method 6: Check for altitude anomalies
    if (currentLocation.coords.altitude !== null) {
      const altitudeAnomaly = currentLocation.coords.altitude < -100 || currentLocation.coords.altitude > 9000;
      if (altitudeAnomaly) {
        detectionMethods.push('Altitude Anomaly');
        warnings.push('Unrealistic altitude detected');
        confidence += 25;
      }
    }

    // Method 7: Check for provider anomalies (Android only)
    if (Platform.OS === 'android') {
      const provider = (currentLocation.coords as any).provider;
      if (provider) {
        const suspiciousProviders = ['mock', 'fused', 'gps_fused', 'network'];
        providerAnomaly = suspiciousProviders.some(suspiciousProvider => 
          provider.toLowerCase().includes(suspiciousProvider)
        );
        
        if (providerAnomaly) {
          detectionMethods.push('Provider Anomaly');
          warnings.push('Suspicious location provider detected');
          confidence += 35;
        }
      }
    }

    // Method 8: Check for time-based anomalies
    const currentHour = new Date().getHours();
    const isNightTime = currentHour < 6 || currentHour > 22;
    
    if (isNightTime && locationHistory.length > 0) {
      const lastLocation = locationHistory[locationHistory.length - 1];
      const timeDiff = differenceInSeconds(new Date(), new Date(lastLocation.timestamp));
      const distance = calculateDistance(
        lastLocation.latitude,
        lastLocation.longitude,
        currentLocation.coords.latitude,
        currentLocation.coords.longitude
      );
      
      // If there's significant movement during night time, it's suspicious
      if (distance > 1000 && timeDiff < 3600) { // More than 1km in less than 1 hour at night
        detectionMethods.push('Night Movement');
        warnings.push('Unusual movement detected during night time');
        confidence += 30;
      }
    }

    // Method 9: Check for repeated coordinates
    const repeatedCoordinates = locationHistory.filter(entry => 
      Math.abs(entry.latitude - currentLocation.coords.latitude) < 0.0001 &&
      Math.abs(entry.longitude - currentLocation.coords.longitude) < 0.0001
    ).length;

    if (repeatedCoordinates > 5) {
      detectionMethods.push('Repeated Coordinates');
      warnings.push('Same coordinates detected multiple times');
      confidence += 20;
    }

    // Method 10: Check for unrealistic accuracy changes
    if (locationHistory.length > 0) {
      const lastLocation = locationHistory[locationHistory.length - 1];
      const accuracyChange = Math.abs((currentLocation.coords.accuracy || 0) - lastLocation.accuracy);
      
      if (accuracyChange > 50) { // Sudden large change in accuracy
        detectionMethods.push('Accuracy Anomaly');
        warnings.push('Unusual accuracy change detected');
        confidence += 15;
      }
    }

    // Determine if location is fake based on confidence
    isFakeLocation = confidence >= 50;

    // Save current location to history
    await saveLocationToHistory(currentLocation);

    return {
      isFakeLocation,
      confidence,
      detectionMethods,
      warnings,
      locationHistory: await getLocationHistory(),
      speedAnomaly,
      accuracyAnomaly,
      providerAnomaly
    };

  } catch (error) {
    console.error('Error in fake location detection:', error);
    return {
      isFakeLocation: false,
      confidence: 0,
      detectionMethods: ['Detection Failed'],
      warnings: ['Unable to validate location'],
      locationHistory: [],
      speedAnomaly: false,
      accuracyAnomaly: false,
      providerAnomaly: false
    };
  }
};

// Validate location with enhanced checks
export const validateLocation = async (currentLocation: Location.LocationObject): Promise<boolean> => {
  try {
    const validationResult = await detectFakeLocation(currentLocation);
    return !validationResult.isFakeLocation;
  } catch (error) {
    console.error('Location validation error:', error);
    return true; // Allow if validation fails
  }
};

// Get location confidence score
export const getLocationConfidence = (location: Location.LocationObject): number => {
  let confidence = 100;

  // Reduce confidence based on accuracy
  if ((location.coords.accuracy || 0) > 50) {
    confidence -= 20;
  }
  if ((location.coords.accuracy || 0) > 100) {
    confidence -= 30;
  }

  // Reduce confidence based on speed
  if (location.coords.speed !== null && location.coords.speed > 100) {
    confidence -= 25;
  }

  // Reduce confidence if altitude is unrealistic
  if (location.coords.altitude !== null && 
      (location.coords.altitude < -100 || location.coords.altitude > 9000)) {
    confidence -= 20;
  }

  return Math.max(0, confidence);
}; 