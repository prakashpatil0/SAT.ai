import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Linking,
  Animated, 
  Modal, 
  KeyboardAvoidingView, 
  Keyboard 
} from 'react-native';
import { Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import BDMMainLayout from "@/app/components/BDMMainLayout";
import AppGradient from '../AppGradient';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  favorite?: boolean;
}

const ALPHABETS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const BDMContactBook = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({ firstName: '', phoneNumber: '' });
  const [contacts, setContacts] = useState<{ [key: string]: Contact[] }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [activeLetters, setActiveLetters] = useState<string[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<{ [key: string]: number }>({});

  // Step 1: Request permission and load contacts from the device
  useEffect(() => {
    const requestPermission = async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        loadContactsFromDevice();
      } else {
        Alert.alert('Permission Denied', 'You need to grant permission to access contacts.');
      }
    };
    requestPermission();
  }, []);

  // Step 2: Filter contacts based on the search query and favorites
  useEffect(() => {
    filterContacts();
  }, [searchQuery, contacts, showFavoritesOnly]);

  // Step 3: Load contacts from AsyncStorage
  const loadContactsFromDevice = async () => {
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      });

      const formattedContacts = data
        .map((item, index) => ({
          id: item.id || index.toString(),
          firstName: item.firstName || '',
          lastName: item.lastName || '',
          phoneNumber: item.phoneNumbers?.[0]?.number || '',
          email: item.emails?.[0]?.email || '',
        }))
        .filter(contact => contact.phoneNumber); // Filter out contacts without phone numbers

      // Save contacts to AsyncStorage
      await AsyncStorage.setItem('contacts', JSON.stringify(formattedContacts));

      organizeContactsByAlphabet(formattedContacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    }
  };

  // Step 4: Organize contacts by the first letter of their name
  const organizeContactsByAlphabet = (contactsList: Contact[]) => {
    const organized = contactsList.reduce((acc: { [key: string]: Contact[] }, contact) => {
      const firstLetter = contact.firstName[0].toUpperCase();
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(contact);
      return acc;
    }, {});

    setContacts(organized);

    // Find which letters have contacts
    const lettersWithContacts = contactsList.reduce((letters: string[], contact: Contact) => {
      const firstLetter = contact.firstName[0].toUpperCase();
      if (!letters.includes(firstLetter)) {
        letters.push(firstLetter);
      }
      return letters;
    }, []);

    setActiveLetters(lettersWithContacts.sort());
  };

  // Step 5: Save search query history to AsyncStorage
  const saveSearchToHistory = async (query: string) => {
    if (!query.trim() || query.length < 3) return;

    try {
      const newHistory = [query, ...searchHistory.filter(item => item !== query)].slice(0, 5);
      setSearchHistory(newHistory);
      await AsyncStorage.setItem('contactSearchHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  };

  // Step 6: Handle contact search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    saveSearchToHistory(query);
    setShowSearchHistory(false);
  };

  // Step 7: Filter contacts based on search query
  const filterContacts = useCallback(() => {
    if (!searchQuery.trim() && !showFavoritesOnly) {
      setContacts(contacts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered: { [key: string]: Contact[] } = {};

    Object.keys(contacts).forEach(letter => {
      let matchingContacts = contacts[letter].filter(contact =>
        (contact.firstName.toLowerCase().includes(query) ||
          contact.lastName.toLowerCase().includes(query) ||
          contact.phoneNumber.includes(query) ||
          (contact.email && contact.email.toLowerCase().includes(query))) &&
        (!showFavoritesOnly || contact.favorite)
      );

      if (matchingContacts.length > 0) {
        filtered[letter] = matchingContacts;
      }
    });

    setContacts(filtered);
  }, [searchQuery, contacts, showFavoritesOnly]);

  // Step 8: Handle deleting contact
  const handleDelete = (contact: Contact) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete ${contact.firstName} ${contact.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const storedContacts = await AsyncStorage.getItem('contacts');
              if (storedContacts) {
                const contacts = JSON.parse(storedContacts);
                const updatedContacts = contacts.filter((c: Contact) => c.id !== contact.id);
                await AsyncStorage.setItem('contacts', JSON.stringify(updatedContacts));
                loadContactsFromDevice(); // Reload contacts to reflect changes
              }
            } catch (error) {
              console.error('Error deleting contact:', error);
              Alert.alert('Error', 'Failed to delete contact');
            }
          }
        }
      ]
    );
  };

  // Step 9: Render contact items
  const renderContact = (contact: Contact) => (
    <TouchableOpacity key={contact.id} style={styles.contactItem}>
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>
          {contact.firstName[0].toUpperCase()}
        </Text>
      </View>

      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>
          {`${contact.firstName} ${contact.lastName}`}
        </Text>
        <Text style={styles.contactPhone}>{contact.phoneNumber}</Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => handleCall(contact.phoneNumber)} // Calling handleCall function
        >
          <MaterialIcons name="phone" size={24} color="#FF8447" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => handleContactOptions(contact)}
        >
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#333' }}>⋮</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Step 10: Handle saving contacts
  const handleSave = async () => {
    // Form validation before save
    if (!validateForm()) {
      return;
    }

    try {
      // Get existing contacts
      const storedContacts = await AsyncStorage.getItem('contacts');
      const currentContacts: Contact[] = storedContacts ? JSON.parse(storedContacts) : [];

      // Create or update contact
      const updatedContact: Contact = {
        id: editingContact?.id || Date.now().toString(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim(),
        favorite: editingContact?.favorite || false
      };

      let updatedContacts: Contact[] = [];
      if (editingContact) {
        // Update existing contact
        updatedContacts = currentContacts.map(contact =>
          contact.id === editingContact.id ? updatedContact : contact
        );
      } else {
        // Add new contact
        updatedContacts = [...currentContacts, updatedContact];
      }

      // Save to AsyncStorage
      await AsyncStorage.setItem('contacts', JSON.stringify(updatedContacts));
      loadContactsFromDevice(); // Reload contacts
      Alert.alert('Success', 'Contact saved successfully!');
      setModalVisible(false);
    } catch (error) {
      console.error('Error saving contact:', error);
      Alert.alert('Error', 'Failed to save contact. Please try again.');
    }
  };

  return (
    <AppGradient>
      <BDMMainLayout showBackButton={true} title="Contact Book">
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={24} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone, or email"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
            onFocus={() => setShowSearchHistory(true)}
            onSubmitEditing={() => {
              saveSearchToHistory(searchQuery);
              setShowSearchHistory(false);
            }}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={24} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView ref={scrollViewRef} style={styles.contactsList}>
          {Object.keys(filteredContacts).map(letter => (
            <View key={letter}>
              <Text style={styles.sectionHeader}>{letter}</Text>
              {filteredContacts[letter].map(contact => renderContact(contact))}
            </View>
          ))}
        </ScrollView>
      </BDMMainLayout>

      {modalVisible && (
        <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                  <MaterialIcons name="close" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{editingContact ? 'Edit Contact' : 'Add New Contact'}</Text>
              </View>
              <ScrollView style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>First Name <Text style={styles.required}>*</Text></Text>
                  <TextInput
                    style={[styles.input, errors.firstName ? styles.inputError : null]}
                    placeholder="Enter First Name"
                    value={firstName}
                    onChangeText={setFirstName}
                    returnKeyType="next"
                  />
                  {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Last Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Last Name"
                    value={lastName}
                    onChangeText={setLastName}
                    returnKeyType="next"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone Number <Text style={styles.required}>*</Text></Text>
                  <TextInput
                    style={[styles.input, errors.phoneNumber ? styles.inputError : null]}
                    placeholder="Enter Phone Number"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                  />
                  {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email ID</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Email ID"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                  />
                </View>
              </ScrollView>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>{editingContact ? 'Update Contact' : 'Save Contact'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchIcon: {
    marginHorizontal: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    marginLeft: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  filterButtonActive: {
    backgroundColor: '#FFF9E6',
  },
  filterButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#333',
  },
  createContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  createContactText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#0099ff',
    fontFamily: 'LexendDeca_500Medium',
  },
  contactsContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
  },
  contactsList: {
    flex: 1,
  },
  sectionHeader: {
    padding: 8,
    paddingLeft: 16,
    backgroundColor: '#F5F5F5',
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF8447',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteAvatarContainer: {
    backgroundColor: '#FFB347',
  },
  avatarText: {
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
    color: '#fff',
  },
  contactInfo: {
    marginLeft: 12,
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactName: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  favoriteIcon: {
    marginLeft: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
    backgroundColor: '#F5F5F5',
  },
  alphabetList: {
    width: 24,
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    paddingVertical: 4,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: -1, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  alphabetItem: {
    padding: 2,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
    borderRadius: 11,
  },
  alphabetItemSelected: {
    backgroundColor: '#FF8447',
    borderRadius: 11,
    elevation: 2,
    shadowColor: '#FF8447',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  alphabetText: {
    fontSize: 11,
    fontFamily: 'LexendDeca_400Regular',
    color: '#888',
  },
  alphabetTextSelected: {
    color: '#fff',
    fontFamily: 'LexendDeca_600SemiBold',
  },
  letterIndicator: {
    position: 'absolute',
    top: '45%',
    left: '45%',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 132, 71, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  letterIndicatorText: {
    color: '#FFF',
    fontSize: 36,
    fontFamily: 'LexendDeca_700Bold',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  searchHistoryContainer: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    zIndex: 10,
  },
  searchHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 8,
  },
  searchHistoryTitle: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
  },
  clearHistoryText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF8447',
  },
  searchHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  searchHistoryItemText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    marginLeft: 12,
  },
  scrollToTopButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF8447',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    paddingBottom: 24,
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#FF4444',
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    backgroundColor: '#FFF',
  },
  inputError: {
    borderColor: '#FF4444',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#FF8447',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
  },
  readOnlyInput: {
    backgroundColor: '#F5F5F5',
    color: '#666',
  },
});      

export default BDMContactBook;  
