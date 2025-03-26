import React, { useState, useCallback, memo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Switch, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import { auth, db } from '@/firebaseConfig';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// Define types for settings
interface Settings {
  notifications: {
    enabled: boolean;
    calls: boolean;
    meetings: boolean;
    alerts: boolean;
    followUps: boolean;
    emailNotifications: boolean;
  };
  appearance: {
    darkMode: boolean;
    fontSize: 'small' | 'medium' | 'large';
    language: string;
  };
  data: {
    sync: boolean;
    autoSave: boolean;
    backupEnabled: boolean;
    dataRetention: number; // days
  };
  privacy: {
    shareData: boolean;
    analytics: boolean;
  };
  calendar: {
    defaultView: 'day' | '3days' | 'week';
    workingHours: {
      start: string;
      end: string;
    };
    weekStartsOn: number; // 0-6 (Sunday-Saturday)
  };
}

// Define types for component props
interface SettingSwitchProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

interface SettingOptionProps {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  description?: string;
  rightText?: string;
}

interface SectionHeaderProps {
  title: string;
  description?: string;
}

// Memoized components
const SettingSwitch = memo<SettingSwitchProps>(({ title, description, value, onValueChange, disabled }) => (
  <View style={styles.settingItem}>
    <View style={styles.settingTextContainer}>
      <Text style={styles.settingText}>{title}</Text>
      {description && <Text style={styles.settingDescription}>{description}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      color="#FF8447"
      disabled={disabled}
    />
  </View>
));

const SettingOption = memo<SettingOptionProps>(({ title, icon, onPress, description, rightText }) => (
  <TouchableOpacity style={styles.settingOption} onPress={onPress}>
    <View style={styles.settingOptionContent}>
      <MaterialIcons name={icon} size={24} color="#666" />
      <View style={styles.settingTextContainer}>
        <Text style={styles.settingText}>{title}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
    </View>
    <View style={styles.settingOptionRight}>
      {rightText && <Text style={styles.settingRightText}>{rightText}</Text>}
      <MaterialIcons name="chevron-right" size={24} color="#CCCCCC" />
    </View>
  </TouchableOpacity>
));

const SectionHeader = memo<SectionHeaderProps>(({ title, description }) => (
  <View style={styles.sectionHeaderContainer}>
    <Text style={styles.sectionHeader}>{title}</Text>
    {description && <Text style={styles.sectionDescription}>{description}</Text>}
  </View>
));

const BDMSettings = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    notifications: {
      enabled: true,
      calls: true,
      meetings: true,
      alerts: true,
      followUps: true,
      emailNotifications: false
    },
    appearance: {
      darkMode: false,
      fontSize: 'medium',
      language: 'en'
    },
    data: {
      sync: true,
      autoSave: true,
      backupEnabled: false,
      dataRetention: 30
    },
    privacy: {
      shareData: true,
      analytics: true
    },
    calendar: {
      defaultView: 'week',
      workingHours: {
        start: '09:00',
        end: '18:00'
      },
      weekStartsOn: 1 // Monday
    }
  });

  // Load settings from Firestore on mount
  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const settingsRef = doc(db, 'user_settings', userId);
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as Settings;
        setSettings(data);
      }
      setIsLoading(false);
    }, (error) => {
      console.error('Error loading settings:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Save settings to Firestore
  const saveSettings = async (newSettings: Settings) => {
    try {
      setIsSaving(true);
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const settingsRef = doc(db, 'user_settings', userId);
      await setDoc(settingsRef, newSettings, { merge: true });
      
      // Save to local storage for offline access
      await AsyncStorage.setItem('bdm_settings', JSON.stringify(newSettings));
      
      // Update notification permissions if needed
      if (newSettings.notifications.enabled !== settings.notifications.enabled) {
        await updateNotificationPermissions(newSettings.notifications.enabled);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Update notification permissions
  const updateNotificationPermissions = async (enabled: boolean) => {
    if (enabled) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in your device settings to receive updates.'
        );
      }
    }
  };

  // Optimized state updates with type safety
  const updateSetting = useCallback(<T extends keyof Settings>(
    category: T,
    key: keyof Settings[T],
    value: any
  ) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value
        }
      };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const handleClearCache = useCallback(async () => {
    Alert.alert(
      "Clear Cache",
      "Are you sure you want to clear the application cache? This will remove all temporary data.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear Cache",
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSaving(true);
              await AsyncStorage.clear();
              Alert.alert("Success", "Cache cleared successfully");
            } catch (error) {
              console.error('Error clearing cache:', error);
              Alert.alert("Error", "Failed to clear cache");
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  }, []);

  const handleBackup = useCallback(() => {
    Alert.alert(
      "Backup Data",
      "Do you want to backup all your data to the cloud?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Backup",
          onPress: async () => {
            try {
              setIsSaving(true);
              // Implement backup logic here
              updateSetting('data', 'backupEnabled', true);
              Alert.alert("Success", "Data backed up successfully");
            } catch (error) {
              console.error('Error backing up data:', error);
              Alert.alert("Error", "Failed to backup data");
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  }, []);

  const handleLanguageChange = useCallback(() => {
    // Implement language selection modal/screen
    navigation.navigate('LanguageSettings' as never);
  }, []);

  if (isLoading) {
    return (
      <AppGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF8447" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </AppGradient>
    );
  }

  return (
    <AppGradient>
      <BDMMainLayout 
        title="Settings" 
        showBackButton 
        showDrawer={true}
        showBottomTabs={true}
      >
        <ScrollView style={styles.container}>
          {isSaving && (
            <View style={styles.savingOverlay}>
              <ActivityIndicator size="small" color="#FF8447" />
              <Text style={styles.savingText}>Saving changes...</Text>
            </View>
          )}

          {/* Notifications Section */}
          <SectionHeader 
            title="Notifications" 
            description="Manage how you want to be notified about important updates"
          />
          <View style={styles.card}>
            <SettingSwitch
              title="Enable Notifications"
              description="Receive push notifications for important updates"
              value={settings.notifications.enabled}
              onValueChange={(value) => updateSetting('notifications', 'enabled', value)}
            />
            <SettingSwitch
              title="Call Notifications"
              description="Get notified about upcoming calls"
              value={settings.notifications.calls}
              onValueChange={(value) => updateSetting('notifications', 'calls', value)}
              disabled={!settings.notifications.enabled}
            />
            <SettingSwitch
              title="Meeting Reminders"
              description="Receive reminders before scheduled meetings"
              value={settings.notifications.meetings}
              onValueChange={(value) => updateSetting('notifications', 'meetings', value)}
              disabled={!settings.notifications.enabled}
            />
            <SettingSwitch
              title="Follow-up Alerts"
              description="Get notified about follow-up tasks"
              value={settings.notifications.followUps}
              onValueChange={(value) => updateSetting('notifications', 'followUps', value)}
              disabled={!settings.notifications.enabled}
            />
            <SettingSwitch
              title="Email Notifications"
              description="Receive important updates via email"
              value={settings.notifications.emailNotifications}
              onValueChange={(value) => updateSetting('notifications', 'emailNotifications', value)}
              disabled={!settings.notifications.enabled}
            />
          </View>
          
          {/* Appearance Section */}
          <SectionHeader 
            title="Appearance" 
            description="Customize how the app looks"
          />
          <View style={styles.card}>
            <SettingSwitch
              title="Dark Mode"
              description="Use dark theme throughout the app"
              value={settings.appearance.darkMode}
              onValueChange={(value) => updateSetting('appearance', 'darkMode', value)}
            />
            <SettingOption 
              title="Language"
              description="Choose your preferred language"
              icon="language"
              onPress={handleLanguageChange}
              rightText={settings.appearance.language.toUpperCase()}
            />
          </View>
          
          {/* Calendar Settings */}
          <SectionHeader 
            title="Calendar Settings" 
            description="Customize your calendar preferences"
          />
          <View style={styles.card}>
            <SettingOption
              title="Default View"
              description="Choose your preferred calendar view"
              icon="calendar-today"
              onPress={() => {
                // Implement view selection
              }}
              rightText={settings.calendar.defaultView}
            />
            <SettingOption
              title="Working Hours"
              description="Set your working hours"
              icon="access-time"
              onPress={() => {
                // Implement working hours selection
              }}
              rightText={`${settings.calendar.workingHours.start} - ${settings.calendar.workingHours.end}`}
            />
          </View>
          
          {/* Data & Storage */}
          <SectionHeader 
            title="Data & Storage" 
            description="Manage your data and storage preferences"
          />
          <View style={styles.card}>
            <SettingSwitch
              title="Auto-Sync Data"
              description="Automatically sync data with cloud"
              value={settings.data.sync}
              onValueChange={(value) => updateSetting('data', 'sync', value)}
            />
            <SettingSwitch
              title="Auto-Save"
              description="Automatically save changes"
              value={settings.data.autoSave}
              onValueChange={(value) => updateSetting('data', 'autoSave', value)}
            />
            <SettingOption 
              title="Backup Data" 
              description="Backup your data to the cloud"
              icon="backup"
              onPress={handleBackup}
              rightText={settings.data.backupEnabled ? 'Enabled' : 'Disabled'}
            />
            <SettingOption 
              title="Clear Cache" 
              description="Clear temporary data"
              icon="delete"
              onPress={handleClearCache}
            />
          </View>
          
          {/* Privacy */}
          <SectionHeader 
            title="Privacy" 
            description="Manage your privacy settings"
          />
          <View style={styles.card}>
            <SettingSwitch
              title="Share Usage Data"
              description="Help us improve by sharing anonymous usage data"
              value={settings.privacy.shareData}
              onValueChange={(value) => updateSetting('privacy', 'shareData', value)}
            />
            <SettingSwitch
              title="Analytics"
              description="Allow analytics to improve app performance"
              value={settings.privacy.analytics}
              onValueChange={(value) => updateSetting('privacy', 'analytics', value)}
            />
          </View>
          
          {/* Account Info */}
          <SectionHeader title="Account Info" />
          <View style={styles.card}>
            <View style={styles.accountInfo}>
              <Text style={styles.accountEmail}>{auth.currentUser?.email}</Text>
              <Text style={styles.accountType}>Business Development Manager</Text>
              <Button 
                mode="outlined" 
                onPress={() => auth.signOut()}
                style={styles.signOutButton}
                labelStyle={styles.signOutButtonText}
              >
                Sign Out
              </Button>
            </View>
          </View>
          
          {/* App Info & Help */}
          <SectionHeader title="App Info & Help" />
          <View style={styles.card}>
            <SettingOption 
              title="Contact Support"
              description="Get help with using the app"
              icon="help"
              onPress={() => Linking.openURL('mailto:support@satai.com')}
            />
            <SettingOption 
              title="Privacy Policy"
              icon="security"
              onPress={() => Linking.openURL('https://policyplanner.com/privacy-policy')}
            />
            <SettingOption 
              title="Terms of Service"
              icon="description"
              onPress={() => Linking.openURL('https://policyplanner.com/terms-of-service')}
            />
            <View style={styles.versionInfo}>
              <Text style={styles.versionText}>Version 1.0.0</Text>
            </View>
          </View>
        </ScrollView>
      </BDMMainLayout>
    </AppGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  savingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  savingText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeaderContainer: {
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionHeader: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
  },
  sectionDescription: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginTop: 4,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginLeft: 12,
  },
  settingDescription: {
    fontSize: 12,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginLeft: 12,
    marginTop: 2,
  },
  settingRightText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginRight: 8,
  },
  accountInfo: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  accountEmail: {
    fontSize: 16,
    fontFamily: 'LexendDeca_500Medium',
    color: '#333',
    marginBottom: 4,
  },
  accountType: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#666',
    marginBottom: 16,
  },
  signOutButton: {
    borderColor: '#FF8447',
    borderRadius: 8,
  },
  signOutButtonText: {
    color: '#FF8447',
    fontFamily: 'LexendDeca_500Medium',
  },
  versionInfo: {
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 12,
  },
  versionText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999',
  },
});

export default memo(BDMSettings); 