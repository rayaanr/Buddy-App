import { expoClient } from '@better-auth/expo/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { API_URL, APP_SCHEME } from '@/config';

/**
 * Email one-time-code auth. On iOS/Android the session cookie is kept in the
 * Keychain/Keystore via SecureStore; on web the browser stores it.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({ scheme: APP_SCHEME, storagePrefix: 'buddy', storage: SecureStore }),
    emailOTPClient(),
  ],
  fetchOptions: Platform.OS === 'web' ? { credentials: 'include' } : undefined,
});

/** Cookie header for our own API requests and the chat socket (native only). */
export async function sessionCookie(): Promise<string | undefined> {
  if (Platform.OS === 'web') return undefined;
  const cookie = await authClient.getCookie();
  return cookie || undefined;
}
