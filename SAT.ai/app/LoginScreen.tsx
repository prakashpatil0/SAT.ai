import React, { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, Modal, Animated } from "react-native";
import { TextInput, Button, Text, useTheme, HelperText } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from '@react-navigation/stack';
import { auth, db } from "@/firebaseConfig";
import { signInWithEmailAndPassword, getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import AppGradient from "@/app/components/AppGradient";
import { getFirestore } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";


type RootStackParamList = {
  Login: undefined;
  MainApp: undefined;
  BDMStack: undefined;
  SignUpScreen: undefined;
  AdminDrawer: undefined;
  ForgotPassword: undefined;
  VerifyEmail: { email: string };
  SetNewPassword: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [touched, setTouched] = useState({
    email: false,
    password: false
  });
  const theme = useTheme();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState<'error' | 'success'>('error');
  const [shakeAnimation] = useState(new Animated.Value(0));
  
  const showCustomAlert = (message: string, type: 'error' | 'success' = 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
    
    // Add shake animation for error
    if (type === 'error') {
      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: -10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Auto hide after 3 seconds
    setTimeout(() => {
      setShowAlert(false);
    }, 3000);
  };

  const handleLogin = async () => {
    if (!validateEmail(email) || !validatePassword(password)) {
      return;
    }
    try {
      setLoading(true);
      const auth = getAuth();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Get user role from Firestore
      const db = getFirestore();
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        showCustomAlert('Oops! We couldn\'t find your account. Please try again or contact support.');
        return;
      }

      const userData = userDoc.data();

      if (!userData.role) {
        showCustomAlert('Oops! Something went wrong. Please contact support.');
        return;
      }

      // Store user role in AsyncStorage for future reference
      await AsyncStorage.setItem('userRole', userData.role.toLowerCase());

      // Show success message
      showCustomAlert('Welcome back! Login successful.', 'success');

      // Navigate based on role
      setTimeout(() => {
        switch (userData.role.toLowerCase()) {
          case 'telecaller':
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainApp' }],
            });
            break;
          case 'bdm':
            navigation.reset({
              index: 0,
              routes: [{ name: 'BDMStack' }],
            });
            break;
          case 'admin':
            navigation.reset({
              index: 0,
              routes: [{ name: 'AdminDrawer' }],
            });
            break;
          default:
            showCustomAlert('Oops! Something went wrong. Please contact support.');
        }
      }, 1000);

    } catch (error: any) {
      let errorMessage = 'Oops! Something went wrong. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'We couldn\'t find an account with this email. Please check your email or create a new account.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'That\'s not the right password. Please try again or use "Forgot Password" if you need help.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address (e.g., example@email.com).';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please wait a few minutes before trying again.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'No internet connection. Please check your connection and try again.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled. Please contact support for help.';
      } else if (error.code === 'auth/email-not-verified') {
        errorMessage = 'Please verify your email address before logging in.';
      } else if (error.message) {
        errorMessage = 'Oops! Something went wrong. Please try again.';
      }
      
      showCustomAlert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (text: string) => {
    setEmail(text);
    if (!touched.email) return true;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      setEmailError("Please enter a valid email address");
      return false;
    } else {
      setEmailError("");
      return true;
    }
  };

  const validatePassword = (text: string) => {
    setPassword(text);
    if (!touched.password) return true;
    
    if (text.length < 5) {
      setPasswordError("Password must be at least 5 characters");
      return false;
    } else {
      setPasswordError("");
      return true;
    }
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched(prev => ({
      ...prev,
      [field]: true
    }));
    if (field === 'email') {
      validateEmail(email);
    } else {
      validatePassword(password);
    }
  };

  return (
    <AppGradient>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.innerContainer}>
          <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
            <Text style={styles.title}>Login to Your Account</Text>
          </Animated.View>
          
          <View style={styles.inputContainer}>
            <TextInput
              label="Email ID"
              value={email}
              onChangeText={validateEmail}
              onBlur={() => handleBlur('email')}
              mode="outlined"
              style={[styles.input, emailError && touched.email && styles.inputError]}
              keyboardType="email-address"
              autoCapitalize="none"
              error={!!emailError && touched.email}
              left={<TextInput.Icon icon="email" color="#B1B1B1"/>}
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
            />
            {emailError && touched.email && (
              <HelperText type="error" visible={true} style={styles.errorText}>
                {emailError}
              </HelperText>
            )}
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              label="Password"
              value={password}
              onChangeText={validatePassword}
              onBlur={() => handleBlur('password')}
              mode="outlined"
              style={[styles.input, passwordError && touched.password && styles.inputError]}
              secureTextEntry={!showPassword}
              error={!!passwordError && touched.password}
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
            />
            {passwordError && touched.password && (
              <HelperText type="error" visible={true} style={styles.errorText}>
                {passwordError}
              </HelperText>
            )}
          </View>

          <Button
            mode="text"
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotPassword}
            labelStyle={styles.forgotPasswordText}
          >
            Forgot Password?
          </Button>
          
          <Button
            mode="contained"
            onPress={handleLogin}
            style={styles.loginButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            loading={loading}
            disabled={loading}
          >
            {loading ? '' : 'Log in'}
          </Button>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <Button
              mode="text"
              onPress={() => navigation.navigate('SignUpScreen')}
              labelStyle={styles.signupButtonText}
            >
              Sign Up
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Custom Alert Modal */}
      <Modal
        transparent
        visible={showAlert}
        animationType="fade"
        onRequestClose={() => setShowAlert(false)}
      >
        <View style={styles.alertOverlay}>
          <Animated.View 
            style={[
              styles.alertContainer,
              {
                transform: [{ translateY: shakeAnimation }],
                backgroundColor: alertType === 'error' ? '#FFF5F5' : '#F0FFF4',
                borderColor: alertType === 'error' ? '#FF5252' : '#4CAF50',
              }
            ]}
          >
            <View style={styles.alertContent}>
              {alertType === 'error' ? (
                <Ionicons name="alert-circle" size={24} color="#FF5252" />
              ) : (
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              )}
              <Text style={[
                styles.alertText,
                { color: alertType === 'error' ? '#FF5252' : '#4CAF50' }
              ]}>
                {alertMessage}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.alertCloseButton}
              onPress={() => setShowAlert(false)}
            >
              <Ionicons 
                name="close" 
                size={20} 
                color={alertType === 'error' ? '#FF5252' : '#4CAF50'} 
              />
            </TouchableOpacity>
          </Animated.View>
        </View>
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
    justifyContent: "center",
    padding: 20,
    backgroundColor: 'white',
    marginTop: 60, // Add space at top
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
    fontFamily: "LexendDeca_500Medium",
    marginBottom: 40,
    textAlign: "center",
    color: "#FF8447",
  },
  inputContainer: {
    width: '100%',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  inputError: {
    borderColor: '#DC3545',
  },
  errorText: {
    color: '#DC3545',
    marginTop: 2,
    marginBottom: 0,
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
  },
  loginButton: {
    marginTop: 10,
    paddingVertical: 5,
    backgroundColor: '#FF8447',
    borderRadius: 12,
  },
  buttonLabel: {
    fontSize: 20,
    fontFamily: "LexendDeca_400Regular",
    color: "#FFFFFF",
  },
  forgotPassword: {
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#FFF8F0',
    padding: 16,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  buttonContent: {
    height: 48, 
  },
  forgotPasswordText: {
    color: "#FF8447",
    fontFamily: "LexendDeca_400Regular",
    fontSize: 16,
  },
  signupText: {
    color: "#999999",
    fontFamily: "Inter_400Regular",
    fontSize: 16,
  },
  signupButtonText: {
    color: "#FF8447",
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  alertOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    borderWidth: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  alertContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertText: {
    marginLeft: 12,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    flex: 1,
  },
  alertCloseButton: {
    padding: 4,
    marginLeft: 12,
  },
});

export default LoginScreen;