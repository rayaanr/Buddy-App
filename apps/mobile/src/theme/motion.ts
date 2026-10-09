import {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  type WithSpringConfig,
} from 'react-native-reanimated';

/**
 * Buddy's motion vocabulary. Every animation picks from these so the app
 * moves one way. Springs and layout animations follow the system's Reduce
 * Motion setting (Reanimated's default), so nothing here needs a check.
 */

export const spring = {
  /** Presses, toggles, small things that should feel instant. */
  snappy: { damping: 18, stiffness: 340, mass: 0.6 },
  /** Larger moves: sliding indicators, bars, sheets. */
  gentle: { damping: 22, stiffness: 200, mass: 1 },
  /** A little overshoot for moments worth celebrating. */
  bouncy: { damping: 11, stiffness: 260, mass: 0.7 },
} satisfies Record<string, WithSpringConfig>;

export const duration = { fast: 150, base: 220, slow: 320 } as const;

/** List items arriving: rise and fade, staggered for the first few. */
export const enterItem = (index = 0) =>
  FadeInDown.duration(duration.slow)
    .delay(Math.min(index, 6) * 45)
    .withInitialValues({ transform: [{ translateY: 14 }] });

/** List items making room when others arrive or leave. */
export const layoutItem = LinearTransition.springify()
  .damping(spring.gentle.damping)
  .stiffness(spring.gentle.stiffness);

export const fadeIn = FadeIn.duration(duration.base);
export const fadeOut = FadeOut.duration(duration.fast);

/** A chat message arriving: rises into place. */
export const enterMessage = FadeInDown.springify()
  .damping(spring.gentle.damping)
  .stiffness(spring.gentle.stiffness)
  .withInitialValues({ transform: [{ translateY: 16 }] });
