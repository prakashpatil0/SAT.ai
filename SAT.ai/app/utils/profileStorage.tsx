import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';

export const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/150';

const IMAGE_CACHE_FOLDER = `${FileSystem.cacheDirectory}images/`;

// Ensure cache directory exists
async function ensureCacheDirectory() {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_FOLDER);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_CACHE_FOLDER, { intermediates: true });
  }
}

// Generate cache key for URL
async function getCacheKey(url: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    url
  );
  return hash;
}

// Cache image to local storage
export async function cacheImage(url: string): Promise<string> {
  try {
    await ensureCacheDirectory();
    const cacheKey = await getCacheKey(url);
    const cachePath = `${IMAGE_CACHE_FOLDER}${cacheKey}`;

    const imageInfo = await FileSystem.getInfoAsync(cachePath);
    if (!imageInfo.exists) {
      await FileSystem.downloadAsync(url, cachePath);
    }

    return `file://${cachePath}`;
  } catch (error) {
    console.warn('Error caching image:', error);
    return url;
  }
}

// Preload multiple images
export async function preloadImages(urls: string[]): Promise<void> {
  try {
    const promises = urls.map(url => {
      if (url.startsWith('http')) {
        return cacheImage(url);
      }
      return Image.prefetch(url);
    });
    await Promise.all(promises);
  } catch (error) {
    console.warn('Error preloading images:', error);
  }
}

// Clear image cache
export async function clearImageCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(IMAGE_CACHE_FOLDER, { idempotent: true });
    await ensureCacheDirectory();
  } catch (error) {
    console.warn('Error clearing image cache:', error);
  }
}

// Get profile photo with caching
export async function getProfilePhoto(url: string | null): Promise<string> {
  if (!url) return DEFAULT_PROFILE_IMAGE;
  
  try {
    const cachedUrl = await cacheImage(url);
    return cachedUrl;
  } catch (error) {
    console.warn('Error getting profile photo:', error);
    return DEFAULT_PROFILE_IMAGE;
  }
} 