import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

const TelecallerBottomTabs = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const isRouteActive = (routeName: string) => {
    return route.name === routeName;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => navigation.navigate('HomeScreen')}
      >
        <MaterialIcons 
          name="home" 
          size={24} 
          color={isRouteActive('HomeScreen') ? '#FF8447' : '#666'} 
        />
        <Text style={[
          styles.tabText, 
          isRouteActive('HomeScreen') && styles.activeTabText
        ]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => navigation.navigate('Target')}
      >
        <MaterialIcons 
          name="track-changes" 
          size={24} 
          color={isRouteActive('Target') ? '#FF8447' : '#666'} 
        />
        <Text style={[
          styles.tabText, 
          isRouteActive('Target') && styles.activeTabText
        ]}>Target</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.tabItem, styles.centerTab]} 
        onPress={() => navigation.navigate('AlertScreen')}
      >
        <View style={styles.centerButton}>
          <MaterialIcons name="notifications-active" size={28} color="#FFF" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => navigation.navigate('Attendance')}
      >
        <MaterialIcons 
          name="event" 
          size={24} 
          color={isRouteActive('Attendance') ? '#FF8447' : '#666'} 
        />
        <Text style={[
          styles.tabText, 
          isRouteActive('Attendance') && styles.activeTabText
        ]}>Attendance</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => navigation.navigate('Report')}
      >
        <MaterialIcons 
          name="description" 
          size={24} 
          color={isRouteActive('Report') ? '#FF8447' : '#666'} 
        />
        <Text style={[
          styles.tabText, 
          isRouteActive('Report') && styles.activeTabText
        ]}>Report</Text>
      </TouchableOpacity>
    </View>
  );
};

// Use the same styles as BDMBottomTabs
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 65,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTab: {
    marginTop: -30,
  },
  centerButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF8447',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#FF8447',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontFamily: 'LexendDeca_400Regular',
  },
  activeTabText: {
    color: '#FF8447',
    fontSize:12,
    fontFamily: 'LexendDeca_400Regular',
  },
});

export default TelecallerBottomTabs; 