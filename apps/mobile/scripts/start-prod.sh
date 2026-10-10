#!/bin/sh
# Expo dev server against the production API instead of a local one. The URL
# comes from the EAS production environment (see infra/README.md), so it stays
# out of git. Needs `eas login`. Accounts and data you create here are real.
set -eu
cd "$(dirname "$0")/.."

url=$(npx -y eas-cli@24.12.1 env:exec production --non-interactive 'printf %s "$EXPO_PUBLIC_API_URL"' | tail -n 1)
if [ -z "$url" ]; then
  echo "EXPO_PUBLIC_API_URL isn't set in the EAS production environment." >&2
  exit 1
fi
echo "Using the production API: $url"

# --clear: EXPO_PUBLIC_* values are baked into the bundle, so a cached one
# could still point at the local API.
EXPO_PUBLIC_API_URL="$url" exec npx expo start --port 7481 --clear "$@"
