import { UUID_RE } from '@buddy/shared';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { api, unwrap } from './client';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Push needs a native build: web has none, and Expo Go on Android throws as
 * soon as expo-notifications is imported (removed in SDK 53). This module is
 * imported by most screens, so it must never load expo-notifications up front.
 */
const supported = Platform.OS !== 'web' && !(Platform.OS === 'android' && isRunningInExpoGo());

let loaded: Promise<NotificationsModule | null> | null = null;

/** expo-notifications, loaded on first use (null where push isn't supported). */
function notifications() {
  loaded ??= supported
    ? import('expo-notifications')
        .then((Notifications) => {
          // Show chat notifications even while the app is open (on other screens).
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
            }),
          });
          return Notifications;
        })
        .catch(() => null)
    : Promise.resolve(null);
  return loaded;
}

let registeredToken: string | null = null;
let askedThisSession = false;

const projectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

/** Real phones with an EAS project only: simulators can't get a token. */
const canPush = () => supported && Device.isDevice && !!projectId();

async function register(Notifications: NotificationsModule) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Group chats',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders and changes',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('communities', {
      name: 'New in your communities',
      importance: Notifications.AndroidImportance.DEFAULT,
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
    if (!canPush()) return;
    const Notifications = await notifications();
    if (!Notifications || !(await Notifications.getPermissionsAsync()).granted) return;
    await register(Notifications);
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
    const Notifications = await notifications();
    if (!Notifications) return;
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted && !current.canAskAgain) return;
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (granted) await register(Notifications);
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
    if (!supported) return;
    let cancelled = false;
    let remove: (() => void) | undefined;
    void notifications().then((Notifications) => {
      if (!Notifications || cancelled) return;
      const open = (response: import('expo-notifications').NotificationResponse | null) => {
        const data = response?.notification.request.content.data as
          { activityId?: string; communityId?: string; screen?: string } | undefined;
        // Only ever from our own server, but it becomes a route: accept only an id.
        const id = data?.activityId ?? data?.communityId;
        if (!id || !UUID_RE.test(id)) return;
        Notifications.clearLastNotificationResponse();
        const chat = data!.screen === 'chat';
        if (data!.activityId) router.push(chat ? `/activity/${id}/chat` : `/activity/${id}`);
        else router.push(chat ? `/community/${id}/chat` : `/community/${id}`);
      };
      open(Notifications.getLastNotificationResponse());
      const sub = Notifications.addNotificationResponseReceivedListener(open);
      remove = () => sub.remove();
    });
    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);
}
