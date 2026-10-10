#!/usr/bin/env node
/**
 * One command from a fresh clone to a running app:
 *
 *   bun run dev          set up, then the API (:7400) and Expo (:7481) together
 *   bun run dev:api      set up, then just the API
 *   bun run setup        set up only
 *
 * Setting up installs packages if needed, creates apps/api/.env with a fresh secret,
 * uses Postgres on :7432 (starting the Docker one if nothing is listening), applies
 * migrations and loads the sample data into an empty database. It never wipes data.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const api = join(root, 'apps/api');
const mobile = join(root, 'apps/mobile');
const DB_PORT = 7432;
const API_PORT = 7400;

const mode = process.argv.includes('--setup')
  ? 'setup'
  : process.argv.includes('--api')
    ? 'api'
    : 'all';

const step = (text) => console.log(`\n\x1b[1m▸ ${text}\x1b[0m`);
const fail = (text) => {
  console.error(`\n\x1b[31m✖ ${text}\x1b[0m`);
  process.exit(1);
};

function run(cmd, args, cwd = root) {
  const { status, error } = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (error) fail(`Couldn't run ${cmd}: ${error.message}`);
  if (status !== 0) fail(`${cmd} ${args.join(' ')} failed.`);
}

function listening(port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.setTimeout(1000);
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => (socket.destroy(), resolve(false)));
  });
}

async function waitFor(port, seconds) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await listening(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// 1. Packages.
if (!existsSync(join(root, 'node_modules'))) {
  step('Installing packages');
  run('bun', ['install']);
}

// 2. API settings: copy the example and give it a real secret.
const envFile = join(api, '.env');
if (!existsSync(envFile)) {
  step('Creating apps/api/.env');
  const example = readFileSync(join(api, '.env.example'), 'utf8');
  const secret = randomBytes(32).toString('base64');
  writeFileSync(
    envFile,
    example.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret}`),
  );
}

// 3. Database: whatever is on :7432, or the Docker one.
if (await listening(DB_PORT)) {
  step(`Using the Postgres on :${DB_PORT}`);
} else {
  step(`Starting Postgres on :${DB_PORT} (Docker)`);
  const docker = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' });
  if (docker.status !== 0) {
    fail(
      `Nothing is listening on :${DB_PORT} and Docker isn't available.\n` +
        `  Start Docker, or run Postgres 16 with PostGIS on port ${DB_PORT}.`,
    );
  }
  run('docker', ['compose', 'up', '-d', '--wait', 'db']);
  if (!(await waitFor(DB_PORT, 30))) fail(`Postgres didn't come up on :${DB_PORT}.`);
}

// 4. Schema and sample data.
step('Applying migrations');
run('bun', ['run', 'db:migrate'], api);
step('Sample data');
run('bun', ['run', 'db:seed', '--if-empty'], api);

if (mode === 'setup') {
  console.log('\nReady. `bun run dev` starts the API and the app.');
  process.exit(0);
}

// 5. Start.
if (await listening(API_PORT)) {
  fail(
    `Something is already running on :${API_PORT}. Stop it (an earlier \`bun run dev\`?) first.`,
  );
}

if (mode === 'api') {
  step(`API on http://localhost:${API_PORT}`);
  const child = spawn('bun', ['run', 'dev'], { cwd: api, stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  step(`API on http://localhost:${API_PORT}, app on :7481`);
  // The API runs in its own process group so Ctrl+C reaches Expo first, then we stop
  // the API (and the server tsx watch started) together.
  const server = spawn('bun', ['run', 'dev'], {
    cwd: api,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  const prefix = (stream, out) => {
    let rest = '';
    stream.on('data', (chunk) => {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop();
      for (const line of lines) out.write(`\x1b[36m[api]\x1b[0m ${line}\n`);
    });
  };
  prefix(server.stdout, process.stdout);
  prefix(server.stderr, process.stderr);

  const stopServer = () => {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  };
  process.on('exit', stopServer);
  server.on('exit', (code) => {
    if (code) console.error(`\x1b[31m[api] stopped (exit ${code})\x1b[0m`);
  });

  if (!(await waitFor(API_PORT, 30))) {
    stopServer();
    fail(`The API didn't start on :${API_PORT}; see the [api] lines above.`);
  }

  const app = spawn('bun', ['run', 'start'], { cwd: mobile, stdio: 'inherit' });
  // Ctrl+C goes to Expo too; wait for it to exit, then take the API down with us.
  process.on('SIGINT', () => {});
  process.on('SIGTERM', () => app.kill('SIGTERM'));
  app.on('exit', (code) => process.exit(code ?? 0));
}
