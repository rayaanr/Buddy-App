import { fileURLToPath } from 'node:url';

/**
 * The browser tests run their own API and web app on ports next to the dev
 * ones, against their own database (rebuilt from the seed on every run), so
 * they never touch your dev data and can run while `bun run dev` is up.
 */
export const API_PORT = 7410;
export const WEB_PORT = 7491;
export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const DATABASE_URL = 'postgres://postgres:postgres@localhost:7432/buddy_e2e';
/** Sign-in emails land here instead of being sent (see DEV_OUTBOX in apps/api). */
export const OUTBOX = fileURLToPath(new URL('./.outbox.jsonl', import.meta.url));
/** Seeded people (apps/api/scripts/seed). Each test signs in as its own, so tests don't collide. */
export const ADMIN = 'kavindu@buddy.test';
