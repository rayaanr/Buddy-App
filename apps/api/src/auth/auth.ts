import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';

import type { Db } from '../db/client';
import * as schema from '../db/schema';
import type { Env } from '../env';
import type { Logger } from '../logger';
import { signInCodeEmail, type Mailer } from '../lib/mailer';

const DAY_SECONDS = 24 * 60 * 60;

export interface AuthDeps {
  db: Db;
  env: Env;
  mailer: Mailer;
  logger: Logger;
}

/**
 * Email one-time-code sign-in. The first successful sign-in creates the
 * account; a profile row is created alongside it so the app can route the
 * new user to onboarding.
 */
export function createAuth({ db, env, mailer, logger }: AuthDeps) {
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
    advanced: {
      database: { generateId: 'uuid' },
      // Caddy sits in front in production and sets the real client address.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    rateLimit: {
      // Production only (Better Auth's default): local testing shouldn't lock you out.
      enabled: env.NODE_ENV === 'production',
      customRules: {
        // Each code request sends an email; keep abuse expensive.
        '/email-otp/send-verification-otp': { window: 60, max: 3 },
        '/sign-in/email-otp': { window: 60, max: 10 },
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
