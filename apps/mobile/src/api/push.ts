import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api, unwrap } from './client';

/** Show chat notifications even while the app is open (on other screens). */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

/**
 * Asks for notification permission and registers this device's Expo push
 * token with the API. Quietly does nothing on simulators, on web, when
 * permission is denied, or before the app has an EAS project ID.
 */
export async function registerForPush() {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('chat', {
        name: 'Group chats',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await unwrap(api.me['push-tokens'].$post({ json: { token } }));
    registeredToken = token;
  } catch {
    // Notifications are a nice-to-have; never block sign-in on them.
  }
}

/** Stops this device receiving the signed-out account's notifications. */
export async function unregisterPush() {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await unwrap(api.me['push-tokens'].$delete({ json: { token } })).catch(() => {});
}
