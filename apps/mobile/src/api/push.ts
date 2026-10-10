import { UUID_RE } from '@buddy/shared';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
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
let askedThisSession = false;

const projectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

/** Real phones with an EAS project only: simulators and web can't get a token. */
const canPush = () => Platform.OS !== 'web' && Device.isDevice && !!projectId();

async function register() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Group chats',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders and changes',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  await unwrap(api.me['push-tokens'].$post({ json: { token } }));
  registeredToken = token;
}

/**
 * Registers this device's push token if notifications are already allowed.
 * Never prompts: run on every launch so the server has the current token.
 */
export async function syncPushToken() {
  try {
    if (!canPush() || !(await Notifications.getPermissionsAsync()).granted) return;
    await register();
  } catch {
    // Notifications are a nice-to-have; never block the app on them.
  }
}

/**
 * Asks for notification permission at a moment it makes sense (just joined,
 * hosted or messaged, so reminders and replies are wanted), not at launch.
 * Asks at most once per session, and never again once someone said no.
 */
export async function askForPush() {
  if (askedThisSession || registeredToken) return;
  askedThisSession = true;
  try {
    if (!canPush()) return;
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted && !current.canAskAgain) return;
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (granted) await register();
  } catch {
    // As above.
  }
}

/** Stops this device receiving the signed-out account's notifications. */
export async function unregisterPush() {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await unwrap(api.me['push-tokens'].$delete({ json: { token } })).catch(() => {});
}

/**
 * Tapping a notification opens what it's about: the group chat, or the
 * activity page (time changes, cancellations). Covers taps that launched the
 * app as well as ones while it was running.
 */
export function useOpenFromNotifications() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as
        { activityId?: string; screen?: string } | undefined;
      // Only ever from our own server, but it becomes a route: accept only an id.
      if (!data?.activityId || !UUID_RE.test(data.activityId)) return;
      Notifications.clearLastNotificationResponse();
      router.push(
        data.screen === 'chat'
          ? `/activity/${data.activityId}/chat`
          : `/activity/${data.activityId}`,
      );
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
