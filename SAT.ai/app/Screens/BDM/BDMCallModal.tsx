import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type Contact = {
  name: string;
  role?: string;
  phone: string;
};

type CallModalProps = {
  visible: boolean;
  onClose: () => void;
  contacts: Contact[];
  title: string;
};

const CallModal = ({ visible, onClose, contacts, title }: CallModalProps) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Choose an Individual to call</Text>
          </View>

          {contacts.map((contact, index) => (
            <TouchableOpacity 
              key={index}
              style={styles.contactItem}
              onPress={() => {
                // Handle call action
                onClose();
              }}
            >
              <View style={styles.contactIcon}>
                <MaterialIcons name="person" size={24} color="#666" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                {contact.role && <Text style={styles.contactRole}>({contact.role})</Text>}
              </View>
              <Text style={styles.phoneNumber}>{contact.phone}</Text>
            </TouchableOpacity>
          ))}
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
  modalContent: {
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
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  contactRole: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 2,
  },
  phoneNumber: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
});

export default CallModal; 