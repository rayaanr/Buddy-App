const { colors, fonts } = require('./src/theme/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      fontFamily: Object.fromEntries(Object.entries(fonts).map(([k, v]) => [k, [v]])),
    },
  },
  plugins: [],
};
