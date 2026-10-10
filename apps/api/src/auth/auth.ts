import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { createHash } from 'node:crypto';

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

/** A stable, non-reversible tag for an address, so logs can be correlated without holding emails. */
const emailTag = (email: string) =>
  createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 12);

/** "nimal.perera42@…" → "Nimal": a starting name until the person sets their own. */
function nameFromEmail(email: string) {
  const local = email.split('@')[0]!.split('+')[0]!;
  const word = local.split(/[^a-zA-Z]+/).find(Boolean) ?? local;
  return (word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).slice(0, 40) || 'Buddy';
}

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
      // The app resolves the client IP itself (clientIp, honouring
      // TRUSTED_PROXY_HOPS) and hands it over as a single X-Forwarded-For
      // value before calling the handler; see app.ts.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
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
          // Sign-up asks only for an email; the name is an optional next step.
          before: async (user) => ({
            data: { ...user, name: user.name?.trim() || nameFromEmail(user.email) },
          }),
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
            logger.warn(
              { email: emailTag(email) },
              'Too many sign-in codes for this email; not sending',
            );
            return;
          }
          // Not awaited by the caller's response path to avoid timing leaks; errors are logged.
          mailer.send(signInCodeEmail(email, otp, env.BETTER_AUTH_URL)).catch((err: unknown) => {
            logger.error({ err, email: emailTag(email) }, 'Failed to send sign-in code');
          });
        },
      }),
      expo(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
