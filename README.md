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

Each app has its own README with setup details.
