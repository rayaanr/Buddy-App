const { colors, fonts, fontSize, lineHeight, radius, spacing } = require('./src/theme/tokens');

const px = (scale) => Object.fromEntries(Object.entries(scale).map(([k, v]) => [k, `${v}px`]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // The app is dark-only. 'class' stops NativeWind's web runtime from throwing
  // "Cannot manually set color scheme" under the default 'media' mode.
  darkMode: 'class',
  theme: {
    extend: {
      colors,
      fontSize: px(fontSize),
      lineHeight: px(lineHeight),
      borderRadius: px(radius),
      spacing: px(spacing),
      fontFamily: Object.fromEntries(Object.entries(fonts).map(([k, v]) => [k, [v]])),
    },
  },
  plugins: [],
};
