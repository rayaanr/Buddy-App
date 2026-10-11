import { existsSync } from 'node:fs';

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json holds the config; this adds what can't live in git.
 *
 * Android push (Firebase): `google-services.json` from your Firebase project.
 * - EAS builds: upload it as a file variable named GOOGLE_SERVICES_JSON
 *   (eas env:create --type file); EAS sets the variable to its path.
 * - Local builds: put it next to this file (it's git-ignored).
 * Without it the app still builds and runs; Android just gets no push token.
 */
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (existsSync('./google-services.json') ? './google-services.json' : undefined);

/**
 * Crash reports (Sentry) work from EXPO_PUBLIC_SENTRY_DSN alone. Readable
 * stack traces also need source maps uploaded at build time, which needs
 * SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT; without them the upload
 * step is left out so builds don't fail.
 */
const sentryUpload = process.env.SENTRY_AUTH_TOKEN
  ? [
      [
        '@sentry/react-native/expo',
        { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT },
      ] as [string, object],
    ]
  : [];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [...(config.plugins ?? []), ...sentryUpload],
  android: {
    ...config.android,
    ...(googleServicesFile && { googleServicesFile }),
  },
});
