# syntax=docker/dockerfile:1
# Build from the repo root (the API needs the workspace's shared package):
#   docker build -f apps/api/Dockerfile -t buddy-api .
#
# Bun installs dependencies (fast); Node builds and runs the API.

FROM node:22-alpine AS build
COPY --from=oven/bun:1.4.2-alpine /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /repo

# Manifests first so the install layer is cached until dependencies change.
# Every workspace manifest is needed for Bun to accept the lockfile.
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --filter @buddy/api --ignore-scripts

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN bun run --filter @buddy/api build

# Runtime: Node only. The build bundles every dependency, so there's no node_modules here.
FROM node:22-alpine
ENV NODE_ENV=production PORT=7400
WORKDIR /app
COPY --from=build /repo/apps/api/package.json ./
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle

USER node
EXPOSE 7400
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:${PORT:-7400}/health || exit 1
# Apply pending migrations, then serve.
CMD ["sh", "-c", "node --enable-source-maps dist/migrate.js && exec node --enable-source-maps dist/server.js"]
