import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import BDMScreenHeader from "@/app/Screens/BDM/BDMScreenHeader";


type BDMPersonNoteProps = {
  route: {
    params: {
      name: string;
      time: string;
      duration: string;
      type: string;
      notes: string[];
    };
  };
};

const BDMPersonNote = ({ route }: BDMPersonNoteProps) => {
  const navigation = useNavigation();
  const { name, time, duration, type, notes } = route.params;

  return (
    <LinearGradient colors={['#f0f4f8', '#fcf1e8']} style={styles.container}>
      <BDMScreenHeader title={name} />
      <View style={styles.header}>
        <View style={styles.personInfo}>
          {/* <Text style={styles.name}>{name}</Text> */}
          <View style={styles.timeContainer}>
            <Text style={styles.time}>{time}</Text>
            <Text style={styles.duration}>{duration}</Text>
          </View>
        </View>
      </View>

      <View style={styles.typeContainer}>
        <Text style={styles.type}>{type}</Text>
      </View>

      <View style={styles.notesContainer}>
        {notes && notes.map((note, index) => (
          <View key={index} style={styles.noteItem}>
            <Text style={styles.noteText}>• {note}</Text>
          </View>
        ))}
        <Text style={styles.characterCount}>
          {notes.join('').length}/120
        </Text>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  personInfo: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  time: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  duration: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginLeft: 8,
  },
  typeContainer: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  type: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  notesContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  noteItem: {
    marginBottom: 12,
  },
  noteText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    lineHeight: 20,
  },
  characterCount: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
  },
});

export default BDMPersonNote;