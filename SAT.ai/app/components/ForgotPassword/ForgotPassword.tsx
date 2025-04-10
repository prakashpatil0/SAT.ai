import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Text, TextInput, Snackbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { doc, setDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { sendPasswordResetEmail, sendEmailVerification, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import AppGradient from '@/app/components/AppGradient';
import { TouchableOpacity } from 'react-native';

interface OTPRequest {
  email: string;
  otp: string;
  type: string;
}

interface OTPResponse {
  success: boolean;
  message?: string;
}

const generateOTP = () => {
  // Generate a 6-digit OTP for better security
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [selectedOption, setSelectedOption] = useState<'otp' | 'link'>('otp');
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
      
      // Generate OTP
      const otp = generateOTP();
      
      // Store OTP in Firestore
      await setDoc(doc(db, 'otps', email), {
        otp,
        email,
        createdAt: serverTimestamp(),
        attempts: 0,
        isUsed: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        lastSentAt: serverTimestamp(),
        status: 'pending'
      });

      // Call the Firebase Cloud Function to send OTP
      const functions = getFunctions();
      const sendOTPEmail = httpsCallable<OTPRequest, OTPResponse>(functions, 'sendOTPEmail');
      const result = await sendOTPEmail({ 
        email, 
        otp,
        type: 'FORGOT_PASSWORD'
      });

      if (result.data.success) {
        setSnackbarMessage('OTP sent successfully! Please check your email');
        setShowSnackbar(true);

        // Navigate to verification screen
        setTimeout(() => {
          navigation.navigate('VerifyEmail', { 
            email,
            expectedOtp: otp 
          });
        }, 1500);
      } else {
        throw new Error(result.data.message || 'Failed to send OTP');
      }

    } catch (error: any) {
      console.error('Error in OTP process:', error);
      let message = 'Failed to process your request';
      
      if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Please provide valid email address';
      } else if (error.message) {
        message = error.message;
      }
      
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetLink = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSnackbarMessage('Password reset link sent successfully! Please check your email');
      setShowSnackbar(true);
      
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (error: any) {
      console.error('Error sending reset link:', error);
      let message = 'Failed to send password reset link';
      
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Please provide valid email address';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later';
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
            Choose how you want to reset your password
          </Text>

          <View style={styles.optionsContainer}>
            {/* <TouchableOpacity
              style={[
                styles.optionButton,
                selectedOption === 'otp' && styles.selectedOption
              ]}
              onPress={() => setSelectedOption('otp')}
              disabled={loading}
            >
              <Text style={[
                styles.optionText,
                selectedOption === 'otp' && styles.selectedOptionText
              ]}>Send OTP</Text>
            </TouchableOpacity> */}

            <TouchableOpacity
              style={[
                styles.optionButton,
                selectedOption === 'link' && styles.selectedOption
              ]}
              onPress={() => setSelectedOption('link')}
              disabled={loading}
            >
              <Text style={[
                styles.optionText,
                selectedOption === 'link' && styles.selectedOptionText
              ]}>Send Link</Text>
            </TouchableOpacity>
          </View>

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
            onPress={selectedOption === 'otp' ? handleSendOTP : handleSendResetLink}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>
                {selectedOption === 'otp' ? 'Send OTP' : 'Send Link'}
              </Text>
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
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginHorizontal: 5,
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#FF8447',
  },
  optionText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  selectedOptionText: {
    color: '#FFF',
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
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#FFF8F0',
    padding: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
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