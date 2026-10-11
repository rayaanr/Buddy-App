import { serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';

import { createApp } from './app';
import { createDeps } from './deps';
import { loadEnv } from './env';
import { fillMissingPictures } from './jobs/pictures';
import { startReminders } from './jobs/reminders';
import { startRetention } from './jobs/retention';
import { startSeries } from './jobs/series';
import { startUploadSweep } from './jobs/uploads';
import { flushSentry, startSentry } from './lib/sentry';
import { WS_MAX_BYTES } from './realtime/hub';

const env = loadEnv();
startSentry(env);
const { deps, close } = createDeps(env);
const app = createApp(deps);
// Anything saved before Buddy had its own pictures gets one.
void fillMissingPictures(deps.db, deps.urls)
  .then((n) => n && deps.logger.info({ filled: n }, 'Gave pictures to rows without one'))
  .catch((err: unknown) => deps.logger.error({ err }, 'Could not fill missing pictures'));
const stopReminders = startReminders(deps);
const stopSeries = startSeries(deps);
const stopRetention = startRetention(deps);
const stopUploadSweep = startUploadSweep(deps);

// Chat sockets share the HTTP port; Hono routes upgrade requests to this server.
const wss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_BYTES });

const server = serve({ fetch: app.fetch, port: env.PORT, websocket: { server: wss } }, (info) => {
  deps.logger.info({ port: info.port }, 'Buddy API listening');
});

// Docker sends SIGTERM on deploys; finish in-flight requests, then close the pool.
const shutdown = (signal: string) => {
  deps.logger.info({ signal }, 'Shutting down');
  stopReminders();
  stopSeries();
  stopRetention();
  stopUploadSweep();
  wss.close();
  server.close(() => {
    // Send any crash reports still queued before exiting.
    void Promise.allSettled([close(), flushSentry()]).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
