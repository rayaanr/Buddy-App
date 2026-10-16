/**
 * Load tests run the built API on its own port against its own database
 * (buddy_load, filled with generated people and activities), so they never
 * touch your dev data and can run while `bun run dev` is up.
 */
export const API_PORT = 7420;
export const API_URL = `http://localhost:${API_PORT}`;
export const DATABASE_URL = 'postgres://postgres:postgres@localhost:7432/buddy_load';
/** Signed-in sessions for k6 to use (written by prepare.ts; git-ignored). */
export const SESSIONS_FILE = new URL('./.sessions.json', import.meta.url);
/** Has to match between prepare.ts (which signs session cookies) and the API. */
export const AUTH_SECRET = 'load-test-secret-not-for-anything-real-0123456789';
