import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Text, TextInput, Snackbar } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAuth, updatePassword } from 'firebase/auth';
import AppGradient from '@/app/components/AppGradient';
import { TouchableOpacity } from 'react-native';

interface RouteParams {
  email: string;
}

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { email } = route.params as RouteParams;

  const validatePassword = (password: string) => {
    // Password must be at least 8 characters long and contain at least one number
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    return passwordRegex.test(password);
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!validatePassword(newPassword)) {
      Alert.alert(
        'Error',
        'Password must be at least 8 characters long and contain at least one number'
      );
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        Alert.alert('Error', 'User not found. Please try logging in again.');
        navigation.navigate('Login');
        return;
      }

      await updatePassword(user, newPassword);
      
      setSnackbarMessage('Password updated successfully!');
      setShowSnackbar(true);

      // Navigate to login screen after short delay
      setTimeout(() => {
        navigation.navigate('Login');
      }, 1500);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      let message = 'Failed to reset password';
      
      if (error.code === 'auth/requires-recent-login') {
        message = 'Please log in again to reset your password';
        navigation.navigate('Login');
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
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Please enter your new password
          </Text>

          <TextInput
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            mode="outlined"
            style={styles.input}
            secureTextEntry
            disabled={loading}
            left={<TextInput.Icon icon="lock" color="#B1B1B1" />}
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

          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            style={styles.input}
            secureTextEntry
            disabled={loading}
            left={<TextInput.Icon icon="lock-check" color="#B1B1B1" />}
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
              styles.resetButton,
              { opacity: loading ? 0.7 : 1 }
            ]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.resetButtonText}>Reset Password</Text>
            )}
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
  resetButton: {
    backgroundColor: '#FF8447',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    minHeight: 56,
    justifyContent: 'center',
  },
  resetButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
  },
  snackbar: {
    backgroundColor: '#4CAF50',
  },
});

export default ResetPassword; 