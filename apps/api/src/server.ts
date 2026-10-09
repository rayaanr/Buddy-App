import { serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';

import { createApp } from './app';
import { createDeps } from './deps';
import { loadEnv } from './env';

const env = loadEnv();
const { deps, close } = createDeps(env);
const app = createApp(deps);

// Chat sockets share the HTTP port; Hono routes upgrade requests to this server.
const wss = new WebSocketServer({ noServer: true });

const server = serve({ fetch: app.fetch, port: env.PORT, websocket: { server: wss } }, (info) => {
  deps.logger.info({ port: info.port }, 'Buddy API listening');
});

// Docker sends SIGTERM on deploys; finish in-flight requests, then close the pool.
const shutdown = (signal: string) => {
  deps.logger.info({ signal }, 'Shutting down');
  wss.close();
  server.close(() => {
    void close().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
