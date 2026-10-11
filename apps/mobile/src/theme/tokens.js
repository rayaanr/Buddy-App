/**
 * Design tokens for Buddy. Single source of truth shared by
 * tailwind.config.js (class names) and runtime code (icons, gradients, animations).
 * Values come straight from the Claude Design prototype (project/Buddy.dc.html).
 */
/**
 * Buddy is dark-only by design: one fixed brand palette, the same on every
 * platform (no light theme, no system colours).
 */
const colors = {
  bg: '#0b0c0b',
  'tab-bar': '#0d0e0d',
  surface: '#161816',
  'surface-sunken': '#141614',
  'surface-raised': '#1c1e1c',
  line: '#1e201e',
  divider: '#222422',
  'divider-strong': '#232523',
  field: '#2b2d2a',
  outline: '#343632',
  'chip-border': '#2f312e',
  disabled: '#2a2d29',
  track: '#262826',
  ink: '#f1f2ee',
  'ink-soft': '#d9dbd5',
  'ink-dim': '#c8cbc4',
  'ink-faint': '#b9bcb5',
  muted: '#8b8e88',
  subtle: '#6f726c',
  lime: '#c9f53f',
  'lime-deep': '#262e12',
  'lime-tint': '#222a12',
  'lime-panel': '#1a2010',
  'lime-panel-border': '#3d4a1c',
  'lime-panel-divider': '#2c3518',
  'lime-panel-muted': '#9da48f',
  'lime-outline': '#55622a',
  danger: '#ff6b5a',
  warning: '#f2a65a',
  me: '#3a6b35',
  'avatar-fallback': '#3a3d39',
  toast: '#f1f2ee',
  /** Dimmed screen behind dialogs and the photo viewer. */
  scrim: 'rgba(0, 0, 0, 0.6)',
  /** Round buttons floating over photos and the map. */
  glass: 'rgba(11, 12, 11, 0.6)',
  /** Labels floating over photos and the map. */
  'glass-strong': 'rgba(11, 12, 11, 0.7)',
  /** Darkening over a photo so text on it reads. */
  shade: 'rgba(11, 12, 11, 0.45)',
  /** A faint lime wash: highlighted rows, the meeting point's halo, the picks stamp. */
  'lime-wash': 'rgba(201, 245, 63, 0.14)',
  /** Card edges on photos (picks, the welcome fan). */
  'card-edge': '#2a2c29',
  /** Empty checkbox rings. */
  'outline-strong': '#4a4c48',
  /** The map's credit line: dark text on a light label (the map is light). */
  'map-credit': 'rgba(0, 0, 0, 0.6)',
  'map-credit-bg': 'rgba(255, 255, 255, 0.7)',
};

const fonts = {
  display: 'SchibstedGrotesk_700Bold',
  'display-heavy': 'SchibstedGrotesk_800ExtraBold',
  sans: 'Geist_400Regular',
  'sans-medium': 'Geist_500Medium',
  'sans-semibold': 'Geist_600SemiBold',
  mono: 'GeistMono_400Regular',
  'mono-medium': 'GeistMono_500Medium',
};

/**
 * Text sizes, one ramp (classes: text-caption, text-body…). Big headings
 * have their own sizes in Heading (components/ui/Typography). Pixels.
 */
const fontSize = {
  micro: 11,
  caption: 12,
  footnote: 13,
  label: 14,
  subhead: 15,
  body: 16,
  headline: 17,
  title3: 18,
  title2: 20,
  title1: 22,
  /** Digits in pickers and the code boxes. */
  numeral: 26,
};

/** Line heights for text that wraps (classes: leading-body…), named after the size they suit. */
const lineHeight = {
  caption: 17,
  footnote: 18,
  label: 20,
  subhead: 22,
  body: 23,
  title2: 25,
  title1: 28,
};

/**
 * Corner radii (classes: rounded-tag…). Capsules (pills, round buttons)
 * use rounded-full.
 */
const radius = {
  /** Small labels: "Host", tags. */
  tag: 10,
  /** Inputs, list tiles, small cards. */
  tile: 14,
  /** Standard cards. */
  card: 18,
  /** Larger panels and banners. */
  panel: 20,
  /** Hero cards, the map. */
  hero: 22,
  /** Dialogs and full-height cards. */
  modal: 28,
};

/**
 * Named spacing (classes: px-edge, -mx-edge, px-header…). Content sits
 * 22pt from the screen edge; header rows (back button, actions) sit 18pt,
 * so their round buttons line up optically with the text below.
 */
const spacing = {
  edge: 22,
  header: 18,
};

/** Shadows as boxShadow strings: the same on iPhone, Android and web. */
const shadows = {
  /** Popover menus, the reaction bar, toasts. */
  raised: '0 10px 30px rgba(0, 0, 0, 0.45)',
  /** Cards lifted off the screen (the picks deck, the welcome fan). */
  overlay: '0 18px 40px rgba(0, 0, 0, 0.5)',
  /** The lime glow on the main actions (+, Interested). */
  glow: '0 0 20px rgba(201, 245, 63, 0.35)',
  /** Small things floating on the map (pins). */
  float: '0 3px 10px rgba(0, 0, 0, 0.4)',
  /** The toggle's knob. */
  knob: '0 1px 4px rgba(0, 0, 0, 0.35)',
};

/**
 * Pixels per `rem` on phones. NativeWind defaults to 14, but the design (and
 * the web build) use 16, so classes like p-4 or h-11 would come out ~12%
 * smaller on a phone than in the prototype.
 */
const rem = 16;

module.exports = { colors, fonts, fontSize, lineHeight, radius, spacing, shadows, rem };
