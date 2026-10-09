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

## Photo uploads (Cloudflare R2)

Uploads stay disabled (`POST /v1/uploads` answers 503) until all `R2_*` variables are set:

1. Create an R2 bucket, e.g. `buddy-media`.
2. Make it publicly readable through a custom domain (or the `r2.dev` URL for testing), and put that URL in `R2_PUBLIC_URL`.
3. Create an R2 API token with **Object Read & Write** on that bucket only, and set `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_ACCOUNT_ID`.

The flow: the app asks `POST /v1/uploads` for a ticket, `PUT`s the file to `uploadUrl` with the returned headers within 5 minutes, then sends `key` as `avatarKey` (PATCH `/v1/me`) or `coverKey` (POST `/v1/activities`). The signature covers the file's type and exact size, so a ticket can't be reused for a different file.

Not yet handled: files uploaded but never attached, and replaced avatars, stay in the bucket. An R2 lifecycle rule or a periodic cleanup job can remove them later.

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
