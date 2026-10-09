const { colors, fonts } = require('./src/theme/tokens');

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
      fontFamily: Object.fromEntries(Object.entries(fonts).map(([k, v]) => [k, [v]])),
    },
  },
  plugins: [],
};
