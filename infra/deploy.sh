#!/bin/sh
# Swaps in the API image named by API_IMAGE in infra/.env: pull it, apply
# migrations with it, then restart onto it. Caddy picks up Caddyfile changes
# and landing/ is served straight from the checkout. Run by CI (see
# .github/workflows/deploy.yml); safe to run by hand.
set -eu
cd "$(dirname "$0")"

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
fi

docker compose pull api
docker compose up -d --wait db
# Migrate before swapping: a failed migration stops here, old API still serving.
docker compose run --rm --no-deps api node --enable-source-maps dist/migrate.js
docker compose up -d --remove-orphans
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
docker image prune -af --filter until=72h >/dev/null
echo "Deployed $(grep '^API_IMAGE=' .env | cut -d= -f2-)"
