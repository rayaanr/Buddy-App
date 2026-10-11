import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { syncPushToken, useOpenFromNotifications } from '@/api/push';
import { useMe, usePicks } from '@/api/queries';
import { useAccountStore } from '@/store/account';
import { useUiStore } from '@/store/ui';
import { colors } from '@/theme';
import { useScreenAnimation } from '@/theme/motion';

const PREVIEW_CARDS = 3;

export default function AppLayout() {
  const me = useMe();
  const picks = usePicks();
  const picksPending = useUiStore((s) => s.picksPending);

  // A link that arrived before sign-in opens now (and skips the picks deck).
  useEffect(() => {
    const link = useUiStore.getState().consumeLink();
    if (!link) return;
    useUiStore.getState().consumePicks();
    requestAnimationFrame(() => router.push(link));
  }, []);

  // Returning users land on Discover with the "Picked for you" deck on top.
  // If picks fail to load, drop the request: a later refetch must not pop the
  // deck up over whatever screen they're on by then.
  useEffect(() => {
    if (!picksPending) return;
    if (picks.error) {
      useUiStore.getState().consumePicks();
      return;
    }
    if (!picks.data) return;
    if (!useUiStore.getState().consumePicks() || picks.data.length === 0) return;
    requestAnimationFrame(() => router.push('/picks'));
  }, [picksPending, picks.data, picks.error]);

  // Keep what the signed-out "Good to see you" screen needs.
  useEffect(() => {
    if (!me.data) return;
    useAccountStore
      .getState()
      .remember({ email: me.data.email, name: me.data.name, area: me.data.area });
  }, [me.data]);
  useEffect(() => {
    if (!picks.data) return;
    useAccountStore.getState().rememberPicks({
      count: picks.data.length,
      cards: picks.data.slice(0, PREVIEW_CARDS).map(({ activity: a }) => ({
        coverUrl: a.coverUrl,
        group: a.group,
        title: a.title,
        startsAt: a.startsAt,
      })),
    });
  }, [picks.data]);

  // Only refreshes the token if allowed; the permission prompt waits for a
  // first join, hosted activity or message (see askForPush).
  useEffect(() => {
    void syncPushToken();
  }, []);
  useOpenFromNotifications();
  const slide = useScreenAnimation();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: slide('slide_from_right'),
        // The back swipe drags the screen along with the finger.
        animationMatchesGesture: true,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen
        name="create"
        options={{ animation: slide('slide_from_bottom'), gestureDirection: 'vertical' }}
      />
      <Stack.Screen
        name="activity/[id]/edit"
        options={{ animation: slide('slide_from_bottom'), gestureDirection: 'vertical' }}
      />
      <Stack.Screen
        name="picks"
        options={{ animation: slide('slide_from_bottom'), gestureEnabled: false }}
      />
      <Stack.Screen name="map" options={{ animation: 'fade' }} />
      <Stack.Screen
        name="report"
        options={{ animation: slide('slide_from_bottom'), gestureDirection: 'vertical' }}
      />
      <Stack.Screen
        name="new-poll"
        options={{ animation: slide('slide_from_bottom'), gestureDirection: 'vertical' }}
      />
      <Stack.Screen
        name="activity/[id]/roll-call"
        options={{ animation: slide('slide_from_bottom'), gestureDirection: 'vertical' }}
      />
      <Stack.Screen
        name="activity/[id]/invite"
        options={{ animation: slide('slide_from_bottom'), gestureDirection: 'vertical' }}
      />
    </Stack>
  );
}
