/**
 * Wipes the database and loads the sample data.
 *
 *   bun run --filter @buddy/api db:seed         core + demo extras
 *   bun run --filter @buddy/api db:seed --core  just what the tests use
 *   … db:seed --if-empty                         only into a database with no users yet
 *
 * In Docker: docker compose exec api node dist/seed.js
 */
import { createDb } from '../../src/db/client';
import { user } from '../../src/db/schema';
import { DEMO_EMAIL, seed } from './index';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database: seeding deletes all data.');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const { db, close } = createDb(url, { max: 1 });
const hasData = async () => (await db.select({ id: user.id }).from(user).limit(1)).length > 0;
try {
  if (process.argv.includes('--if-empty') && (await hasData())) {
    console.log('Database already has data, so not seeding. `bun run db:seed` starts it over.');
  } else {
    const counts = await seed(db, { demo: !process.argv.includes('--core') });
    console.log('Seeded', counts);
  }
  console.log(
    `Sign in as ${DEMO_EMAIL} (or <first name>@buddy.test); codes appear in the API log.`,
  );
} finally {
  await close();
}
