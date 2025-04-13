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
      colors={[
        '#FFF8F0',
        '#FFE7B3',
        '#E6F9F1',
        '#B8ECD7',
        '#DED3FF',
        // '#C4B5FF'
      ]}
      style={[styles.gradient, style]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 2 }}
      locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
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