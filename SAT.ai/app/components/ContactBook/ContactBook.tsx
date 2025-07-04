import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Linking,
  Platform,
  ActionSheetIOS,
  Share,
  Animated,Modal, KeyboardAvoidingView,     // add this
  Keyboard  
} from 'react-native';
import { Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import * as ExpoContacts from 'expo-contacts';
import Dialer from '@/app/components/Dialer/Dialer';
import AppGradient from '../AppGradient';
type AddContactModalProps = {
    visible: boolean;
    onClose?: () => void;
    phoneNumber: string;
    onContactSaved?: (contact: Contact) => void;
    editingContact?: Contact | null;
    
  };
// import Dialer, { Contact as DialerContact } from '@/app/components/Dialer/Dialer';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  favorite?: boolean;
}

const ALPHABETS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const ContactBook = () => {

    const [contacts, setContacts] = useState<{ [key: string]: Contact[] }>({}); 
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [errors, setErrors] = useState({
      firstName: '',
      phoneNumber: ''
    });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState('');
  const [filteredContacts, setFilteredContacts] = useState<{ [key: string]: Contact[] }>({});
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<{ [key: string]: number }>({});
  const [activeLetters, setActiveLetters] = useState<string[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cleanPhoneNumber = (phone?: string) => (phone || '').replace(/\D/g, '');

  // const [contacts, setContacts] = useState<DialerContact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

const importDeviceContacts = async () => {
  try {
    // Request permission to access device contacts
    const { status } = await ExpoContacts.requestPermissionsAsync();
    if (status === 'granted') {
      // Fetch contacts from the device
      const { data } = await ExpoContacts.getContactsAsync({
        fields: [ExpoContacts.Fields.PhoneNumbers, ExpoContacts.Fields.Emails],
      });

      // If there are contacts fetched
      if (data.length > 0) {
        // Function to clean the phone number by removing non-digit characters
        const cleanPhoneNumber = (phone?: string) => (phone || '').replace(/\D/g, '');

        // Format and filter contacts
        const formattedContacts = data
          .map((contact) => ({
            id: contact.id,
            firstName: contact.firstName || '',
            lastName: contact.lastName || '',
            phoneNumber: contact.phoneNumbers && contact.phoneNumbers.length > 0 
              ? contact.phoneNumbers[0].number 
              : '',
            email: contact.emails && contact.emails.length > 0 ? contact.emails[0].email : '',
            favorite: false,
          }))
          .filter(c => c.phoneNumber); // Filter out contacts without phone numbers

        // Fetch existing contacts from AsyncStorage
        const storedContacts = await AsyncStorage.getItem('telecaller_contacts');
        let existingContacts = storedContacts ? JSON.parse(storedContacts) : [];

        // Merge existing contacts with newly fetched contacts
        const mergedContacts = [...existingContacts];

        formattedContacts.forEach(newContact => {
          const newPhone = cleanPhoneNumber(newContact.phoneNumber);
          
          // Check if the contact already exists based on phone number
          const exists = existingContacts.some((c: Contact) => cleanPhoneNumber(c.phoneNumber) === newPhone);
          if (!exists && newPhone) {
            mergedContacts.push(newContact); // Add new contact only if it doesn't exist
          }
        });

        // Save merged contacts back to AsyncStorage
        await AsyncStorage.setItem('telecaller_contacts', JSON.stringify(mergedContacts));

        // Load contacts into state and perform additional operations like refreshing UI
        loadContacts();

        // Display success message
        Alert.alert('Success', 'Device contacts synced successfully.');
      } else {
        Alert.alert('No Contacts Found', 'There are no contacts in your device.');
      }
    } else {
      Alert.alert('Permission Denied', 'We need access to your contacts to sync them.');
    }
  } catch (error) {
    console.error('Error syncing contacts:', error);
    Alert.alert('Error', 'Failed to sync contacts. Please try again.');
  }
};

  
  

  useEffect(() => {
    loadContacts();
    loadSearchHistory();
    importDeviceContacts();   // ➡️ Auto sync on screen load
  }, []);

  useEffect(() => {
    filterContacts();
  }, [searchQuery, contacts, showFavoritesOnly]);

  const loadContacts = async () => {
    try {
      const storedContacts = await AsyncStorage.getItem('telecaller_contacts');
      if (storedContacts) {
        const parsedContacts: Contact[] = JSON.parse(storedContacts);
        organizeContactsByAlphabet(parsedContacts); // Organize contacts by first letter
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    }
  };


  const loadSearchHistory = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem('contactSearchHistory');
      if (storedHistory) {
        setSearchHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  };

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

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    saveSearchToHistory(query);
    setShowSearchHistory(false);
  };

  const clearSearchHistory = async () => {
    try {
      setSearchHistory([]);
      await AsyncStorage.removeItem('contactSearchHistory');
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  };

  const handleScroll = (event: any) => {
    const yOffset = event.nativeEvent.contentOffset.y;
    setShowScrollToTop(yOffset > 300);
  };

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const organizeContactsByAlphabet = (contactsList: Contact[]) => {
    const organized = contactsList.reduce((acc: { [key: string]: Contact[] }, contact: Contact) => {
      const firstLetter = (contact.firstName?.[0] || '#').toUpperCase();

      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(contact);
      return acc;
    }, {});

    setContacts(organized); // Store organized contacts
  };
  

  const filterContacts = useCallback(() => {
    if (!searchQuery.trim() && !showFavoritesOnly) {
      setFilteredContacts(contacts);
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

    setFilteredContacts(filtered);
  }, [searchQuery, contacts, showFavoritesOnly]);

  const handleContactSaved = (newContact: Contact) => {
    loadContacts();
  };

  const scrollToLetter = (letter: string) => {
    if (!activeLetters.includes(letter)) return;
    
    setSelectedLetter(letter);
    
    // Fade in animation
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
    
    const yOffset = sectionRefs.current[letter] || 0;
    scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
  };

  const handleCall = (phoneNumber: string) => {
    const telUrl = `tel:${phoneNumber}`;
    Linking.canOpenURL(telUrl)
      .then(supported => {
        if (supported) {
          return Linking.openURL(telUrl);
        }
        Alert.alert('Error', 'Phone calls are not supported on this device');
      })
      .catch(err => Alert.alert('Error', 'Failed to make phone call'));
  };

  const handleShare = async (contact: Contact) => {
    try {
      const message = `Contact Details:\nName: ${contact.firstName} ${contact.lastName}\nPhone: ${contact.phoneNumber}${contact.email ? `\nEmail: ${contact.email}` : ''}`;
      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing contact:', error);
    }
  };

  const handleContactOptions = (contact: Contact) => {
    Alert.alert(
      `${contact.firstName} ${contact.lastName}`,
      'Choose an action',
      [
        {
          text: 'Call',
          onPress: () => handleCall(contact.phoneNumber)
        },
        {
          text: 'Edit',
          onPress: () => {
            setEditingContact(contact);
            setFirstName(contact.firstName || '');
            setLastName(contact.lastName || '');
            setPhoneNumber(contact.phoneNumber || '');
            setEmail(contact.email || '');
            setModalVisible(true);
          }
          
        },
        {
          text: 'Delete',
          onPress: () => handleDelete(contact),
          style: 'destructive'
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ],
      { cancelable: true }
    );
  };
  

 

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
              const storedContacts = await AsyncStorage.getItem('telecaller_contacts');
              if (storedContacts) {
                const parsedContacts: Contact[] = JSON.parse(storedContacts);
  
                // ❌ Remove the contact
                const updatedContacts = parsedContacts.filter(c => c.id !== contact.id);
  
                // ✅ Save updated list
                await AsyncStorage.setItem('telecaller_contacts', JSON.stringify(updatedContacts));
  
                // ✅ Refresh UI
                organizeContactsByAlphabet(updatedContacts);
                filterContacts(); // Refresh filtered view
                const lettersWithContacts = updatedContacts.reduce((letters: string[], contact: Contact) => {
                  const firstLetter = (contact.firstName?.[0] || '#').toUpperCase();
                  if (!letters.includes(firstLetter)) letters.push(firstLetter);
                  return letters;
                }, []);
                setActiveLetters(lettersWithContacts.sort());
  
                Alert.alert('Deleted', 'Contact has been removed.');
              }
            } catch (error) {
              console.error('Delete Error:', error);
              Alert.alert('Error', 'Failed to delete contact.');
            }
          }
        }
      ]
    );
  };
  

  const renderContact = (contact: Contact) => (
    <TouchableOpacity
      key={contact.id}
      style={styles.contactItem}
      onLongPress={() => handleContactOptions(contact)}
      delayLongPress={500}
    >
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>
        {(contact.firstName?.[0] || '#').toUpperCase()}

        </Text>
      </View>
  
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>
          {`${contact.firstName} ${contact.lastName}`.trim()}
        </Text>
        <Text style={styles.contactPhone}>{contact.phoneNumber}</Text>
      </View>
  
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => handleCall(contact.phoneNumber)}
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
  
  
  const validateForm = () => {
    let isValid = true;
    const newErrors = {
      firstName: '',
      phoneNumber: ''
    };

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
      isValid = false;
    }

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
  
    try {
      const storedContacts = await AsyncStorage.getItem('telecaller_contacts');
      let currentContacts: Contact[] = storedContacts ? JSON.parse(storedContacts) : [];
  
      let updatedContacts: Contact[];
  
      if (editingContact) {
        // Edit Mode: Update only this contact
        updatedContacts = currentContacts.map((contact) =>
          contact.id === editingContact.id
            ? {
                ...contact,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phoneNumber: phoneNumber.trim(),
                email: email.trim(),
              }
            : contact
        );
      } else {
        // Add New Contact Mode
        const newContact: Contact = {
          id: Date.now().toString(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email.trim(),
          favorite: false,
        };
        updatedContacts = [...currentContacts, newContact];
      }
  
      await AsyncStorage.setItem('telecaller_contacts', JSON.stringify(updatedContacts));
  
      organizeContactsByAlphabet(updatedContacts); // Reload updated contacts in view
      const lettersWithContacts = updatedContacts.reduce((letters: string[], contact: Contact) => {
        const firstLetter = (contact.firstName?.[0] || '#').toUpperCase();
        if (!letters.includes(firstLetter)) letters.push(firstLetter);
        return letters;
      }, []);
      setActiveLetters(lettersWithContacts.sort());
      setSearchQuery('');
      filterContacts();
  
      // Clear form
      setFirstName('');
      setLastName('');
      setPhoneNumber('');
      setEmail('');
      setEditingContact(null);
  
      // ✅ Close modal first
      setModalVisible(false);
  
      // ✅ Then show popup after a small delay
      setTimeout(() => {
        Alert.alert('Success', editingContact ? 'Contact updated successfully!' : 'Contact saved successfully!');
      }, 300);
  
    } catch (error) {
      console.error('Error saving contact:', error);
      Alert.alert('Error', `Failed to ${editingContact ? 'update' : 'save'} contact. Please try again.`);
    }
  };
  
useEffect(() => {
  console.log('Contacts passed to Dialer:', contacts);
}, [JSON.stringify(contacts)]); 
  // Removed fetchContacts and its useEffect because contacts are managed as an object by alphabet in this component.

 return (
  <AppGradient>
    <TelecallerMainLayout showBackButton={true} title="Contact Book">
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
          <TouchableOpacity onPress={() => {
            setSearchQuery('');
            setShowSearchHistory(true);
          }}>
            <MaterialIcons name="close" size={24} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {showSearchHistory && searchHistory.length > 0 && (
        <View style={styles.searchHistoryContainer}>
          <View style={styles.searchHistoryHeader}>
            <Text style={styles.searchHistoryTitle}>Recent Searches</Text>
            <TouchableOpacity onPress={clearSearchHistory}>
              <Text style={styles.clearHistoryText}>Clear</Text>
            </TouchableOpacity>
          </View>
          {searchHistory.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.searchHistoryItem}
              onPress={() => handleSearch(item)}
            >
              <MaterialIcons name="history" size={18} color="#999" />
              <Text style={styles.searchHistoryItemText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.createContactButton}
        onPress={() => {
          setEditingContact(null); // For Add New Contact
          setModalVisible(true);   // Open Modal
        }}
      >
        <MaterialIcons name="person-add" size={24} color="#0099ff" />
        <Text style={styles.createContactText}>Create New Contact</Text>
      </TouchableOpacity>

      <View style={styles.contactsContainer}>
        <ScrollView 
          ref={scrollViewRef}
          style={styles.contactsList}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {Object.keys(filteredContacts).sort().map(letter => (
            <View 
              key={letter} 
              onLayout={(event) => {
                const layout = event.nativeEvent.layout;
                sectionRefs.current[letter] = layout.y;
              }}
            >
              <Text style={styles.sectionHeader}>{letter}</Text>
              {filteredContacts[letter].map(contact => renderContact(contact))}
            </View>
          ))}

          {/* Add some padding at the bottom for better scrolling */}
          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.alphabetList}>  
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 4 }}
          >
            {ALPHABETS.map((letter) => (
              <TouchableOpacity
                key={letter}
                onPress={() => scrollToLetter(letter)}
                style={[
                  styles.alphabetItem,
                  activeLetters.includes(letter) ? { opacity: 1 } : { opacity: 0.3 },
                  selectedLetter === letter && styles.alphabetItemSelected
                ]}
                disabled={!activeLetters.includes(letter)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.alphabetText,
                  activeLetters.includes(letter) ? { color: '#666', fontFamily: 'LexendDeca_500Medium' } : {},
                  selectedLetter === letter && styles.alphabetTextSelected
                ]}>
                  {letter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Scroll to top button */}
      {showScrollToTop && (
        <TouchableOpacity 
          style={styles.scrollToTopButton}
          onPress={scrollToTop}
        >
          <MaterialIcons name="arrow-upward" size={24} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Quick Alphabet Navigation Indicator */}
      {selectedLetter ? (
        <Animated.View 
          style={[
            styles.letterIndicator,
            { opacity: fadeAnim }
          ]}
        >
          <Text style={styles.letterIndicatorText}>{selectedLetter}</Text>
        </Animated.View>
      ) : null}
    </TelecallerMainLayout>



    {modalVisible && (
      <Modal
        visible={modalVisible} // your existing state
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setModalVisible(false); // Close Modal
                }}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>

              <Text style={styles.modalTitle}>
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView
              style={styles.form}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Form Fields for First Name, Last Name, Phone Number, Email */}
            </ScrollView>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>
                {editingContact ? 'Update Contact' : 'Save Contact'}
              </Text>
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

export default ContactBook;   
