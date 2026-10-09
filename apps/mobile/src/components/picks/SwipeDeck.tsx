import * as Haptics from 'expo-haptics';
import { useLayoutEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { CheckIcon, CloseIcon, Eyebrow, Photo, Scrim } from '@/components/ui';
import { availabilityColor, spotsLabel, whenLong } from '@/lib/activity';
import { colors, EASE_OUT } from '@/theme';
import type { Activity } from '@/types/models';

/** Drag distance past which a release counts as a decision. */
const THRESHOLD = 100;
/** Distance over which the back card grows to full size. */
const REVEAL = 120;
const FLY_OUT = 600;
const ease = Easing.bezier(...EASE_OUT);

const haptic = (like: boolean) => {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(
    like ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
  );
};

interface SwipeDeckProps {
  top: Activity;
  next?: Activity;
  reason: string;
  /** Changes whenever the top card changes; resets the drag position. */
  index: number;
  onDecide: (like: boolean) => void;
}

export function SwipeDeck({ top, next, reason, index, onDecide }: SwipeDeckProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  /** Ignores input while a card is flying off. */
  const busy = useSharedValue(false);

  // The previous card flew off-screen; snap back to centre for the new top card
  // before paint so it never flashes at the old position.
  useLayoutEffect(() => {
    tx.set(0);
    ty.set(0);
    busy.set(false);
  }, [index, tx, ty, busy]);

  const decide = (like: boolean) => {
    'worklet';
    if (busy.get()) return;
    busy.set(true);
    scheduleOnRN(haptic, like);
    tx.set(
      withTiming(like ? FLY_OUT : -FLY_OUT, { duration: 320, easing: ease }, (done) => {
        if (done) scheduleOnRN(onDecide, like);
      }),
    );
    ty.set(withTiming(ty.get() || -30, { duration: 320, easing: ease }));
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (busy.get()) return;
      tx.set(e.translationX);
      ty.set(e.translationY);
    })
    .onEnd((e) => {
      if (busy.get()) return;
      if (e.translationX > THRESHOLD) decide(true);
      else if (e.translationX < -THRESHOLD) decide(false);
      else {
        tx.set(withTiming(0, { duration: 320, easing: ease }));
        ty.set(withTiming(0, { duration: 320, easing: ease }));
      }
    });

  return (
    <>
      <View className="relative mx-[22px] mt-5 flex-1">
        {next ? <BackCard activity={next} tx={tx} /> : null}
        <GestureDetector gesture={pan}>
          <TopCard activity={top} reason={reason} tx={tx} ty={ty} />
        </GestureDetector>
      </View>

      <View className="flex-row items-center justify-center gap-[22px] pb-[34px] pt-[22px]">
        <Pressable
          onPress={() => scheduleOnUI(decide, false)}
          accessibilityRole="button"
          accessibilityLabel="Skip"
          className="h-[66px] w-[66px] items-center justify-center rounded-full border border-outline bg-surface active:scale-90"
        >
          <CloseIcon size={24} color={colors.danger} strokeWidth={2} />
        </Pressable>
        <Pressable
          onPress={() => scheduleOnUI(decide, true)}
          accessibilityRole="button"
          accessibilityLabel="Interested"
          className="h-[78px] w-[78px] items-center justify-center rounded-full bg-lime active:scale-90"
          style={{
            shadowColor: colors.lime,
            shadowOpacity: 0.35,
            shadowRadius: 13,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
          }}
        >
          <CheckIcon />
        </Pressable>
      </View>
    </>
  );
}

function BackCard({ activity, tx }: { activity: Activity; tx: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.abs(tx.get()) / REVEAL);
    return { transform: [{ scale: 0.93 + 0.07 * p }, { translateY: 18 * (1 - p) }] };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Photo
        uri={activity.image}
        hue={activity.hue}
        className="flex-1 rounded-[28px] border border-line"
      >
        <View className="absolute inset-0 bg-[rgba(11,12,11,0.45)]" />
      </Photo>
    </Animated.View>
  );
}

interface TopCardProps {
  activity: Activity;
  reason: string;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
}

function TopCard({ activity: a, reason, tx, ty }: TopCardProps) {
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.get() },
      { translateY: ty.get() * 0.35 },
      { rotate: `${tx.get() / 18}deg` },
    ],
  }));
  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.get(), [0, THRESHOLD], [0, 1], 'clamp'),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.get(), [-THRESHOLD, 0], [1, 0], 'clamp'),
  }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: 28, backgroundColor: a.hue },
        {
          shadowColor: '#000',
          shadowOpacity: 0.5,
          shadowRadius: 25,
          shadowOffset: { width: 0, height: 20 },
          elevation: 14,
        },
        cardStyle,
      ]}
    >
      <Photo uri={a.image} hue={a.hue} className="flex-1 rounded-[28px] border border-[#2a2c29]">
        <Scrim from={0.35} opacity={0.92} />
        <View className="absolute right-3.5 top-3.5 h-7 justify-center rounded-[14px] bg-lime px-[11px]">
          <Text className="font-sans-semibold text-[13px] text-bg">{a.distance}</Text>
        </View>

        <Animated.View
          style={[
            { position: 'absolute', top: 58, left: 20, transform: [{ rotate: '-12deg' }] },
            likeStyle,
          ]}
        >
          <Stamp label="GOING?" color={colors.lime} />
        </Animated.View>
        <Animated.View
          style={[
            { position: 'absolute', top: 58, right: 20, transform: [{ rotate: '12deg' }] },
            nopeStyle,
          ]}
        >
          <Stamp label="SKIP" color={colors.danger} />
        </Animated.View>

        <View className="absolute inset-x-5 bottom-5">
          <View className="h-7 justify-center self-start rounded-[14px] bg-[rgba(201,245,63,0.14)] px-3">
            <Text className="font-sans-medium text-[13px] text-lime">{reason}</Text>
          </View>
          <Eyebrow className="mt-3">{a.category}</Eyebrow>
          <Text className="mt-2 font-display text-[27px] leading-[30px] tracking-[-0.68px] text-ink">
            {a.title}
          </Text>
          <View className="mt-3 gap-1">
            <Text className="font-sans text-[14.5px] text-ink-dim">
              {whenLong(a)} · {a.place}
            </Text>
            <Text className="font-sans text-[14.5px]" style={{ color: availabilityColor(a) }}>
              {a.going} going · {spotsLabel(a)}
            </Text>
          </View>
        </View>
      </Photo>
    </Animated.View>
  );
}

function Stamp({ label, color }: { label: string; color: string }) {
  return (
    <View className="rounded-[10px] border-[3px] px-3.5 py-1.5" style={{ borderColor: color }}>
      <Text className="font-display-heavy text-[26px] tracking-[1px]" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
