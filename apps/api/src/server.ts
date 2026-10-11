import { serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';

import { createApp } from './app';
import { createDeps } from './deps';
import { loadEnv } from './env';
import { startReminders } from './jobs/reminders';
import { startRetention } from './jobs/retention';
import { startSeries } from './jobs/series';
import { flushSentry, startSentry } from './lib/sentry';

const env = loadEnv();
startSentry(env);
const { deps, close } = createDeps(env);
const app = createApp(deps);
const stopReminders = startReminders(deps);
const stopSeries = startSeries(deps);
const stopRetention = startRetention(deps);

// Chat sockets share the HTTP port; Hono routes upgrade requests to this server.
const wss = new WebSocketServer({ noServer: true });

const server = serve({ fetch: app.fetch, port: env.PORT, websocket: { server: wss } }, (info) => {
  deps.logger.info({ port: info.port }, 'Buddy API listening');
});

// Docker sends SIGTERM on deploys; finish in-flight requests, then close the pool.
const shutdown = (signal: string) => {
  deps.logger.info({ signal }, 'Shutting down');
  stopReminders();
  stopSeries();
  stopRetention();
  wss.close();
  server.close(() => {
    // Send any crash reports still queued before exiting.
    void Promise.allSettled([close(), flushSentry()]).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
