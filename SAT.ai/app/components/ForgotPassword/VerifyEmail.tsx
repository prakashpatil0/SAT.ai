import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Text, TextInput, Snackbar } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { doc, getDoc, updateDoc, getFirestore } from 'firebase/firestore';
import { auth } from '@/firebaseConfig';
import { User, sendEmailVerification } from 'firebase/auth';
import AppGradient from '@/app/components/AppGradient';
import { TouchableOpacity } from 'react-native';

const VerifyEmail = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { email, expectedOtp } = route.params;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = `otp-input-${index + 1}`;
      const input = document.getElementById(nextInput) as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }
  };

  const verifyOTP = async () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const db = getFirestore();
      const otpDoc = await getDoc(doc(db, 'otps', email));

      if (!otpDoc.exists()) {
        throw new Error('OTP not found or expired');
      }

      const otpData = otpDoc.data();
      
      // Check if OTP matches
      if (otpData.otp !== enteredOtp) {
        // Increment attempts
        await updateDoc(doc(db, 'otps', email), {
          attempts: (otpData.attempts || 0) + 1
        });

        if (otpData.attempts >= 3) {
          throw new Error('Too many failed attempts. Please request a new OTP');
        }

        throw new Error('Invalid OTP');
      }

      // Check if OTP is expired
      const expiresAt = otpData.expiresAt?.toDate();
      if (expiresAt && new Date() > expiresAt) {
        throw new Error('OTP has expired');
      }

      // Mark OTP as used
      await updateDoc(doc(db, 'otps', email), {
        isUsed: true,
        status: 'verified'
      });

      setSnackbarMessage('OTP verified successfully!');
      setShowSnackbar(true);

      // Navigate to set new password screen
      setTimeout(() => {
        navigation.navigate('SetNewPassword', { email });
      }, 1500);

    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      Alert.alert('Error', error.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'No user found. Please try logging in again.');
        return;
      }

      await sendEmailVerification(user);
      setTimer(60);
      Alert.alert('Success', 'Verification email has been sent. Please check your inbox.');
    } catch (error) {
      console.error('Error resending verification:', error);
      Alert.alert('Error', 'Failed to send verification email. Please try again.');
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
          <Text style={styles.title}>Verify Email</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit OTP sent to your email
          </Text>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                id={`otp-input-${index}`}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                keyboardType="numeric"
                maxLength={1}
                style={styles.otpInput}
                theme={{
                  roundness: 10,
                  colors: {
                    primary: '#FF8447',
                    text: '#333',
                    placeholder: '#999',
                    error: '#DC3545',
                  },
                }}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.verifyButton,
              { opacity: loading ? 0.7 : 1 }
            ]}
            onPress={verifyOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            <Text style={styles.timerText}>
              {timer > 0 ? `Resend OTP in ${timer}s` : 'Didn\'t receive OTP?'}
            </Text>
            <TouchableOpacity
              onPress={handleResendOTP}
              disabled={!canResend || loading}
            >
              <Text style={[
                styles.resendText,
                { opacity: canResend ? 1 : 0.5 }
              ]}>
                Resend OTP
              </Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 30,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  otpInput: {
    width: 45,
    height: 45,
    textAlign: 'center',
    fontSize: 20,
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
  timerText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginBottom: 5,
  },
  resendText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#FF8447',
  },
  snackbar: {
    backgroundColor: '#4CAF50',
  },
});

export default VerifyEmail; 