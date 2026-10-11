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

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    ...(googleServicesFile && { googleServicesFile }),
  },
});
