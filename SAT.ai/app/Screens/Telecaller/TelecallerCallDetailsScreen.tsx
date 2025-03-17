import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
type RootStackParamList = {
  TelecallerCreateFollowUp: undefined;
};

const TelecallerCallNoteDetails = ({ route }: { route: { params: { meeting: any } } }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [status, setStatus] = useState('Mark Status');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const { meeting } = route.params;

  const statusOptions = ['Prospect', 'Suspect', 'Closing'];

  const handleStatusSelect = (selectedStatus: string) => {
    setStatus(selectedStatus);
    setShowStatusModal(false);
  };

  const handleFollowUpPress = () => {
    setFollowUp(!followUp);
    navigation.navigate('TelecallerCreateFollowUp');
  };

  return (
    <LinearGradient colors={['#FFF8F0', '#FFF']} style={styles.gradient}>
      
    <TelecallerMainLayout showDrawer showBackButton={true} showBottomTabs={true} title={meeting.name}>
      
    <Text style={styles.headerSubtitle}>{meeting.time} {meeting.duration}</Text>
    
    <SafeAreaView style={styles.container}>
      
        {/* Header */}
        <View style={styles.header}>
          
          <View style={styles.headerContent}>
            
            {/* <Text style={styles.headerSubtitle}>{meeting.time} {meeting.duration}</Text> */}
            </View>
            <TouchableOpacity style={styles.playButton}>
            <MaterialIcons name="play-circle-outline" size={28} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Status Dropdown Button */}
        <TouchableOpacity 
          style={styles.statusButton}
          onPress={() => setShowStatusModal(true)}
        >
          <Text style={styles.statusText}>{status}</Text>
          <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
        </TouchableOpacity>

        {/* Status Modal */}
        <Modal
          visible={showStatusModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStatusModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowStatusModal(false)}
          >
            <View style={styles.modalContent}>
              {statusOptions.map((option, index) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.statusOption,
                    index < statusOptions.length - 1 && styles.statusOptionBorder
                  ]}
                  onPress={() => handleStatusSelect(option)}
                >
                  <Text style={styles.statusOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Notes Section */}
        <View style={styles.notesContainer}>
  <TextInput
    style={styles.notesInput}
    placeholder="Add Meeting Notes"
    placeholderTextColor="#A4A4A4"
    multiline
    value={notes}
    onChangeText={setNotes}
  />

  {/* Character Count & Submit Button in Row */}
  <View style={styles.notesFooter}>
    <Text style={styles.characterCount}>{notes.length}/120</Text>

    <TouchableOpacity 
      style={[styles.submitButton, notes.length === 0 && styles.submitButtonDisabled]}
      disabled={notes.length === 0}
    >
      <Text style={styles.submitButtonText}>Submit</Text>
    </TouchableOpacity>
  </View>
</View>


        {/* Follow Up Checkbox */}
        <TouchableOpacity 
          style={styles.followUpContainer}
          onPress={handleFollowUpPress}
        >
          <View style={[styles.checkbox, followUp && styles.checkboxChecked]}>
            {followUp && <MaterialIcons name="check" size={16} color="#FFF" />}
          </View>
          <Text style={styles.followUpText}>Follow up on this call</Text>
        </TouchableOpacity>
    </SafeAreaView>
    </TelecallerMainLayout>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 2,
    alignSelf: 'center',
  },
  playButton: {
    padding: 6,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    marginHorizontal: 10,
    marginVertical: 24,
    width: '50%',
    height: 40,
    borderRadius: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    textAlign: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  notesContainer: {
    backgroundColor: '#FFF',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    
    // elevation: 2,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.1,
    // shadowRadius: 4,
  },
  notesInput: {
    height: 160,
    textAlignVertical: 'top',
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  notesFooter: {
    flexDirection: 'row', /* Arrange Character Count & Submit Button in Row */
    alignItems: 'flex-end',
    justifyContent: 'space-between', /* Space between Character Count & Button */
    marginTop: 12, /* Add space from the TextInput */
  },
  characterCount: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#A4A4A4',
    flex: 1, /* Pushes to the left */
  },
  submitButton: {
    backgroundColor: '#FF7A45',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
  },

  followUpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF8800',
    borderColor: '#FF8800',
  },
  followUpText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'LexendDeca_500Medium'
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerNavItem: {
    backgroundColor: '#FF8800',
    marginTop: -20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignSelf: 'flex-start',
  },
  navText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 120, // Adjust this value to position the dropdown appropriately
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  statusOption: {
    padding: 16,
  },
  statusOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  statusOptionText: {
    fontSize: 16,
    color: '#666',
  },
});

export default TelecallerCallNoteDetails;