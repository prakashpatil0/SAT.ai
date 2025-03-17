import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type AppGradientProps = {
  children: React.ReactNode;
};

const AppGradient = ({ children }: AppGradientProps) => {
  return (
    <LinearGradient
      colors={['#FFF8F0', '#FFF']}
      style={styles.gradient}
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