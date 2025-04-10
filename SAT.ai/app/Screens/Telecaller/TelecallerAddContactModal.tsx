import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AddContactModalProps = {
  visible: boolean;
  onClose?: () => void;
  phoneNumber: string;
  onContactSaved?: (contact: Contact) => void;
  editingContact?: Contact | null;
};

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  favorite?: boolean;
}

const AddContactModal = ({ visible, onClose = () => {}, phoneNumber: initialPhoneNumber, onContactSaved, editingContact }: AddContactModalProps) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({
    firstName: '',
    phoneNumber: ''
  });
  const navigation = useNavigation();

  useEffect(() => {
    // Set the phone number when the modal becomes visible or initialPhoneNumber changes
    if (visible) {
      setPhoneNumber(initialPhoneNumber || '');
    }
  }, [visible, initialPhoneNumber]);

  useEffect(() => {
    if (editingContact) {
      setFirstName(editingContact.firstName);
      setLastName(editingContact.lastName);
      setPhoneNumber(editingContact.phoneNumber);
      setEmail(editingContact.email || '');
    }
  }, [editingContact]);

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
      // Get existing contacts from device storage
      const storedContacts = await AsyncStorage.getItem('contacts');
      const currentContacts: Contact[] = storedContacts ? JSON.parse(storedContacts) : [];

      // Create new contact
      const newContact: Contact = {
        id: editingContact?.id || Date.now().toString(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim(),
        favorite: editingContact?.favorite || false
      };

      // Check if contact with same phone number already exists
      const existingContactIndex = currentContacts.findIndex(
        contact => contact.phoneNumber === newContact.phoneNumber
      );

      let updatedContacts: Contact[];
      if (existingContactIndex !== -1) {
        // Update existing contact
        updatedContacts = currentContacts.map((contact, index) =>
          index === existingContactIndex ? newContact : contact
        );
      } else {
        // Add new contact
        updatedContacts = [...currentContacts, newContact];
      }

      // Save to device storage
      await AsyncStorage.setItem('contacts', JSON.stringify(updatedContacts));

      // Notify parent component
      if (onContactSaved) {
        onContactSaved(newContact);
      }

      // Show success message
      Alert.alert(
        'Success',
        `Contact ${editingContact ? 'updated' : 'saved'} successfully!`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form and close modal
              setFirstName('');
              setLastName('');
              setPhoneNumber('');
              setEmail('');
              setErrors({ firstName: '', phoneNumber: '' });
              Keyboard.dismiss();
              onClose();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error saving contact:', error);
      Alert.alert('Error', `Failed to ${editingContact ? 'update' : 'save'} contact. Please try again.`);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => {
                Keyboard.dismiss();
                onClose();
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
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First Name <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.input, errors.firstName ? styles.inputError : null]}
                placeholder="Enter First Name"
                value={firstName}
                onChangeText={setFirstName}
                returnKeyType="next"
              />
              {errors.firstName ? (
                <Text style={styles.errorText}>{errors.firstName}</Text>
              ) : null}
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
                editable={false}
                selectTextOnFocus={false}
                returnKeyType="next"
              />
              {errors.phoneNumber ? (
                <Text style={styles.errorText}>{errors.phoneNumber}</Text>
              ) : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email ID</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter Email ID"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
              />
            </View>
          </ScrollView>

          {/* Save Button */}
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
  );
};

const styles = StyleSheet.create({
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

export default AddContactModal;