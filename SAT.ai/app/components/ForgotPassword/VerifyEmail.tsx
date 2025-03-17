import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import AppGradient from '@/app/components/AppGradient';

type RootStackParamList = {
  Login: undefined;
  SetNewPassword: undefined;
};

type VerifyEmailNavigationProp = StackNavigationProp<RootStackParamList>;

interface VerifyEmailProps {
  email: string;
  expectedOtp: string;
}

const VerifyEmail = () => {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const inputRefs = useRef<TextInput[]>([]);
  const navigation = useNavigation<VerifyEmailNavigationProp>();
  const route = useRoute();
  const { email, expectedOtp } = route.params as VerifyEmailProps;

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  const handleOtpChange = (text: string, index: number) => {
    if (error) setError('');
    
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus next input
    if (text && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtpInFirestore = async (enteredOtp: string) => {
    const db = getFirestore();
    const otpDoc = await getDoc(doc(db, 'otps', email));
    
    if (!otpDoc.exists()) {
      throw new Error('OTP expired or invalid');
    }

    const otpData = otpDoc.data();
    const createdAt = otpData.createdAt;
    const currentTime = new Date().getTime();
    
    // Check if OTP is expired (5 minutes)
    if (currentTime - createdAt > 5 * 60 * 1000) {
      throw new Error('OTP has expired');
    }

    // Check if too many attempts
    if (otpData.attempts >= 3) {
      throw new Error('Too many attempts. Please request a new OTP');
    }

    // Verify OTP
    if (otpData.otp !== enteredOtp) {
      throw new Error('Invalid OTP');
    }

    return true;
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    
    const enteredOtp = otp.join('');
    
    if (enteredOtp.length !== 4) {
      setError('Please enter complete OTP');
      setLoading(false);
      return;
    }

    try {
      await verifyOtpInFirestore(enteredOtp);
      
      setSnackbarMessage('OTP verified successfully!');
      setShowSnackbar(true);

      // Navigate after showing success message
      setTimeout(() => {
        navigation.navigate('SetNewPassword');
      }, 1500);

    } catch (error: any) {
      setError(error.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setTimer(30);
    setCanResend(false);
    setOtp(['', '', '', '']);
    setError('');
    
    // Implement resend logic here
    try {
      // Your resend OTP logic
      setSnackbarMessage('New OTP sent successfully!');
      setShowSnackbar(true);
    } catch (error) {
      setError('Failed to resend OTP');
    }
  };

  return (
    <AppGradient>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Verify Email</Text>
          <Text style={styles.subtitle}>Enter the OTP sent to {email}</Text>

          <View style={styles.otpContainer}>
            {[0, 1, 2, 3].map((index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  if (ref) inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpInput,
                  error ? styles.otpInputError : null
                ]}
                maxLength={1}
                keyboardType="number-pad"
                value={otp[index]}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                editable={!loading}
              />
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.verifyButton,
              { opacity: loading ? 0.7 : 1 }
            ]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>
              {canResend ? (
                <TouchableOpacity onPress={handleResend}>
                  <Text style={styles.resendButtonText}>Resend OTP</Text>
                </TouchableOpacity>
              ) : (
                `Resend OTP in ${timer} seconds`
              )}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#FF8447',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    width: '100%',
    gap: 10,
  },
  otpInput: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#FFF',
    fontSize: 24,
    textAlign: 'center',
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  otpInputError: {
    borderWidth: 1,
    borderColor: '#DC3545',
  },
  errorText: {
    color: '#DC3545',
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    marginBottom: 20,
    textAlign: 'center',
  },
  verifyButton: {
    backgroundColor: '#FF8447',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
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
  },
  resendText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    textAlign: 'center',
  },
  resendButtonText: {
    color: '#FF8447',
    textDecorationLine: 'underline',
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

export default VerifyEmail; 