import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import BDMScreenHeader from "@/app/Screens/BDM/BDMScreenHeader";
import CallModal from '@/app/Screens/BDM/BDMCallModal';


const BDMCompanyDetailsScreen = ({ route }: { route: any }) => {
  const navigation = useNavigation();
  const company = route.params?.company;
  const [showCallModal, setShowCallModal] = useState(false);
  
  
  const contacts = [
    { name: 'Divya Patil', role: 'Director', phone: '+91 87392 83729', email: 'divya@glycon.com' },
    { name: 'Sarita', role: 'HR Manager', phone: '+91 87392 83729', email: 'sarita@glycon.com' },
  ];
  
  

  return (
    <>
      <LinearGradient colors={['#f0f4f8', '#fcf1e8']} style={styles.container}>
      <BDMScreenHeader title={company?.name} />

        {/* Company Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <MaterialIcons name="business" size={40} color="#666" />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setShowCallModal(true)}
          >
            <View style={styles.actionCircle}>
              <MaterialIcons name="phone" size={24} color="#666" />
            </View>
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionCircle}>
              <MaterialIcons name="message" size={24} color="#666" />
            </View>
            <Text style={styles.actionText}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionCircle}>
              <MaterialIcons name="email" size={24} color="#666" />
            </View>
            <Text style={styles.actionText}>E-Mail</Text>
          </TouchableOpacity>
        </View>

        {/* Contact Information Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Contact Information</Text>
          {contacts.map((contact, index) => (
            <View key={index} style={styles.contactItem}>
              <View style={styles.contactIcon}>
                <MaterialIcons name="person" size={24} color="#666" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactRole}>{contact.role}</Text>
                <Text style={styles.contactDetail}>{contact.phone}</Text>
                <Text style={styles.contactDetail}>{contact.email}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Bottom Buttons */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity style={styles.bottomButton}>
            <MaterialIcons name="share" size={20} color="#666" />
            <Text style={styles.bottomButtonText}>Share Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bottomButton, styles.deleteButton]}>
            <MaterialIcons name="delete" size={20} color="#FF3B30" />
            <Text style={[styles.bottomButtonText, styles.deleteText]}>Delete Contact</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <CallModal 
        visible={showCallModal}
        onClose={() => setShowCallModal(false)}
        contacts={contacts}
        title="Choose an Individual to call"
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginLeft: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 24,
    paddingHorizontal: 16,
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
  },
  actionText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  infoCard: {
    backgroundColor: 'white',
    marginTop: 24,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    marginBottom: 16,
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
  bottomButtons: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bottomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  bottomButtonText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#666',
    marginLeft: 12,
  },
  deleteButton: {
    marginTop: 4,
  },
  deleteText: {
    color: '#FF3B30',
  },
});

export default BDMCompanyDetailsScreen; 