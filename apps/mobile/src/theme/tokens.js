/**
 * Design tokens for Buddy. Single source of truth shared by
 * tailwind.config.js (class names) and runtime code (icons, gradients, animations).
 * Values come straight from the Claude Design prototype (project/Buddy.dc.html).
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
  'disabled-alt': '#232523',
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
 * Pixels per `rem` on phones. NativeWind defaults to 14, but the design (and
 * the web build) use 16, so classes like p-4 or h-11 would come out ~12%
 * smaller on a phone than in the prototype.
 */
const rem = 16;

module.exports = { colors, fonts, rem };
