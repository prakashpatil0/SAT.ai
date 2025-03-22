import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type Contact = {
  name: string;
  phone: string;
  role?: string;
  company?: string;
  contactType?: 'person' | 'company';
};

type CallModalProps = {
  visible: boolean;
  onClose: () => void;
  contacts: Contact[];
  title?: string;
  onCallPress: (phone: string) => void;
};

const CallModal = ({ visible, onClose, contacts, title, onCallPress }: CallModalProps) => {
  const handleCallPress = (phone: string) => {
    if (onCallPress) {
      onCallPress(phone);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title || 'Select Contact'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.contactsList}>
            {contacts.map((contact, index) => (
              <TouchableOpacity
                key={index}
                style={styles.contactItem}
                onPress={() => handleCallPress(contact.phone)}
              >
                <View style={[
                  styles.contactIcon, 
                  contact.contactType === 'company' ? styles.companyIcon : {}
                ]}>
                  <MaterialIcons 
                    name={contact.contactType === 'company' ? "business" : "person"} 
                    size={24} 
                    color={contact.contactType === 'company' ? "#0078D7" : "#FF8447"} 
                  />
                </View>
                <View style={styles.contactDetails}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  {contact.role && (
                    <Text style={styles.contactRole}>{contact.role}</Text>
                  )}
                  {contact.company && contact.contactType !== 'company' && (
                    <Text style={styles.companyName}>{contact.company}</Text>
                  )}
                  <Text style={styles.phoneNumber}>{contact.phone}</Text>
                </View>
                <MaterialIcons name="call" size={22} color="#4CAF50" />
              </TouchableOpacity>
            ))}
            
            {contacts.length === 0 && (
              <View style={styles.noContactsContainer}>
                <MaterialIcons name="error-outline" size={36} color="#DDD" />
                <Text style={styles.noContactsText}>No contacts available</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  contactsList: {
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  contactRole: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  phoneNumber: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  companyIcon: {
    backgroundColor: '#E6F7FF',
  },
  companyName: {
    fontSize: 13,
    color: '#0078D7',
    fontFamily: 'LexendDeca_400Regular',
  },
  noContactsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noContactsText: {
    marginTop: 10,
    fontSize: 16,
    color: '#999',
    fontFamily: 'LexendDeca_400Regular',
  },
});

export default CallModal; 