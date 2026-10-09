# Buddy mobile app

Expo app for **Buddy**: find people nearby to do things with. Built from a Claude Design prototype ([`design/project/Buddy.dc.html`](../../design/project/Buddy.dc.html)); the full design handoff, including the design chat transcript, is in [`design/`](../../design/). All data comes from the [Buddy API](../api).

**Stack:** Expo SDK 57 · Expo Router (typed routes) · NativeWind v4 (Tailwind 3) · TanStack Query · Better Auth (email codes) · Zustand · Reanimated 4 + Gesture Handler · expo-image · TypeScript (strict)

## Run it

The app needs the API running. Follow [`apps/api/README.md`](../api/README.md) first (Postgres, `.env`, migrate, seed), then:

```bash
npm install                 # from the repo root (npm workspaces)
npm run dev -w @buddy/api   # terminal 1: API on :7400 (or: docker compose up -d)
npm run mobile              # terminal 2: press i / a, or scan the QR code
```

**Where the app looks for the API:** `EXPO_PUBLIC_API_URL` if set; otherwise the machine running the Expo dev server, port 7400. A phone on the same Wi-Fi works without configuration.

**Signing in during development:** sign-in codes are printed in the API's log (no email is sent without `RESEND_API_KEY`). The seed's demo user is `kavindu@buddy.test`.

**Expo Go vs a development build:** everything except push notifications works in Expo Go. Push needs a development build (`npx expo run:ios|android` or `eas build --profile development`) and an EAS project ID; until then the app skips push registration quietly.

**Web (for quick checks):** set `WEB_ORIGINS=http://localhost:7481` in `apps/api/.env` so the browser may call the API, then `npm run web -w @buddy/mobile`.

Checks (run from `apps/mobile`, or from the root for every package):

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint
npm run format        # prettier + tailwind class sorting
```

## Flows

| Flow           | How to see it                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| New user       | Sign up (name, email, area) → 6-digit code from email → pick 3+ interests → Discover (no swipe deck on the first visit)                           |
| Returning user | Reopen the app while signed in, or Log out → **Continue as …** → code. The "Picked for you" deck opens.                                           |
| Swipe deck     | Drag right or tap ✓ to open that activity's details. Drag left or tap ✕ to skip. After the last skip: "You're all caught up."                     |
| Core loop      | Discover → activity → **Join** → **Open group chat** → messages go Sending… → Sent ✓ → Seen ✓✓ when another member reads them, live over a socket |
| Communities    | Join a community and its activities surface first: Discover row, Activities panel, swipe deck                                                     |
| Host           | Centre **+** → title, type, time, place → **Publish** lands on Activities → Hosting                                                               |
| Start over     | Log out → "Not you? Start over" forgets the account on this device                                                                                |
| Report, block  | Long-press someone's message, or **Report**/**Block** on their profile, or **Report activity**. Unblock in Profile → Blocked people               |
| Delete account | Profile → Delete account → **Delete my account**: lands on Sign up with nothing remembered                                                        |

## Project structure

```
src/
  app/                      Expo Router routes (screens only)
    _layout.tsx             providers, fonts, auth routing (Stack.Protected on session + onboarding)
    sign-up.tsx  sign-in.tsx  verify.tsx  onboarding.tsx
    (app)/                  signed-in shell: picks deck trigger, push registration
      (tabs)/               Discover · Activities · Communities · Profile + custom TabBar
      activity/[id]/        index (details) · chat
      community/[id].tsx  user/[id].tsx
      create.tsx  picks.tsx  interests.tsx  edit-profile.tsx (sheet)
  api/
    client.ts               typed Hono client (route types come from apps/api), error handling
    auth-client.ts          Better Auth with session cookie in SecureStore
    auth.ts                 send / verify email codes
    queries.ts              TanStack Query hooks and query keys
    chat.ts                 useChat: history, WebSocket with reconnect + catch-up, optimistic sends
    push.ts                 Expo push token registration
  components/               ui/ primitives and feature components
  data/constants.ts         UI-only constants (type chips, placeholder hues); domain lists live in @buddy/shared
  hooks/  lib/  store/      view helpers, pure formatting, local state (remembered account, toasts)
  theme/tokens.js           colours + fonts shared by Tailwind and TS
```

## Conventions

- **Server state lives in TanStack Query**, never in Zustand. Zustand only holds device-local state: the remembered account and transient UI (toasts, the picks trigger).
- **Types come from `@buddy/shared`** (Zod schemas) and the typed Hono client. The app imports the API's _type_ only; no server code is bundled.
- **Tokens, not hex.** Colours and fonts live in `src/theme/tokens.js` and are exposed as Tailwind classes. Use `colors` from `@/theme` only where a class can't go (SVG strokes, gradients, shadows).
- **No conflicting classes.** NativeWind doesn't merge classes, so components expose props (`variant`, `size`, `tone`, `weight`) instead of letting callers override the same property through `className`.
- **Icons are Lucide**, added to `src/components/ui/icons.tsx` with a deep import (`lucide-react-native/icons/<name>`) so only the icons in use are bundled. Screens use those wrappers, not text glyphs like → or ✓.
- **Reanimated views carry motion only.** `className` isn't applied to `Animated.View`, so put styles on an inner `View`.
- **Wrappers forward everything.** Android and web clone a ScrollView's `refreshControl` and pass the scroll view in as `children`; a wrapper that drops props blanks the screen (see `Refresh`).
- **Design → device spacing.** The prototype was drawn on a 390×844 frame. `useScreenInsets().top(designPx)` and `.bottom(designPx)` turn its paddings into safe-area-aware values.
- **Navigation** uses Expo Router hrefs only (typed routes on). Auth is enforced by `Stack.Protected` guards in the root layout, never by manual redirects.

## Notes

- Signed out, the server can't personalise anything, so the "Good to see you" screen shows a picks preview saved on the device at the last session.
- Edit profile picks the area from chips (not free text): distances are measured from a known area.
- Activities are placed at their area's centre until the Create screen gets a map picker.
- Photo uploads are ready in the API but not in the UI yet (no picker in the design).
- Bundle ID / package is the placeholder `com.buddyapp.mobile`. Change it in `app.json` before the first EAS build.
- App icon and splash are still Expo defaults. Logo directions are in [`design/project/Buddy Logo.dc.html`](../../design/project/Buddy%20Logo.dc.html); none has been chosen yet.
