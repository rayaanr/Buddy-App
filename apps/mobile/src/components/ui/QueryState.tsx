import {
  ActivityIndicator,
  RefreshControl,
  Text,
  View,
  type RefreshControlProps,
} from 'react-native';

import { errorMessage } from '@/api/client';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';
import { Button } from './Button';

/** Centered spinner for a screen or section that's loading for the first time. */
export function Loading({ className }: { className?: string }) {
  return (
    <View
      className={cn('items-center justify-center py-16', className)}
      accessibilityLabel="Loading"
    >
      <ActivityIndicator color={colors.lime} />
    </View>
  );
}

/** A failed request, with the API's message and a retry. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <View className="items-center rounded-[20px] bg-surface px-5 py-10">
      <Text className="font-sans-semibold text-[17px] text-ink">Couldn’t load this</Text>
      <Text className="mt-1.5 text-center font-sans text-[14px] leading-5 text-muted">
        {errorMessage(error)}
      </Text>
      <Button label="Try again" size="sm" variant="outline" onPress={onRetry} className="mt-4" />
    </View>
  );
}

/**
 * Lime pull-to-refresh. Forwards every prop: on Android and web, ScrollView
 * clones its refresh control and passes the scroll view in as `children`
 * (plus `style`), so dropping them renders a blank screen.
 */
export function Refresh(props: RefreshControlProps) {
  return (
    <RefreshControl
      tintColor={colors.lime}
      colors={[colors.lime]}
      progressBackgroundColor={colors.surface}
      {...props}
    />
  );
}
