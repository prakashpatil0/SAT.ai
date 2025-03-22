import React, { useState, useCallback, memo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Switch } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import BDMMainLayout from '@/app/components/BDMMainLayout';
import AppGradient from '@/app/components/AppGradient';
import { auth } from '@/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define types for settings
interface Settings {
  notifications: {
    enabled: boolean;
    calls: boolean;
    meetings: boolean;
    alerts: boolean;
  };
  appearance: {
    darkMode: boolean;
  };
  data: {
    sync: boolean;
    autoSave: boolean;
  };
}

// Define types for component props
interface SettingSwitchProps {
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

interface SettingOptionProps {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
}

interface SectionHeaderProps {
  title: string;
}

// Memoized components
const SettingSwitch = memo<SettingSwitchProps>(({ title, value, onValueChange }) => (
  <View style={styles.settingItem}>
    <Text style={styles.settingText}>{title}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      color="#FF8447"
    />
  </View>
));

const SettingOption = memo<SettingOptionProps>(({ title, icon, onPress }) => (
  <TouchableOpacity style={styles.settingOption} onPress={onPress}>
    <View style={styles.settingOptionContent}>
      <MaterialIcons name={icon} size={24} color="#666" />
      <Text style={styles.settingText}>{title}</Text>
    </View>
    <MaterialIcons name="chevron-right" size={24} color="#CCCCCC" />
  </TouchableOpacity>
));

const SectionHeader = memo<SectionHeaderProps>(({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
));

const BDMSettings = () => {
  const navigation = useNavigation();
  
  // Settings state with optimized state updates
  const [settings, setSettings] = useState<Settings>({
    notifications: {
      enabled: true,
      calls: true,
      meetings: true,
      alerts: true
    },
    appearance: {
      darkMode: false
    },
    data: {
      sync: true,
      autoSave: true
    }
  });

  // Load settings from storage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Save settings to storage when they change
  useEffect(() => {
    saveSettings();
  }, [settings]);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('bdm_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('bdm_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Optimized state updates with type safety
  const updateSetting = useCallback(<T extends keyof Settings>(
    category: T,
    key: keyof Settings[T],
    value: boolean
  ) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
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
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert("Success", "Cache cleared successfully");
            } catch (error) {
              console.error('Error clearing cache:', error);
              Alert.alert("Error", "Failed to clear cache");
            }
          }
        }
      ]
    );
  }, []);

  const handleContactSupport = useCallback(() => {
    Linking.openURL('mailto:it@policyplanner.com?subject=Support Request');
  }, []);

  const handlePrivacyPolicy = useCallback(() => {
    Linking.openURL('https://satai.com/privacy-policy');
  }, []);

  const handleTermsOfService = useCallback(() => {
    Linking.openURL('https://satai.com/terms-of-service');
  }, []);

  return (
    <AppGradient>
      <BDMMainLayout 
        title="Settings" 
        showBackButton 
        showDrawer={true}
        showBottomTabs={true}
      >
        <ScrollView style={styles.container}>
          {/* Notifications Section */}
          <SectionHeader title="Notifications" />
          <View style={styles.card}>
            <SettingSwitch
              title="Enable Notifications"
              value={settings.notifications.enabled}
              onValueChange={(value) => updateSetting('notifications', 'enabled', value)}
            />
            <SettingSwitch
              title="Call Notifications"
              value={settings.notifications.calls}
              onValueChange={(value) => updateSetting('notifications', 'calls', value)}
            />
            <SettingSwitch
              title="Meeting Reminders"
              value={settings.notifications.meetings}
              onValueChange={(value) => updateSetting('notifications', 'meetings', value)}
            />
            <SettingSwitch
              title="Meeting Alerts"
              value={settings.notifications.alerts}
              onValueChange={(value) => updateSetting('notifications', 'alerts', value)}
            />
          </View>
          
          {/* Appearance Section */}
          <SectionHeader title="Appearance" />
          <View style={styles.card}>
            <SettingSwitch
              title="Dark Mode"
              value={settings.appearance.darkMode}
              onValueChange={(value) => updateSetting('appearance', 'darkMode', value)}
            />
          </View>
          
          {/* Data & Storage */}
          <SectionHeader title="Data & Storage" />
          <View style={styles.card}>
            <SettingSwitch
              title="Auto-Sync Data"
              value={settings.data.sync}
              onValueChange={(value) => updateSetting('data', 'sync', value)}
            />
            <SettingSwitch
              title="Auto-Save Notes"
              value={settings.data.autoSave}
              onValueChange={(value) => updateSetting('data', 'autoSave', value)}
            />
            <SettingOption title="Clear Cache" icon="delete" onPress={handleClearCache} />
          </View>
          
          {/* Account Info */}
          <SectionHeader title="Account Info" />
          <View style={styles.card}>
            <View style={styles.accountInfo}>
              <Text style={styles.accountEmail}>{auth.currentUser?.email}</Text>
              <Text style={styles.accountType}>Business Development Manager</Text>
            </View>
          </View>
          
          {/* App Info & Help */}
          <SectionHeader title="App Info & Help" />
          <View style={styles.card}>
            <SettingOption title="Contact Support" icon="help" onPress={handleContactSupport} />
            <SettingOption title="Privacy Policy" icon="security" onPress={handlePrivacyPolicy} />
            <SettingOption title="Terms of Service" icon="description" onPress={handleTermsOfService} />
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
  sectionHeader: {
    fontSize: 18,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#333',
    marginBottom: 8,
    marginLeft: 4,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
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
  },
  settingText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_400Regular',
    color: '#333',
    marginLeft: 12,
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
  },
  versionInfo: {
    alignItems: 'center',
    paddingTop: 12,
  },
  versionText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: '#999',
  },
});

export default memo(BDMSettings); 