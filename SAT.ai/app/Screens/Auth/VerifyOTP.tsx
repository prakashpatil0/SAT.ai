import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Text, TextInput, Snackbar } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { doc, getDoc, updateDoc, getFirestore } from 'firebase/firestore';
import AppGradient from '@/app/components/AppGradient';
import { TouchableOpacity } from 'react-native';

interface RouteParams {
  email: string;
  expectedOtp: string;
}

const VerifyOTP = () => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [attempts, setAttempts] = useState(0);
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { email, expectedOtp } = route.params as RouteParams;

  useEffect(() => {
    loadAttempts();
  }, []);

  const loadAttempts = async () => {
    try {
      const db = getFirestore();
      const otpDoc = await getDoc(doc(db, 'otps', email));
      if (otpDoc.exists()) {
        setAttempts(otpDoc.data().attempts || 0);
      }
    } catch (error) {
      console.error('Error loading attempts:', error);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 4) {
      Alert.alert('Error', 'Please enter a valid 4-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const db = getFirestore();
      const otpDoc = await getDoc(doc(db, 'otps', email));
      
      if (!otpDoc.exists()) {
        Alert.alert('Error', 'OTP has expired. Please request a new one.');
        navigation.goBack();
        return;
      }

      const otpData = otpDoc.data();
      const currentAttempts = (otpData.attempts || 0) + 1;

      // Update attempts count
      await updateDoc(doc(db, 'otps', email), {
        attempts: currentAttempts
      });

      if (otp === expectedOtp) {
        // OTP is correct
        setSnackbarMessage('OTP verified successfully!');
        setShowSnackbar(true);
        
        // Navigate to reset password screen after short delay
        setTimeout(() => {
          navigation.navigate('ResetPassword', { email });
        }, 1500);
      } else {
        // OTP is incorrect
        if (currentAttempts >= 3) {
          Alert.alert('Error', 'Too many incorrect attempts. Please request a new OTP.');
          navigation.goBack();
        } else {
          Alert.alert('Error', 'Incorrect OTP. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      Alert.alert('Error', 'Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = () => {
    navigation.goBack();
  };

  return (
    <AppGradient>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 4-digit OTP sent to your email
          </Text>

          <TextInput
            label="OTP"
            value={otp}
            onChangeText={setOtp}
            mode="outlined"
            style={styles.input}
            keyboardType="number-pad"
            maxLength={4}
            disabled={loading}
            left={<TextInput.Icon icon="key" color="#B1B1B1" />}
            theme={{
              roundness: 10,
              colors: {
                primary: '#FF8447',
                text: '#333',
                placeholder: '#999',
                error: '#DC3545',
              },
              fonts: {
                regular: {
                  fontFamily: 'LexendDeca_400Regular',
                },
              },
            }}
          />

          <TouchableOpacity
            style={[
              styles.verifyButton,
              { opacity: loading ? 0.7 : 1 }
            ]}
            onPress={handleVerifyOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleResendOTP}
            style={styles.resendContainer}
            disabled={loading}
          >
            <Text style={styles.resendText}>
              Didn't receive OTP? <Text style={styles.resendTextHighlight}>Resend</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Snackbar
          visible={showSnackbar}
          onDismiss={() => setShowSnackbar(false)}
          duration={2000}
          style={styles.snackbar}
        >
          {snackbarMessage}
        </Snackbar>
      </KeyboardAvoidingView>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#FF8447',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  input: {
    marginBottom: 20,
    backgroundColor: '#FFF',
  },
  verifyButton: {
    backgroundColor: '#FF8447',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    minHeight: 56,
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
  },
  resendContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  resendTextHighlight: {
    color: '#FF8447',
    textDecorationLine: 'underline',
  },
  snackbar: {
    backgroundColor: '#4CAF50',
  },
});

export default VerifyOTP;