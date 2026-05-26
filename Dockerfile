# syntax=docker/dockerfile:1.7

# ---------- Build stage ----------
# Floating tag for convenience. For reproducible deploys pin to a digest:
#   docker pull node:20-alpine
#   docker images --digests node:20-alpine
# then replace below with `node:20-alpine@sha256:<digest>`.
FROM node:20-alpine AS build
WORKDIR /app

# Install all workspace deps using only manifests so the layer caches well.
COPY package.json package-lock.json ./
COPY web/package.json ./web/
COPY server/package.json ./server/
RUN npm ci

# Copy sources and build both workspaces.
COPY web ./web
COPY server ./server
RUN npm run build

# Strip dev-deps in place; the runtime stage will copy node_modules wholesale.
RUN npm prune --omit=dev

# ---------- Runtime stage ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Manifests + pruned deps.
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/web/package.json ./web/
COPY --from=build /app/node_modules ./node_modules

# Built artifacts.
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist

# The node base image ships a `node` user (uid 1000). The persistent upload mount
# at /data/uploads needs to be writable by it, so create + chown the dir.
RUN mkdir -p /data/uploads && chown -R node:node /app /data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Boot-time migrations are controlled by RUN_MIGRATIONS_ON_BOOT (default true in production).
# Set RUN_SEED_ON_BOOT=true on first deploy if you want the starter dataset auto-loaded.
CMD ["node", "server/dist/index.js"]
