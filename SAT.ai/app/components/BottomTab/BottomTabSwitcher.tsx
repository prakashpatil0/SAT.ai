import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

interface BottomTabSwitcherProps {
  role: 'BDM' | 'Telecaller';
}

const BottomTabSwitcher: React.FC<BottomTabSwitcherProps> = ({ role }) => {
  const navigation = useNavigation();
  const route = useRoute();

  const isRouteActive = (routeName: string) => {
    return route.name === routeName;
  };

  if (role === 'BDM') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('BDMHomeScreen' as never)}>
          <MaterialIcons name="home" size={24} color={isRouteActive('BDMHomeScreen') ? '#FF8447' : '#666'} />
          <Text style={[styles.tabText, isRouteActive('BDMHomeScreen') && styles.activeTabText]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('BDMTarget' as never)}>
          <MaterialIcons name="track-changes" size={24} color={isRouteActive('BDMTarget') ? '#FF8447' : '#666'} />
          <Text style={[styles.tabText, isRouteActive('BDMTarget') && styles.activeTabText]}>Target</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.centerTabContainer} onPress={() => navigation.navigate('BDMMeetingLogScreen' as never)}>
          <View style={styles.centerTabCircle}>
            <MaterialIcons name="document-scanner" size={35} color="#FFF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('BDMAttendance' as never)}>
          <MaterialIcons name="calendar-month" size={24} color={isRouteActive('BDMAttendance') ? '#FF8447' : '#666'} />
          <Text style={[styles.tabText, isRouteActive('BDMAttendance') && styles.activeTabText]}>Attendance</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('BDMReport' as never)}>
          <MaterialIcons name="description" size={24} color={isRouteActive('BDMReport') ? '#FF8447' : '#666'} />
          <Text style={[styles.tabText, isRouteActive('BDMReport') && styles.activeTabText]}>Report</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Telecaller bottom tabs
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('HomeScreen' as never)}>
        <MaterialIcons name="home" size={24} color={isRouteActive('HomeScreen') ? '#FF8447' : '#666'} />
        <Text style={[styles.tabText, isRouteActive('HomeScreen') && styles.activeTabText]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Target' as never)}>
        <MaterialIcons name="track-changes" size={24} color={isRouteActive('Target') ? '#FF8447' : '#666'} />
        <Text style={[styles.tabText, isRouteActive('Target') && styles.activeTabText]}>Target</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.tabItem, styles.centerTab]} onPress={() => navigation.navigate('AlertScreen' as never)}>
        <View style={styles.centerButton}>
          <MaterialIcons name="notifications-active" size={35} color="#FFF" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Attendance' as never)}>
        <MaterialIcons name="event" size={24} color={isRouteActive('Attendance') ? '#FF8447' : '#666'} />
        <Text style={[styles.tabText, isRouteActive('Attendance') && styles.activeTabText]}>Attendance</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Report' as never)}>
        <MaterialIcons name="description" size={24} color={isRouteActive('Report') ? '#FF8447' : '#666'} />
        <Text style={[styles.tabText, isRouteActive('Report') && styles.activeTabText]}>Report</Text>
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
  },
  centerTabContainer: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
    marginBottom: -20,
  },
  centerTabCircle: {
    width: 67,
    height: 67,
    borderRadius: 35,
    backgroundColor: '#FF8447',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  centerTab: {
    marginTop: -15,
  },
  centerButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF8447',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#FF8447',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});

export default BottomTabSwitcher;
