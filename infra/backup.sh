#!/bin/sh
# Nightly database backup: a compressed pg_dump in infra/backups, keeping the
# last 14. Add to cron on the server (see infra/README.md). If rclone is set up
# with a remote named "r2", each dump is also copied off the server.
set -eu
cd "$(dirname "$0")"

mkdir -p backups
file="backups/buddy-$(date -u +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U buddy -d buddy --no-owner | gzip > "$file"
echo "Saved $file ($(du -h "$file" | cut -f1))"

# Keep the newest 14 locally.
ls -1t backups/buddy-*.sql.gz | tail -n +15 | xargs -r rm --

if command -v rclone >/dev/null 2>&1 && rclone listremotes | grep -q '^r2:$'; then
  rclone copy "$file" "r2:${BACKUP_BUCKET:-buddy-backups}/db/"
  echo "Copied to r2:${BACKUP_BUCKET:-buddy-backups}/db/"
fi
