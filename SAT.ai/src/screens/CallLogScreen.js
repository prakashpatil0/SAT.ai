import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  PermissionsAndroid,
  Button,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import CallLog from '@react-native-call-log';

const CallLogScreen = () => {
  const [callLogs, setCallLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  const requestCallLogPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const apiLevel = Platform.Version;
        let permissions = [PermissionsAndroid.PERMISSIONS.READ_CALL_LOG];

        if (apiLevel >= 29) {
          permissions.push(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        if (
          granted[PermissionsAndroid.PERMISSIONS.READ_CALL_LOG] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          setHasPermission(true);
          fetchCallLogs();
        } else {
          setHasPermission(false);
          Alert.alert(
            "Permission Required",
            "Call log permission is required to view call history.",
            [{ text: "OK" }]
          );
        }
      }
    } catch (err) {
      console.warn("Error requesting permissions:", err);
      Alert.alert("Error", "Failed to request permissions");
    }
  }, []);

  const fetchCallLogs = async () => {
    if (!hasPermission) {
      return;
    }
    
    setLoading(true);
    try {
      const logs = await CallLog.loadAll();
      setCallLogs(logs);
    } catch (error) {
      console.log("Error fetching call logs:", error);
      Alert.alert("Error", "Failed to fetch call logs");
    } finally {
      setLoading(false);
    }
  };

  const getCallTypeIcon = (type) => {
    switch (type) {
      case 'INCOMING':
        return '📲';
      case 'OUTGOING':
        return '📱';
      case 'MISSED':
        return '❌';
      case 'REJECTED':
        return '🚫';
      default:
        return '📞';
    }
  };

  useEffect(() => {
    requestCallLogPermission();
  }, [requestCallLogPermission]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.messageText}>Permission required to access call logs</Text>
        <Button title="Grant Permission" onPress={requestCallLogPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Call History</Text>
        <Button title="Refresh" onPress={fetchCallLogs} />
      </View>
      
      <FlatList
        data={callLogs}
        keyExtractor={(item) => item.timestamp.toString()}
        renderItem={({ item }) => (
          <View style={styles.callItem}>
            <View style={styles.callHeader}>
              <Text style={styles.phoneNumber}>
                {getCallTypeIcon(item.type)} {item.phoneNumber}
              </Text>
              <Text style={styles.duration}>{item.duration}s</Text>
            </View>
            <Text style={styles.dateTime}>
              {new Date(parseInt(item.timestamp)).toLocaleString()}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    elevation: 2,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  messageText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  callItem: {
    backgroundColor: '#fff',
    padding: 16,
  },
  callHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '500',
  },
  duration: {
    fontSize: 14,
    color: '#666',
  },
  dateTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
  },
});

export default CallLogScreen; 