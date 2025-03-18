import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, Modal } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import AppGradient from './components/AppGradient';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  Login: undefined;
  MainApp: undefined;
  BDMHomeScreen: undefined;
  SignUpScreen: undefined;
  BDMStack: undefined;
};

type SignUpScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignUpScreen'>;

const SignUpScreen = () => {
  const navigation = useNavigation<SignUpScreenNavigationProp>();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const roles = [
    { label: 'Telecaller', value: 'telecaller' },
    { label: 'BDM', value: 'bdm' }
  ];
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });

  const handleSignUp = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      console.log('Starting signup process for role:', formData.role);
      
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      console.log('Firebase Auth user created:', user.uid);

      // Store additional user data in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        role: formData.role.toLowerCase(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true
      };
      
      console.log('Saving user data to Firestore:', userData);
      await setDoc(userRef, userData);
      console.log('User data saved successfully');

      // Store user role in AsyncStorage
      await AsyncStorage.setItem('userRole', formData.role.toLowerCase());
      console.log('User role stored in AsyncStorage:', formData.role.toLowerCase());

      // Navigate based on role
      if (formData.role.toLowerCase() === 'bdm') {
        console.log('Navigating to BDMStack');
        navigation.reset({
          index: 0,
          routes: [{ name: 'BDMStack' }],
        });
      } else if (formData.role.toLowerCase() === 'telecaller') {
        console.log('Navigating to MainApp');
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainApp' }],
        });
      } else {
        throw new Error('Invalid role selected');
      }

    } catch (error: any) {
      console.error('Signup error:', error);
      let errorMessage = 'Failed to sign up';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already registered';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (role: string) => {
    setFormData({ ...formData, role });
    setRoleModalVisible(false);
  };

  const validateEmail = (text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setFormData({ ...formData, email: text });
    
    if (!emailRegex.test(text)) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
      return false;
    } else {
      setErrors(prev => ({ ...prev, email: '' }));
      return true;
    }
  };

  const validatePassword = (text: string) => {
    setFormData({ ...formData, password: text });
    
    if (text.length < 5) {
      setErrors(prev => ({ ...prev, password: 'Password must be at least 5 characters' }));
      return false;
    } else {
      setErrors(prev => ({ ...prev, password: '' }));
      return true;
    }
  };

  const validateForm = () => {
    // Enhanced validation
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return false;
    }

    if (!formData.email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    if (!formData.phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return false;
    }

    // Phone validation (Indian format)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.phone.replace(/[^0-9]/g, ''))) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return false;
    }

    if (!formData.password) {
      Alert.alert('Error', 'Please enter a password');
      return false;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    if (!formData.role) {
      Alert.alert('Error', 'Please select your role');
      return false;
    }

    return true;
  };

  return (
    <AppGradient>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.innerContainer}>
          <Text style={styles.title}>Create New Account</Text>

          <TextInput
            label="Name"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="account" color="#B1B1B1"/>}
            theme={{
              roundness: 10,
              colors: {
                primary: "#FF8447",
                text: "#333",
                placeholder: "#999",
              },
              fonts: {
                regular: {
                  fontFamily: "LexendDeca_400Regular",
                },
              },
              animation: {
                scale: 1,
              },
            }}
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
          />

          <TextInput
            label="Email ID"
            value={formData.email}
            onChangeText={validateEmail}
            mode="outlined"
            style={styles.input}
            keyboardType="email-address"
            error={!!errors.email}
            left={<TextInput.Icon icon="email" color="#B1B1B1"/>}
            theme={{
              roundness: 10,
              colors: {
                primary: "#FF8447",
                text: "#333",
                placeholder: "#999",
                error: "#DC3545",
              },
            }}
          />
          <HelperText type="error" visible={!!errors.email}>
            {errors.email}
          </HelperText>

          <TextInput
            label="Phone Number"
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            mode="outlined"
            style={styles.input}
            keyboardType="phone-pad"
            left={<TextInput.Icon icon="phone" color="#B1B1B1"/>}
            theme={{
              roundness: 10,
              colors: {
                primary: "#FF8447",
                text: "#333",
                placeholder: "#999",
              },
              fonts: {
                regular: {
                  fontFamily: "LexendDeca_400Regular",
                },
              },
              animation: {
                scale: 1,
              },
            }}
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
          />

          <TextInput
            label="Create Password"
            value={formData.password}
            onChangeText={validatePassword}
            mode="outlined"
            style={styles.input}
            secureTextEntry={!showPassword}
            error={!!errors.password}
            left={<TextInput.Icon icon="lock" color="#B1B1B1"/>}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                color="#FF8447"
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            theme={{
              roundness: 10,
              colors: {
                primary: "#FF8447",
                text: "#333",
                placeholder: "#999",
                error: "#DC3545",
              },
              fonts: {
                regular: {
                  fontFamily: "LexendDeca_400Regular",
                },
              },
              animation: {
                scale: 1,
              },
            }}
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
          />
          <HelperText type="error" visible={!!errors.password}>
            {errors.password}
          </HelperText>

          <TextInput
            label="Confirm Password"
            value={formData.confirmPassword}
            onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
            mode="outlined"
            style={styles.input}
            secureTextEntry={!showConfirmPassword}
            left={<TextInput.Icon icon="lock" color="#B1B1B1"/>}
            right={
              <TextInput.Icon
                icon={showConfirmPassword ? "eye-off" : "eye"}
                color="#FF8447"
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
            theme={{
              roundness: 10,
              colors: {
                primary: "#FF8447",
                text: "#333",
                placeholder: "#999",
              },
              fonts: {
                regular: {
                  fontFamily: "LexendDeca_400Regular",
                },
              },
              animation: {
                scale: 1,
              },
            }}
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
          />

          <TouchableOpacity 
            onPress={() => setRoleModalVisible(true)}
            style={styles.roleSelector}
          >
            <View style={styles.dropdownTrigger}>
              <Text style={styles.roleText}>
                {formData.role || 'Select Your Role'}
              </Text>
              <MaterialIcons 
                name={roleModalVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                size={24} 
                color="#666"
              />
            </View>
          </TouchableOpacity>

          <Button
            mode="contained"
            onPress={handleSignUp}
            style={styles.signupButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            loading={loading}
            disabled={loading}
          >
            Sign Up
          </Button>

          <View style={styles.loginContainer}>
            <View style={styles.loginWrapper}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login' as never)}
                style={styles.loginButton}
              >
                <Text style={styles.loginButtonText}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={roleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalContainer} 
          activeOpacity={1} 
          onPress={() => setRoleModalVisible(false)}
        >
          <View style={styles.modalContent}>
            {roles.map((role, index) => (
              <TouchableOpacity
                key={role.value}
                style={[
                  styles.roleOption,
                  index === roles.length - 1 && { borderBottomWidth: 0 }
                ]}
                onPress={() => {
                  handleRoleSelect(role.value);
                  setRoleModalVisible(false);
                }}
              >
                <Text style={styles.roleText}>{role.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
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
    fontSize: 26,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF8447',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  inputContent: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputOutline: {
    borderRadius: 10,
    borderWidth: 1.5,
  },
  signupButton: {
    marginTop: 24,
    backgroundColor: '#FF8447',
    borderRadius: 8,
    height: 48,
    marginBottom: 80,
  },
  buttonContent: {
    height: 48,
    paddingHorizontal: 32,
  },
  buttonLabel: {
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FFFFFF',
  },
  loginContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF8F0',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loginWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#999',
  },
  loginButton: {
    marginLeft: 4,
  },
  loginButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#FF8447',
  },
  roleSelector: {
    marginBottom: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    elevation: 5,
  },
  roleOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  roleText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
  },
  dropdownTrigger: {
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default SignUpScreen;