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
- `.env.api` for API runtime vars (DB, auth, OAuth, billing incl. Stripe/Google Play/App Store)
- `.env.web` for web build/runtime vars (`API_URL`, `DEBUG_MODE`, `MOBILE_CALLBACK_URL`)
- `.env` / `.env.local` / `.env.production` are used by `./do` and compose profile workflows

Self-registration mail delivery:
- Better Auth account emails (verification, password reset, change-email confirmation) are sent via SMTP when `AUTH_EMAIL_SMTP_HOST` is configured.
- SMTP settings:
  - `AUTH_EMAIL_SMTP_HOST`, `AUTH_EMAIL_SMTP_PORT`, `AUTH_EMAIL_SMTP_STARTTLS`
  - `AUTH_EMAIL_SMTP_USER`, `AUTH_EMAIL_SMTP_PASSWORD`
  - Optional server-name override: `AUTH_EMAIL_SMTP_SERVER_NAME`
  - Optional sender identity: `AUTH_EMAIL_SMTP_FROM_NAME`, `AUTH_EMAIL_SMTP_FROM_EMAIL`
- Alias names are also supported: `SMTP_SERVER`, `SMTP_PORT`, `SMTP_STARTTLS`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SERVER_NAME`, `SMTP_FROM_ADDRESS`.
- If SMTP is not configured, the API falls back to `AUTH_EMAIL_WEBHOOK_URL` (+ optional `AUTH_EMAIL_WEBHOOK_BEARER_TOKEN`).
- If neither SMTP nor webhook is configured, emails are logged to the API output (dev-friendly fallback).

Support-to-GitHub integration:
- `SUPPORT_GITHUB_ISSUES_URL` defines the target issue list URL (default: `https://github.com/prj120/bandstr/issues`).
- `SUPPORT_GITHUB_TOKEN` is required for API-side issue creation.

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

Import historical at issue backup into a dedicated band:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/import-at-issue.sql
```

## Developer QuickInfo

CI/CD chain overview:
- Auto build on push: GitHub Actions workflow [`build-and-release-gate.yml`](.github/workflows/build-and-release-gate.yml) runs on every `push` and builds the production artifacts (Docker image + APK gate flow).
- Production deployment trigger: GitHub Actions workflow [`deploy-prod.yml`](.github/workflows/deploy-prod.yml) runs only when started manually via `workflow_dispatch`.
- Deploy execution host: `deploy-prod.yml` uses `runs-on: self-hosted`, so the Coolify deploy URL is called from the self-hosted build server.
- Deploy call configuration (GitHub repo settings):
  - Variable `COOLIFY_DEPLOY_URL` (for example `https://coolify.emailanschneiders.de/api/v1/deploy?uuid=...&force=false`)
  - Secret `COOLIFY_AUTH_TOKEN` (sent as header `Authorization: Bearer <token>`)

Deployment request used by the workflow:

```bash
curl -H "Authorization: Bearer ${COOLIFY_AUTH_TOKEN}" "${COOLIFY_DEPLOY_URL}"
```

## `./do` Helper

The `./do` script wraps common Docker/dev tasks:

```bash
./do start local
./do logs local
./do stop local
./do build local
./do build-apk
./do create-apk-bundle
./do deploy-apk local [DEVICE_ID]
./do build-ios local
./do deploy-ios local [DEVICE_ID]
./do upload-ios [IPA_PATH]
./do keygen-apk --store-pass "<strong-password>"
./do install-bundletool
./do --help
./do sync-assets
./do security-scan
./do cleanup-resources
```

Notes:
- `build-apk` and `deploy-apk` support `local|production`.
- `build-apk` defaults to `production` profile when no profile is passed.
- `build-apk` supports `--no-sign` and `--no-install`.
- `create-apk-bundle` builds a Play Store `.aab` and signs/validates it by default (`--no-sign` disables that).
- `create-apk-bundle` defaults to `production` profile when no profile is passed.
- `build-ios` and `deploy-ios` require macOS + Xcode.
- `build-ios` exports an IPA by default (`--no-sign` creates archive only).
- `upload-ios` uses App Store Connect API key auth (`APPSTORE_CONNECT_API_KEY_ID`, `APPSTORE_CONNECT_ISSUER_ID`).
- `build-apk` and `create-apk-bundle` auto-increment Android `versionCode` on each run.
- Both commands also create named artifacts: `<appName>-vc<versionCode>-b<buildId>.apk|.aab`.
- `./do` reads `.env.local` first, then falls back to `.env` (or `.env.production` in production mode).
- `./do security-scan` runs dependency vulnerability audits for web and backend packages.
- For production signing, set:
  - `ANDROID_SIGNING_KEYSTORE_BASE64`
  - `ANDROID_SIGNING_KEY_ALIAS`
  - `ANDROID_SIGNING_KEYSTORE_PASSWORD`
  - `ANDROID_SIGNING_KEY_PASSWORD`
- CI release artifact upload now requires a signed APK and verifies it with `apksigner`.

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

Seed example data in deployed app container:

```bash
APP_CONTAINER="<your-app-container>"
docker exec -it "$APP_CONTAINER" sh -lc 'node /app/packages/api/dist/db/seed.js'
```

Admin CLI in deployed app container:

```bash
APP_CONTAINER="<your-app-container>"
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-cli help'

# list
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-cli list-users'
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-cli list-bands'

# user + membership
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-cli add-user --name "Jane Admin" --email "jane@example.com"'
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-cli verify-user-email --email "jane@example.com" --verified true'
# alternatively by user id:
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-cli verify-user-email --user-id "<user-id>" --verified true'
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-cli delete-user --user-id "<user-id>"'
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-cli assign-user-to-band --user-id "<user-id>" --band-id 1 --role admin'
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-cli remove-user-from-band --user-id "<user-id>" --band-id 1'

# imports from external SQL (Postgres) DB
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-cli import-songs-from-sql-db --source-db-url "<postgres-url>" --source-band-id 1 --target-band-id 1'
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-cli import-votings-from-sql-db --source-db-url "<postgres-url>" --source-band-id 1 --target-band-id 1'

# import bundled at issue predecessor backup to band slug "at-issue"
docker exec -it "$APP_CONTAINER" sh -lc 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/scripts/import-at-issue.sql'

# user subscription override (affects owner/admin band inheritance)
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-cli change-subscription-for-user --user-id "<user-id>" --enabled true'

# auth mail delivery test (SMTP/webhook/console fallback)
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-mail-test help'
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-mail-test send --to "you@example.com"'
docker exec -it "$APP_CONTAINER" sh -lc '/app/bandstr-mail-test send --to "you@example.com" --kind reset-password --link "https://example.com/reset?token=test"'
```

## Google Play Billing Setup Scripts

Use these scripts to create, assign, and verify Google Cloud + Play Console setup for RTDN and subscriptions:

```bash
# 1) Create/assign GCP resources (Pub/Sub topic, IAM binding, push subscription)
GCP_PROJECT_ID="your-project-id" \
API_BASE_URL="https://your-api.example" \
GPLAY_RTDN_TOKEN="replace-with-secret" \
bash ./scripts/gplay-rtdn-setup.sh

# 2) Verify GCP setup end-to-end
GCP_PROJECT_ID="your-project-id" \
API_BASE_URL="https://your-api.example" \
GPLAY_RTDN_TOKEN="replace-with-secret" \
bash ./scripts/gplay-rtdn-verify.sh

# 3) Print exact Play Console manual assignment checklist
GCP_PROJECT_ID="your-project-id" \
GPLAY_PACKAGE_NAME="de.trmusic.bandstr" \
GPLAY_SERVICE_ACCOUNT_EMAIL="service-account@your-project.iam.gserviceaccount.com" \
bash ./scripts/gplay-play-console-checklist.sh

# 4) Probe Google Play Developer API permissions with a real purchase token
GPLAY_PACKAGE_NAME="de.trmusic.bandstr" \
GPLAY_TEST_PURCHASE_TOKEN="replace-with-token" \
GPLAY_SERVICE_ACCOUNT_JSON="$(cat service-account.json)" \
bash ./scripts/gplay-api-permission-probe.sh

# 5) Probe permissions without a real purchase token (dummy-token check)
GPLAY_PACKAGE_NAME="de.trmusic.bandstr" \
GPLAY_SERVICE_ACCOUNT_JSON="$(cat service-account.json)" \
bash ./scripts/gplay-api-permission-probe-no-token.sh
```

Notes:
- `gplay-play-console-checklist.sh` exists because Play Console user/app permission assignment is not fully exposed via `gcloud`.
- `gplay-api-permission-probe.sh` is the fastest check for `401 permissionDenied` on `subscriptionsv2`.
- `gplay-api-permission-probe-no-token.sh` validates auth/permissions path without needing a purchase token. It expects a `400/404` with a dummy token as success.

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

## Spotify Test Page

- Direct URL (not linked from Impress UI): `/impress/spotify-test`
- Example production URL: `https://bandstr.apps.4ki.app/impress/spotify-test`

## License

All rights reserved.
