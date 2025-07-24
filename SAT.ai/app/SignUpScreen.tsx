import React, { useState, useCallback } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform,ScrollView, Alert, TouchableOpacity, Modal, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, deleteDoc, collection, query, getDocs } from 'firebase/firestore';
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

type CustomTextStyle = {
  marginBottom: number;
  backgroundColor: string;
  fontSize: number;
};

interface Styles {
  container: ViewStyle;
  innerContainer: ViewStyle;
  title: TextStyle;
  input: TextStyle & ViewStyle;
  inputContent: TextStyle & ViewStyle;
  inputOutline: ViewStyle;
  inputWithError: ViewStyle;
  errorText: TextStyle;
  signupButton: ViewStyle;
  buttonContent: ViewStyle;
  buttonLabel: TextStyle;
  loginContainer: ViewStyle;
  loginWrapper: ViewStyle;
  loginText: TextStyle;
  loginButton: ViewStyle;
  loginButtonText: TextStyle;
  roleSelector: ViewStyle;
  modalContainer: ViewStyle;
  modalContent: ViewStyle;
  roleOption: ViewStyle;
  roleText: TextStyle;
  dropdownTrigger: ViewStyle;
  textInput: ViewStyle;
  textInputContent: TextStyle & ViewStyle;
  textInputWithError: TextStyle & ViewStyle;
  inputContainer: ViewStyle;
  inputContainerWithError: ViewStyle;
  formField: ViewStyle;
  formFieldWithError: ViewStyle;
  scrollViewContainer: ViewStyle;
}

interface FormFieldProps {
  children: React.ReactNode;
  hasError?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({ children, hasError }) => (
  <View style={[styles.formField, hasError && styles.formFieldWithError]}>
    {children}
  </View>
);

const SignUpScreen = () => {
  const navigation = useNavigation<SignUpScreenNavigationProp>();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    role: '',
    companyId: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const roles = [
    { label: 'Telecaller', value: 'telecaller' },
    { label: 'BDM', value: 'bdm' },
    { label: 'HR Manager', value: 'hrmanager' } // ✅ Added
  ];
  
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });

  const generateUserId = async (name: string): Promise<string> => {
    // Split name into first and last name
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    
    // Get first characters
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    
    // Get current year
    const currentYear = new Date().getFullYear();
    
    // Get count of existing users
    const usersRef = collection(db, 'users');
    const q = query(usersRef);
    const querySnapshot = await getDocs(q);
    const userCount = querySnapshot.size + 1; // Add 1 for the new user
    
    // Format the sequential number with leading zero if needed
    const sequentialNumber = userCount.toString().padStart(2, '0');
    
    // Combine all parts to create the user ID
    return `${currentYear}${firstInitial}${lastInitial}${sequentialNumber}`;
  };

  const handleSignUp = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      // Generate user ID
      const userId = await generateUserId(formData.name);
      
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber: formData.phoneNumber.trim(),
        role: formData.role.toLowerCase(),
        companyId: formData.companyId.trim(), // ✅ ADD THIS LINE
        designation: 
          formData.role.toLowerCase() === 'bdm'
            ? 'BDM'
            : formData.role.toLowerCase() === 'telecaller'
            ? 'Telecaller'
            : formData.role.toLowerCase() === 'hrmanager'
            ? 'HR Manager'
            : '',
        userId: userId, // Add the generated user ID
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true
      });

      // Store user role and ID in AsyncStorage
      await AsyncStorage.multiSet([
        ['userRole', formData.role.toLowerCase()],
        ['sessionToken', user.uid],
        ['userId', userId],
        ['lastActiveTime', new Date().toISOString()]
      ]);

      // Navigate based on role
      if (formData.role.toLowerCase() === 'bdm') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'BDMStack' }],
        });
      } else if (formData.role.toLowerCase() === 'telecaller') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainApp' }],
        });
      } else if (formData.role.toLowerCase() === 'hrmanager') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'HRHome' }], // ✅ Add this route if you have an HR dashboard
        });
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
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection';
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

    if (!formData.phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return false;
    }

    // Phone validation (Indian format)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.phoneNumber.replace(/[^0-9]/g, ''))) {
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
  // ✅ Company ID validation
 const companyIdRegex = /^[a-zA-Z0-9]+$/;
if (!formData.companyId.trim()) {
  Alert.alert('Error', 'Please enter your Company ID');
  return false;
} else if (!companyIdRegex.test(formData.companyId.trim())) {
  Alert.alert('Error', 'Company ID should contain only letters and numbers');
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
          <ScrollView
      contentContainerStyle={styles.scrollViewContainer}
      keyboardShouldPersistTaps="handled" // Ensure inputs are tappable
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
                placeholder: "#969595",
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

          <FormField hasError={!!errors.email}>
            <TextInput
              label="Email ID"
              value={formData.email}
              onChangeText={validateEmail}
              mode="outlined"
              keyboardType="email-address"
              error={!!errors.email}
              left={<TextInput.Icon icon="email" color="#B1B1B1"/>}
              theme={{
                roundness: 10,
                colors: {
                  primary: "#FF8447",
                  text: "#333",
                  placeholder: "#969595",
                  error: "#DC3545",
                },
              }}
            />
            {errors.email ? (
              <HelperText type="error" style={styles.errorText}>
                {errors.email}
              </HelperText>
            ) : null}
          </FormField>

          <FormField>
            <TextInput
              label="Phone Number"
              value={formData.phoneNumber}
              onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
              mode="outlined"
              keyboardType="phone-pad"
              left={<TextInput.Icon icon="phone" color="#B1B1B1"/>}
              theme={{
                roundness: 10,
                colors: {
                  primary: "#FF8447",
                  text: "#333",
                  placeholder: "#969595",
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
            />
          </FormField>

          <FormField hasError={!!errors.password}>
            <TextInput
              label="Create Password"
              value={formData.password}
              onChangeText={validatePassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              error={!!errors.password}
              left={<TextInput.Icon icon="lock" color="#B1B1B1"/>}
              right={
                <TextInput.Icon
                  icon={showPassword ? "eye-off-outline" : "eye-outline"}
                  color="#FF8447"
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              theme={{
                roundness: 10,
                colors: {
                  primary: "#FF8447",
                  text: "#333",
                  placeholder: "#969595",
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
            />
            {errors.password ? (
              <HelperText type="error" style={styles.errorText}>
                {errors.password}
              </HelperText>
            ) : null}
          </FormField>

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
                icon={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                color="#FF8447"
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
            theme={{
              roundness: 10,
              colors: {
                primary: "#FF8447",
                text: "#333",
                placeholder: "#969595",
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
<TextInput
  label="Company ID"
  value={formData.companyId}
  onChangeText={(text) => {
    const cleaned = text.replace(/[^a-zA-Z0-9]/g, ''); // ✅ Remove special characters
    setFormData({ ...formData, companyId: cleaned });
  }}
  mode="outlined"
  style={styles.input}
  left={<TextInput.Icon icon="domain" color="#B1B1B1" />}
  theme={{
    roundness: 10,
    colors: {
      primary: "#FF8447",
      text: "#333",
      placeholder: "#969595",
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
        </ScrollView>
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

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
  },
  scrollViewContainer: {
    flexGrow: 1,  
    justifyContent: 'center',
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
    marginBottom: 12,
    backgroundColor: '#F8F8F8',
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
  inputWithError: {
    marginBottom: 0,
  },
  errorText: {
    marginBottom: 12,
    marginTop: 2,
    fontSize: 12,
    color: '#DC3545',
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
    textDecorationLine: 'underline',
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
  textInput: {
    width: '100%',
  },
  textInputContent: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  textInputWithError: {
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputContainerWithError: {
    marginBottom: 0,
  },
  formField: {
    marginBottom: 12,
  },
  formFieldWithError: {
    marginBottom: 0,
  },
});

export default SignUpScreen;