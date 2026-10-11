# Testing on an Android phone

From nothing to Buddy on your phone, talking to the real API. Commands run from `apps/mobile` unless they say otherwise, signed in to Expo (`npx eas-cli@latest login`). The free Expo plan covers all of it.

## Once

1. **Over-the-air updates.** Before the first build, so every build can get JavaScript fixes without a reinstall:

   ```bash
   npx eas-cli@latest update:configure
   ```

   It adds the update URL and runtime version to `app.json` and a channel to each profile in `eas.json`. Commit what it changes.

2. **Deploy the API.** Follow [infra/README.md](../infra/README.md) steps 1 to 3 (server, tunnel, R2, GitHub secrets, deploy). Check `https://api-buddy.<DOMAIN>/health` answers `{"status":"ok"}`. Put your email in `ADMIN_EMAILS` in the `ENV_FILE` secret to get the Buddy team screens.

3. **Point preview builds at it.** Preview builds read the EAS `preview` environment:

   ```bash
   npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value https://api-buddy.<DOMAIN> --environment preview --environment production --visibility plaintext
   ```

4. **Push (optional, free):** the "Android push notifications" steps in [infra/README.md](../infra/README.md).

5. **Crash reports (optional, free):** the "Crash reports (Sentry)" steps in [infra/README.md](../infra/README.md).

## Build and install

```bash
npx eas-cli@latest build --profile preview --platform android
```

It takes 10 to 20 minutes in the queue on the free plan. When it's done, open the link it prints on the phone and install the APK (allow installs from your browser when Android asks).

## After a change

- **JavaScript only** (screens, text, logic):
  `npx eas-cli@latest update --channel preview --environment preview --message "…"`. Close the app fully and reopen it, twice if needed: the first launch downloads, the next one runs it.
- **New native package or app.json change:** build again.

## What to try on the phone

Things the web build can't check:

- [ ] Sign in with an email code (the code arrives by email, not in the log)
- [ ] Allow notifications when asked (after joining or hosting), then have a second account message the chat: a push arrives, tapping it opens the chat
- [ ] Unread count on the app icon, if your launcher shows badges
- [ ] Map: drag, fling, pinch and double-tap zoom; full screen
- [ ] Picks deck: swipe left and right
- [ ] Chat: keyboard doesn't cover the composer, send a photo from camera and gallery
- [ ] Back gesture and the system back button on every screen
- [ ] Turn on airplane mode, then off: lists refresh by themselves
- [ ] With Sentry set up: the app's Sentry project lists your phone's sessions under Releases (errors appear there if anything breaks)
