import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming,
  useSharedValue,
  withDelay
} from 'react-native-reanimated';

interface WaveSkeletonProps {
  width: number | string;
  height: number;
  style?: any;
}

const WaveSkeleton: React.FC<WaveSkeletonProps> = ({ width, height, style }) => {
  const translateX = useSharedValue(typeof width === 'number' ? -width : -100);

  React.useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(typeof width === 'number' ? width : 100, { duration: 1000 }),
        withDelay(500, withTiming(typeof width === 'number' ? -width : -100, { duration: 0 }))
      ),
      -1
    );
  }, [width]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <View style={[{ width, height, backgroundColor: '#E5E7EB', overflow: 'hidden' }, style]}>
      <Animated.View
        style={[
          {
            width: '100%',
            height: '100%',
            backgroundColor: 'transparent',
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255, 255, 255, 0.3)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>
    </View>
  );
};

export default WaveSkeleton; 