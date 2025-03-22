import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { TextInput, HelperText, Text } from 'react-native-paper';

interface FormInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  showTogglePassword?: boolean;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  multiline?: boolean;
  numberOfLines?: number;
  style?: any;
  onBlur?: () => void;
  autoComplete?: 'off' | 'username' | 'password' | 'email' | 'name' | 'tel' | 'street-address' | 'postal-code' | 'cc-number' | 'cc-csc' | 'cc-exp' | 'cc-exp-month' | 'cc-exp-year';
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  showTogglePassword = false,
  leftIcon,
  rightIcon,
  onRightIconPress,
  multiline = false,
  numberOfLines = 1,
  style,
  onBlur,
  autoComplete,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const errorHeightAnim = useRef(new Animated.Value(0)).current;
  const errorOpacityAnim = useRef(new Animated.Value(0)).current;
  const [prevError, setPrevError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (error && !prevError) {
      // Error appeared - animate in
      Animated.parallel([
        Animated.timing(errorHeightAnim, {
          toValue: 22, // Height of error text
          duration: 200,
          useNativeDriver: false
        }),
        Animated.timing(errorOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false
        })
      ]).start();
    } else if (!error && prevError) {
      // Error disappeared - animate out
      Animated.parallel([
        Animated.timing(errorHeightAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false
        }),
        Animated.timing(errorOpacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false
        })
      ]).start();
    }
    
    setPrevError(error);
  }, [error, prevError]);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <View style={[styles.container, style]}>
      <TextInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry && !showPassword}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : 1}
        onBlur={onBlur}
        mode="outlined"
        style={[
          styles.input,
          error ? styles.inputError : null,
          multiline ? { height: numberOfLines * 25 + 20 } : null
        ]}
        error={!!error}
        autoComplete={autoComplete}
        left={leftIcon ? <TextInput.Icon icon={leftIcon} color="#B1B1B1" /> : undefined}
        right={
          showTogglePassword ? (
            <TextInput.Icon
              icon={showPassword ? "eye-off" : "eye"}
              color="#FF8447"
              onPress={togglePasswordVisibility}
            />
          ) : rightIcon ? (
            <TextInput.Icon
              icon={rightIcon}
              color="#B1B1B1"
              onPress={onRightIconPress}
            />
          ) : undefined
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
      
      <Animated.View 
        style={[
          styles.errorContainer, 
          { 
            height: errorHeightAnim,
            opacity: errorOpacityAnim,
          }
        ]}
      >
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFF',
    fontFamily: 'LexendDeca_400Regular',
  },
  inputError: {
    borderColor: '#DC3545',
  },
  errorContainer: {
    overflow: 'hidden',
    justifyContent: 'center',
    paddingLeft: 15,
  },
  errorText: {
    color: '#DC3545',
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
  }
});

export default FormInput; 