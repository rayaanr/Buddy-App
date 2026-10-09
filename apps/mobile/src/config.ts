import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 7400;

/**
 * Where the API lives.
 *
 * Set EXPO_PUBLIC_API_URL for builds (e.g. https://api.yourdomain.com). In
 * development it falls back to the machine running the Expo dev server, so a
 * phone on the same Wi-Fi reaches the API without any configuration.
 */
function resolveApiUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  // e.g. "192.168.1.20:7481" → the dev machine's address on the local network.
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${devHost ?? 'localhost'}:${API_PORT}`;
}

export const API_URL = resolveApiUrl();
export const APP_SCHEME = 'buddy';

/**
 * Base for shared links (the API serves the preview page at /a/:id). Set
 * EXPO_PUBLIC_SHARE_URL if links should use a different domain, e.g. buddy.lk.
 */
export const SHARE_URL = (process.env.EXPO_PUBLIC_SHARE_URL ?? API_URL).replace(/\/$/, '');
