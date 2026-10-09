/**
 * Wipes the database and loads the sample data.
 *
 *   npm run db:seed -w @buddy/api            core + demo extras
 *   npm run db:seed -w @buddy/api -- --core  just what the tests use
 *
 * In Docker: docker compose -f infra/docker-compose.dev.yml exec api node dist/seed.js
 */
import { createDb } from '../../src/db/client';
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
try {
  const counts = await seed(db, { demo: !process.argv.includes('--core') });
  console.log('Seeded', counts);
  console.log(
    `Sign in as ${DEMO_EMAIL} (or <first name>@buddy.test); codes appear in the API log.`,
  );
} finally {
  await close();
}
