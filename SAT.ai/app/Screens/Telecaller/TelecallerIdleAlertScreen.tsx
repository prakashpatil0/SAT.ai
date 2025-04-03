import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import TelecallerMainLayout from '@/app/components/TelecallerMainLayout';
import AppGradient from '@/app/components/AppGradient';

const TelecallerIdleAlertScreen = () => {
  const navigation = useNavigation();

  return (
    <AppGradient>
      <TelecallerMainLayout title="Idle Timer" showBackButton={true} showBottomTabs={true}>
        <View style={styles.container}>
          <View style={styles.alertContainer}>
            <Image
              source={require('@/assets/images/siren.gif')}
              style={styles.alertImage}
              resizeMode="contain"
            />
            <Text style={styles.alertText}>
              You have been Idle for 15 minutes
            </Text>
          </View>

          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>Idle Timer Instructions</Text>
            <View style={styles.instructionsList}>
              <Text style={styles.instructionText}>• The idle timer will ring a total of three times.</Text>
              <Text style={styles.instructionText}>• On the third ring, your phone will automatically lock.</Text>
              <Text style={styles.instructionText}>• Once locked, please visit management to have your phone unlocked so you can resume work.</Text>
            </View>
          </View>
        </View>
      </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  alertContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  alertImage: {
    width: 200,
    height: 200,
    marginBottom: 24,
  },
  alertText: {
    fontSize: 24,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  instructionsContainer: {
    padding: 24,
  },
  instructionsTitle: {
    fontSize: 20,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#000',
    marginBottom: 16,
  },
  instructionsList: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
  },
  instructionText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default TelecallerIdleAlertScreen; 