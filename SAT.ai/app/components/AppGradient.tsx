import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type AppGradientProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

const AppGradient = ({ children, style }: AppGradientProps) => {
  return (
    <LinearGradient
      colors={['#FFF8F0', '#FFF']}
      style={[styles.gradient, style]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
});

export default AppGradient; 