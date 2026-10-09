import '../global.css';

import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import {
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
} from '@expo-google-fonts/schibsted-grotesk';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { authClient } from '@/api/auth-client';
import { ApiRequestError } from '@/api/client';
import { queryClient, signOut, useMe } from '@/api/queries';
import { ToastHost } from '@/components/ui';
import { useHydrated } from '@/hooks/useHydrated';
import { useAccountStore } from '@/store/account';
import { useUiStore } from '@/store/ui';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    primary: colors.lime,
    text: colors.ink,
    border: colors.line,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_800ExtraBold,
  });
  const hydrated = useHydrated();
  if (!(fontsLoaded || fontError) || !hydrated) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaProvider>
          <ThemeProvider value={navTheme}>
            <StatusBar style="light" />
            <View style={{ flex: 1 }}>
              <RootNavigator />
              <ToastHost />
            </View>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

/** Routes by real auth state: signed out → sign-in/up, no interests yet → onboarding, else the app. */
function RootNavigator() {
  const session = authClient.useSession();
  const signedIn = !!session.data;
  const me = useMe(signedIn);
  const remembered = useAccountStore((s) => !!s.remembered);

  // An expired session shows up as a 401 from the API: treat it as signed out.
  useEffect(() => {
    if (me.error instanceof ApiRequestError && me.error.status === 401) void signOut();
  }, [me.error]);

  // Returning users who open the app already signed in get the "Picked for you"
  // deck, unless a link opened it somewhere specific (e.g. a chat).
  const pathname = usePathname();
  const launchedAt = useRef(pathname);
  const launchedSignedIn = useRef<boolean | null>(null);
  useEffect(() => {
    if (launchedSignedIn.current === null && !session.isPending) {
      launchedSignedIn.current = signedIn;
    }
  }, [session.isPending, signedIn]);
  const onboarded = me.data?.onboarded ?? false;
  const picksRequested = useRef(false);
  useEffect(() => {
    if (
      launchedSignedIn.current &&
      launchedAt.current === '/' &&
      onboarded &&
      !picksRequested.current
    ) {
      picksRequested.current = true;
      useUiStore.getState().requestPicks();
    }
  }, [onboarded]);

  const loading = session.isPending || (signedIn && !me.data && !me.error);
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);
  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  // With a remembered account, signing in comes first; otherwise signing up.
  const authScreens = remembered
    ? [<Stack.Screen key="sign-in" name="sign-in" />, <Stack.Screen key="sign-up" name="sign-up" />]
    : [
        <Stack.Screen key="sign-up" name="sign-up" />,
        <Stack.Screen key="sign-in" name="sign-in" />,
      ];

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'fade',
      }}
    >
      <Stack.Protected guard={!signedIn}>
        {authScreens}
        <Stack.Screen name="verify" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
