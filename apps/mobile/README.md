# Buddy mobile app

Expo app for **Buddy**: find people nearby to do things with. Built from a Claude Design prototype ([`design/project/Buddy.dc.html`](../../design/project/Buddy.dc.html)), with mock data set in Colombo. The full design handoff, including the design chat transcript, is in [`design/`](../../design/).

**Stack:** Expo SDK 57 · Expo Router (typed routes) · NativeWind v4 (Tailwind 3) · Zustand + AsyncStorage · Reanimated 4 + Gesture Handler · expo-image · TypeScript (strict)

## Run it

```bash
npm install           # from the repo root (npm workspaces)
npm run mobile        # then press i / a, or scan the QR code with Expo Go
```

Checks (run from `apps/mobile`, or from the root for every package):

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint
npm run format        # prettier + tailwind class sorting
```

## Flows

| Flow           | How to see it                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| New user       | Sign up → pick 3+ interests → Discover (no swipe deck on the first visit)                                                                        |
| Returning user | Reload the app while signed in, or Profile → Log out → **Continue as …**. The "Picked for you" deck opens.                                       |
| Swipe deck     | Drag right or tap ✓ to open that activity's details. Drag left or tap ✕ to skip. After the last skip: "You're all caught up."                    |
| Core loop      | Discover → activity → **Join** → **Open group chat** → send a message (Sending… → Sent ✓ → Seen ✓✓ plus an auto-reply)                           |
| Communities    | Join a community and its activities appear first: Discover row, Activities panel, swipe deck. Tap a member or a chat name to open their profile. |
| Host           | Centre **+** → fill in a title and place → **Publish** lands on Activities → Hosting                                                             |
| Start over     | Log out → "Not you? Start over" clears the account                                                                                               |

## Project structure

```
src/
  app/                      Expo Router routes (screens only)
    _layout.tsx             fonts, splash, store hydration, auth guards (Stack.Protected)
    sign-up.tsx  onboarding.tsx  sign-in.tsx
    (app)/                  signed-in shell (stack)
      (tabs)/               Discover · Activities · Communities · Profile + custom TabBar
      activity/[id]/        index (details) · chat
      community/[id].tsx  user/[name].tsx
      create.tsx  picks.tsx  interests.tsx  edit-profile.tsx (sheet)
  components/
    ui/                     design-system primitives (Button, Chip, Heading, Photo, Avatar, Toast…)
    activity/ chat/ community/ onboarding/ picks/ navigation/
  data/                     seed data + constants (swap for an API later)
  hooks/                    view-model hooks (deck, community feed, insets, hydration)
  lib/                      pure domain logic (labels, filters, deck ranking)
  services/chat.ts          mock chat transport (receipts, typing, auto-reply)
  store/                    Zustand stores: session (persisted), activities (persisted), ui
  theme/tokens.js           colours + fonts shared by Tailwind and TS
  types/models.ts
```

## Conventions

- **Tokens, not hex.** Colours and fonts live in `src/theme/tokens.js` and are exposed as Tailwind classes (`bg-surface`, `text-muted`, `font-display`…). Use `colors` from `@/theme` only where a class can't go (SVG strokes, gradients, shadows).
- **No conflicting classes.** NativeWind doesn't merge classes like `tailwind-merge` does, so components expose props (`variant`, `size`, `tone`, `weight`) instead of letting callers override the same property through `className`.
- **Reanimated views carry motion only.** `className` isn't applied to `Animated.View`, so put styles on an inner `View`.
- **Design → device spacing.** The prototype was drawn on a 390×844 frame. `useScreenInsets().top(designPx)` and `.bottom(designPx)` turn its paddings into safe-area-aware values.
- **Logic stays out of screens.** Ranking, labels and filters are pure functions in `lib/`. Mutations live in stores. Side effects with timers live in `services/`.
- **Navigation** uses Expo Router hrefs only (typed routes on). Auth is enforced by `Stack.Protected` guards in the root layout, never by manual redirects.

## Backend

Nothing talks to a server yet. To hook one up:

1. Replace `SEED_*` in `src/data/` with fetches (TanStack Query fits well) and keep the stores for local UI state.
2. Swap `src/services/chat.ts` for a real socket client, keeping the same `sendMessage(activityId, text)` signature.
3. Back `createAccount` / `signIn` in `store/session.ts` with real auth (OTP to the +94 number).

## Notes

- Photos come from Unsplash and randomuser.me. Offline, cards show the striped hue placeholder from the design.
- Bundle ID / package is the placeholder `com.buddyapp.mobile`. Change it in `app.json` before the first EAS build.
- App icon and splash are still Expo defaults. Logo directions are in [`design/project/Buddy Logo.dc.html`](../../design/project/Buddy%20Logo.dc.html), and none has been chosen yet.
