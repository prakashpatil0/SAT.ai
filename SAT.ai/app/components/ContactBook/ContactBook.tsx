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
  Animated
} from 'react-native';
import { Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import TelecallerAddContactModal from '@/app/Screens/Telecaller/TelecallerAddContactModal';
import TelecallerMainLayout from '../TelecallerMainLayout';
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

const ContactBook = () => {
  const [contacts, setContacts] = useState<{ [key: string]: Contact[] }>({});
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

  useEffect(() => {
    loadContacts();
    loadSearchHistory();
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
        
        // Find which letters have contacts
        const lettersWithContacts = parsedContacts.reduce((letters: string[], contact: Contact) => {
          const firstLetter = contact.firstName[0].toUpperCase();
          if (!letters.includes(firstLetter)) {
            letters.push(firstLetter);
          }
          return letters;
        }, []);
        
        setActiveLetters(lettersWithContacts.sort());
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
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Call', 'Edit', 'Toggle Favorite', 'Delete'],
          destructiveButtonIndex: 4,
          cancelButtonIndex: 0,
          title: `${contact.firstName} ${contact.lastName}`,
        },
        (buttonIndex) => {
          switch (buttonIndex) {
            case 1:
              handleCall(contact.phoneNumber);
              break;
            case 2:
              setEditingContact(contact);
              setModalVisible(true);
              break;
            case 3:
              toggleFavorite(contact);
              break;
            case 4:
              handleDelete(contact);
              break;
          }
        }
      );
    } else {
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
              setModalVisible(true);
            }
          },
          {
            text: contact.favorite ? 'Remove from Favorites' : 'Add to Favorites',
            onPress: () => toggleFavorite(contact)
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
    }
  };

  const toggleFavorite = async (contact: Contact) => {
    try {
      const storedContacts = await AsyncStorage.getItem('contacts');
      if (storedContacts) {
        const contacts = JSON.parse(storedContacts);
        const updatedContacts = contacts.map((c: Contact) => {
          if (c.id === contact.id) {
            return { ...c, favorite: !c.favorite };
          }
          return c;
        });
        await AsyncStorage.setItem('contacts', JSON.stringify(updatedContacts));
        loadContacts(); // Reload contacts to reflect changes
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
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
              const storedContacts = await AsyncStorage.getItem('contacts');
              if (storedContacts) {
                const contacts = JSON.parse(storedContacts);
                const updatedContacts = contacts.filter((c: Contact) => c.id !== contact.id);
                await AsyncStorage.setItem('contacts', JSON.stringify(updatedContacts));
                loadContacts(); // Reload contacts to reflect changes
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

  const renderContact = (contact: Contact) => (
    <TouchableOpacity
      key={contact.id}
      style={styles.contactItem}
      onLongPress={() => handleContactOptions(contact)}
      delayLongPress={500}
    >
      <View style={[styles.avatarContainer, contact.favorite && styles.favoriteAvatarContainer]}>
        <Text style={styles.avatarText}>
          {contact.firstName[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <View style={styles.nameContainer}>
          <Text style={styles.contactName}>
            {`${contact.firstName} ${contact.lastName}`.trim()}
          </Text>
          {contact.favorite && (
            <MaterialIcons
              name="star"
              size={16}
              color="#FFB347"
              style={styles.favoriteIcon}
            />
          )}
        </View>
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
          <MaterialIcons name="more-vert" size={24} color="#666" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

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
          <View style={{height: 100}} />
        </ScrollView>

        <View style={styles.alphabetList}>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{paddingVertical: 4}}
          >
            {ALPHABETS.map((letter) => (
              <TouchableOpacity
                key={letter}
                onPress={() => scrollToLetter(letter)}
                style={[
                  styles.alphabetItem,
                  activeLetters.includes(letter) ? {opacity: 1} : {opacity: 0.3},
                  selectedLetter === letter && styles.alphabetItemSelected
                ]}
                disabled={!activeLetters.includes(letter)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.alphabetText,
                  activeLetters.includes(letter) ? {color: '#666', fontFamily: 'LexendDeca_500Medium'} : {},
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
});

export default ContactBook; 