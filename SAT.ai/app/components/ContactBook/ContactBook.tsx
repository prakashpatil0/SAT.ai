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
  Share
} from 'react-native';
import { Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import TelecallerAddContactModal from '@/app/Screens/Telecaller/TelecallerAddContactModal';
import TelecallerMainLayout from '../TelecallerMainLayout';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState('');
  const [filteredContacts, setFilteredContacts] = useState<{ [key: string]: Contact[] }>({});
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<{ [key: string]: number }>({});

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [searchQuery, contacts, showFavoritesOnly]);

  const loadContacts = async () => {
    try {
      const storedContacts = await AsyncStorage.getItem('contacts');
      if (storedContacts) {
        const parsedContacts = JSON.parse(storedContacts);
        organizeContactsByAlphabet(parsedContacts);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    }
  };

  const organizeContactsByAlphabet = (contactsList: Contact[]) => {
    const organized = contactsList.reduce((acc: { [key: string]: Contact[] }, contact) => {
      const firstLetter = contact.firstName[0].toUpperCase();
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(contact);
      return acc;
    }, {});

    Object.keys(organized).forEach(letter => {
      organized[letter].sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return a.firstName.localeCompare(b.firstName);
      });
    });

    setContacts(organized);
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
    setSelectedLetter(letter);
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

  const toggleFavorite = async (contact: Contact) => {
    try {
      const storedContacts = await AsyncStorage.getItem('contacts');
      const currentContacts: Contact[] = storedContacts ? JSON.parse(storedContacts) : [];
      
      const updatedContacts = currentContacts.map(c => 
        c.id === contact.id ? { ...c, favorite: !c.favorite } : c
      );

      await AsyncStorage.setItem('contacts', JSON.stringify(updatedContacts));
      organizeContactsByAlphabet(updatedContacts);
    } catch (error) {
      console.error('Error updating favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
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
              const currentContacts: Contact[] = storedContacts ? JSON.parse(storedContacts) : [];
              const updatedContacts = currentContacts.filter(c => c.id !== contact.id);
              await AsyncStorage.setItem('contacts', JSON.stringify(updatedContacts));
              organizeContactsByAlphabet(updatedContacts);
            } catch (error) {
              console.error('Error deleting contact:', error);
              Alert.alert('Error', 'Failed to delete contact');
            }
          }
        }
      ]
    );
  };

  const handleContactPress = (contact: Contact) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Call', 'Edit', 'Share', 'Delete', contact.favorite ? 'Remove from Favorites' : 'Add to Favorites'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 4,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handleCall(contact.phoneNumber);
          else if (buttonIndex === 2) {
            setEditingContact(contact);
            setModalVisible(true);
          }
          else if (buttonIndex === 3) handleShare(contact);
          else if (buttonIndex === 4) handleDeleteContact(contact);
          else if (buttonIndex === 5) toggleFavorite(contact);
        }
      );
    } else {
      Alert.alert(
        `${contact.firstName} ${contact.lastName}`,
        `Phone: ${contact.phoneNumber}\nEmail: ${contact.email || 'Not provided'}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Call',
            style: 'default',
            onPress: () => handleCall(contact.phoneNumber)
          },
          {
            text: 'Edit',
            style: 'default',
            onPress: () => {
              setEditingContact(contact);
              setModalVisible(true);
            }
          },
          {
            text: 'Share Contact',
            style: 'default',
            onPress: () => handleShare(contact)
          },
          {
            text: contact.favorite ? '⭐ Remove from Favorites' : '⭐ Add to Favorites',
            style: 'default',
            onPress: () => toggleFavorite(contact)
          },
          {
            text: 'Delete Contact',
            style: 'destructive',
            onPress: () => handleDeleteContact(contact)
          }
        ]
      );
    }
  };

  const renderContactItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity 
      style={styles.contactItem}
      onPress={() => handleContactPress(item)}
    >
      <View style={[styles.avatarContainer, item.favorite && styles.favoriteAvatarContainer]}>
        <Text style={styles.avatarText}>{item.firstName[0].toUpperCase()}</Text>
      </View>
      <View style={styles.contactInfo}>
        <View style={styles.nameContainer}>
          <Text style={styles.contactName}>
            {`${item.firstName} ${item.lastName}`}
          </Text>
          {item.favorite && (
            <MaterialIcons name="star" size={16} color="#FFD700" style={styles.favoriteIcon} />
          )}
        </View>
        <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
      </View>
      <TouchableOpacity 
        style={styles.quickCallButton}
        onPress={() => handleCall(item.phoneNumber)}
      >
        <MaterialIcons name="phone" size={20} color="#FF8447" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderAlphabetSection = ({ letter }: { letter: string }) => {
    const contactsToShow = filteredContacts[letter] || [];
    if (contactsToShow.length === 0) return null;
    
    return (
      <View 
        key={letter}
        onLayout={(event) => {
          sectionRefs.current[letter] = event.nativeEvent.layout.y;
        }}
      >
        <Text style={styles.sectionHeader}>{letter}</Text>
        {contactsToShow.map((contact) => (
          <View key={contact.id}>
            {renderContactItem({ item: contact })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <TelecallerMainLayout showBackButton={true} title="Contact Book">
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, phone, or email"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialIcons name="close" size={24} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, showFavoritesOnly && styles.filterButtonActive]}
          onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
        >
          <MaterialIcons 
            name="star" 
            size={20} 
            color={showFavoritesOnly ? "#FFD700" : "#666"} 
          />
          <Text style={[styles.filterButtonText, showFavoritesOnly && styles.filterButtonTextActive]}>
            Favorites
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.createContactButton}
        onPress={() => {
          setEditingContact(null);
          setModalVisible(true);
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
        >
          {ALPHABETS.map((letter) => renderAlphabetSection({ letter }))}
        </ScrollView>

        <View style={styles.alphabetList}>
          {ALPHABETS.map((letter) => (
            <TouchableOpacity
              key={letter}
              onPress={() => scrollToLetter(letter)}
              style={[
                styles.alphabetItem,
                selectedLetter === letter && styles.alphabetItemSelected
              ]}
            >
              <Text style={[
                styles.alphabetText,
                selectedLetter === letter && styles.alphabetTextSelected
              ]}>
                {letter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TelecallerAddContactModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingContact(null);
        }}
        phoneNumber={editingContact?.phoneNumber || ""}
        onContactSaved={handleContactSaved}
        editingContact={editingContact}
      />
    </TelecallerMainLayout>
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
  quickCallButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  alphabetList: {
    width: 24,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  alphabetItem: {
    padding: 2,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alphabetItemSelected: {
    backgroundColor: '#FF8447',
    borderRadius: 12,
  },
  alphabetText: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  alphabetTextSelected: {
    color: '#fff',
  },
});

export default ContactBook; 