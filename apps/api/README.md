# Buddy API

Hono on Node with Postgres + PostGIS (Drizzle ORM) and Better Auth email sign-in.
Request and response shapes live in [`packages/shared`](../../packages/shared).

## Local setup

```bash
# 1. Postgres + PostGIS (creates the buddy and buddy_test databases)
docker compose -f infra/docker-compose.dev.yml up -d     # from the repo root

# 2. Configuration
cp apps/api/.env.example apps/api/.env
#    then set BETTER_AUTH_SECRET:  openssl rand -base64 32

# 3. Schema and sample data
npm run db:migrate -w @buddy/api
npm run db:seed -w @buddy/api        # Colombo sample data; wipes existing data

# 4. Run
npm run dev -w @buddy/api            # http://localhost:3000/health
```

**Signing in during development:** without `RESEND_API_KEY`, sign-in codes are printed to the API log instead of emailed. The seed creates a demo user, `kavindu@buddy.test`.

## Scripts

| Script            | What it does                                                |
| ----------------- | ----------------------------------------------------------- |
| `dev`             | Run with reload (`tsx watch`)                               |
| `build` / `start` | Bundle to `dist/` with tsup, then run it                    |
| `test`            | Integration tests against `buddy_test` (real Postgres)      |
| `db:generate`     | Create a migration from schema changes in `src/db/schema`   |
| `db:migrate`      | Apply migrations                                            |
| `db:seed`         | Load sample data (refuses to run in production)             |
| `auth:generate`   | Regenerate Better Auth's tables after changing auth plugins |

Production applies migrations with `node dist/migrate.js`, since `drizzle-kit` is a dev dependency.

## Layout

```
src/
  server.ts          process entry: env, deps, HTTP server, graceful shutdown
  app.ts             Hono app: middleware, error handling, routes (exports AppType)
  deps.ts            wires db, auth, mailer and URL helpers from the environment
  env.ts             environment validation
  auth/              Better Auth config and session middleware
  db/                Drizzle client, schema, PostGIS column type
  modules/<feature>/ routes + queries/service per feature
  lib/               errors, validation, mailer, URL helpers
scripts/seed.ts      sample data
drizzle/             SQL migrations (generated; see note below)
test/                integration tests and harness
```

## Conventions

- **Errors:** throw `HttpError` (or helpers like `notFound`). Every error response is `{ error: { code, message, details? } }`.
- **Validation:** `validate('json' | 'query', schema)` with schemas from `@buddy/shared`.
- **Activities:** list endpoints go through `findActivitySummaries`, so counts and viewer flags are computed one way.
- **Migrations and PostGIS:** drizzle-kit quotes the `geography(Point,4326)` type in generated SQL. When a migration adds such a column, remove the quotes by hand (see `src/db/geography.ts`).
