import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons'; // For the pin icon
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";

// Function to truncate content
const truncateContent = (content, length =90) => {
  return content.length > length ? content.substring(0, length) + '...' : content;
};

const BDMMyNotesScreen = () => {
  const navigation = useNavigation();

  const data = [
    { title: "Cerebral palsy sport", content: "Cerebral palsy sport classification is a classification system used by sports that include athletes with cerebral palsy to ensure fair competition. This system categorizes athletes based on the level of motor function impairment, considering factors such as muscle control, coordination, balance, and range of movement. Different sports have specific classification criteria to accommodate the diverse functional abilities of athletes, allowing them to compete against others with similar capabilities. The classification process typically involves medical assessments and sport-specific functional evaluations to determine the most appropriate competitive category for each athlete.", date: "23/01/2025" },
    { title: "Health Insurance - Initial Pitch", content: "Hi [Customer Name], we have a special health insurance plan with no waiting period and cash...", date: "23/01/2025" },
    { title: "Lead - Interested but Needs Time", content: "Date: 5th Feb 2025 Name: Rahul Verma Company: Verma Solutions - Interested in group...", date: "23/01/2025" },
    { title: "Health Insurance - Initial Pitch", content: "Hi [Customer Name], we have a special health insurance plan with no waiting period and cash...", date: "23/01/2025" },
    { title: "Lead - Interested but Needs Time", content: "Date: 5th Feb 2025 Name: Rahul Verma Company: Verma Solutions - Interested in group...", date: "23/01/2025" }
  ];

  const handleBackPress = () => {
    navigation.navigate('BDMHomeScreen'); // Navigate to HomeScreen instead of going back
  };
  

  const navigateToDetails = (item) => {
    navigation.navigate('BDMNotesDetailScreen', {
      title: item.title,
      content: item.content,
      date: item.date,
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
      <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
  <Ionicons name="arrow-back" size={24} color="#000"/> 
</TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>My Notes</Text>
        </View>
      </View>

      {data.map((item, index) => (
        <TouchableOpacity key={index} onPress={() => navigateToDetails(item)}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.title}>{item.title}</Text>
              {/* Conditionally render the pin icon for the first two cards */}
        {index < 2 && <MaterialCommunityIcons name='pin-outline' size={25} color="black"/>}
            </View>
            {/* Show truncated content */}
            <Text style={styles.content}>{truncateContent(item.content)}</Text>
            <Text style={styles.date}>{item.date}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f4',
    padding: 20,
  },
  backButton: {
    fontSize: 24,
    color: "#000",
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "LexendDeca_600SemiBold",
    marginLeft: 10,
    textAlign:"center",
    alignItems:"center",
  },
  card: {
    backgroundColor: '#FFF1CC',
    borderRadius: 8,
    marginBottom: 10,
    padding: 15,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: "LexendDeca_600SemiBold",
  },
  content: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: "LexendDeca_400Regular",
    color: '#595550',
  },
  date: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: '#787878',
    textAlign: 'right',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BDMMyNotesScreen;
