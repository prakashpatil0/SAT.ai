import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

const SLOW_SPEED_THRESHOLD = 0.15; // Mbps (150 kbps)

const NetworkStatusBanner = () => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (!state.isConnected) {
        setMessage('No internet connection. Some features may not work.');
        setVisible(true);
      } else if (state.details && 'downlink' in state.details && typeof state.details.downlink === 'number') {
        if (state.details.downlink < SLOW_SPEED_THRESHOLD) {
          setMessage('Your internet connection is very slow. Some features may be limited.');
          setVisible(true);
        } else {
          setVisible(false);
        }
      } else {
        setVisible(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.banner, { opacity: fadeAnim }]}> 
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFB300',
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    textAlign: 'center',
  },
});

export default NetworkStatusBanner; 