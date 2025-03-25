import React, { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { TextInput, Button, Text, useTheme, HelperText } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from '@react-navigation/stack';
import { auth, db } from "@/firebaseConfig";
import { signInWithEmailAndPassword, getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import AppGradient from "@/app/components/AppGradient";
import { getFirestore } from "firebase/firestore";


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
        Alert.alert('Error', 'User data not found');
        return;
      }

      const userData = userDoc.data();

      if (!userData.role) {
        Alert.alert('Error', 'User role not found');
        return;
      }

      // Store user role in AsyncStorage for future reference
      await AsyncStorage.setItem('userRole', userData.role.toLowerCase());

      // Navigate based on role
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
          Alert.alert('Error', 'Invalid user role');
      }
    } catch (error: any) {
      let errorMessage = 'Failed to login';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No user found with this email';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Login Error', errorMessage);
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
          <Text style={styles.title}>Login to Your Account</Text>
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
          {loading ? 'Logging in...' : 'Log in'}
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
    marginTop: 20,
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
    height: 48,           // Fixed button height
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
  },
});

export default LoginScreen;