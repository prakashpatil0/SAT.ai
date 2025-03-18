import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

const BDMBottomTabs = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const isRouteActive = (routeName: string) => {
    return route.name === routeName;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => navigation.navigate('BDMHomeScreen' as never)}
      >
        <MaterialIcons 
          name="home" 
          size={24} 
          color={isRouteActive('BDMHomeScreen') ? '#FF8447' : '#666'} 
        />
        <Text style={[
          styles.tabText, 
          isRouteActive('BDMHomeScreen') && styles.activeTabText
        ]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => navigation.navigate('BDMTarget' as never)}
      >
        <MaterialIcons 
          name="flag" 
          size={24} 
          color={isRouteActive('BDMTarget') ? '#FF8447' : '#666'} 
        />
        <Text style={[
          styles.tabText, 
          isRouteActive('BDMTarget') && styles.activeTabText
        ]}>Target</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => navigation.navigate('BDMAttendance' as never)}
      >
        <MaterialIcons 
          name="event" 
          size={24} 
          color={isRouteActive('BDMAttendance') ? '#FF8447' : '#666'} 
        />
        <Text style={[
          styles.tabText, 
          isRouteActive('BDMAttendance') && styles.activeTabText
        ]}>Attendance</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => navigation.navigate('BDMReport' as never)}
      >
        <MaterialIcons 
          name="description" 
          size={24} 
          color={isRouteActive('BDMReport') ? '#FF8447' : '#666'} 
        />
        <Text style={[
          styles.tabText, 
          isRouteActive('BDMReport') && styles.activeTabText
        ]}>Report</Text>
      </TouchableOpacity>
    </View>
  );
};

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
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontFamily: 'LexendDeca_400Regular',
  },
  activeTabText: {
    color: '#FF8447',
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
  }
});

export default BDMBottomTabs;