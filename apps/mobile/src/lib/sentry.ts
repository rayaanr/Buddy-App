import * as Sentry from '@sentry/react-native';

/**
 * Crash reports from builds, only when EXPO_PUBLIC_SENTRY_DSN is set (on EAS,
 * see infra/README.md). Never in development: errors show on screen there.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn && !__DEV__,
  // No IPs, cookies or request bodies; errors only, no performance tracing.
  sendDefaultPii: false,
  tracesSampleRate: 0,
});

export const withSentry = Sentry.wrap;

/** Reports an error the app caught itself (e.g. on the crash screen). */
export const reportError = (error: unknown) => Sentry.captureException(error);
