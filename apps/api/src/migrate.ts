/**
 * Applies pending migrations from ./drizzle, then exits.
 * Production runs this before starting the server (drizzle-kit is a dev tool).
 */
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';

import { createDb } from './db/client';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

// Works from src/ (tsx) and dist/ (built): both sit one level below the package root.
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

// One connection, so the lock below and the migrations share it.
const { db, sql, close } = createDb(url, { max: 1 });
try {
  // Several API copies start together: one migrates, the others wait for it
  // and then find nothing left to do.
  await sql`select pg_advisory_lock(4242002)`;
  await migrate(db, { migrationsFolder });
  console.log('Migrations applied.');
} finally {
  await close();
}
