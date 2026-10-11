import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { riseIn, sinkOut } from '@/theme/motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUiStore } from '@/store/ui';
import { TAB_BAR_HEIGHT, shadows } from '@/theme';

/** Global toast, rendered once at the root above every screen. */
export function ToastHost() {
  const toast = useUiStore((s) => s.toast);
  const insets = useSafeAreaInsets();
  if (!toast) return null;

  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 items-center"
      style={{ bottom: insets.bottom + TAB_BAR_HEIGHT + 12 }}
    >
      {/* Reanimated views carry the motion only; NativeWind classes go on plain Views. */}
      <Animated.View key={toast.id} entering={riseIn} exiting={sinkOut}>
        <View
          accessibilityLiveRegion="polite"
          className="mx-6 rounded-tile bg-toast px-[18px] py-3"
          style={{
            boxShadow: shadows.raised,
          }}
        >
          <Text className="text-center font-sans-medium text-subhead text-bg">{toast.message}</Text>
        </View>
      </Animated.View>
    </View>
  );
}
