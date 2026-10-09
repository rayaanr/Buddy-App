import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { createDb } from '../src/db/client';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/buddy_test';

/** Brings the test database up to the latest migration before any test runs. */
export default async function setup() {
  const { db, close } = createDb(TEST_DATABASE_URL, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
  } finally {
    await close();
  }
}
