# Deploying the API and landing page to a VPS

One server runs Postgres with PostGIS, Valkey (Redis), the API (two copies by default), Caddy (balances the API copies, routes by hostname and serves the landing page from `landing/`) and `cloudflared`, a Cloudflare Tunnel. Cloudflare handles HTTPS; the tunnel connects out to it, so nothing publishes a port. That lets Buddy share a server with other apps (AutoDLer's Caddy owns 80/443) and means moving servers needs no DNS change.

Deploys run from GitHub Actions ([`deploy.yml`](../.github/workflows/deploy.yml)): after CI passes on `main`, it builds the API image, pushes it to GHCR, then SSHes in and deploys that exact commit. Everything the server needs lives in GitHub secrets, so the server holds nothing you'd miss if it disappeared (apart from the database: see backups).

| File                 | What it is                                                      |
| -------------------- | --------------------------------------------------------------- |
| `docker-compose.yml` | The services                                                    |
| `caddy/Caddyfile`    | Routes the two hostnames: API (WebSockets too) and landing page |
| `.env.example`       | Every production setting; the real one is the `ENV_FILE` secret |
| `deploy.sh`          | Run by CI on the server: pull, migrate, restart                 |
| `backup.sh`          | Nightly compressed `pg_dump`, keeps 14                          |

## 1. Server

Debian or Ubuntu with 1 GB of RAM or more (images are built in CI, not on the server). Buddy needs no open ports beyond SSH.

As root on a fresh server (cloud images that log you in as a sudo user can skip the first block):

```bash
# A user for deploys, with passwordless sudo (the first deploy installs Docker)
adduser --disabled-password --gecos "" deploy
echo 'deploy ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# SSH keys only
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/; s/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh

# Firewall: Buddy only needs SSH. On a box shared with an app that serves
# 80/443 itself (AutoDLer), allow those too or that app goes offline.
apt update && apt install -y ufw unattended-upgrades
ufw allow OpenSSH && ufw --force enable
```

Docker writes its own firewall rules, but no Buddy container publishes a port, so none of it is reachable except through the tunnel.

### Cloudflare Tunnel

In Cloudflare: Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared. Name it `buddy`, copy the token (the long string after `--token`) into `TUNNEL_TOKEN` in your `.env`, and skip the install step: the `cloudflared` container runs it. Then add two public hostnames, both with service type HTTP and URL `caddy:80`:

- `api-buddy.<DOMAIN>`
- `buddy.<DOMAIN>`

Cloudflare creates their DNS records. Delete any existing A records for those names first, or it refuses.

Then give GitHub Actions its own SSH key. On your machine:

```bash
ssh-keygen -t ed25519 -f buddy-deploy -N "" -C "github-actions"
ssh-copy-id -i buddy-deploy.pub deploy@<server-ip>
```

### Photo storage (Cloudflare R2)

Profile photos, covers, community logos and chat photos live in R2. The API refuses to start without all five `R2_*` settings, in development too.

1. Cloudflare dashboard → R2 → Create bucket (e.g. `buddy-media`). Use a separate bucket for development.
2. Bucket → Settings → Public access: connect a custom domain (or enable the r2.dev URL for development). That URL is `R2_PUBLIC_URL`, without a trailing slash.
3. Bucket → Settings → CORS policy, so the web app can upload: allow `PUT` from your web origins (e.g. `http://localhost:7481`) with header `content-type`.
4. R2 → Manage API tokens → Create token with "Object Read & Write" on that bucket. It gives `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`; `R2_ACCOUNT_ID` is in the R2 overview.
5. Put all five in `apps/api/.env` (development) and the production `.env`.

Old chat photos are deleted by the API itself (see `RETENTION` in `packages/shared/src/constants.ts`), so no lifecycle rule is needed.

The database stores photos as R2 keys (`covers/<user>/<id>.jpg`) and Buddy's own pictures as paths (`/fallbacks/<id>.svg`), never with a domain. To move photos to another bucket or domain, copy the objects across and change `R2_PUBLIC_URL`; to move the API, change `BETTER_AUTH_URL`. Nothing in the database needs touching.

## 2. GitHub secrets

In the repo: Settings → Secrets and variables → Actions → New repository secret.

| Secret               | Value                                                      |
| -------------------- | ---------------------------------------------------------- |
| `SERVER_HOST`        | The server's IP or hostname                                |
| `SERVER_USER`        | `deploy`                                                   |
| `SERVER_SSH_KEY`     | The whole private key file `buddy-deploy`                  |
| `ENV_FILE`           | The whole production `.env` (start from `.env.example`)    |
| `SERVER_DEPLOY_PATH` | Optional. Where the repo is cloned; defaults to `~/buddy`. |

Or from the terminal: `gh secret set ENV_FILE < infra/.env.production`, and likewise for the others. Delete the local `buddy-deploy` key once it's stored.

## 3. Deploy

Every push to `main` deploys once CI passes. For the first deploy (or to redeploy without a push): Actions → Deploy → Run workflow.

The first run on a bare server installs git and Docker, clones the repo and adds the nightly backup to cron. Each run then:

1. checks out the commit the image was built from,
2. rewrites `infra/.env` from `ENV_FILE` (plus `API_IMAGE`, the image tag),
3. runs `deploy.sh`: pull the image, apply migrations with it, start the new API copies, stop the old ones once the new are healthy, reload Caddy.

A failed migration stops the deploy with the old API still serving. Landing page and Caddyfile changes go out with the same deploy.

Check `https://api-buddy.example.com/health` answers `{"status":"ok"}`, that `/privacy` and `/terms` load, and that `https://buddy.example.com` shows the landing page.

**Changing a setting:** edit the `ENV_FILE` secret, then run the workflow. Editing `infra/.env` on the server is overwritten by the next deploy.

**Rolling back:** revert the commit on `main`, or run the workflow from an older commit's branch.

**Moving to a new server:** set it up as in step 1 (not the tunnel: it moves with its token), change `SERVER_HOST`, run the workflow, then restore the database (below). Stop the old server's containers so only one copy serves the tunnel.

### Point the app at it

The production URL lives on EAS, not in git (the `production` profile in `apps/mobile/eas.json` reads the EAS `production` environment). From `apps/mobile` (run it again to change it):

```bash
eas env:set --name EXPO_PUBLIC_API_URL --value https://api-buddy.<DOMAIN> --environment production --visibility plaintext
```

Then build with `eas build --profile production`. A release build without it stops at launch with an error rather than pointing at nothing.

### Over-the-air updates (once, before the first store build)

`expo-updates` is installed but not yet linked to EAS. From `apps/mobile`, signed in to Expo:

```bash
npx eas-cli@latest update:configure
```

It adds the update URL and runtime version to `app.json` and a channel to each build profile in `eas.json`. Commit what it changes. Builds made before this can never receive updates. Afterwards, JavaScript-only fixes ship with `eas update --channel production --environment production --message "…"`; anything native still needs a new build.

### Android push notifications (free)

Push goes through Expo's push service, which hands Android messages to Firebase Cloud Messaging. Once:

1. [Firebase console](https://console.firebase.google.com) → Add project (Analytics not needed) → Add app → Android, package `com.buddyapp.mobile` → download `google-services.json`.
2. Give the build the file. From `apps/mobile`:
   ```bash
   npx eas-cli@latest env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment development --environment preview --environment production --visibility secret
   ```
   For a local build instead, leave `google-services.json` in `apps/mobile` (git-ignored).
3. Let Expo send through it: Firebase → Project settings → Service accounts → Generate new private key, then `npx eas-cli@latest credentials -p android` → your build profile → Google Service Account → FCM V1 → upload that key.
4. Build again (`eas build --profile preview --platform android`). The file only takes effect in a new build, not an over-the-air update.

Without the file the app still works; Android phones just don't get a push token. iPhones need a paid Apple Developer account for push.

### Crash reports (Sentry, optional)

Both the app and the API send crashes to [Sentry](https://sentry.io) once they have a DSN, and send nothing without one. The free plan is enough. Create two projects in Sentry (React Native, and Bun for the API) and copy each one's DSN.

- **API:** add `SENTRY_DSN=<api project DSN>` to the `ENV_FILE` secret and run the deploy workflow. Unexpected errors (the 500s) are reported with their request ID, which matches the API log.
- **App:** from `apps/mobile`:
  ```bash
  npx eas-cli@latest env:create --name EXPO_PUBLIC_SENTRY_DSN --value <app project DSN> --environment preview --environment production --visibility plaintext
  ```
  Then build again. Reports come from builds only, never from `bun run dev`.
- **Readable stack traces (optional):** Sentry → Settings → Auth Tokens → create one, then set `SENTRY_AUTH_TOKEN` (visibility secret), `SENTRY_ORG` and `SENTRY_PROJECT` (your org and project slugs) the same way. Builds then upload source maps. Without the token they skip the upload and still build.

Neither sends names or emails, only the error, the screen or request, and the device. To keep IP addresses out too, turn on Sentry → Settings → Security & Privacy → Prevent Storing of IP Addresses.

### Development builds

The `development` profile builds a dev client (`expo-dev-client`): it loads JavaScript from `bun run dev` on your machine and finds the API there too, so it has no API URL of its own. Build it once with `eas build --profile development`, and again whenever a native package changes (camera, clipboard and haptics, for example, arrived after the last one).

## 4. Backups

Each deploy installs a cron job that runs `backup.sh` nightly at 02:30. Dumps go to `infra/backups/` on the server. To keep copies off the server (do this: it's what lets you move servers), install rclone, add an R2 remote named `r2` (`rclone config`), and the script copies each dump to the `buddy-backups` bucket (or `BACKUP_BUCKET`).

**Restoring onto a new server:** run the workflow once so the database exists, then:

```bash
cd ~/buddy/infra
docker compose stop api
docker compose exec db psql -U buddy -d postgres -c "drop database buddy" -c "create database buddy owner buddy"
docker compose exec db psql -U buddy -d buddy -c "create extension if not exists postgis"
gunzip -c buddy-<date>.sql.gz | docker compose exec -T db psql -U buddy -d buddy -q
docker compose start api
```

**Test a restore once**, so you know the backups work:

```bash
docker compose exec db psql -U buddy -d postgres -c "create database restore_test"
gunzip -c backups/buddy-<date>.sql.gz | docker compose exec -T db psql -U buddy -d restore_test -q
docker compose exec db psql -U buddy -d restore_test -c 'select count(*) from "user"'
docker compose exec db psql -U buddy -d postgres -c "drop database restore_test"
```

## 5. Running it

Run these from `~/buddy/infra` on the server.

- **Logs:** `docker compose logs -f api` (JSON, one line per request).
- **Uptime:** point a free monitor (e.g. UptimeRobot) at `/health`; it checks the database too.
- **API copies.** `API_REPLICAS` in the `ENV_FILE` secret (2 by default) sets how many run; each is one Node process, so one CPU core and about 150 MB. Caddy spreads requests across them and skips one that's restarting; Valkey (`redis` in the compose file) lets them share chat events, rate limits and sign-outs, and only one runs the background jobs. Deploys start the new copies, wait until they're healthy, then stop the old ones, so the API stays up. `docker compose ps api` lists them.
- **More capacity.** Raise `API_REPLICAS` up to the server's CPU cores minus one (Postgres needs one). Past that, Postgres is the limit: a bigger server, or Postgres on its own server.
- **Database shell:** `docker compose exec db psql -U buddy -d buddy`. Reports are in the `reports` table.
- **Tunnel status:** `docker compose logs cloudflared` ("Registered tunnel connection"), or the tunnel's page in Cloudflare.
