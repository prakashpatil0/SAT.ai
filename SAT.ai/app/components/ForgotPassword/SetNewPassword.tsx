import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AppGradient from '@/app/components/AppGradient';
import { TouchableOpacity } from 'react-native';
import PasswordUpdateSuccess from './PasswordUpdateSuccess';
import { getAuth, updatePassword } from 'firebase/auth';

type RootStackParamList = {
  Login: undefined;
};

type SetNewPasswordNavigationProp = StackNavigationProp<RootStackParamList>;

const SetNewPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigation = useNavigation<SetNewPasswordNavigationProp>();

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return '';
  };

  const handleConfirm = async () => {
    // Reset error
    setError('');

    // Validate password
    const validationError = validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (user) {
        await updatePassword(user, newPassword);
        setShowSuccess(true);
      } else {
        setError('No user is currently signed in');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update password');
    }
  };

  return (
    <AppGradient>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Set Your New Password</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                setError('');
              }}
              secureTextEntry={!showNewPassword}
              mode="outlined"
              style={styles.input}
              placeholder="Enter your new password"
              error={!!error}
              right={
                <TextInput.Icon
                  icon={showNewPassword ? "eye-off" : "eye"}
                  color="#B1B1B1"
                  onPress={() => setShowNewPassword(!showNewPassword)}
                />
              }
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
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirm your New Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setError('');
              }}
              secureTextEntry={!showConfirmPassword}
              mode="outlined"
              style={styles.input}
              placeholder="Confirm your New Password"
              error={!!error}
              right={
                <TextInput.Icon
                  icon={showConfirmPassword ? "eye-off" : "eye"}
                  color="#B1B1B1"
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              }
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
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmButtonText}>Confirm</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.returnContainer}
          >
            <Text style={styles.returnText}>
              Return to Login Screen- <Text style={styles.loginText}>Login</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {showSuccess && <PasswordUpdateSuccess />}
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
    backgroundColor: 'white',
    marginTop: 60,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 32,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#FF8447',
    marginBottom: 40,
    marginTop: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 18,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    fontSize: 16,
  },
  errorText: {
    color: '#DC3545',
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    marginTop: 5,
  },
  confirmButton: {
    backgroundColor: '#FF8447',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  confirmButtonText: {
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
});

export default SetNewPassword; 