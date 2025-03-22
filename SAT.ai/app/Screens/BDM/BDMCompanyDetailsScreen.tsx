import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking, Platform, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import BDMScreenHeader from "@/app/Screens/BDM/BDMScreenHeader";
import CallModal from '@/app/Screens/BDM/BDMCallModal';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import { RootStackParamList } from '@/app/index';

type BDMCompanyDetailsScreenProps = {
  route: RouteProp<RootStackParamList, 'BDMCompanyDetails'>;
};

// Update the company type to include domain and industry
type Company = {
  name: string;
  domain?: string;
  industry?: string;
};

type ContactPerson = {
  name: string;
  role?: string;
  phone: string;
  email?: string;
};

const BDMCompanyDetailsScreen: React.FC<BDMCompanyDetailsScreenProps> = ({ route }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const company: Company = route.params?.company || { name: 'Unknown Company' };
  const [showCallModal, setShowCallModal] = useState(false);
  
  // In a real app, we would fetch this data based on the company ID or domain
  // Display sample contacts only if we have specific company data
  const hasCompanyData = company.industry || company.domain;
  
  // Demo contacts - in a real app, these would come from a database or API
  const contacts: ContactPerson[] = hasCompanyData ? [
    { name: 'Divya Patil', role: 'Director', phone: '+91 87392 83729', email: 'divya@example.com' },
    { name: 'Sarita', role: 'HR Manager', phone: '+91 87392 83729' },
  ] : [];

  // Call action handler
  const handleCall = () => {
    if (contacts.length === 0) {
      Alert.alert('Error', 'No contacts available to call');
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

  // Message action handler
  const handleMessage = () => {
    if (contacts.length === 0) {
      Alert.alert('Error', 'No contacts available to message');
      return;
    }
    
    if (contacts.length === 1) {
      const formattedNumber = contacts[0].phone.replace(/\s+/g, '');
      Linking.openURL(`sms:${formattedNumber}`);
    } else {
      // If multiple contacts, show the modal to choose
      setShowCallModal(true);
    }
  };

  // Email action handler
  const handleEmail = () => {
    const contactsWithEmail = contacts.filter(contact => contact.email);
    
    if (contactsWithEmail.length === 0) {
      Alert.alert('Error', 'No email addresses available');
      return;
    }
    
    if (contactsWithEmail.length === 1) {
      Linking.openURL(`mailto:${contactsWithEmail[0].email}`);
    } else {
      // If we had email functionality in the modal, we would show it here
      Alert.alert('Info', 'Please select a contact first to email them');
    }
  };

  // Share company details
  const handleShareCompany = async () => {
    try {
      let message = `🏢 Company: ${company?.name || 'Company Name'}\n\nContacts:`;
      
      contacts.forEach(contact => {
        message += `\n\n👤 ${contact.name}${contact.role ? ` (${contact.role})` : ''}`;
        message += `\n📱 ${contact.phone}`;
        if (contact.email) {
          message += `\n📧 ${contact.email}`;
        }
      });
      
      await Share.share({
        message,
      });
    } catch (error) {
      console.error('Error sharing company:', error);
      Alert.alert('Error', 'Failed to share company details');
    }
  };

  // Delete company
  const handleDeleteCompany = () => {
    Alert.alert(
      'Delete Company',
      `Are you sure you want to delete ${company?.name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDeleteCompany
        }
      ]
    );
  };

  const confirmDeleteCompany = async () => {
    try {
      // For a real app, you would delete from database/storage
      // This is a placeholder for demonstration
      Alert.alert('Success', `${company?.name} has been deleted`);
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting company:', error);
      Alert.alert('Error', 'Failed to delete company');
    }
  };

  return (
    <AppGradient>
      <BDMMainLayout title={company?.name || 'Company'} showBackButton showDrawer={true} showBottomTabs={true}>
        <ScrollView style={styles.container}>
          {/* Company Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <MaterialIcons name="business" size={40} color="#666" />
            </View>
            <Text style={styles.companyName}>{company?.name || 'Company Name'}</Text>
            {company.industry && <Text style={styles.companyIndustry}>{company.industry}</Text>}
            {company.domain && <Text style={styles.companyDomain}>{company.domain}</Text>}
          </View>

          {/* Company Details Section - Only shown if details exist */}
          {hasCompanyData ? (
            <View style={styles.infoSummary}>
              <Text style={styles.infoSummaryTitle}>Company Information</Text>
              <View style={styles.infoRow}>
                <MaterialIcons name="category" size={20} color="#666" />
                <Text style={styles.infoRowText}>
                  {company.industry || 'Industry not available'}
                </Text>
              </View>
              {company.domain && (
                <View style={styles.infoRow}>
                  <MaterialIcons name="language" size={20} color="#666" />
                  <Text style={styles.infoRowText}>{company.domain}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noDetailsContainer}>
              <MaterialIcons name="info-outline" size={24} color="#999" />
              <Text style={styles.noDetailsText}>No company details available</Text>
              <Text style={styles.noDetailsSubtext}>Additional information will appear here when available</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleCall}
              disabled={contacts.length === 0}
            >
              <View style={[
                styles.actionCircle, 
                contacts.length === 0 && styles.disabledActionCircle
              ]}>
                <MaterialIcons name="phone" size={24} color={contacts.length > 0 ? "#666" : "#AAA"} />
              </View>
              <Text style={[
                styles.actionText,
                contacts.length === 0 && styles.disabledActionText
              ]}>Call</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleMessage}
              disabled={contacts.length === 0}
            >
              <View style={[
                styles.actionCircle,
                contacts.length === 0 && styles.disabledActionCircle
              ]}>
                <MaterialIcons name="message" size={24} color={contacts.length > 0 ? "#666" : "#AAA"} />
              </View>
              <Text style={[
                styles.actionText,
                contacts.length === 0 && styles.disabledActionText
              ]}>Message</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleEmail}
              disabled={contacts.filter(contact => contact.email).length === 0}
            >
              <View style={[
                styles.actionCircle, 
                contacts.filter(contact => contact.email).length === 0 && styles.disabledActionCircle
              ]}>
                <MaterialIcons 
                  name="email" 
                  size={24} 
                  color={contacts.filter(contact => contact.email).length > 0 ? "#666" : "#AAA"} 
                />
              </View>
              <Text style={[
                styles.actionText,
                contacts.filter(contact => contact.email).length === 0 && styles.disabledActionText
              ]}>
                E-Mail
              </Text>
            </TouchableOpacity>
          </View>

          {/* Contact Information Card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Contact Information</Text>
            {contacts.length > 0 ? (
              contacts.map((contact, index) => (
                <View key={index} style={styles.contactItem}>
                  <View style={styles.contactIcon}>
                    <MaterialIcons name="person" size={24} color="#666" />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    {contact.role && <Text style={styles.contactRole}>{contact.role}</Text>}
                    <Text style={styles.contactDetail}>{contact.phone}</Text>
                    {contact.email ? (
                      <Text style={styles.contactDetail}>{contact.email}</Text>
                    ) : (
                      <Text style={styles.noEmailText}>No email available</Text>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.noContactsContainer}>
                <MaterialIcons name="contacts" size={36} color="#DDD" />
                <Text style={styles.noContactsText}>No contacts available</Text>
                <Text style={styles.noContactsSubtext}>Contact information will appear here when available</Text>
              </View>
            )}
          </View>

          {/* Bottom Buttons */}
          <View style={styles.bottomButtons}>
            <TouchableOpacity 
              style={styles.bottomButton}
              onPress={handleShareCompany}
            >
              <MaterialIcons name="share" size={20} color="#666" />
              <Text style={styles.bottomButtonText}>Share Company</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.bottomButton, styles.deleteButton]}
              onPress={handleDeleteCompany}
            >
              <MaterialIcons name="delete" size={20} color="#FF3B30" />
              <Text style={[styles.bottomButtonText, styles.deleteText]}>Delete Company</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <CallModal 
          visible={showCallModal}
          onClose={() => setShowCallModal(false)}
          contacts={contacts}
          title="Choose an Individual to call"
          onCallPress={(phoneNumber: string) => makePhoneCall(phoneNumber)}
        />
      </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  companyName: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    textAlign: 'center',
  },
  companyIndustry: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#0078D7',
    marginTop: 4,
  },
  companyDomain: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 2,
  },
  infoSummary: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  infoSummaryTitle: {
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  infoRowText: {
    marginLeft: 12,
    fontSize: 15,
    fontFamily: 'LexendDeca_400Regular',
    color: '#555',
  },
  noDetailsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  noDetailsText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  noDetailsSubtext: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999',
    textAlign: 'center',
  },
  noContactsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noContactsText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  noContactsSubtext: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999',
    textAlign: 'center',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionCircle: {
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
  disabledActionCircle: {
    backgroundColor: '#F5F5F5',
  },
  actionText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  disabledActionText: {
    color: '#AAA',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5E6',
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
  contactDetail: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 4,
  },
  noEmailText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  bottomButtons: {
    marginBottom: 24,
  },
  bottomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  bottomButtonText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    marginLeft: 12,
  },
  deleteButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#FFDDDD',
  },
  deleteText: {
    color: '#FF3B30',
  },
});

export default BDMCompanyDetailsScreen; 