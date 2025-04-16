import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform
} from "react-native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/firebaseConfig";
import TelecallerMainLayout from "@/app/components/TelecallerMainLayout";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppGradient from "@/app/components/AppGradient";
import PDFViewer from '@/app/components/PDFViewer';
interface SettingsData {
  notificationsEnabled: boolean;
  darkModeEnabled: boolean;
  locationEnabled: boolean;
  autoSyncEnabled: boolean;
  soundEnabled: boolean;
  biometricsEnabled: boolean;
  dataSavingEnabled: boolean;
  offlineMode: boolean;
  language: string;
  fontSize: string;
  [key: string]: any;
}

const TelecallerSettings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [settings, setSettings] = useState<SettingsData>({
    notificationsEnabled: true,
    darkModeEnabled: false,
    locationEnabled: true,
    autoSyncEnabled: true,
    soundEnabled: true,
    biometricsEnabled: false,
    dataSavingEnabled: false,
    offlineMode: false,
    language: 'English',
    fontSize: 'Medium'
  });


  const handlePrivacyPolicy = () => {
    setShowPdfViewer(true);
  };

  if (showPdfViewer) {
    return (
      <PDFViewer 
        pdfPath="assets/privacy_policy.pdf"
        onClose={() => setShowPdfViewer(false)}
      />
    );
  }
  // Load settings from Firestore
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      // Try to get settings from Firestore
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Update settings with values from Firestore if they exist
        const newSettings = { ...settings };
        Object.keys(settings).forEach(key => {
          if (userData[key] !== undefined) {
            newSettings[key] = userData[key];
          }
        });
        
        setSettings(newSettings);
      }
      
      // Also check for any local settings in AsyncStorage
      const localSettings = await AsyncStorage.getItem('appSettings');
      if (localSettings) {
        const parsedSettings = JSON.parse(localSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      Alert.alert("Error", "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key: keyof SettingsData, value: any) => {
    try {
      // Update state
      setSettings(prev => ({ ...prev, [key]: value }));
      
      // Save to AsyncStorage for quick access
      const currentSettings = await AsyncStorage.getItem('appSettings');
      const parsedSettings = currentSettings ? JSON.parse(currentSettings) : {};
      await AsyncStorage.setItem('appSettings', JSON.stringify({
        ...parsedSettings,
        [key]: value
      }));
      
      // We don't need to save every toggle to Firestore immediately
      // It will be saved when user leaves the screen
    } catch (error) {
      console.error(`Error updating ${key}:`, error);
    }
  };

  const saveSettingsToFirestore = async () => {
    try {
      setIsSaving(true);
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      // Update Firestore document
      const userRef = doc(db, "users", userId);
      await setDoc(userRef, {
        ...settings,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      Alert.alert("Success", "Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      Alert.alert("Error", "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle user leaving the screen - save settings to Firestore
  useEffect(() => {
    return () => {
      const userId = auth.currentUser?.uid;
      if (userId) {
        const userRef = doc(db, "users", userId);
        setDoc(userRef, {
          ...settings,
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(error => {
          console.error("Error saving settings on unmount:", error);
        });
      }
    };
  }, [settings]);

  const clearAppData = async () => {
    Alert.alert(
      "Clear App Data",
      "This will reset all settings and cached data. This action cannot be undone. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Data",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear AsyncStorage
              await AsyncStorage.clear();
              
              // Reset settings to default
              setSettings({
                notificationsEnabled: true,
                darkModeEnabled: false,
                locationEnabled: true,
                autoSyncEnabled: true,
                soundEnabled: true,
                biometricsEnabled: false,
                dataSavingEnabled: false,
                offlineMode: false,
                language: 'English',
                fontSize: 'Medium'
              });
              
              Alert.alert("Success", "App data cleared successfully");
            } catch (error) {
              console.error("Error clearing app data:", error);
              Alert.alert("Error", "Failed to clear app data");
            }
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          onPress: async () => {
            try {
              await auth.signOut();
              // Navigation will be handled by auth state listener
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("Error", "Failed to logout");
            }
          }
        }
      ]
    );
  };

  const renderSectionHeader = (icon: string, title: string) => (
    <View style={styles.sectionHeader}>
      <MaterialIcons name={icon as any} size={22} color="#FF8447" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderSwitchItem = (icon: string, title: string, key: keyof SettingsData) => (
    <View style={styles.settingItem}>
      <View style={styles.settingTextContainer}>
        <MaterialIcons name={icon as any} size={22} color="#555" />
        <Text style={styles.settingText}>{title}</Text>
      </View>
      <Switch
        value={settings[key] as boolean}
        onValueChange={(value) => updateSetting(key, value)}
        trackColor={{ false: '#d1d1d1', true: '#ffc5aa' }}
        thumbColor={settings[key] ? '#FF8447' : '#f4f3f4'}
      />
    </View>
  );

  const renderOptionItem = (icon: string, title: string, subtitle: string, onPress: () => void) => (
    <TouchableOpacity style={styles.optionItem} onPress={onPress}>
      <View style={styles.settingTextContainer}>
        <MaterialIcons name={icon as any} size={22} color="#555" />
        <View>
          <Text style={styles.settingText}>{title}</Text>
          <Text style={styles.settingSubtext}>{subtitle}</Text>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color="#999" />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <AppGradient>
      <TelecallerMainLayout title="Settings" showBackButton>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF8447" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </TelecallerMainLayout>
    </AppGradient>
    );
  }

  return (
    <AppGradient>
    <TelecallerMainLayout title="Settings" showBackButton>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* General Settings Section */}
        <View style={styles.section}>
          {renderSectionHeader("settings", "General")}
          
          <View style={styles.settingsContainer}>
            {renderSwitchItem("notifications", "Push Notifications", "notificationsEnabled")}
            {/* {renderSwitchItem("dark-mode", "Dark Mode", "darkModeEnabled")} */}
            {renderSwitchItem("volume-up", "Sound Effects", "soundEnabled")}
            
            {renderOptionItem("language", "Language", settings.language, () => 
              Alert.alert("Language", "Language settings coming soon!")
            )}
            
            {renderOptionItem("format-size", "Font Size", settings.fontSize, () => {
              Alert.alert(
                "Select Font Size",
                "Choose your preferred font size",
                [
                  { text: "Small", onPress: () => updateSetting("fontSize", "Small") },
                  { text: "Medium", onPress: () => updateSetting("fontSize", "Medium") },
                  { text: "Large", onPress: () => updateSetting("fontSize", "Large") }
                ]
              );
            })}
          </View>
        </View>
        
        {/* Privacy & Security Section */}
        <View style={styles.section}>
          {renderSectionHeader("security", "Privacy & Security")}
          
          <View style={styles.settingsContainer}>
            {renderSwitchItem("location-on", "Location Services", "locationEnabled")}
            {/* {renderSwitchItem("fingerprint", "Biometric Login", "biometricsEnabled")} */}
            
            {/* {renderOptionItem("lock", "Change Password", "Secure your account", () => 
              Alert.alert("Change Password", "Password change feature coming soon!")
            )} */}
            
            {renderOptionItem("fact-check", "Privacy Policy", "Read our privacy policy", handlePrivacyPolicy)}
          </View>
        </View>
        
        {/* Data Management Section */}
        <View style={styles.section}>
          {renderSectionHeader("storage", "Data Management")}
          
          <View style={styles.settingsContainer}>
            {renderSwitchItem("sync", "Auto-Sync Data", "autoSyncEnabled")}
            {renderSwitchItem("data-usage", "Data Saving Mode", "dataSavingEnabled")}
            {renderSwitchItem("offline-bolt", "Offline Mode", "offlineMode")}
            
            {renderOptionItem("delete", "Clear App Data", "Reset app settings and cache", clearAppData)}
          </View>
        </View>
        
        {/* Account Section */}
        <View style={styles.section}>
          {renderSectionHeader("account-circle", "Account")}
          
          <View style={styles.settingsContainer}>
            {renderOptionItem("info", "About App", "Version 1.0.0", () => 
              Alert.alert("About App", "SAT.ai - Version 1.0.0\n\nDeveloped by SAT Team")
            )}
            
            {renderOptionItem("help", "Help & Support", "Get assistance", () => 
              Alert.alert("Help & Support", "Contact us at it@policyplanner.com")
            )}
            
            <TouchableOpacity style={[styles.optionItem, styles.logoutItem]} onPress={handleLogout}>
              <View style={styles.settingTextContainer}>
                <MaterialIcons name="logout" size={22} color="#FF3B30" />
                <Text style={[styles.settingText, { color: '#FF3B30' }]}>Logout</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={saveSettingsToFirestore}
          disabled={isSaving}
        >
          <LinearGradient
            colors={['#FF8447', '#FF6D24']}
            style={styles.saveGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Settings</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
          <Text style={styles.buildText}>Build 2025.04.07</Text>
        </View>
      </ScrollView>
    </TelecallerMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#555',
    fontFamily: 'LexendDeca_400Regular',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginLeft: 10,
  },
  settingsContainer: {
    paddingVertical: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
  },
  settingTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    marginLeft: 12,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
  },
  settingSubtext: {
    marginLeft: 12,
    fontSize: 13,
    fontFamily: 'LexendDeca_400Regular',
    color: '#888',
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  saveButton: {
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#FF8447',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  saveGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "LexendDeca_600SemiBold",
  },
  versionContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  versionText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'LexendDeca_400Regular',
  },
  buildText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'LexendDeca_400Regular',
    marginTop: 4,
    marginBottom: 40,
  },
});

export default TelecallerSettings; 