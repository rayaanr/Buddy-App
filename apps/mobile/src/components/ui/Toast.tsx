import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { riseIn, sinkOut } from '@/theme/motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUiStore } from '@/store/ui';
import { TAB_BAR_HEIGHT } from '@/theme';

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
          className="mx-6 rounded-[14px] bg-toast px-[18px] py-3"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 15,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
          }}
        >
          <Text className="text-center font-sans-medium text-[14.5px] text-bg">
            {toast.message}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
