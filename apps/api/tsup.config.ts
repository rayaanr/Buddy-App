import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/migrate.ts'],
  format: 'esm',
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // The shared package ships TypeScript source; bundle it instead of importing at runtime.
  noExternal: ['@buddy/shared'],
});
