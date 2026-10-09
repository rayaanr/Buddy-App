/**
 * Used only by `npm run auth:generate` to regenerate src/db/schema/auth.ts.
 * Mirrors the plugins in src/auth/auth.ts that affect the database schema.
 */
import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export const auth = betterAuth({
  database: drizzleAdapter(drizzle(postgres('postgres://localhost/unused')), { provider: 'pg' }),
  advanced: { database: { generateId: 'uuid' } },
  plugins: [emailOTP({ sendVerificationOTP: async () => {} }), expo()],
});
