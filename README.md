# Buddy

Find people nearby to do things with: runs, games, markets and more, in Colombo.

## Repository layout

| Path                                 | What it is                                                          |
| ------------------------------------ | ------------------------------------------------------------------- |
| [`apps/mobile`](apps/mobile)         | Expo app (iOS and Android)                                          |
| [`apps/api`](apps/api)               | Hono API on Node: Postgres + PostGIS, email sign-in, real-time chat |
| [`packages/shared`](packages/shared) | Zod schemas shared by the app and the API                           |
| [`design`](design)                   | Claude Design handoff the app was built from                        |
| [`docs/PLAN.md`](docs/PLAN.md)       | Backend plan and roadmap                                            |

[Bun](https://bun.sh) workspaces tie the packages together: run `bun install` once at the root. Bun installs packages and runs scripts; the API and the tools (Expo, Vitest, Jest, tsx) still run on Node 22, locally and in production.

## Quick start

Needs [Bun](https://bun.sh), Node 22 and Docker (or your own Postgres 16 + PostGIS on port 7432).

```bash
bun run dev
```

That one command gets a fresh clone running: it installs packages, creates `apps/api/.env` with a fresh secret, uses whatever Postgres is on :7432 (starting the Docker one if nothing is), applies migrations, loads the sample data into an empty database, then starts the API on :7400 and Expo on :7481 together. API lines are prefixed `[api]`; Expo keeps its QR code and `i` / `a` keys. Ctrl+C stops both. It never wipes your data, so run it every time.

## Commands

```bash
bun run dev          # set up if needed, then the API and the app together
bun run dev:api      # same, but only the API
bun run setup        # set up only (packages, .env, database, migrations, sample data)
bun run check        # everything CI runs: format check, lint, typecheck, tests

bun run api          # just the API from source (needs Postgres on :7432)
bun run mobile       # just the Expo dev server
bun run db:up        # start the Docker Postgres
bun run db:migrate   # apply migrations
bun run db:seed      # reload the sample data (wipes the database)

bun run lint         # lint every package
bun run typecheck    # typecheck every package
bun run test         # run every package's tests
bun run format       # format with Prettier
```

## Run the backend in Docker

To run the built API image instead of from source:

```bash
docker compose up -d --build                # Postgres + PostGIS on :7432, API on :7400
docker compose exec api node dist/seed.js   # sample data (wipes the database)
docker compose logs -f api                  # sign-in codes are printed here
```

Buddy stays off the usual defaults so it can run next to other projects:

| Service         | Port |
| --------------- | ---- |
| API             | 7400 |
| Postgres        | 7432 |
| Expo dev server | 7481 |

Sign in as `kavindu@buddy.test`, or any seeded person as `<first name>@buddy.test` (`nethmi@`, `dilan@`, `shehani@`…). No email is sent in development: the 6-digit code shows up in the API log.

The app finds the API on the machine running the Expo dev server, so a phone on the same Wi-Fi needs no setup.

Each app has its own README with setup details.
