import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

const Loader = () => {
  const barHeights = [20, 30, 40, 50, 60]; // Heights for each bar, progressively increasing from left to right
  const ballPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    // Ball animation path with increased y values for higher movement
    const ballPath = [
      { x: 0, y: 0 },
      { x: 9, y: -30 },  // Increased y value for much higher movement
      { x: 16, y: -25 },
      { x: 24, y: -40 },
      { x: 31, y: -35 },
      { x: 39, y: -50 },
      { x: 46, y: -45 },
      { x: 54, y: -60 },
      { x: 60, y: -55 },
      { x: 60, y: 0 },
      { x: 53, y: -30 },
      { x: 45, y: -25 },
      { x: 37, y: -40 },
      { x: 30, y: -35 },
      { x: 22, y: -50 },
      { x: 15, y: -45 },
      { x: 7, y: -60 },
      { x: 0, y: -55 },
      { x: 0, y: 0 },
    ];

    const animateBall = () => {
      Animated.loop(
        Animated.sequence(
          ballPath.map((point) =>
            Animated.timing(ballPosition, {
              toValue: point,
              duration: 100,
              easing: Easing.linear,
              useNativeDriver: true,
            })
          )
        )
      ).start(); // Loop the ball animation forward and backward
    };

    animateBall(); // Start ball animation
  }, []);

  return (
    <View style={styles.loader}>
      {/* Render fixed bars with increasing heights */}
      {barHeights.map((height, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            { left: index * 15 }, 
            { height: height }, 
          ]}
        />
      ))}

      {/* Render animated ball */}
      <Animated.View
        style={[
          styles.ball,
          {
            transform: [
              { translateX: ballPosition.x },
              { translateY: ballPosition.y },
            ], 
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  loader: {
    position: 'relative',
    width: 75,
    height: 100,
    justifyContent: 'flex-end',
  },
  bar: {
    position: 'absolute',
    bottom: 0,
    width: 10, 
    backgroundColor: '#000', 
    borderRadius: 2, 
  },
  ball: {
    position: 'absolute',
    bottom: 10,
    width: 10,
    height: 10,
    backgroundColor: 'rgb(44, 143, 255)', 
    borderRadius: 5,
  },
});

export default Loader;
