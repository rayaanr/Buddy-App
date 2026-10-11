import { useMutation } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { signInWithGoogle } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { PressableScale } from '@/components/ui';
import { CONTROL_FONT_SCALE } from '@/theme';

/** Google's "G", in its own colours as their brand guidelines ask. */
function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <Path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </Svg>
  );
}

/**
 * "Continue with Google", then an "or" rule above the email field. Signing in
 * updates the session, and the root navigator takes it from there.
 */
export function GoogleSignIn({ className }: { className?: string }) {
  const google = useMutation({ mutationFn: signInWithGoogle });
  return (
    <View className={className}>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ disabled: google.isPending }}
        haptic="light"
        disabled={google.isPending}
        onPress={() => google.mutate()}
        className="h-[52px] flex-row items-center justify-center gap-2.5 rounded-2xl border border-outline"
      >
        <GoogleG />
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          className="font-sans-semibold text-body text-ink"
        >
          {google.isPending ? 'Opening Google…' : 'Continue with Google'}
        </Text>
      </PressableScale>
      {google.error ? (
        <Text className="mt-2 font-sans text-label text-danger">{errorMessage(google.error)}</Text>
      ) : null}
      <View className="mt-6 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-outline" />
        <Text className="font-sans text-footnote text-subtle">or use your email</Text>
        <View className="h-px flex-1 bg-outline" />
      </View>
    </View>
  );
}
