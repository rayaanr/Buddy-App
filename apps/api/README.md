# Buddy API

Hono on Node with Postgres + PostGIS (Drizzle ORM) and Better Auth email sign-in.
Request and response shapes live in [`packages/shared`](../../packages/shared).

## Local setup

The quickest way is `bun run dev` (or `bun run dev:api` for the API alone) from the repo root: it does every step below for you, seeds only an empty database, and is safe to rerun. See the [root README](../../README.md#quick-start).

Everything in Docker (from the repo root; see [`compose.yaml`](../../compose.yaml)):

```bash
docker compose up -d --build                # Postgres + PostGIS on :7432, the API on :7400
docker compose exec api node dist/seed.js   # sample data; wipes existing data
docker compose logs -f api                  # sign-in codes appear here
```

Or by hand: only the database in Docker, with the API running from source for reloads and tests:

```bash
# 1. Postgres + PostGIS (creates the buddy and buddy_test databases)
docker compose up -d db

# 2. Configuration
cp apps/api/.env.example apps/api/.env
#    then set BETTER_AUTH_SECRET:  openssl rand -base64 32

# 3. Schema and sample data
bun run --filter @buddy/api db:migrate
bun run --filter @buddy/api db:seed        # wipes existing data

# 4. Run
bun run --filter @buddy/api dev            # http://localhost:7400/health
```

Both images are Alpine: `imresamu/postgis:17-3.5-alpine` (multi-arch build of PostGIS; the official image has no arm64) and `node:22-alpine`. The API image ([`Dockerfile`](Dockerfile)) contains only the bundled `dist/` and the migrations, with no `node_modules`; it applies migrations on start. Compose runs it with `NODE_ENV=development`; override settings (R2 keys, `RESEND_API_KEY`) in a `.env` next to `compose.yaml`.

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

Everyone else signs in as `<first name>@buddy.test`. Pass `--core` for the test data only: `bun run --filter @buddy/api db:seed --core`.

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

## Reporting and blocking

| Endpoint                   | Purpose                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `POST /v1/reports`         | Report one `userId`, `messageId` or `activityId` with a `reason` and optional note  |
| `POST /v1/users/:id/block` | Block someone (repeat calls are no-ops); `DELETE` to unblock                        |
| `GET /v1/me/blocks`        | People you blocked                                                                  |
| `DELETE /v1/me`            | Delete your account and everything that hangs off it (sessions, messages, hosting…) |

**Blocking hides people from each other in both directions.** The rule lives in `src/modules/safety/blocks.ts` and is applied in one place per surface: activity lists (`findActivitySummaries`), attendees, community members, chat history, live socket events, push notifications and profiles. Activities you're already going to stay visible.

**Reports** go into the `reports` table with `status = 'open'`, are logged, and are emailed to `MODERATION_EMAIL` when set. Set it in production: App Review expects reports to be acted on within 24 hours. There's no admin screen yet; review them in the database.

## Hosting, reminders and share links

| Endpoint                                         | Purpose                                                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `PATCH /v1/activities/:id`                       | Host edits title, type, time, place, spots or notes until it starts. Spots can't drop below who's going.                                 |
| `POST /v1/activities/:id/cancel`                 | Host calls it off. It stays visible, marked `cancelled`, only to the people who were going.                                              |
| `POST /v1/activities/:id/waitlist`               | Wait for a spot on a full activity (max 10 waiting); joins straight away if one is free. `DELETE` to leave.                              |
| `POST /v1/activities/:id/members/:userId/remove` | Host removes a guest or someone waiting, with a private `reason` (`not_a_fit`, `behaviour`, `other`). They can't rejoin or see it again. |
| `POST /v1/activities/:id/mute`                   | `{ muted }`: no chat notifications from this activity (members only).                                                                    |
| `GET /a/:id` (public HTML)                       | The page behind shared links: Open Graph tags for chat-app previews and an "Open in Buddy" (`buddy://`) link                             |

People waiting live in `activity_waitlist`, apart from `activity_members`, so they never count as going (chat, counts, reminders). When someone leaves or the host adds spots, the first in line moves in automatically (with the activity row locked, so a racing join can't take the spot), gets a "You're in" push, and the chat shows "… joined from the waitlist". Cancelling clears the waitlist and tells those people too. A new time or place, or a cancellation, is posted in the group chat and pushed to everyone going. Weekly activities (`repeatsWeekly`) share a `series_id`: once the latest occurrence starts, `src/jobs/series.ts` posts the next week's as a copy of it (so host edits carry forward, and people the host removed stay removed) and tells last week's group it's on again. A unique (series, start) index keeps it to one per week across instances; turning repeating off on any occurrence stops the series. A job in the API process (`src/jobs/reminders.ts`, every minute) pushes "Coming up" two hours before an activity and "How was it?" three hours after (if anyone joined). Each is claimed with a single `UPDATE … RETURNING`, so running several API instances never double-sends, and moving an activity's time re-arms both.

## Towns and meeting points

Buddy covers all of Sri Lanka. The `places` table holds ~2,100 towns (postal towns with coordinates, districts, provinces, and Sinhala and Tamil names), loaded by migration `0009_places`.

| Endpoint                                  | Purpose                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /v1/places/search?q=` (public)       | Towns by name, prefixes first; close spellings ("nugegda") and other names ("Cinnamon Gardens") match |
| `GET /v1/places/nearest?lat&lng` (public) | The town to call a point: a main town within 5 km, else the nearest reliable place                    |
| `GET /v1/venues/search?q&lat&lng`         | Meeting points from the configured provider, biased towards `lat/lng` or your home town               |
| `GET /v1/activities?lat&lng` / `?placeId` | Discover from where you are / a town you're browsing (else home); widens to 50–450 km when it's quiet |

- **Profiles** store a home town (`place_id`), never an address. Distances use the town's centre.
- **Activities** store the meeting point and the town it's in (`place_id`, a foreign key to `places`, the town nearest the point); `area` keeps that town's name for display.
- **Venue search** is pluggable (`src/lib/venues.ts`): `VENUE_PROVIDER=osm` (default; OpenStreetMap via [Photon](https://photon.komoot.io), built for search-as-you-type), `google` (Places API (New) Text Search, needs `GOOGLE_PLACES_API_KEY`; billed per request beyond Google's free tier) or `towns` (no outside service). Results are cached for 10 minutes, and if the provider is down it falls back to towns. Adding a provider means one more `search(query, near)` returning `Venue[]`. For production traffic, run your own Photon (`PHOTON_URL`) rather than the public server.
- **Data quality.** The source gives some villages a nearby town's coordinates; places sharing a point with two or more others are marked `approximate` and never used to name a location. Towns with a main post office are marked `main` and preferred when naming one.
- **Updating the towns.** `bunx tsx scripts/places/build.ts` (from `apps/api`) prints the SQL; put it in a new migration (rows upsert by id).
- **Data sources and licences.** Towns from [`sri-lanka-postal-locations`](https://github.com/hareeshkar/sri-lanka-postal-locations) (MIT), derived from [madurapa/sri-lanka-provinces-districts-cities](https://github.com/madurapa/sri-lanka-provinces-districts-cities) (MIT, © 2016 Maduka Jayalath) and [SKIDDOW/SriLankaCitiesDatabase](https://github.com/SKIDDOW/SriLankaCitiesDatabase) (MIT, © 2024 SKIDDOW); main post offices from [`lankapost`](https://github.com/AbQaadir/lankapost) (MIT). Venue results from Photon are © OpenStreetMap contributors (ODbL), so show "© OpenStreetMap" where venue results appear in a public release.

## Rate limits and abuse

Per signed-in user unless noted (`src/lib/rate-limit.ts`; counted in memory, so per API instance):

| What                          | Limit                                              | Why                                                            |
| ----------------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| Chat messages                 | 30 / minute                                        | Each can push to everyone in the chat                          |
| Join, leave, waitlist         | 30 / 10 minutes                                    | Each posts a chat line                                         |
| Host edits, cancels, removals | 30 / hour                                          | Time/place changes push to everyone                            |
| Host change notifications     | 3 / hour per activity                              | The chat line still goes up; phones aren't spammed             |
| New activities                | 20 / hour                                          |                                                                |
| Reports                       | 10 / hour                                          | Each emails the moderators (repeat reports within a day don't) |
| Venue search                  | 60 / minute                                        | Google Places is billed per call; Photon asks for fair use     |
| Upload tickets                | 30 / hour                                          | Storage costs                                                  |
| Town search (public)          | 120 / minute per IP                                |                                                                |
| Sign-in codes                 | 3 / minute per IP (production), 5 / hour per email | Each sends an email; no inbox bombing                          |

Over the limit is a `429` with code `rate_limited` and a `Retry-After` header. Behind a reverse proxy set `TRUSTED_PROXY_HOPS` (1 for Caddy on the same server) so limits see the client's IP, not the proxy's (2 for Cloudflare then Caddy). With 0, `X-Forwarded-For` is ignored, sign-in limits included.

Also hardened: Better Auth's own `update-user`, `change-email` and `delete-user` routes are off (the app uses `/v1/me`), upload keys must match exactly what `/v1/uploads` issued, chat sockets refuse other sites' pages and re-check membership once open, share pages only show upcoming activities, and a blocked person's profile shows only their name and photo. Known and accepted: chat system lines ("Ashan joined") still name someone you blocked.

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
