#!/bin/bash
# Cloud sessions only: install packages, start the dev database and bring it
# up to date, so `bun run check` and `bun run dev` work straight away.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

bun install

# The API's settings, from the example, if this container has none yet.
# R2 gets placeholders: the API won't start without them (uploads won't work).
if [ ! -f apps/api/.env ]; then
  cp apps/api/.env.example apps/api/.env
  sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '=+/')|" apps/api/.env
  sed -i 's|^R2_ACCOUNT_ID=$|R2_ACCOUNT_ID=dev|; s|^R2_ACCESS_KEY_ID=$|R2_ACCESS_KEY_ID=dev|; s|^R2_SECRET_ACCESS_KEY=$|R2_SECRET_ACCESS_KEY=dev|; s|^R2_BUCKET=$|R2_BUCKET=dev|; s|^R2_PUBLIC_URL=$|R2_PUBLIC_URL=https://img.buddy.test|' apps/api/.env
fi

# Postgres in Docker. Without Docker, everything but the API tests still works.
if ! docker info >/dev/null 2>&1 && command -v dockerd >/dev/null; then
  setsid nohup dockerd > /tmp/dockerd.log 2>&1 < /dev/null &
  for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
fi
if docker info >/dev/null 2>&1 && docker compose up -d --wait db; then
  bun run db:migrate
  # Seed people and activities once, into an empty database.
  people=$(docker compose exec -T db psql -U postgres -d buddy -Atc 'select count(*) from "user"' 2>/dev/null || echo 0)
  if [ "$people" = "0" ]; then
    bun run db:seed
  fi
else
  echo "Docker isn't available: the database isn't running (API tests and the API need it)." >&2
fi
