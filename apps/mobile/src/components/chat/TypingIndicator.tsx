import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedView } from '@/components/ui';
import { colors } from '@/theme';
import { fadeOut, enterMessage } from '@/theme/motion';

const DOTS = 3;
const STEP_MS = 160;

/** "Kavindu is typing" with three dots bouncing in turn. */
export function TypingIndicator({ name }: { name: string }) {
  return (
    <AnimatedView entering={enterMessage} exiting={fadeOut} style={styles.wrap}>
      <View
        className="flex-row items-center gap-2 rounded-2xl bg-surface px-3.5 py-2.5"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${name} is typing`}
      >
        <Text className="font-sans text-[13.5px] text-muted">{name} is typing</Text>
        <View className="flex-row items-center gap-[3px] pt-1">
          {Array.from({ length: DOTS }, (_, i) => (
            <Dot key={i} index={i} />
          ))}
        </View>
      </View>
    </AnimatedView>
  );
}

function Dot({ index }: { index: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.set(
      withDelay(
        index * STEP_MS,
        withRepeat(
          withSequence(
            withTiming(-3, { duration: STEP_MS * 1.5 }),
            withTiming(0, { duration: STEP_MS * 1.5 }),
            withTiming(0, { duration: STEP_MS * (DOTS - 1) }),
          ),
          -1,
        ),
      ),
    );
  }, [index, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <AnimatedView style={[styles.dot, style]} />;
}

// Style objects, not classes: NativeWind doesn't style Reanimated views.
const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', marginTop: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.muted },
});
