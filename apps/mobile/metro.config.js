const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { rem } = require('./src/theme/tokens');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css', inlineRem: rem });
