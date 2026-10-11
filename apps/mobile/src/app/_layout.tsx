import '../global.css';

import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import {
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
} from '@expo-google-fonts/schibsted-grotesk';
import { PortalHost } from '@rn-primitives/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { authClient } from '@/api/auth-client';
import { connectQueriesToApp } from '@/api/lifecycle';
import { queryClient, useMe } from '@/api/queries';
import { ToastHost } from '@/components/ui';
import { useHydrated } from '@/hooks/useHydrated';
import { activityPathFrom } from '@/lib/pendingLink';
import { useAccountStore } from '@/store/account';
import { useUiStore } from '@/store/ui';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();
connectQueriesToApp();

/** The launch link is only ever remembered once (not again after signing out). */
let initialLinkSeen = false;

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
        {/* Edge-to-edge on Android: the app draws under both system bars. */}
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
          <SafeAreaProvider>
            <ThemeProvider value={navTheme}>
              <StatusBar style="light" />
              <View style={{ flex: 1 }}>
                <RootNavigator />
                <ToastHost />
                {/* Popover menus draw here, above every screen. */}
                <PortalHost />
              </View>
            </ThemeProvider>
          </SafeAreaProvider>
        </KeyboardProvider>
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

  // A link to an activity that opened the app before you could see it (signed
  // out, or still onboarding) opens once you're in (see the app layout).
  const loading = session.isPending || (signedIn && !me.data && !me.error);
  const ready = signedIn && onboarded;
  useEffect(() => {
    // Wait for the session: until then everyone looks signed out.
    if (ready || loading) return;
    const remember = (url: string | null) => {
      const path = activityPathFrom(url);
      if (path) useUiStore.getState().rememberLink(path);
    };
    if (!initialLinkSeen) {
      initialLinkSeen = true;
      void Linking.getInitialURL().then(remember);
    }
    const sub = Linking.addEventListener('url', (e) => remember(e.url));
    return () => sub.remove();
  }, [ready, loading]);

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);
  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  // With a remembered account, "Good to see you" comes first; otherwise Get started.
  const first = remembered ? 'sign-in' : 'welcome';
  const authScreens = [first, ...['welcome', 'sign-up', 'sign-in'].filter((n) => n !== first)].map(
    (name) => (
      <Stack.Screen
        key={name}
        name={name}
        options={name === first ? undefined : { animation: 'slide_from_right' }}
      />
    ),
  );

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
