# Deploying the API and landing page to a VPS

One Ubuntu server runs three containers: Postgres with PostGIS (private), the API, and Caddy, which serves HTTPS (renewing certificates by itself) and the landing page from `landing/`. Migrations run each time the API starts.

| File                 | What it is                                                        |
| -------------------- | ----------------------------------------------------------------- |
| `docker-compose.yml` | The three services                                                |
| `Caddyfile`          | HTTPS, the proxy to the API (WebSockets too) and the landing page |
| `.env.example`       | Every production setting; copy to `.env`                          |
| `backup.sh`          | Nightly compressed `pg_dump`, keeps 14                            |

## 1. Server

Ubuntu 24.04 with 2 GB of RAM or more (the image builds on the server). Set `DOMAIN` in `infra/.env` (e.g. `example.com`) and point DNS A records for `api-buddy.<DOMAIN>` (the API) and `buddy.<DOMAIN>` (the landing page) at its IP before starting, or Caddy can't get certificates.

As root on a fresh server:

```bash
# A user for deploys, with your SSH key
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# SSH keys only
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/; s/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh

# Firewall: SSH and web only
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# Security updates, Docker
apt update && apt install -y unattended-upgrades git
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

Docker writes its own firewall rules, but only Caddy publishes ports, so Postgres and the API stay unreachable from outside.

## 2. First deploy

As `deploy`:

```bash
git clone <your repo URL> buddy && cd buddy/infra
cp .env.example .env
nano .env          # fill in every value; generators are in the comments
docker compose up -d --build
docker compose logs -f api   # "Migrations applied." then "Buddy API listening"
```

Check `https://api-buddy.example.com/health` answers `{"status":"ok"}`, that `/privacy` and `/terms` load, and that `https://buddy.example.com` shows the landing page.

Then point the app at it. The production URL lives on EAS, not in git (the `production` profile in `apps/mobile/eas.json` reads the EAS `production` environment). From `apps/mobile` (run it again to change it):

```bash
eas env:set --name EXPO_PUBLIC_API_URL --value https://api-buddy.<DOMAIN> --environment production --visibility plaintext
```

Then build with `eas build --profile production`. A release build without it stops at launch with an error rather than pointing at nothing.

## 3. Updates

```bash
cd ~/buddy && git pull && cd infra && docker compose up -d --build
```

The API restarts on the new image and applies any new migrations first. Requests in flight finish before the old one stops. Landing page changes are live as soon as `git pull` finishes: Caddy reads `landing/` straight from the checkout.

## 4. Backups

```bash
crontab -e
# then add:
30 2 * * * /home/deploy/buddy/infra/backup.sh >> /home/deploy/buddy/infra/backups/backup.log 2>&1
```

Dumps go to `infra/backups/`. To keep copies off the server, install rclone, add an R2 remote named `r2` (`rclone config`), and the script copies each dump to the `buddy-backups` bucket (or `BACKUP_BUCKET`).

**Test a restore once**, so you know the backups work:

```bash
docker compose exec db psql -U buddy -d postgres -c "create database restore_test"
gunzip -c backups/buddy-<date>.sql.gz | docker compose exec -T db psql -U buddy -d restore_test -q
docker compose exec db psql -U buddy -d restore_test -c 'select count(*) from "user"'
docker compose exec db psql -U buddy -d postgres -c "drop database restore_test"
```

## 5. Running it

- **Logs:** `docker compose logs -f api` (JSON, one line per request).
- **Uptime:** point a free monitor (e.g. UptimeRobot) at `/health`; it checks the database too.
- **One API container only.** Rate limits and live chat are kept in memory; a second copy would need Redis.
- **Database shell:** `docker compose exec db psql -U buddy -d buddy`. Reports are in the `reports` table.
- **Cloudflare in front** (orange cloud): set `TRUSTED_PROXY_HOPS=2` and the SSL mode to Full (strict).
