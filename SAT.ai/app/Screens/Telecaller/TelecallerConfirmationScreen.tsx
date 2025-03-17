import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const ConfirmationScreen = ({ route }) => {
  const { photo, location, dateTime } = route.params;

  return (
    <View style={styles.container}>
      <Image source={{ uri: photo }} style={styles.image} />
      <Text style={styles.text}>Location: {location ? `${location.latitude}, ${location.longitude}` : 'Unknown'}</Text>
      <Text style={styles.text}>Date: {dateTime.toLocaleDateString()}</Text>
      <Text style={styles.text}>Time: {dateTime.toLocaleTimeString()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  image: {
    width: '100%',
    height: 300,
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    marginBottom: 10,
  },
});

export default ConfirmationScreen;