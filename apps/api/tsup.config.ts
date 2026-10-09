import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    server: 'src/server.ts',
    migrate: 'src/migrate.ts',
    // Dev only: lets the Docker image seed itself (it refuses to run in production).
    seed: 'scripts/seed/run.ts',
  },
  format: 'esm',
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Bundle every dependency so dist/ runs without node_modules (keeps the Docker image small).
  noExternal: [/.*/],
  // Optional native speedups for ws; it falls back to plain JS without them.
  external: ['bufferutil', 'utf-8-validate'],
  // Some bundled CommonJS packages call require() for Node built-ins.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});
