import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import BDMScreenHeader from '@/app/Screens/BDM/BDMScreenHeader';
const BDMNotesDetailScreen = ({ route }) => {
  const navigation = useNavigation();
  const { title, content, date } = route.params; // Get data from navigation params

  const [showOptions, setShowOptions] = useState(false); // State to toggle the options popup

  const handleBackPress = () => {
    // Navigate back to the previous screen (My Script)
    navigation.navigate('BDMMyNotesScreen');
  };

  const handleOptionPress = (option: 'Unpin' | 'Delete') => {
    setShowOptions(false); // Close the options popup
    if (option === 'Unpin') {
      console.log("Unpin option selected");
    } else if (option === 'Delete') {
      console.log("Delete option selected");
    }
  };

  return (
    
    <ScrollView style={styles.container}>
      <BDMScreenHeader title=" " />
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>My Notes</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={() => setShowOptions(!showOptions)} style={styles.threeDotsButton}>
            <Ionicons name="ellipsis-vertical" size={24} color="#000"/>
          </TouchableOpacity>
        </View>
        <Text style={styles.date}>{date}</Text>
        <Text style={styles.content}>{content}</Text>

        {/* Small popup with Unpin and Delete options */}
        {showOptions && (
          <View style={styles.optionsPopup}>
            <TouchableOpacity onPress={() => handleOptionPress('Unpin')} style={styles.optionButton}>
              <Text style={styles.optionText}>Unpin</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleOptionPress('Delete')} style={styles.optionButton}>
              <Text style={[styles.optionText, { color: 'red' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  backButton: {
    padding: 1, // Ensuring the back button is large enough to click
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
    textAlign: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFF1CC',
    borderRadius: 8,
    padding: 15,
    elevation: 3,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: "LexendDeca_600SemiBold",
    flex: 1,
  },
  threeDotsButton: {
    padding: 5,
  },
  date: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: '#787878',
    marginTop: 5,
  },
  content: {
    fontSize: 16,
    fontFamily: "LexendDeca_400Regular",
    color: '#595550',
    marginTop: 15,
  },
  optionsPopup: {
    backgroundColor: '#FFF',
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 10,
    borderRadius: 8,
    elevation: 5,
    width: 120,
    marginTop: 5,
    zIndex: 10,
  },
  optionButton: {
    paddingVertical: 5,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 14,
    color: '#000',
  },
});

export default BDMNotesDetailScreen;
