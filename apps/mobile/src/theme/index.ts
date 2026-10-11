import tokens from './tokens';

type Tokens = typeof import('./tokens');

export const colors: Tokens['colors'] = tokens.colors;
/** Named spacing: `edge` (content from the screen edge), `header` (header rows). */
export const spacing: Tokens['spacing'] = tokens.spacing;
/** boxShadow strings, for style objects (the same on every platform). */
export { shadows } from './tokens';

/** Height of the bottom tab bar, excluding the bottom safe-area inset. */
export const TAB_BAR_HEIGHT = 74;

/**
 * Largest text scale inside fixed-height controls (buttons, chips, fields).
 * Text still grows with the system setting, but stops before it clips.
 */
export const CONTROL_FONT_SCALE = 1.3;
