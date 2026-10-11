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
  // A release build guessing "the dev machine" would ship pointing at localhost.
  if (!__DEV__)
    throw new Error('EXPO_PUBLIC_API_URL must be set for release builds (see infra/README.md).');

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

/** Public pages the stores require the app to link to (served by the API). */
export const PRIVACY_URL = `${API_URL}/privacy`;
export const TERMS_URL = `${API_URL}/terms`;

/**
 * Map tiles for meeting-point previews: any {z}/{x}/{y} raster tile URL.
 * CARTO's Voyager basemap (OpenStreetMap data): light, with streets, names,
 * parks and water, so a place is easy to find. CARTO now
 * needs an API key (`?key=…`; free up to 1M tiles a month for commercial
 * use) or every tile reads "API key required". Set EXPO_PUBLIC_MAP_TILES to
 * the keyed URL: on EAS for builds, in apps/mobile/.env.local for local runs.
 * Another source works too, with EXPO_PUBLIC_MAP_ATTRIBUTION as its credit.
 */
export const MAP_TILES =
  process.env.EXPO_PUBLIC_MAP_TILES ??
  'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png';
/** Shown under tiles still loading: close to Voyager's land colour. */
export const MAP_BACKGROUND = '#EDEBE6';
/** Laid over the tiles, under the pins: dims the light map to sit in the dark UI. */
export const MAP_SHADE = 'rgba(0, 0, 0, 0.22)';
export const MAP_ATTRIBUTION =
  process.env.EXPO_PUBLIC_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors © CARTO';
