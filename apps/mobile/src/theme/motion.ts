import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  Keyframe,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
  type WithSpringConfig,
} from 'react-native-reanimated';

/**
 * Buddy's motion vocabulary. Every animation picks from these so the app
 * moves one way.
 *
 * Reduce Motion: springs, timings and entrances follow the system setting
 * (Reanimated's default), so they jump to their end; exits that only explain
 * a change keep their fade; screen transitions turn into fades (see
 * `useScreenAnimation`).
 */

/** Springs in Apple's two terms: how long, and how much it overshoots (1 = none). */
export const spring = {
  /** Toggles, small things that should feel instant. */
  snappy: { duration: 250, dampingRatio: 1 },
  /** Settling into place with no finger involved: indicators, bars. */
  settle: { duration: 400, dampingRatio: 1 },
  /** Home after a drag; pass the finger's `velocity`. */
  snapBack: { duration: 400, dampingRatio: 0.8 },
  /** Sheets and drawers after a drag; pass the finger's `velocity`. */
  sheet: { duration: 300, dampingRatio: 0.8 },
  /** A little overshoot, for moments worth celebrating (joining). */
  pop: { duration: 450, dampingRatio: 0.6 },
} satisfies Record<string, WithSpringConfig>;

/** Easing for anything without a finger on it. Never ease-in on UI. */
export const ease = {
  /** Entering, exiting, the default. */
  out: Easing.bezier(0.23, 1, 0.32, 1),
  /** Moving on screen. */
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  /** iOS's sheet curve. */
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
};

const duration = { fast: 150, base: 200, slow: 280 } as const;

/** List items making room when others arrive or leave. */
export const layoutItem = LinearTransition.duration(duration.base).easing(ease.inOut);

export const fadeIn = FadeIn.duration(duration.base).easing(ease.out);
export const fadeOut = FadeOut.duration(duration.fast).easing(ease.out);

/**
 * Popovers, dialogs and the reaction bar: grow from just under full size
 * while fading in (never from nothing).
 */
export const popIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.95 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: ease.out },
}).duration(duration.fast);
/** Leaving needs no movement: a quick fade, kept even with Reduce Motion. */
export const popOut = FadeOut.duration(120).easing(ease.out).reduceMotion(ReduceMotion.Never);

/** Toasts: rise in, and leave the way they came. */
export const riseIn = FadeInDown.duration(duration.slow)
  .easing(ease.out)
  .withInitialValues({ transform: [{ translateY: 12 }] });
export const sinkOut = FadeOutDown.duration(duration.base).easing(ease.out);

/** The typing indicator arriving under the last message. */
export const enterMessage = FadeInDown.duration(duration.slow)
  .easing(ease.out)
  .withInitialValues({ transform: [{ translateY: 12 }] });

/**
 * Screen transitions: the slide asked for, or a fade when Reduce Motion is
 * on (the native stack doesn't follow the setting by itself).
 */
export function useScreenAnimation() {
  const reduced = useReducedMotion();
  return <T extends string>(slide: T): T | 'fade' => (reduced ? 'fade' : slide);
}
