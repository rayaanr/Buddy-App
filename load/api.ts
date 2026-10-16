/**
 * Builds the API and runs it the way production does (node dist/server.js,
 * NODE_ENV=production) against the load database, on API_PORT.
 *
 *   bun run --filter @buddy/load api                 one copy
 *   INSTANCES=3 bun run --filter @buddy/load api     three, behind Caddy, sharing Redis
 *   bun run --filter @buddy/load api --cpu-prof      extra arguments go to node
 *
 * Several copies need Docker (for Caddy) and Redis (`docker compose up -d redis`).
 */
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { API_PORT, API_URL, AUTH_SECRET, DATABASE_URL } from './env';

const api = fileURLToPath(new URL('../apps/api', import.meta.url));
const INSTANCES = Number(process.env.INSTANCES ?? 1);
/** Its own Redis database, apart from the tests'. */
const REDIS_URL = 'redis://localhost:7479/2';

const built = spawnSync('bun', ['run', 'build'], { cwd: api, stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status ?? 1);

const start = (port: number) =>
  spawn('node', [...process.argv.slice(2), 'dist/server.js'], {
    cwd: api,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'production',
      PORT: String(port),
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
      DATABASE_URL,
      ...(INSTANCES > 1 && { REDIS_URL }),
      BETTER_AUTH_URL: API_URL,
      BETTER_AUTH_SECRET: AUTH_SECRET,
      // Nothing here sends email or touches storage: sessions are made by
      // prepare.ts, and these placeholders make sure a stray call fails rather
      // than reaching a real bucket.
      RESEND_API_KEY: 're_load_test',
      R2_ACCOUNT_ID: 'load-test',
      R2_ACCESS_KEY_ID: 'load-test',
      R2_SECRET_ACCESS_KEY: 'load-test',
      R2_BUCKET: 'load-test',
      R2_PUBLIC_URL: 'http://img.load.test',
      VENUE_PROVIDER: 'towns',
    },
  });

const children: ChildProcess[] = [];
if (INSTANCES === 1) {
  children.push(start(API_PORT));
} else {
  // Copies on the next ports, and Caddy on API_PORT balancing them like production.
  const ports = Array.from({ length: INSTANCES }, (_, i) => API_PORT + 1 + i);
  children.push(...ports.map(start));
  const caddyfile = `:${API_PORT} {
  reverse_proxy ${ports.map((p) => `127.0.0.1:${p}`).join(' ')} {
    lb_policy least_conn
    lb_try_duration 10s
  }
}`;
  spawnSync('docker', ['rm', '-f', 'buddy-load-caddy'], { stdio: 'ignore' });
  const caddy = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      'buddy-load-caddy',
      '--network',
      'host',
      '-i',
      'caddy:2-alpine',
      'sh',
      '-c',
      'cat > /etc/caddy/Caddyfile && caddy run --config /etc/caddy/Caddyfile',
    ],
    { stdio: ['pipe', 'ignore', 'ignore'] },
  );
  caddy.stdin.end(caddyfile);
  children.push(caddy);
}

console.log(`API on ${API_URL}${INSTANCES > 1 ? ` (${INSTANCES} copies)` : ''} (Ctrl+C stops it)`);
const stop = () => {
  for (const child of children) child.kill('SIGTERM');
  spawnSync('docker', ['rm', '-f', 'buddy-load-caddy'], { stdio: 'ignore' });
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
let left = children.length;
for (const child of children) child.on('exit', () => --left === 0 && process.exit(0));
