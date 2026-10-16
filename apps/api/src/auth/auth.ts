import { expo } from '@better-auth/expo';
import { ERROR_CODES, LIMITS } from '@buddy/shared';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { createHash } from 'node:crypto';

import type { Db } from '../db/client';
import * as schema from '../db/schema';
import type { Env } from '../env';
import type { Logger } from '../logger';
import { signInCodeEmail, type Mailer } from '../lib/mailer';
import type { RateLimiter } from '../lib/rate-limit';
import { createUrls } from '../lib/urls';
import { isSuspended } from '../modules/moderation/service';

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
/** Code guesses per email address per day, whatever IP tries (each code also allows 5). */
const TRIES_PER_EMAIL_PER_DAY = 20;

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
 * Email one-time-code sign-in, plus Google when it's configured. The first
 * successful sign-in creates the account; a profile row is created alongside
 * it so the app can route the new user to onboarding.
 */
export function createAuth({ db, env, mailer, logger, limiter }: AuthDeps) {
  const { art } = createUrls(env);
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
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              // Always show the account chooser, so a shared phone can switch.
              prompt: 'select_account',
            },
          }
        : undefined,
    account: {
      // Signing in with Google as someone who signed up by email code is the
      // same person: attach it to their account instead of failing. Only for
      // addresses Google says it has verified (no trustedProviders, which
      // would skip that check).
      accountLinking: { enabled: true },
    },
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
      // Counted in the cluster, so the limits hold across API instances.
      customStorage: {
        consume: async (key, { window, max }) => {
          const { ok, retryAfterS } = await limiter.hit(`auth:${key}`, max, window * 1000);
          return { allowed: ok, retryAfter: ok ? null : retryAfterS };
        },
      },
      customRules: {
        // Each code request sends an email; keep abuse expensive.
        '/email-otp/send-verification-otp': {
          window: 60,
          max: env.NODE_ENV === 'production' ? 3 : 20,
        },
        '/sign-in/email-otp': { window: 60, max: env.NODE_ENV === 'production' ? 10 : 50 },
      },
    },
    hooks: {
      // Per-address limits, checked before better-auth acts: past the limit a
      // code request must not create a new code either, or it would replace
      // (and so lock out) the real person's code.
      before: createAuthMiddleware(async (ctx) => {
        const email = String((ctx.body as { email?: unknown } | undefined)?.email ?? '')
          .trim()
          .toLowerCase();
        if (!email) return;
        if (ctx.path === '/email-otp/send-verification-otp') {
          if (!(await limiter.hit(`otp:${email}`, CODES_PER_EMAIL_PER_HOUR, 3_600_000)).ok) {
            // Look the same as success, so this can't be used to probe addresses.
            logger.warn(
              { email: emailTag(email) },
              'Too many sign-in codes for this email; not sending',
            );
            return ctx.json({ success: true });
          }
        }
        if (ctx.path === '/sign-in/email-otp') {
          if (!(await limiter.hit(`otp-try:${email}`, TRIES_PER_EMAIL_PER_DAY, 86_400_000)).ok) {
            throw new APIError('TOO_MANY_REQUESTS', {
              message: 'Too many tries for this email. Try again tomorrow.',
            });
          }
        }
      }),
    },
    databaseHooks: {
      session: {
        create: {
          // Suspended by a moderator: no new sessions (existing ones were ended).
          before: async (s) => {
            if (await isSuspended(db, s.userId)) {
              throw new APIError('FORBIDDEN', {
                code: ERROR_CODES.suspended,
                message: 'This account has been suspended for breaking Buddy’s rules.',
              });
            }
          },
        },
      },
      user: {
        create: {
          // Sign-up asks only for an email; the name is an optional next step.
          before: async (user) => ({
            data: {
              ...user,
              name: (user.name?.trim() || nameFromEmail(user.email)).slice(0, LIMITS.nameMax),
            },
          }),
          after: async (user) => {
            // Google sign-ups start with their Google photo until they upload
            // one; everyone else with one of our avatars until they pick theirs.
            await db
              .insert(schema.profiles)
              .values({ userId: user.id, avatarUrl: user.image ?? art.avatar(user.id, null) })
              .onConflictDoNothing();
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
        // The per-address limit runs first (see hooks.before).
        async sendVerificationOTP({ email, otp }) {
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
