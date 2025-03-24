import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage Keys as string literals
export const STORAGE_KEYS = {
  BDM_HOME: {
    CALL_LOGS: 'bdm_device_call_logs' as const,
    CALL_LOGS_LAST_UPDATE: 'bdm_call_logs_last_update' as const,
    WEEKLY_ACHIEVEMENT: 'bdm_weekly_achievement' as const,
    CONTACTS: 'bdm_contacts' as const,
    USER_PROFILE: 'bdm_user_profile' as const
  },
  BDM_REPORT: {
    DRAFT_REPORT: 'bdm_draft_report' as const,
    RECENT_REPORTS: 'bdm_recent_reports' as const,
    REPORT_TEMPLATES: 'bdm_report_templates' as const
  }
};

// Cache expiry times
export const CACHE_EXPIRY = {
  CALL_LOGS: 5 * 60 * 1000, // 5 minutes
  WEEKLY_ACHIEVEMENT: 24 * 60 * 60 * 1000, // 24 hours
  CONTACTS: 12 * 60 * 60 * 1000, // 12 hours
  REPORTS: 30 * 60 * 1000 // 30 minutes
};

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

export interface StorageKeyMap {
  'bdm_device_call_logs': any[];
  'bdm_contacts': Record<string, any>;
  'bdm_weekly_achievement': {
    progress: number;
    progressText: string;
  };
}

type StorageKey = keyof StorageKeyMap;

export async function setStorageItem<K extends StorageKey>(
  key: K,
  data: StorageKeyMap[K],
  expiry?: number
): Promise<void> {
  try {
    const item: CacheItem<StorageKeyMap[K]> = {
      data,
      timestamp: Date.now()
    };
    await AsyncStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.error(`Error storing ${key}:`, error);
  }
}

export async function getStorageItem<K extends StorageKey>(
  key: K,
  expiryTime?: number
): Promise<StorageKeyMap[K] | null> {
  try {
    const item = await AsyncStorage.getItem(key);
    if (!item) return null;

    const parsedItem: CacheItem<StorageKeyMap[K]> = JSON.parse(item);
    
    if (expiryTime && Date.now() - parsedItem.timestamp > expiryTime) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return parsedItem.data;
  } catch (error) {
    console.error(`Error retrieving ${key}:`, error);
    return null;
  }
}

export async function batchGetItems<K extends StorageKey>(
  keys: K[],
  expiryTime?: number
): Promise<{ [P in K]: StorageKeyMap[P] | null }> {
  try {
    const items = await AsyncStorage.multiGet(keys);
    const result = {} as { [P in K]: StorageKeyMap[P] | null };
    
    items.forEach(([key, value]) => {
      if (!value) {
        result[key as K] = null;
        return;
      }

      const parsedItem: CacheItem<StorageKeyMap[K]> = JSON.parse(value);
      
      if (expiryTime && Date.now() - parsedItem.timestamp > expiryTime) {
        result[key as K] = null;
        AsyncStorage.removeItem(key);
        return;
      }

      result[key as K] = parsedItem.data;
    });

    return result;
  } catch (error) {
    console.error('Error in batch get:', error);
    return {} as { [P in K]: StorageKeyMap[P] | null };
  }
}

export async function removeStorageItem(key: StorageKey): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing ${key}:`, error);
  }
}

export async function clearStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
}

export async function batchSetItems<K extends StorageKey>(
  items: { key: K; data: StorageKeyMap[K] }[]
): Promise<void> {
  try {
    const pairs: [string, string][] = items.map(({ key, data }) => [
      key,
      JSON.stringify({
        data,
        timestamp: Date.now()
      })
    ]);
    await AsyncStorage.multiSet(pairs);
  } catch (error) {
    console.error('Error in batch set:', error);
  }
} 