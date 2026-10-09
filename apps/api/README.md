# Buddy API

Hono on Node with Postgres + PostGIS (Drizzle ORM) and Better Auth email sign-in.
Request and response shapes live in [`packages/shared`](../../packages/shared).

## Local setup

Everything in Docker (from the repo root; see [`compose.yaml`](../../compose.yaml)):

```bash
docker compose up -d --build                # Postgres + PostGIS, and the API on :3000
docker compose exec api node dist/seed.js   # sample data; wipes existing data
docker compose logs -f api                  # sign-in codes appear here
```

Or only the database in Docker, with the API running from source for reloads and tests:

```bash
# 1. Postgres + PostGIS (creates the buddy and buddy_test databases)
docker compose up -d db

# 2. Configuration
cp apps/api/.env.example apps/api/.env
#    then set BETTER_AUTH_SECRET:  openssl rand -base64 32

# 3. Schema and sample data
npm run db:migrate -w @buddy/api
npm run db:seed -w @buddy/api        # wipes existing data

# 4. Run
npm run dev -w @buddy/api            # http://localhost:3000/health
```

Both images are Alpine: `postgis/postgis:16-3.4-alpine` and `node:22-alpine`. The API image ([`Dockerfile`](Dockerfile)) contains only the bundled `dist/` and the migrations, with no `node_modules`; it applies migrations on start. Compose runs it with `NODE_ENV=development`; override settings (R2 keys, `RESEND_API_KEY`) in a `.env` next to `compose.yaml`.

**Signing in during development:** without `RESEND_API_KEY`, sign-in codes are printed to the API log instead of emailed.

## Sample data

[`scripts/seed`](scripts/seed) loads Colombo data in two layers:

| File             | Contents                                                     |
| ---------------- | ------------------------------------------------------------ |
| `people.ts`      | 16 people with areas, bios and interests                     |
| `communities.ts` | 4 core communities, 2 demo ones, and extra demo memberships  |
| `activities.ts`  | 9 core activities and 12 demo ones (3 of them in the past)   |
| `index.ts`       | `seed(db, { demo })`: wipes the tables and inserts the above |
| `run.ts`         | The `db:seed` command (`dist/seed.js` in the Docker image)   |

The **core** layer is the design's data; the integration tests seed it before every test and assert on it, so change it together with the tests. The **demo** layer, loaded by default, adds what you need to click through the app as Kavindu:

| Sign in as           | What's there                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `kavindu@buddy.test` | Hosting _Wingspan and coffee_ with three guests chatting; joined _Padel_ and _Crag day trip_; three past activities in Profile → Recent; picks |
| `nethmi@buddy.test`  | Hosts two runs (the other side of a chat)                                                                                                      |
| `sanduni@buddy.test` | Hosts _Sunrise yoga_, which is full: anyone else sees "Activity full"                                                                          |

Everyone else signs in as `<first name>@buddy.test`. Pass `--core` for the test data only: `npm run db:seed -w @buddy/api -- --core`.

## Real-time chat

Each activity's chat lives under `/v1/activities/:id/chat` and is open to members (host included):

| Endpoint                   | Purpose                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET /messages?after=<id>` | History oldest first; `after` catches up after a reconnect. Includes `othersReadUpTo` for "Seen". |
| `POST /messages`           | Send `{ id, body }`. The app generates `id`, so retries never duplicate (201 new, 200 repeat).    |
| `POST /read`               | Move your read position to `{ messageId }`.                                                       |
| `GET /ws` (WebSocket)      | Live `message`, `typing` and `read` events. Send `{"type":"typing"}`.                             |

Sending goes over HTTP, not the socket, so the app gets a clear success or failure. The server pings every 30 seconds and drops sockets that don't answer. Members who aren't connected to that chat get an Expo push notification; the app registers its token with `POST /v1/me/push-tokens` and removes it on sign-out.

Connections live in this process's memory (`src/realtime/hub.ts`). That's right for one API process; running several would need Redis pub/sub to relay events between them.

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
| `build` / `start` | Bundle to `dist/` with tsup (all dependencies), then run it |
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
scripts/seed/        sample data (see above)
drizzle/             SQL migrations (generated; see note below)
test/                integration tests and harness
```

## Conventions

- **Errors:** throw `HttpError` (or helpers like `notFound`). Every error response is `{ error: { code, message, details? } }`.
- **Validation:** `validate('json' | 'query', schema)` with schemas from `@buddy/shared`.
- **Activities:** list endpoints go through `findActivitySummaries`, so counts and viewer flags are computed one way.
- **Migrations and PostGIS:** drizzle-kit quotes the `geography(Point,4326)` type in generated SQL. When a migration adds such a column, remove the quotes by hand (see `src/db/geography.ts`).
