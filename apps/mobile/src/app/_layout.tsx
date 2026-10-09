import '../global.css';

import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import {
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
} from '@expo-google-fonts/schibsted-grotesk';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ui';
import { useHydrated } from '@/hooks/useHydrated';
import { useSessionStore } from '@/store/session';
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
  const ready = (fontsLoaded || !!fontError) && hydrated;

  const account = useSessionStore((s) => s.account);
  const onboarded = useSessionStore((s) => s.onboarded);
  const signedIn = useSessionStore((s) => s.signedIn);

  // A returning, signed-in user gets the "Picked for you" deck on cold start.
  const checkedLaunch = useRef(false);
  useEffect(() => {
    if (!hydrated || checkedLaunch.current) return;
    checkedLaunch.current = true;
    const s = useSessionStore.getState();
    if (s.signedIn && s.onboarded) useUiStore.getState().requestPicks();
  }, [hydrated]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const inApp = !!account && onboarded && signedIn;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" />
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'fade',
              }}
            >
              <Stack.Protected guard={!account}>
                <Stack.Screen name="sign-up" />
              </Stack.Protected>
              <Stack.Protected guard={!!account && !onboarded}>
                <Stack.Screen name="onboarding" />
              </Stack.Protected>
              <Stack.Protected guard={!!account && onboarded && !signedIn}>
                <Stack.Screen name="sign-in" />
              </Stack.Protected>
              <Stack.Protected guard={inApp}>
                <Stack.Screen name="(app)" />
              </Stack.Protected>
            </Stack>
            <ToastHost />
          </View>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
