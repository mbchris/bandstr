# bandstr

Multi-tenant band management monorepo:
- API: Hono + TypeScript (`packages/api`)
- Web/Mobile: Quasar + Vue 3 + Capacitor (`packages/web`)
- Shared code: `packages/shared`

## Prerequisites

- Node.js 20+
- pnpm via Corepack (`corepack enable`)
- Docker (recommended for local Postgres and production image workflows)

## Environment Files

Use the split templates:

```bash
cp .env.api.template .env.api
cp .env.web.template .env.web
```

Key files:
- `.env.api` for API runtime vars (DB, auth, OAuth, billing)
- `.env.web` for web build/runtime vars (`API_URL`, `DEBUG_MODE`, `MOBILE_CALLBACK_URL`)
- `.env` / `.env.local` / `.env.production` are used by `./do` and compose profile workflows

## Local Development

### Option A: Native API + Web (recommended during feature work)

1. Start local Postgres:

```bash
docker compose -f docker-compose.dev.yml up -d postgres
```

2. Install deps and run dev servers:

```bash
pnpm install
pnpm dev
```

Default URLs:
- API: `http://localhost:3001`
- Web: `http://localhost:9000`

### Option B: Full dev stack in containers

```bash
docker compose -f docker-compose.dev.yml --profile full up
```

## Common Commands

```bash
pnpm dev
pnpm dev:api
pnpm dev:web
pnpm build
pnpm build:api
pnpm build:web
pnpm typecheck
pnpm lint
```

Database commands:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:migrate:runtime
pnpm db:seed
pnpm db:studio
```

## Developer QuickInfo

CI/CD chain overview:
- Auto build on push: GitHub Actions workflow [`build-and-release-gate.yml`](.github/workflows/build-and-release-gate.yml) runs on every `push` and builds the production artifacts (Docker image + APK gate flow).
- Production deployment trigger: GitHub Actions workflow [`deploy-prod.yml`](.github/workflows/deploy-prod.yml) runs on `push` to `main` (and can also be started manually via `workflow_dispatch`).
- Deploy execution host: `deploy-prod.yml` uses `runs-on: self-hosted`, so the Coolify deploy URL is called from the self-hosted build server.
- Deploy call configuration (GitHub repo settings):
  - Variable `COOLIFY_DEPLOY_URL` (for example `https://coolify.emailanschneiders.de/api/v1/deploy?uuid=...&force=false`)
  - Secret `COOLIFY_AUTH_TOKEN` (sent as header `authorization: <token>`)

Deployment request used by the workflow:

```bash
curl -H "authorization: ${COOLIFY_AUTH_TOKEN}" "${COOLIFY_DEPLOY_URL}"
```

## `./do` Helper

The `./do` script wraps common Docker/dev tasks:

```bash
./do start local
./do logs local
./do stop local
./do build local
./do build-apk local
./do deploy-apk local [DEVICE_ID]
./do sync-assets
./do cleanup-resources
```

Notes:
- `build-apk` and `deploy-apk` support `local|production`.
- `build-apk` supports `--no-sign` and `--no-install`.
- `./do` reads `.env.local` first, then falls back to `.env` (or `.env.production` in production mode).

## Assets and Favicons

Canonical source assets live under `assets/`.

Sync behavior:
- Build-time sync now runs automatically before `pnpm build` and web/mobile builds.
- Manual sync is still available via `./do sync-assets` or `bash ./scripts/sync-assets.sh`.

Favicons from `assets/favicons/*` are mirrored to:
- `packages/web/public/favicons/*`
- `public/favicons/*`

## Docker Profiles

`docker-compose.yml`:
- `dev` profile: workspace dev container
- `prod` profile: unified production image/container (`Dockerfile`)

`docker-compose.dev.yml`:
- local Postgres (`postgres`)
- optional full dev services (`api`, `web`) via `--profile full`

## Production Checks

```bash
DOMAIN="https://your-domain.tld"
curl -fsS "$DOMAIN/health"
curl -fsS "$DOMAIN/api/auth/get-session"
curl -fsS "$DOMAIN" | head -n 5
```

Run runtime migration in deployed app container:

```bash
APP_CONTAINER="<your-app-container>"
docker exec -it "$APP_CONTAINER" sh -lc 'node /app/packages/api/dist/db/migrate.js'
```

## Repo Layout

```text
packages/api/      Hono API + Drizzle
packages/web/      Quasar SPA + Capacitor targets
packages/shared/   Shared types/utilities
docs/              Feature plan and backlog
scripts/           Setup and automation scripts
```

## Documentation

- Contributor conventions: [AGENTS.md](AGENTS.md)
- Project context: [AI_CONTEXT.md](AI_CONTEXT.md)
- Iteration roadmap: [docs/feature_plan.md](docs/feature_plan.md)
- Deployment guide: [docs/coolify-deployment.md](docs/coolify-deployment.md)

## License

All rights reserved.
