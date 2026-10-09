import { serve } from '@hono/node-server';

import { createApp } from './app';
import { createDeps } from './deps';
import { loadEnv } from './env';

const env = loadEnv();
const { deps, close } = createDeps(env);
const app = createApp(deps);

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  deps.logger.info({ port: info.port }, 'Buddy API listening');
});

// Docker sends SIGTERM on deploys; finish in-flight requests, then close the pool.
const shutdown = (signal: string) => {
  deps.logger.info({ signal }, 'Shutting down');
  server.close(() => {
    void close().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
