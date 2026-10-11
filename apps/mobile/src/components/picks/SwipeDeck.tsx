import type { ActivitySummary as Activity } from '@buddy/shared';
import * as Haptics from 'expo-haptics';
import { useCallback, useLayoutEffect, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { CheckIcon, CloseIcon, Eyebrow, Heading, Photo, Scrim } from '@/components/ui';
import { availabilityColor, distanceLabel, hueFor, spotsLabel, whenLong } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { project } from '@/lib/gestures';
import { colors, shadows } from '@/theme';
import { spring } from '@/theme/motion';

/**
 * Where a release has to be heading to count as a decision: a long drag or
 * a quick flick both get there, a lazy let-go near the middle doesn't.
 */
const THRESHOLD = 100;
/** Cards slow down fast: only a real flick projects far. */
const CARD_DECELERATION = 0.99;
/** Distance over which the back card grows to full size. */
const REVEAL = 120;
const FLY_OUT = 600;

/** The card committing: one light tap, as it leaves. */
const haptic = () => {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

interface SwipeDeckProps {
  top: Activity;
  next?: Activity;
  reason: string;
  /** Changes whenever the top card changes; resets the drag position. */
  index: number;
  onDecide: (like: boolean) => void;
  /** "Not into board games": skips the card and asks for no more of its kind. */
  onNotInto?: () => void;
}

export function SwipeDeck({ top, next, reason, index, onDecide, onNotInto }: SwipeDeckProps) {
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

  /** Throws the card off, carrying the finger's speed (none from the buttons). */
  const decide = useCallback(
    (like: boolean, vx = 0, vy = 0) => {
      'worklet';
      if (busy.get()) return;
      busy.set(true);
      scheduleOnRN(haptic);
      const out = { duration: 300, dampingRatio: 1, overshootClamping: true };
      tx.set(
        withSpring(like ? FLY_OUT : -FLY_OUT, { ...out, velocity: vx }, (done) => {
          if (done) scheduleOnRN(onDecide, like);
        }),
      );
      ty.set(withSpring(ty.get() || -30, { ...out, velocity: vy }));
    },
    [busy, tx, ty, onDecide],
  );

  // Where the card was when grabbed, so catching it mid-return doesn't jump.
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          fromX.set(tx.get());
          fromY.set(ty.get());
        })
        .onUpdate((e) => {
          if (busy.get()) return;
          tx.set(fromX.get() + e.translationX);
          ty.set(fromY.get() + e.translationY);
        })
        .onEnd((e) => {
          if (busy.get()) return;
          const heading = tx.get() + project(e.velocityX, CARD_DECELERATION);
          if (heading > THRESHOLD) decide(true, e.velocityX, e.velocityY);
          else if (heading < -THRESHOLD) decide(false, e.velocityX, e.velocityY);
          else {
            tx.set(withSpring(0, { ...spring.snapBack, velocity: e.velocityX }));
            ty.set(withSpring(0, { ...spring.snapBack, velocity: e.velocityY }));
          }
        }),
    [busy, tx, ty, fromX, fromY, decide],
  );

  return (
    <>
      <View className="relative mx-edge mt-5 flex-1">
        {next ? <BackCard activity={next} tx={tx} /> : null}
        <GestureDetector gesture={pan}>
          <TopCard activity={top} reason={reason} tx={tx} ty={ty} />
        </GestureDetector>
      </View>

      <View
        className={cn(
          'flex-row items-center justify-center gap-[22px] pt-[22px]',
          onNotInto && top.interest ? 'pb-2' : 'pb-[34px]',
        )}
      >
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
            boxShadow: shadows.glow,
          }}
        >
          <CheckIcon />
        </Pressable>
      </View>
      {onNotInto && top.interest ? (
        <Pressable
          onPress={() => {
            onNotInto();
            scheduleOnUI(decide, false);
          }}
          accessibilityRole="button"
          accessibilityHint="Skips this and shows no more of its kind in your picks"
          hitSlop={8}
          className="mb-5 self-center rounded-full px-4 py-2 active:bg-surface"
        >
          <Text className="font-sans-medium text-label text-muted">
            Not into {top.interest.toLowerCase()}
          </Text>
        </Pressable>
      ) : null}
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
        uri={activity.coverUrl ?? undefined}
        hue={hueFor(activity)}
        className="flex-1 rounded-modal border border-line"
      >
        <View className="absolute inset-0 bg-shade" />
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
        { borderRadius: 28, backgroundColor: hueFor(a) },
        {
          boxShadow: shadows.overlay,
        },
        cardStyle,
      ]}
    >
      <Photo
        uri={a.coverUrl ?? undefined}
        hue={hueFor(a)}
        className="flex-1 rounded-modal border border-card-edge"
      >
        <Scrim from={0.35} opacity={0.92} />
        <View className="absolute right-3.5 top-3.5 h-7 justify-center rounded-tile bg-lime px-[11px]">
          <Text className="font-sans-semibold text-footnote text-bg">{distanceLabel(a)}</Text>
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
          <View className="h-7 justify-center self-start rounded-tile bg-lime-wash px-3">
            <Text className="font-sans-medium text-footnote text-lime">{reason}</Text>
          </View>
          <Eyebrow className="mt-3">{a.category}</Eyebrow>
          <Heading size="card" className="mt-2">
            {a.title}
          </Heading>
          <View className="mt-3 gap-1">
            <Text className="font-sans text-subhead text-ink-dim">
              {whenLong(a)} · {a.place}
            </Text>
            <Text className="font-sans text-subhead" style={{ color: availabilityColor(a) }}>
              {a.goingCount} going · {spotsLabel(a)}
            </Text>
          </View>
        </View>
      </Photo>
    </Animated.View>
  );
}

function Stamp({ label, color }: { label: string; color: string }) {
  return (
    <View className="rounded-tag border-[3px] px-3.5 py-1.5" style={{ borderColor: color }}>
      <Text className="font-display-heavy text-numeral tracking-[1px]" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
