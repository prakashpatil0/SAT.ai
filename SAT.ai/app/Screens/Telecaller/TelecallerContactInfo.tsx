import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Share, 
  Linking, 
  Platform, 
  Alert,
  ScrollView,
  ToastAndroid
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import CallModal from '@/app/Screens/BDM/BDMCallModal';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import AppGradient from '@/app/components/AppGradient';

interface RouteParams {
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email?: string;
    favorite?: boolean;
  };
}

interface Props {
  route: {
    params: RouteParams;
  };
}

const ContactInfo: React.FC<Props> = ({ route }) => {  
  const navigation = useNavigation();
  const [showCallModal, setShowCallModal] = useState(false);
  const { contact } = route.params;

  // Add name display helper
  const getDisplayName = () => {
    if (contact.firstName && contact.lastName) return `${contact.firstName} ${contact.lastName}`;
    
    const nameParts = [];
    if (contact.firstName && contact.firstName.trim()) {
      nameParts.push(contact.firstName.trim());
    }
    if (contact.lastName && contact.lastName.trim()) {
      nameParts.push(contact.phoneNumber.trim());
    }
    
    return nameParts.length > 0 ? nameParts.join(' ') : contact.phoneNumber;
  };

  const getInitial = () => {
    if (!contact) return 'C';
    if (contact.firstName && contact.firstName.trim()) {
      return contact.firstName.trim().charAt(0).toUpperCase();
    }
    if (contact.lastName && contact.lastName.trim()) {
      return contact.lastName.trim().charAt(0).toUpperCase();
    }
    return 'C';
  };

  const contacts = [{
    name: getDisplayName(),
    phone: contact?.phoneNumber || ''
  }];

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  // Function to handle sharing contact details
  const handleShareContact = async () => {
    try {
      const message = `📞 Contact Details 📞\n\n👤 Name: ${contact?.firstName} ${contact?.lastName}\n📱 Phone: ${contact?.phoneNumber}${contact?.email ? `\n📧 Email: ${contact?.email}` : ''}`;
      await Share.share({
        message,
        title: 'Share Contact',
      });
      showToast('Sharing contact details...');
    } catch (error) {
      console.error('Error sharing contact:', error);
      Alert.alert('Error', 'Failed to share contact');
    }
  };

  const makePhoneCall = async () => {
    try {
      const phoneNumber = contact?.phoneNumber.replace(/\D/g, ''); // Remove non-digits
      const telUrl = Platform.select({
        ios: `telprompt:${phoneNumber}`,
        android: `tel:${phoneNumber}`
      });
      
      if (!telUrl) return;

      const canOpen = await Linking.canOpenURL(telUrl);
      if (canOpen) {
        await Linking.openURL(telUrl);
        showToast('Initiating call...');
      } else {
        Alert.alert('Error', 'Unable to make call');
      }
    } catch (error) {
      console.error('Error making call:', error);
      Alert.alert('Error', 'Failed to make call');
    }
  };

  const sendMessage = async (type: 'sms' | 'whatsapp') => {
    try {
      const phoneNumber = contact?.phoneNumber.replace(/\D/g, '');
      let url = '';

      if (type === 'whatsapp') {
        url = `whatsapp://send?phone=${phoneNumber}`;
      } else {
        url = Platform.select({
          ios: `sms:${phoneNumber}`,
          android: `sms:${phoneNumber}`
        }) || '';
      }

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        showToast(`Opening ${type === 'whatsapp' ? 'WhatsApp' : 'Messages'}...`);
      } else {
        Alert.alert('Error', `${type === 'whatsapp' ? 'WhatsApp' : 'Messages'} is not installed`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to open messaging app');
    }
  };

  const sendEmail = async () => {
    try {
      if (!contact?.email) {
        Alert.alert('Error', 'No email address available');
        return;
      }

      const url = `mailto:${contact.email}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        showToast('Opening email...');
      } else {
        Alert.alert('Error', 'No email app is installed');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      Alert.alert('Error', 'Failed to open email app');
    }
  };

  const handleMessageOptions = () => {
    Alert.alert(
      'Send Message',
      'Choose messaging app',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'SMS',
          onPress: () => sendMessage('sms')
        },
        { 
          text: 'WhatsApp',
          onPress: () => sendMessage('whatsapp')
        }
      ]
    );
  };

  return (
    <AppGradient>
      <TelecallerMainLayout 
        showDrawer 
        showBackButton={true} 
        showBottomTabs={true} 
        title={getDisplayName()}
      >
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.profileInitial}>
              <Text style={styles.initialText}>
                {getInitial()}
              </Text>
            </View>
            <Text style={styles.contactName}>
              {getDisplayName()}
            </Text>
            {contact?.favorite && (
              <MaterialIcons name="star" size={24} color="#FFD700" style={styles.favoriteIcon} />
            )}
          </View>

          {/* Quick Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={makePhoneCall}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
                <MaterialIcons name="phone" size={24} color="#4CAF50" />
              </View>
              <Text style={styles.actionText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleMessageOptions}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
                <MaterialIcons name="message" size={24} color="#2196F3" />
              </View>
              <Text style={styles.actionText}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={sendEmail}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
                <MaterialIcons name="email" size={24} color="#FF9800" />
              </View>
              <Text style={styles.actionText}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleShareContact}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#F3E5F5' }]}>
                <MaterialIcons name="share" size={24} color="#9C27B0" />
              </View>
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Contact Information */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>Contact Information</Text>
            
            <TouchableOpacity 
              style={styles.infoItem}
              onPress={makePhoneCall}
            >
              <MaterialIcons name="phone" size={20} color="#4CAF50" />
              <Text style={styles.infoText}>{contact?.phoneNumber || 'No phone number'}</Text>
              <View style={styles.infoActionIcon}>
                <MaterialIcons name="call" size={20} color="#4CAF50" />
              </View>
            </TouchableOpacity>

            {contact?.email && (
              <TouchableOpacity 
                style={styles.infoItem}
                onPress={sendEmail}
              >
                <MaterialIcons name="email" size={20} color="#FF9800" />
                <Text style={styles.infoText}>{contact.email}</Text>
                <View style={styles.infoActionIcon}>
                  <MaterialIcons name="send" size={20} color="#FF9800" />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Communication Options */}
          <View style={styles.communicationContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            
            <TouchableOpacity 
              style={styles.communicationButton}
              onPress={() => sendMessage('whatsapp')}
            >
              <MaterialIcons name="message" size={20} color="#25D366" />
              <Text style={styles.communicationText}>Send WhatsApp Message</Text>
              <MaterialIcons name="chevron-right" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.communicationButton}
              onPress={() => sendMessage('sms')}
            >
              <MaterialIcons name="sms" size={20} color="#2196F3" />
              <Text style={styles.communicationText}>Send SMS</Text>
              <MaterialIcons name="chevron-right" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.communicationButton}
              onPress={handleShareContact}
            >
              <MaterialIcons name="share" size={20} color="#9C27B0" />
              <Text style={styles.communicationText}>Share Contact</Text>
              <MaterialIcons name="chevron-right" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        <CallModal 
          visible={showCallModal}
          onClose={() => setShowCallModal(false)}
          contacts={contacts}
          title="Call Contact"
        />
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  profileInitial: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  initialText: {
    fontSize: 32,
    color: '#666',
    fontFamily: 'LexendDeca_600SemiBold',
  },
  contactName: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 4,
  },
  favoriteIcon: {
    marginTop: 4,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  infoContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#666',
    fontFamily: 'LexendDeca_400Regular',
  },
  infoActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  communicationContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 60,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    marginBottom: 16,
    color: '#333',
  },
  communicationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 12,
  },
  communicationText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
    fontFamily: 'LexendDeca_500Medium',
  },
});

export default ContactInfo;
