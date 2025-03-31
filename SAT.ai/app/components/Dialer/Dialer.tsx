import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  Platform,
  PanResponder,
  FlatList,
  ActivityIndicator,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { height, width } = Dimensions.get('window');

// Define navigation types
type RootStackParamList = {
  AddContactModal: {
    phoneNumber: string;
    onContactSaved: () => void;
    editingContact?: Contact;
  };
  ContactInfo: {
    contact: Contact;
  };
};

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  favorite: boolean;
}

interface DialerProps {
  visible: boolean;
  onClose: () => void;
  onCallPress: (number: string) => void;
  contacts: Contact[];
  isLoading: boolean;
}

interface ContactValidation {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
}

// Memoized components for better performance
const DialButton = memo(({ item, onPress }: { 
  item: { num: string; alpha: string }; 
  onPress: (num: string) => void;
}) => (
  <TouchableOpacity
    style={styles.dialButton}
    onPress={() => onPress(item.num)}
  >
    <Text style={styles.dialButtonNumber}>{item.num}</Text>
    <Text style={styles.dialButtonAlpha}>{item.alpha}</Text>
  </TouchableOpacity>
));

const ContactSuggestion = memo(({ contact, onPress, onInfoPress }: {
  contact: Contact;
  onPress: (contact: Contact) => void;
  onInfoPress: (contact: Contact) => void;
}) => (
  <TouchableOpacity 
    style={styles.suggestionItem}
    onPress={() => onPress(contact)}
  >
    <View style={styles.avatarContainer}>
      <Text style={styles.avatarText}>
        {contact.firstName[0].toUpperCase()}
      </Text>
    </View>
    <View style={styles.contactInfo}>
      <Text style={styles.contactName}>
        {`${contact.firstName} ${contact.lastName}`}
      </Text>
      <Text style={styles.contactNumber}>
        {contact.phoneNumber}
      </Text>
    </View>
    <TouchableOpacity 
      style={styles.contactInfoButton}
      onPress={() => onInfoPress(contact)}
    >
      <MaterialIcons name="info" size={24} color="#FF8447" />
    </TouchableOpacity>
  </TouchableOpacity>
));

// Add Contact Modal Component
const AddContactModal = memo(({ 
  visible, 
  onClose, 
  phoneNumber,
  onSave 
}: {
  visible: boolean;
  onClose: () => void;
  phoneNumber: string;
  onSave: (contact: Contact) => void;
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<ContactValidation>({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      setFirstName('');
      setLastName('');
      setEmail('');
      setErrors({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        email: ''
      });
    }
  }, [visible]);

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: ContactValidation = {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      email: ''
    };

    // First Name validation
    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
      isValid = false;
    } else if (firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
      isValid = false;
    }

    // Last Name validation (optional but if provided, must be valid)
    if (lastName.trim() && lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
      isValid = false;
    }

    // Phone Number validation
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
      isValid = false;
    } else if (!/^\+?[\d\s-]{10,}$/.test(phoneNumber.trim())) {
      newErrors.phoneNumber = 'Invalid phone number format';
      isValid = false;
    }

    // Email validation (optional but if provided, must be valid)
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Invalid email format';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      setIsSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const newContact: Contact = {
        id: Date.now().toString(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim() || undefined,
        favorite: false
      };

      // Get existing contacts
      const storedContacts = await AsyncStorage.getItem('contacts');
      const contacts = storedContacts ? JSON.parse(storedContacts) : [];

      // Check for duplicate phone number
      const isDuplicate = contacts.some((contact: Contact) => 
        contact.phoneNumber === newContact.phoneNumber
      );

      if (isDuplicate) {
        Alert.alert(
          'Duplicate Contact',
          'A contact with this phone number already exists.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Add new contact and save
      const updatedContacts = [...contacts, newContact];
      await AsyncStorage.setItem('contacts', JSON.stringify(updatedContacts));

      onSave(newContact);
      Alert.alert('Success', 'Contact saved successfully!');
      onClose();
    } catch (error) {
      console.error('Error saving contact:', error);
      Alert.alert('Error', 'Failed to save contact. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.addContactOverlay}
      >
        <View style={styles.addContactContainer}>
          <View style={styles.addContactHeader}>
            <Text style={styles.addContactTitle}>Add New Contact</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScrollView}>
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <TextInput
                  style={[styles.addContactInput, errors.firstName && styles.inputError]}
                  placeholder="First Name*"
                  value={firstName}
                  onChangeText={(text) => {
                    setFirstName(text);
                    if (errors.firstName) {
                      setErrors(prev => ({ ...prev, firstName: '' }));
                    }
                  }}
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                  blurOnSubmit={false}
                />
                {errors.firstName ? (
                  <Text style={styles.errorText}>{errors.firstName}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <TextInput
                  ref={lastNameRef}
                  style={[styles.addContactInput, errors.lastName && styles.inputError]}
                  placeholder="Last Name"
                  value={lastName}
                  onChangeText={(text) => {
                    setLastName(text);
                    if (errors.lastName) {
                      setErrors(prev => ({ ...prev, lastName: '' }));
                    }
                  }}
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  blurOnSubmit={false}
                />
                {errors.lastName ? (
                  <Text style={styles.errorText}>{errors.lastName}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <TextInput
                  style={[styles.addContactInput, errors.phoneNumber && styles.inputError]}
                  placeholder="Phone Number"
                  value={phoneNumber}
                  editable={false}
                />
                {errors.phoneNumber ? (
                  <Text style={styles.errorText}>{errors.phoneNumber}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <TextInput
                  ref={emailRef}
                  style={[styles.addContactInput, errors.email && styles.inputError]}
                  placeholder="Email"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) {
                      setErrors(prev => ({ ...prev, email: '' }));
                    }
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="done"
                />
                {errors.email ? (
                  <Text style={styles.errorText}>{errors.email}</Text>
                ) : null}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity 
            style={[
              styles.addContactButton,
              (!firstName.trim() || isSaving) && styles.addContactButtonDisabled
            ]}
            onPress={handleSave}
            disabled={!firstName.trim() || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.addContactButtonText}>Save Contact</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const Dialer: React.FC<DialerProps> = ({
  visible,
  onClose,
  onCallPress,
  contacts,
  isLoading
}) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  
  // Animated values
  const dialerY = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const suggestionsHeight = useRef(new Animated.Value(0)).current;
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  // Pan responder for smooth dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dialerY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > height * 0.2) {
          handleClose();
        } else {
          // Snap back
          Animated.spring(dialerY, {
            toValue: 0,
            tension: 65,
            friction: 11,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Keyboard handling
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(dialerY, {
          toValue: -e.endCoordinates.height,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(dialerY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Opening animation
  useEffect(() => {
    if (visible) {
      dialerY.setValue(height);
      fadeAnim.setValue(0);
      
      Animated.parallel([
        Animated.spring(dialerY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  // Contact filtering with optimized animation
  useEffect(() => {
    const query = searchQuery || phoneNumber;
    if (query.length > 0) {
      const filtered = contacts.filter(contact => 
        contact.phoneNumber.includes(query) ||
        `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredContacts(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredContacts([]);
      setShowSuggestions(false);
    }
  }, [phoneNumber, searchQuery, contacts]);

  // Memoized handlers for better performance
  const handleNumberPress = useCallback((num: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhoneNumber(prev => prev + num);
  }, []);

  const handleContactPress = useCallback((contact: Contact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhoneNumber(contact.phoneNumber);
    setShowSuggestions(false);
    setIsSearching(false);
    setSearchQuery('');
  }, []);

  const handleContactSave = useCallback((contact: Contact) => {
    // Here you can add the contact to your contacts list
    console.log('Saving contact:', contact);
    setShowAddContact(false);
    handleClose();
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(dialerY, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      setPhoneNumber('');
      setSearchQuery('');
      setIsSearching(false);
      onClose();
    });
  };

  // Update handlers for add contact buttons
  const handleCreateNewContact = () => {
    setShowAddContact(true);
  };

  const handleAddToContact = () => {
    setShowAddContact(true);
  };

  const renderContactSuggestion = ({ item }: { item: Contact }) => (
    <ContactSuggestion
      contact={item}
      onPress={handleContactPress}
      onInfoPress={(contact) => navigation.navigate('ContactInfo', { contact })}
    />
  );

  const dialPad = [
    [{ num: '1', alpha: '' }, { num: '2', alpha: 'ABC' }, { num: '3', alpha: 'DEF' }],
    [{ num: '4', alpha: 'GHI' }, { num: '5', alpha: 'JKL' }, { num: '6', alpha: 'MNO' }],
    [{ num: '7', alpha: 'PQRS' }, { num: '8', alpha: 'TUV' }, { num: '9', alpha: 'WXYZ' }],
    [{ num: '*', alpha: '' }, { num: '0', alpha: '+' }, { num: '#', alpha: '' }]
  ];

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={handleClose}
      >
        <TouchableOpacity 
          style={[styles.overlay, { opacity: fadeAnim }]} 
          activeOpacity={1} 
          onPress={handleClose}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardView}
          >
            <Animated.View 
              style={[
                styles.container,
                { 
                  transform: [{ translateY: dialerY }],
                }
              ]}
              {...panResponder.panHandlers}
            >
              <View style={styles.dragIndicator} />
              
              <View style={styles.content}>
                <View style={styles.header}>
                  {isSearching ? (
                    <TextInput
                      style={styles.searchInput}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search contacts..."
                      autoFocus
                    />
                  ) : (
                    <Text style={styles.phoneNumber}>{phoneNumber}</Text>
                  )}
                  
                  <View style={styles.headerActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => setIsSearching(!isSearching)}
                    >
                      <MaterialIcons 
                        name={isSearching ? "dialpad" : "search"} 
                        size={24} 
                        color="#FF8447" 
                      />
                    </TouchableOpacity>
                    
                    {phoneNumber.length > 0 && (
                      <>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={handleCreateNewContact}
                        >
                          <MaterialIcons name="person-add" size={24} color="#FF8447" />
                          <Text style={styles.actionText}>New</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={handleAddToContact}
                        >
                          <MaterialIcons name="person-add-alt" size={24} color="#FF8447" />
                          <Text style={styles.actionText}>Add to</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={styles.backspaceButton}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setPhoneNumber(prev => prev.slice(0, -1));
                          }}
                        >
                          <MaterialIcons name="backspace" size={24} color="#666" />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>

                {showSuggestions && (
                  <View style={[
                    styles.suggestionsContainer,
                    { height: Math.min(filteredContacts.length * 72, 200) }
                  ]}>
                    {isLoading ? (
                      <ActivityIndicator size="large" color="#FF8447" style={styles.loader} />
                    ) : (
                      <FlatList
                        data={filteredContacts}
                        renderItem={renderContactSuggestion}
                        keyExtractor={item => item.id}
                        style={styles.suggestionsList}
                        keyboardShouldPersistTaps="handled"
                      />
                    )}
                  </View>
                )}

                {!isSearching && (
                  <>
                    <View style={styles.dialPad}>
                      {dialPad.map((row, rowIndex) => (
                        <View key={rowIndex} style={styles.dialRow}>
                          {row.map((item) => (
                            <DialButton
                              key={item.num}
                              item={item}
                              onPress={handleNumberPress}
                            />
                          ))}
                        </View>
                      ))}
                    </View>

                    {phoneNumber.length > 0 && (
                      <TouchableOpacity 
                        style={styles.callButton}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          onCallPress(phoneNumber);
                        }}
                      >
                        <MaterialIcons name="call" size={32} color="#FFF" />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      <AddContactModal
        visible={showAddContact}
        onClose={() => setShowAddContact(false)}
        phoneNumber={phoneNumber}
        onSave={handleContactSave}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    maxHeight: height * 0.9,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 20,
  },
  searchInput: {
    fontSize: 18,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  phoneNumber: {
    fontSize: 32,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#FF8447',
    marginLeft: 8,
    fontFamily: 'LexendDeca_400Regular',
  },
  backspaceButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginLeft: 8,
  },
  suggestionsContainer: {
    marginBottom: 20,
    overflow: 'hidden',
  },
  suggestionsList: {
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF8447',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  contactNumber: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 2,
  },
  contactInfoButton: {
    padding: 8,
  },
  dialPad: {
    marginBottom: 20,
  },
  dialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dialButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dialButtonNumber: {
    fontSize: 28,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  dialButtonAlpha: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 2,
  },
  callButton: {
    backgroundColor: '#4CAF50',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loader: {
    marginVertical: 20,
  },
  addContactOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addContactContainer: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    width: width * 0.9,
    maxHeight: height * 0.8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addContactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  addContactTitle: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  formScrollView: {
    maxHeight: height * 0.6,
  },
  formContainer: {
    paddingBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#DC2626',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    marginTop: 4,
    marginLeft: 4,
  },
  addContactInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    backgroundColor: '#FFF',
  },
  addContactButton: {
    backgroundColor: '#FF8447',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  addContactButtonDisabled: {
    backgroundColor: '#FFD5C2',
  },
  addContactButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
  },
});

export default memo(Dialer); 