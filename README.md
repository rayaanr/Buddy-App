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

npm workspaces tie the packages together: run `npm install` once at the root.

## Common commands

```bash
npm install          # install everything
npm run mobile       # start the Expo dev server
npm run lint         # lint every package
npm run typecheck    # typecheck every package
npm run test         # run every package's tests
npm run format       # format with Prettier
```

## Run the backend locally

Needs Docker. From the repo root:

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

Then `npm run mobile`. The app finds the API on the machine running the Expo dev server, so a phone on the same Wi-Fi needs no setup.

Each app has its own README with setup details.
