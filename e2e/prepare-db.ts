/**
 * Rebuilds the browser tests' database from scratch: an empty buddy_e2e,
 * migrated and seeded. Run by the API's start command in playwright.config.ts.
 */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

import { DATABASE_URL, OUTBOX } from './env';

const api = fileURLToPath(new URL('../apps/api', import.meta.url));
const name = new URL(DATABASE_URL).pathname.slice(1);

const admin = postgres(DATABASE_URL.replace(`/${name}`, '/postgres'), {
  max: 1,
  onnotice: () => {},
});
try {
  await admin.unsafe(`drop database if exists ${name} with (force)`);
  await admin.unsafe(`create database ${name}`);
} catch (err) {
  console.error(
    'Could not reach Postgres on :7432. Start it with `bun run db:up` (or `bun run setup`).',
  );
  throw err;
} finally {
  await admin.end();
}

const run = (args: string[]) => {
  const { status } = spawnSync('bunx', args, {
    cwd: api,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL, NODE_ENV: 'development' },
  });
  if (status !== 0) throw new Error(`${args.join(' ')} failed`);
};
run(['drizzle-kit', 'migrate']);
run(['tsx', 'scripts/seed/run.ts']);

rmSync(OUTBOX, { force: true });
