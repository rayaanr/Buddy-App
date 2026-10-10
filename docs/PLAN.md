# Buddy backend plan

## Decisions

| Area           | Choice                                         | Why                                                   |
| -------------- | ---------------------------------------------- | ----------------------------------------------------- |
| API            | Hono on Node                                   | Light, TypeScript-first, typed RPC client for the app |
| Hosting        | One VPS, Docker Compose (API, Postgres, Caddy) | Low fixed cost, no vendor lock-in                     |
| Database       | Postgres + PostGIS, Drizzle ORM                | Relational data and "near me" queries                 |
| Auth           | Better Auth, email one-time codes              | No SMS costs; runs inside the API                     |
| Email          | Resend (free tier)                             | Sends sign-in codes; needs a verified domain          |
| Images         | Cloudflare R2, presigned uploads               | No egress fees; uploads skip the VPS                  |
| Real-time chat | WebSockets in the API process                  | Server is always on anyway; no extra service          |
| Push           | Expo Push                                      | Free; covers backgrounded apps                        |
| Contracts      | Zod schemas in `packages/shared`               | One source of truth for app and API                   |

## Status

Phases 0–7 are done (M1–M4). Phase 8 is under way: reporting, blocking and account deletion are done; the privacy policy, store declarations, icon and builds remain. Phase 9 (deploy) is on hold until local testing is done.

Changes from the original plan, decided while building:

- **Mobile sign-in screens moved from Phase 3 to Phase 7**, so the app switched from mock data to real accounts in one step instead of mixing both.
- **Code-entry screen added** (`verify.tsx`): email sign-in needs one, and the design had none.
- **"Good to see you" works offline**: the device remembers the last account and a picks preview, since the server can't personalise anything for a signed-out user.
- **`GET /v1/activities/history`** added for Profile → Recent.
- **Sign-in rate limiting is production-only** (Better Auth's default).
- **`@hono/node-ws` dropped**: `@hono/node-server` v2 has WebSockets built in.
- **Local backend in Docker Compose** (`compose.yaml` at the root): Postgres + PostGIS and the API, both on Alpine images. The API image holds only the bundled `dist/` (no `node_modules`), and runs migrations on start.
- **Seed data in two layers**: the core set the tests assert on, plus demo extras for local testing (hosting, a full activity, every area, past activities).
- **Blocking works both ways**: neither person sees the other's messages (history, live, push), hosted activities or place in attendee lists, and the blocked person gets "not found" for the blocker's profile. Activities you're already going to stay visible so you can still leave them.
- **Reports are emailed** to `MODERATION_EMAIL` (and always logged). There's no admin screen: review them in the `reports` table and update `status`. App Review expects reports handled within 24 hours.
- **The swipe deck only opens when the app launches on Discover**, so links into a chat or activity aren't covered by it.

Known gaps carried forward: tapping a push notification opens the app but not the chat; no photo picker in the UI yet (API ready); activity locations use area centres until a map picker exists; orphaned R2 uploads aren't cleaned up; the WebSocket heartbeat has no automated test.

## Phases

### Phase 0: Monorepo

- Move the app to `apps/mobile`; npm workspaces at the root.
- Root scripts (`dev`, `lint`, `typecheck`, `test`) across packages.
- GitHub Actions: lint, typecheck and tests on every push.
- **Done when** the Expo app typechecks, lints and bundles from its new location.

### Phase 1: Shared contracts (`packages/shared`)

- Zod schemas for every API request and response.
- Real timestamps replace day labels ("Tonight"); the app formats them in Sri Lanka time.

### Phase 2: API foundation (`apps/api`)

- Hono on Node: validated environment, structured logs, one error format, `/health`.
- Drizzle schema and migrations: users and sessions (Better Auth), `profiles`, `communities`, `community_members`, `activities` (PostGIS point), `activity_members`, `messages`, `chat_reads`, `blocks`, `reports`, `push_tokens`.
- Seed script with the Colombo data.
- `compose.yaml` for local Postgres + PostGIS and the API.
- Integration tests against real Postgres.
- **Done when** the API runs locally and serves the seeded activities.

### Phase 3: Sign-in

- Better Auth email one-time codes via Resend; sessions stored securely on the phone.
- Sign up → Onboarding → Sign in use real accounts (email replaces +94 phone).
- Account deletion endpoint (required by Apple and Google).
- **Done when** a user can sign up by email, onboard, sign out and sign back in.

### Phase 4: Core features

- Activities: nearby feed with filters and PostGIS distance; details; create; join/leave with a transactional capacity check.
- Communities: list, details, join, leave.
- Profiles: own (view, edit) and others' (interests in common).
- Picks: deck ranking moves to the server.
- **Done when** every screen's data can come from the API.

### Phase 5: Images

- Short-lived R2 upload links restricted to image types and size; the app uploads directly.
- Profile photos and activity covers.

### Phase 6: Real-time chat

- WebSocket endpoint checking sign-in and membership on connect.
- In-memory registry of connections per chat.
- Sending over HTTP with a client-generated ID (retries never duplicate); saved, then broadcast.
- Typing signals (throttled, not stored); read positions drive Seen.
- 30-second heartbeat; "messages after X" catch-up endpoint.
- Expo Push for members who aren't connected.

### Phase 7: App on the real API

- TanStack Query replaces mock data; Zustand keeps UI and session state only.
- Typed API client from Hono's types.
- WebSocket hook with automatic reconnect and backoff.
- Sending → Sent → Seen with instant display.
- Loading, error and offline states; mock data removed.

### Phase 8: Store readiness

- ✅ Moderation: report messages, people and activities; block and unblock people; hide blocked content (Apple guideline 1.2).
- ✅ Account deletion in Profile.
- Privacy policy page.
- Store data declarations (email, location); App Review demo account.
- Final icon and splash, real bundle ID, EAS build profiles per environment.

### Phase 9: Deploy (on hold)

Deferred until the app has been tested locally.

- VPS hardening: only 80/443 open, SSH keys only, automatic security updates, Postgres private.
- `infra/docker-compose.yml` (API, Postgres, Caddy); migrations run on deploy.
- Nightly `pg_dump` to R2, plus one tested restore.
- Uptime monitoring and logs; optional GitHub Actions deploy over SSH.

## Milestones

| Milestone                  | Phases | Result                                   |
| -------------------------- | ------ | ---------------------------------------- |
| M1: Foundation             | 0–2    | API runs locally with seeded data        |
| M2: Real accounts and data | 3–5    | Sign-in, activities, communities, images |
| M3: Chat                   | 6      | Live group chat with receipts and push   |
| M4: App on real backend    | 7      | Mock data gone                           |
| M5: Ship                   | 8–9    | Deployed and submitted to both stores    |

## Inputs needed

1. VPS provider, OS and RAM (Phase 9).
2. A domain name (~$10/year): required for Resend sending to real users and for HTTPS.
3. Resend and Cloudflare R2 accounts (free) before Phases 3 and 5 go live.
