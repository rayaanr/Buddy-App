#!/bin/sh
# Swaps in the API image named by API_IMAGE in infra/.env: pull it, apply
# migrations with it, then replace the API copies without downtime. Caddy picks up Caddyfile changes
# and landing/ is served straight from the checkout. Run by CI (see
# .github/workflows/deploy.yml); safe to run by hand.
set -eu
cd "$(dirname "$0")"

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
fi

docker compose pull api
docker compose up -d --wait db redis
# Migrate before swapping: a failed migration stops here, old API still serving.
docker compose run --rm --no-deps api node --enable-source-maps dist/migrate.js

# Rolling swap: start the new copies next to the old ones, wait until they're
# healthy, point Caddy at them, then stop the old ones (each finishes its
# requests first). The API never goes down.
replicas=$(sed -n 's/^API_REPLICAS=//p' .env | tail -1)
replicas=${replicas:-2}

# Caddy balances across the copies listed here (imported by the Caddyfile).
point_caddy_at() {
  {
    echo "# Written by deploy.sh: the API copies to send requests to."
    printf 'to'
    for c in "$@"; do printf ' %s:7400' "$(docker inspect -f '{{.Name}}' "$c" | sed 's#^/##')"; done
    echo
  } > caddy/api-upstreams
  if [ -n "$(docker compose ps -q caddy)" ]; then
    docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
  fi
}

wait_healthy() {
  for c in "$@"; do
    tries=0
    until [ "$(docker inspect -f '{{.State.Health.Status}}' "$c")" = healthy ]; do
      tries=$((tries + 1))
      if [ "$tries" -gt 60 ]; then
        echo "A new API copy didn't become healthy." >&2
        docker logs --tail 50 "$c" >&2 || true
        return 1
      fi
      sleep 2
    done
  done
}

old=$(docker compose ps -q api)
if [ -z "$old" ]; then
  docker compose up -d --no-deps --scale api="$replicas" api
  new=$(docker compose ps -q api)
  wait_healthy $new
else
  running=$(echo "$old" | wc -l)
  docker compose up -d --no-deps --no-recreate --scale api=$((running + replicas)) api
  new=$(docker compose ps -q api | grep -vxF "$old" || true)
  if ! wait_healthy $new; then
    echo "Keeping the old API copies." >&2
    docker rm -f $new >/dev/null
    exit 1
  fi
fi
point_caddy_at $new
if [ -n "$old" ]; then
  docker stop -t 15 $old >/dev/null
  docker rm $old >/dev/null
fi
docker compose up -d --remove-orphans
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
docker image prune -af --filter until=72h >/dev/null
echo "Deployed $(grep '^API_IMAGE=' .env | cut -d= -f2-)"
