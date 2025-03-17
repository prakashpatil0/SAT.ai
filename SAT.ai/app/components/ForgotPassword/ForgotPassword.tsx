import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Text, TextInput, Snackbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { doc, setDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable, HttpsCallableResult } from 'firebase/functions';
import AppGradient from '@/app/components/AppGradient';
import { TouchableOpacity } from 'react-native';

const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

interface OTPResponse {
  success: boolean;
  message?: string;
}

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const navigation = useNavigation<any>();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendOTP = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const db = getFirestore();
      const functions = getFunctions();
      const sendOTPEmail = httpsCallable<{ email: string; otp: string; type: string }, OTPResponse>(functions, 'sendOTPEmail');
      
      // Generate OTP
      const otp = generateOTP();
      
      // First try to send the OTP email
      const result = await sendOTPEmail({ 
        email,
        otp,
        type: 'FORGOT_PASSWORD'
      });

      // If email sent successfully, store OTP in Firestore
      if (result.data.success) {
        try {
          await setDoc(doc(db, 'otps', email), {
            otp,
            email,
            createdAt: serverTimestamp(),
            attempts: 0,
            isUsed: false,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
          });

          // Show success message
          setSnackbarMessage('OTP sent successfully! Please check your email');
          setShowSnackbar(true);

          // Navigate after short delay
          setTimeout(() => {
            navigation.navigate('VerifyEmail', { 
              email,
              expectedOtp: otp 
            });
          }, 1500);
        } catch (firestoreError: any) {
          console.error('Error storing OTP:', firestoreError);
          Alert.alert('Error', 'Failed to store OTP. Please try again.');
        }
      } else {
        Alert.alert('Error', result.data.message || 'Failed to send OTP');
      }

    } catch (error: any) {
      console.error('Error sending OTP:', error);
      let message = 'Failed to send OTP';
      
      // Handle specific Firebase error codes
      if (error.code === 'not-found') {
        message = 'No account found with this email';
      } else if (error.code === 'invalid-argument') {
        message = 'Please provide valid email address';
      } else if (error.code === 'internal') {
        message = 'Server error. Please try again later';
      } else if (error.message) {
        message = error.message;
      }
      
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppGradient>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter your email address to receive a password reset OTP
          </Text>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            disabled={loading}
            left={<TextInput.Icon icon="email" color="#B1B1B1" />}
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
              styles.sendButton,
              { opacity: loading ? 0.7 : 1 }
            ]}
            onPress={handleSendOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Send OTP</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.returnContainer}
            disabled={loading}
          >
            <Text style={styles.returnText}>
              Return to Login Screen- <Text style={styles.loginText}>Login</Text>
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
  sendButton: {
    backgroundColor: '#FF8447',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    minHeight: 56,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
  },
  returnContainer: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  returnText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  loginText: {
    color: '#FF8447',
    textDecorationLine: 'underline',
  },
  snackbar: {
    backgroundColor: '#4CAF50',
  },
});

export default ForgotPassword; 