import tokens from './tokens';

type Colors = typeof import('./tokens').colors;
type Fonts = typeof import('./tokens').fonts;

export const colors: Colors = tokens.colors;
export const fonts: Fonts = tokens.fonts;

/** Shared motion curve used by the prototype: cubic-bezier(.2,.8,.2,1). */
export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

/** Height of the bottom tab bar, excluding the bottom safe-area inset. */
export const TAB_BAR_HEIGHT = 74;

/**
 * Largest text scale inside fixed-height controls (buttons, chips, fields).
 * Text still grows with the system setting, but stops before it clips.
 */
export const CONTROL_FONT_SCALE = 1.3;
