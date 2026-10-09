import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { registerForPush } from '@/api/push';
import { useMe, usePicks } from '@/api/queries';
import { useAccountStore } from '@/store/account';
import { useUiStore } from '@/store/ui';
import { colors } from '@/theme';

const PREVIEW_CARDS = 3;

export default function AppLayout() {
  const me = useMe();
  const picks = usePicks();
  const picksPending = useUiStore((s) => s.picksPending);

  // Returning users land on Discover with the "Picked for you" deck on top.
  useEffect(() => {
    if (!picksPending || !picks.data) return;
    if (!useUiStore.getState().consumePicks() || picks.data.length === 0) return;
    requestAnimationFrame(() => router.push('/picks'));
  }, [picksPending, picks.data]);

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

  useEffect(() => {
    void registerForPush();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen
        name="create"
        options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }}
      />
      <Stack.Screen
        name="picks"
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen name="interests" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="report" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
