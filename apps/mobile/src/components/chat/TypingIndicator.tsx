import { useEffect } from 'react';
import { Text, View } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedView } from '@/components/ui';
import { fadeOut, enterMessage } from '@/theme/motion';

const DOTS = 3;
const STEP_MS = 160;

/** "Kavindu is typing" with three dots bouncing in turn. */
export function TypingIndicator({ name }: { name: string }) {
  return (
    <AnimatedView
      entering={enterMessage}
      exiting={fadeOut}
      className="mt-1.5 flex-row items-center gap-2 self-start rounded-2xl bg-surface px-3.5 py-2.5"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${name} is typing`}
    >
      <Text className="font-sans text-[13.5px] text-muted">{name} is typing</Text>
      <View className="flex-row items-center gap-[3px] pt-1">
        {Array.from({ length: DOTS }, (_, i) => (
          <Dot key={i} index={i} />
        ))}
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
  return <AnimatedView className="h-[5px] w-[5px] rounded-full bg-muted" style={style} />;
}
