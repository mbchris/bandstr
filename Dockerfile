# ── Stage 1: Build API + Web ─────────────────────
FROM node:20-alpine AS build

ARG GIT_REV=unknown
ARG SOURCE_COMMIT=unknown

WORKDIR /app

# Enable Corepack (pnpm version comes from packageManager in package.json)
RUN corepack enable
RUN apk add --no-cache git bash postgresql-client

ENV GIT_REV=${GIT_REV}
ENV SOURCE_COMMIT=${SOURCE_COMMIT}

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Copy package.json for each workspace package
COPY packages/api/package.json packages/api/
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/

# Copy patches for pnpm patching
COPY patches/ patches/

# Install all dependencies
RUN NODE_ENV=development pnpm install --frozen-lockfile || pnpm install

# Copy full repository context (including .git when available)
COPY . .

# Normalize shell scripts to LF in case the host checkout uses CRLF.
RUN sed -i 's/\r$//' scripts/sync-assets.sh scripts/bandstr-cli.sh scripts/bandstr-mail-test.sh scripts/container-shell-notes.sh scripts/bandstr-send-push.sh && \
  chmod +x scripts/sync-assets.sh scripts/bandstr-cli.sh scripts/bandstr-mail-test.sh scripts/container-shell-notes.sh scripts/bandstr-send-push.sh

# Build API (tsc) and Web (quasar build) in parallel via pnpm
RUN pnpm run build
RUN rev="${SOURCE_COMMIT:-}"; \
  case "$rev" in \
    ''|unknown|UNKNOWN|dev|DEV) \
      rev="$(git rev-parse --short HEAD 2>/dev/null || true)" ;; \
  esac; \
  rev="$(printf '%s' "$rev" | tr -d '\r\n' | cut -c1-12)"; \
  if [ -z "$rev" ]; then rev="unknown"; fi; \
  printf '%s\n' "$rev" > /app/packages/api/dist/build-rev.txt

# ── Stage 2: API production dependencies ─────────
FROM node:20-alpine AS api-deps

WORKDIR /app

RUN corepack enable

COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/packages/api/package.json packages/api/
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY pnpm-lock.yaml* ./
COPY patches/ patches/

RUN pnpm install --filter @bandstr/api --filter @bandstr/shared --prod --frozen-lockfile || pnpm install --filter @bandstr/api --filter @bandstr/shared --prod

# ── Stage 3: Production (nginx + node) ───────────
FROM nginx:1.27-alpine AS production

ARG GIT_REV=unknown
ARG SOURCE_COMMIT=unknown

# Install Node.js for the API server and psql client for DB admin/import scripts
RUN apk add --no-cache nodejs postgresql-client

WORKDIR /app

# Nginx config
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/bandstr.conf

# Copy built SPA
COPY --from=build /app/packages/web/dist/spa/ /usr/share/nginx/html/

# Copy API build + production deps
COPY --from=api-deps /app/node_modules/ node_modules/
COPY --from=api-deps /app/packages/ packages/
COPY --from=build /app/packages/api/dist/ packages/api/dist/
# Runtime migrations for drizzle migrator
COPY --from=build /app/packages/api/src/db/migrations/ packages/api/dist/db/migrations/
# Seed data used by dist/db/seed.js inside container shells
COPY --from=build /app/scripts/seed_example.sql /app/scripts/seed_example.sql
COPY --from=build /app/scripts/import-at-issue.sql /app/scripts/import-at-issue.sql
COPY --from=build /app/scripts/bandstr-send-push.sh /app/scripts/bandstr-send-push.sh
COPY --from=build /app/scripts/bandstr-cli.sh /app/bandstr-cli
COPY --from=build /app/scripts/bandstr-mail-test.sh /app/bandstr-mail-test
COPY --from=build /app/do /app/do

# For the unified container, nginx proxies to localhost instead of "api" hostname
RUN sed -i 's|http://api:3001|http://127.0.0.1:3001|g' /etc/nginx/conf.d/bandstr.conf

# Runtime config
ENV HOST=0.0.0.0
ENV PORT=3001
ENV NODE_ENV=production
ENV GIT_REV=${GIT_REV}
ENV SOURCE_COMMIT=${SOURCE_COMMIT}
ENV ENV=/etc/bandstr_shell_rc

LABEL org.opencontainers.image.title="bandstr-prod"
LABEL org.opencontainers.image.version="${GIT_REV}"
LABEL org.opencontainers.image.revision="${SOURCE_COMMIT}"

# Interactive shell notes (shown on docker exec -it <container> sh)
COPY scripts/container-shell-notes.sh /etc/bandstr_shell_rc
RUN chmod +x /app/bandstr-cli /app/bandstr-mail-test /app/do /app/scripts/bandstr-send-push.sh

EXPOSE 80

# Run DB migrations, then start API and nginx
CMD sh -c "node /app/packages/api/dist/db/migrate.js && node /app/packages/api/dist/index.js & nginx -g 'daemon off;'"
