import tokens from './tokens';

type Colors = typeof import('./tokens').colors;

export const colors: Colors = tokens.colors;

/** Height of the bottom tab bar, excluding the bottom safe-area inset. */
export const TAB_BAR_HEIGHT = 74;

/**
 * Largest text scale inside fixed-height controls (buttons, chips, fields).
 * Text still grows with the system setting, but stops before it clips.
 */
export const CONTROL_FONT_SCALE = 1.3;
