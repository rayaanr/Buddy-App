import { z } from 'zod';

/**
 * Environment variables, validated once at startup. A missing or malformed
 * value stops the server immediately instead of failing on the first request.
 */
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(7400),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Human-readable logs (pino-pretty, a dev dependency). Leave off in Docker and production. */
    LOG_PRETTY: z.stringbool().default(false),

    DATABASE_URL: z.url(),

    /** Public base URL of this API, e.g. https://api.example.com. */
    BETTER_AUTH_URL: z.url(),
    /** At least 32 random characters; signs session cookies. */
    BETTER_AUTH_SECRET: z.string().min(32),
    /** Deep-link scheme of the mobile app, trusted for auth redirects. */
    APP_SCHEME: z.string().default('buddy'),
    /** Comma-separated browser origins allowed to call the API (Expo web in development). */
    WEB_ORIGINS: z
      .string()
      .optional()
      .transform((v) =>
        v
          ? v
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : [],
      ),

    /**
     * Google sign-in (a Web application OAuth client). Off unless both are set;
     * its redirect URI is <BETTER_AUTH_URL>/api/auth/callback/google.
     */
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    /** Without a key, sign-in codes are written to the log instead (development only). */
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default('Buddy <hello@example.com>'),
    /** Shown on the privacy policy and terms pages for questions and data requests. */
    CONTACT_EMAIL: z.email().default('hello@example.com'),
    /** Where new reports are emailed. Without it they're only logged. */
    MODERATION_EMAIL: z.email().optional(),
    /** Who can act on reports in the app (Settings → Moderation), comma-separated emails. */
    ADMIN_EMAILS: z
      .string()
      .default('')
      .transform((s) =>
        s
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean),
      ),

    /** Optional; only needed if push security is enabled in the Expo project. */
    EXPO_ACCESS_TOKEN: z.string().optional(),

    /** Crash reports go to Sentry when set (the project's DSN). Off without it. */
    SENTRY_DSN: z.url().optional(),

    /** Cloudflare R2 (S3-compatible) for photos. Required: the server won't start without it (tests excepted). */
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    /** Public URL of the bucket (custom domain or r2.dev), without a trailing slash. */
    R2_PUBLIC_URL: z.url().optional(),

    /**
     * Venue search for meeting points (see lib/venues.ts): `osm` (OpenStreetMap
     * via Photon), `google` (Places API, needs GOOGLE_PLACES_API_KEY) or `towns`.
     */
    VENUE_PROVIDER: z.enum(['osm', 'google', 'towns']).default('osm'),
    /**
     * Reverse proxies in front of the API (e.g. 1 for Caddy). Rate limits then
     * read the client IP from X-Forwarded-For; 0 uses the socket address.
     */
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    /** Photon server for `osm`; run your own for heavy use (the public one asks for fair use). */
    PHOTON_URL: z.url().default('https://photon.komoot.io'),
    GOOGLE_PLACES_API_KEY: z.string().optional(),
  })
  .refine((e) => e.VENUE_PROVIDER !== 'google' || !!e.GOOGLE_PLACES_API_KEY, {
    path: ['GOOGLE_PLACES_API_KEY'],
    message: 'Required when VENUE_PROVIDER is google',
  })
  .refine((e) => !e.GOOGLE_CLIENT_ID === !e.GOOGLE_CLIENT_SECRET, {
    path: ['GOOGLE_CLIENT_SECRET'],
    message: 'Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither',
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // `KEY=` in a .env file means "not set", not an empty string.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${problems.join('\n')}`);
  }
  const env = parsed.data;
  // Photos (profiles, covers, logos, chat) need storage; without it they'd
  // fail one request at a time, so refuse to start instead.
  const r2 = {
    R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: env.R2_BUCKET,
    R2_PUBLIC_URL: env.R2_PUBLIC_URL,
  };
  const missing = Object.entries(r2)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (env.NODE_ENV !== 'test' && missing.length) {
    throw new Error(
      `Photo storage (Cloudflare R2) isn’t set up. Add ${missing.join(', ')} to apps/api/.env ` +
        '(see infra/README.md, "Photo storage").',
    );
  }
  if (env.NODE_ENV === 'production' && !env.RESEND_API_KEY) {
    throw new Error(
      'RESEND_API_KEY is required in production: users could not receive sign-in codes.',
    );
  }
  return env;
}
