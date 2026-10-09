import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { buildDeck } from '@/lib/activity';
import { useActivitiesStore } from '@/store/activities';
import { useSessionStore } from '@/store/session';
import { useUiStore } from '@/store/ui';
import { colors } from '@/theme';

export default function AppLayout() {
  const picksPending = useUiStore((s) => s.picksPending);

  // Returning users land on Discover with the "Picked for you" deck on top.
  useEffect(() => {
    if (!picksPending || !useUiStore.getState().consumePicks()) return;
    const { activities, communities } = useActivitiesStore.getState();
    if (buildDeck(activities, useSessionStore.getState().interests, communities).length === 0)
      return;
    requestAnimationFrame(() => router.push('/picks'));
  }, [picksPending]);

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
      <Stack.Screen
        name="edit-profile"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack>
  );
}
