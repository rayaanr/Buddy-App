const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');
const { rem } = require('./src/theme/tokens');

// Expo's config, plus ids that tie crash reports to their source maps.
const config = getSentryExpoConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css', inlineRem: rem });
