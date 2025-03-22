import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert, Linking, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import CallModal from '@/app/Screens/BDM/BDMCallModal';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '@/app/index';

type BDMContactDetailsScreenProps = {
  route: RouteProp<RootStackParamList, 'BDMContactDetails'>;
};

type Contact = {
  name: string;
  phone: string;
  email?: string;
  id?: string;
};

const BDMContactDetailsScreen: React.FC<BDMContactDetailsScreenProps> = ({ route }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [showCallModal, setShowCallModal] = useState(false);
  const contact = route.params?.contact;

  const contacts = [{
    name: contact?.name || 'Contact Name',
    phone: contact?.phone || ''
  }];

  const handleCall = () => {
    if (!contact?.phone) {
      Alert.alert('Error', 'No phone number available');
      return;
    }
    
    setShowCallModal(true);
  };

  const makePhoneCall = (phoneNumber: string) => {
    const formattedNumber = phoneNumber.replace(/\s+/g, '');
    
    if (Platform.OS === 'android') {
      Linking.openURL(`tel:${formattedNumber}`);
    } else {
      Linking.openURL(`telprompt:${formattedNumber}`);
    }
  };

  const handleMessage = () => {
    if (!contact?.phone) {
      Alert.alert('Error', 'No phone number available');
      return;
    }
    
    const formattedNumber = contact.phone.replace(/\s+/g, '');
    Linking.openURL(`sms:${formattedNumber}`);
  };

  const handleEmail = () => {
    if (!contact?.email) {
      Alert.alert('Error', 'No email address available');
      return;
    }
    
    Linking.openURL(`mailto:${contact.email}`);
  };

  // Function to handle sharing contact details
  const handleShareContact = async () => {
    try {
      let message = `📞 Contact Details 📞\n\n👤 Name: ${contact?.name || 'Contact Name'}\n📱 Phone: ${contact?.phone || ''}`;
      
      if (contact?.email) {
        message += `\n📧 Email: ${contact.email}`;
      }
      
      await Share.share({
        message,
      });
    } catch (error) {
      console.error('Error sharing contact:', error);
      Alert.alert('Error', 'Failed to share contact');
    }
  };

  const handleDeleteContact = () => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete ${contact?.name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDeleteContact
        }
      ]
    );
  };

  const confirmDeleteContact = async () => {
    try {
      // For a real app, you would delete from database/storage
      // This is a placeholder for demonstration
      Alert.alert('Success', `${contact?.name} has been deleted`);
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting contact:', error);
      Alert.alert('Error', 'Failed to delete contact');
    }
  };

  return (
    <AppGradient>
    <BDMMainLayout title={contact?.name || 'Contact'} showBackButton showDrawer={true} showBottomTabs={true}>
    <View style={styles.container}>
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
          onPress={handleCall}
        >
          <View style={styles.actionIcon}>
            <MaterialIcons name="phone" size={24} color="#666" />
          </View>
          <Text style={styles.actionText}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleMessage}
        >
          <View style={styles.actionIcon}>
            <MaterialIcons name="message" size={24} color="#666" />
          </View>
          <Text style={styles.actionText}>Message</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleEmail}
          disabled={!contact?.email}
        >
          <View style={[styles.actionIcon, !contact?.email && styles.disabledIcon]}>
            <MaterialIcons name="email" size={24} color={contact?.email ? "#666" : "#AAA"} />
          </View>
          <Text style={[styles.actionText, !contact?.email && styles.disabledText]}>E-Mail</Text>
        </TouchableOpacity>
      </View>

      {/* Contact Information */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Contact Information</Text>
        
        <View style={styles.infoItem}>
          <MaterialIcons name="phone" size={20} color="#666" />
          <Text style={styles.infoText}>{contact?.phone || 'No phone number available'}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <MaterialIcons name="email" size={20} color="#666" />
          <Text style={styles.infoText}>
            {contact?.email || 'No email available'}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {/* Share Contact Button */}
        <TouchableOpacity style={styles.shareButton} onPress={handleShareContact}>
          <MaterialIcons name="share" size={20} color="#666" />
          <Text style={styles.shareText}>Share Contact</Text>
        </TouchableOpacity>

        {/* Delete Contact Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteContact}>
          <MaterialIcons name="delete" size={20} color="#FF3B30" />
          <Text style={styles.deleteText}>Delete Contact</Text>
        </TouchableOpacity>
      </View>

      <CallModal 
        visible={showCallModal}
        onClose={() => setShowCallModal(false)}
        contacts={contacts}
        title="Call Contact"
        onCallPress={(phoneNumber: string) => makePhoneCall(phoneNumber)}
      />
    </View>
    </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  disabledIcon: {
    backgroundColor: '#F5F5F5',
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  disabledText: {
    color: '#AAA',
  },
  infoContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#DCDCDC',
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    marginBottom: 16,
    color: '#333',
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
    flex: 1,
  },
  buttonContainer: {
    marginTop: 24,
    marginHorizontal: 80,
    gap: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFDDDD',
  },
  shareText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
    fontFamily: 'LexendDeca_500Medium',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFDDDD',
  },
  deleteText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#FF3B30',
    fontFamily: 'LexendDeca_500Medium',
  },
});

export default BDMContactDetailsScreen;
