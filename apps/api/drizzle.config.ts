import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  // PostGIS owns tables like spatial_ref_sys; keep them out of migrations.
  extensionsFilters: ['postgis'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:7432/buddy',
  },
});
