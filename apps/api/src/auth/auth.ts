import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';

import type { Db } from '../db/client';
import * as schema from '../db/schema';
import type { Env } from '../env';
import type { Logger } from '../logger';
import { signInCodeEmail, type Mailer } from '../lib/mailer';
import type { RateLimiter } from '../lib/rate-limit';

const DAY_SECONDS = 24 * 60 * 60;

export interface AuthDeps {
  db: Db;
  env: Env;
  mailer: Mailer;
  logger: Logger;
  limiter: RateLimiter;
}

/** Sign-in codes per email address per hour, whatever IP asks (stops inbox bombing). */
const CODES_PER_EMAIL_PER_HOUR = 5;

/**
 * Email one-time-code sign-in. The first successful sign-in creates the
 * account; a profile row is created alongside it so the app can route the
 * new user to onboarding.
 */
export function createAuth({ db, env, mailer, logger, limiter }: AuthDeps) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    trustedOrigins: [
      `${env.APP_SCHEME}://`,
      // Expo Go uses exp:// links while developing.
      ...(env.NODE_ENV === 'development' ? ['exp://'] : []),
      ...env.WEB_ORIGINS,
    ],
    session: {
      // Phones stay signed in; activity extends the session.
      expiresIn: 30 * DAY_SECONDS,
      updateAge: DAY_SECONDS,
    },
    // Built-in routes the app doesn't use. update-user would let anyone set any
    // name, skipping /v1/me's rules; the app has its own account deletion.
    disabledPaths: ['/update-user', '/change-email', '/delete-user'],
    advanced: {
      database: { generateId: 'uuid' },
      ipAddress: {
        // Caddy sits in front in production and sets the real client address.
        ipAddressHeaders: ['x-forwarded-for'],
        // With more than one proxy (e.g. Cloudflare then Caddy), list them here.
        ...(env.TRUSTED_PROXIES.length && { trustedProxies: env.TRUSTED_PROXIES }),
      },
    },
    rateLimit: {
      // On everywhere but tests, so a server started without NODE_ENV=production
      // is still protected; development is just roomier.
      enabled: env.NODE_ENV !== 'test',
      customRules: {
        // Each code request sends an email; keep abuse expensive.
        '/email-otp/send-verification-otp': {
          window: 60,
          max: env.NODE_ENV === 'production' ? 3 : 20,
        },
        '/sign-in/email-otp': { window: 60, max: env.NODE_ENV === 'production' ? 10 : 50 },
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await db.insert(schema.profiles).values({ userId: user.id }).onConflictDoNothing();
          },
        },
      },
    },
    plugins: [
      emailOTP({
        expiresIn: 5 * 60,
        allowedAttempts: 5,
        // Hashed at rest: a leaked database must not hand out working codes.
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp }) {
          if (!limiter.hit(`otp:${email.toLowerCase()}`, CODES_PER_EMAIL_PER_HOUR, 3_600_000).ok) {
            // Look the same as success, so this can't be used to probe addresses.
            logger.warn({ email }, 'Too many sign-in codes for this email; not sending');
            return;
          }
          // Not awaited by the caller's response path to avoid timing leaks; errors are logged.
          mailer.send(signInCodeEmail(email, otp)).catch((err: unknown) => {
            logger.error({ err, email }, 'Failed to send sign-in code');
          });
        },
      }),
      expo(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
