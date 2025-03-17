import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import CallModal from '@/app/Screens/BDM/BDMCallModal';
import BDMScreenHeader from '@/app/Screens/BDM/BDMScreenHeader';

const BDMContactDetailsScreen = ({ route }) => {
  const navigation = useNavigation();
  const [showCallModal, setShowCallModal] = useState(false);
  const contact = route.params?.contact;

  const contacts = [{
    name: contact?.name || 'Contact Name',
    phone: contact?.phone || '+91 87392 83729'
  }];

  // Function to handle sharing contact details
  const handleShareContact = async () => {
    try {
      const message = `📞 Contact Details 📞\n\n👤 Name: ${contact?.name || 'Contact Name'}\n📱 Phone: ${contact?.phone || '+91 87392 83729'}\n📧 Email: ${contact?.email || 'aaravpandey56@gmail.com'}`;
      await Share.share({
        message,
      });
    } catch (error) {
      console.error('Error sharing contact:', error);
    }
  };

  return (
    <View style={styles.container}>
      <BDMScreenHeader title={contact?.name} />

      {/* Profile Initial */}
      <View style={styles.profileInitial}>
        <Text style={styles.initialText}>
          {contact?.name?.charAt(0).toUpperCase() || 'C'}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setShowCallModal(true)}
        >
          <View style={styles.actionIcon}>
            <MaterialIcons name="phone" size={24} color="#666" />
          </View>
          <Text style={styles.actionText}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <View style={styles.actionIcon}>
            <MaterialIcons name="message" size={24} color="#666" />
          </View>
          <Text style={styles.actionText}>Message</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <View style={styles.actionIcon}>
            <MaterialIcons name="email" size={24} color="#666" />
          </View>
          <Text style={styles.actionText}>E-Mail</Text>
        </TouchableOpacity>
      </View>

      {/* Contact Information */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Contact Information</Text>
        <View style={styles.infoItem}>
          <MaterialIcons name="phone" size={20} color="#666" />
          <Text style={styles.infoText}>{contact?.phone || '+91 87392 83729'}</Text>
        </View>
        <View style={styles.infoItem}>
          <MaterialIcons name="email" size={20} color="#666" />
          <Text style={styles.infoText}>{contact?.email || 'aaravpandey56@gmail.com'}</Text>
        </View>
      </View>

      {/* Share Contact Button */}
      <TouchableOpacity style={styles.shareButton} onPress={handleShareContact}>
        <MaterialIcons name="share" size={20} color="#666" />
        <Text style={styles.shareText}>Share Contact</Text>
      </TouchableOpacity>

      <CallModal 
        visible={showCallModal}
        onClose={() => setShowCallModal(false)}
        contacts={contacts}
        title="Call Contact"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  profileInitial: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 24,
  },
  initialText: {
    fontSize: 32,
    color: '#666',
    fontFamily: 'LexendDeca_600SemiBold',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  infoContainer: {
    backgroundColor: 'white',
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    marginTop: 24,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
  },
  shareText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
    fontFamily: 'LexendDeca_500Medium',
  },
});

export default BDMContactDetailsScreen;
