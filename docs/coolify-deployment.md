# Coolify Deployment Guide

## Architecture

```
                    ┌─────────────────────────────────┐
                    │          Coolify VPS             │
                    │                                  │
  HTTPS ──► Traefik ──► Nginx (web)  ──► /api/ proxy ──► Hono API (:3001)
                    │       │                    │     │
                    │       │  SPA files         │     │
                    │       └────────────        │     │
                    │                            ▼     │
                    │                   PostgreSQL DB   │
                    │                  (Coolify-managed)│
                    └─────────────────────────────────┘
```

| Service | Container | Role |
|---|---|---|
| **web** | `bandstr-web` | Nginx serving Quasar SPA, reverse-proxies `/api/` to API |
| **api** | `bandstr-api` | Hono + Node.js, connects to PostgreSQL via `DATABASE_URL` |
| **migrate** | `bandstr-migrate` | One-shot: runs Drizzle migrations on deploy, then exits |
| **PostgreSQL** | *(Coolify-managed)* | Separate Coolify "Database" resource, not in docker-compose |

---

## Prerequisites

- Coolify instance running on your VPS
- SSH access to the VPS
- GitHub repo `mbchris/bandstr` accessible from Coolify
- DNS: `bandstr.trmusic.de` pointing to VPS IP

---

## Step 1: Create PostgreSQL Database

### Option A: Automated (via Coolify API)

```bash
# 1. Get your Coolify API token from: Coolify Dashboard → Settings → API Tokens
# 2. Get your server UUID from: Coolify Dashboard → Servers → click your server → UUID in URL

export COOLIFY_URL="https://coolify.trmusic.de"    # your Coolify URL
export COOLIFY_TOKEN="your-api-token-here"
export COOLIFY_SERVER_UUID="your-server-uuid-here"

# Run the setup script
bash scripts/coolify-setup-db.sh
```

The script will:
1. Create a new PostgreSQL 16 resource in Coolify
2. Generate a secure random password
3. Start the database container
4. Output the `DATABASE_URL` to use in step 3
5. Save credentials to `.coolify-db-credentials` (gitignored)

### Option B: Manual (via Coolify Dashboard)

1. Log into Coolify Dashboard
2. Go to **Resources → + New → Database → PostgreSQL**
3. Configure:
   - **Name**: `bandstr-postgres`
   - **Image**: `postgres:16-alpine`
   - **Database name**: `bandstr`
   - **Username**: `bandstr`
   - **Password**: *(generate a strong password)*
   - **Public**: No (internal only)
   - **Memory limit**: 512 MB (sufficient for ~500 bands)
4. Click **Start**
5. Once running, note the **Internal URL** shown in the database details — it looks like:
   ```
   postgresql://bandstr:<password>@<container-uuid>:5432/bandstr
   ```

### Post-creation: Initialize Extensions

After the database is running, apply the init script to enable required PostgreSQL extensions:

```bash
# From your local machine (needs SSH access to VPS)
ssh root@your-vps "docker exec -i <pg-container-name> psql -U bandstr -d bandstr" \
  < scripts/db-init.sql
```

This enables:
- `uuid-ossp` — UUID generation (Better Auth user IDs)
- `pg_trgm` — trigram indexes for fuzzy song search
- `citext` — case-insensitive text for email comparisons

### Configure Backups in Coolify

1. Go to **Database Resource → Backups**
2. Click **+ Add Backup**
3. Configure schedule: daily at 03:00 UTC recommended
4. Set retention: keep last 14 backups
5. Optionally configure S3 destination for off-server backups

---

## Step 2: Create Application Resource

1. In Coolify Dashboard, go to **Resources → + New → Docker Compose**
2. **Repository**: `github.com/mbchris/bandstr`
3. **Branch**: `main`
4. **Docker Compose file**: `docker-compose.coolify.yml`
5. **Build Pack**: Docker Compose

---

## Step 3: Configure Environment Variables

In the Coolify resource, go to **Environment Variables** and configure the `.env.api` file.

### Required Variables

| Variable | Example Value | How to Get It |
|---|---|---|
| `NODE_ENV` | `production` | Static |
| `PORT` | `3001` | Static |
| `API_URL` | `https://bandstr.trmusic.de/api` | Your domain + `/api` |
| `DATABASE_URL` | `postgresql://bandstr:***@<uuid>:5432/bandstr` | From Step 1 (Internal URL) |
| `AUTH_SECRET` | *(32+ char random string)* | `openssl rand -hex 32` |
| `CORS_ORIGINS` | `https://bandstr.trmusic.de` | Comma-separated allowed origins |

### OAuth Providers

| Variable | How to Get It |
|---|---|
| `GOOGLE_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client |
| `GOOGLE_CLIENT_SECRET` | Same as above |
| `GHUB_CLIENT_ID` | [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps |
| `GHUB_CLIENT_SECRET` | Same as above |

OAuth callback URLs to register:
- Google: `https://bandstr.trmusic.de/api/auth/callback/google`
- GitHub: `https://bandstr.trmusic.de/api/auth/callback/github`

### Stripe (when ready)

| Variable | How to Get It |
|---|---|
| `STRIPE_SECRET_KEY` | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → Signing secret |
| `STRIPE_PRICE_BAND` | Stripe → Products → Band tier price ID |
| `STRIPE_PRICE_PRO` | Stripe → Products → Pro tier price ID |

### Compose-Level Variables

Set these in Coolify's environment (not in `.env.api`):

| Variable | Value |
|---|---|
| `APP_DOMAIN` | `bandstr.trmusic.de` |

---

## Step 4: Configure Domain & TLS

1. In the Coolify resource settings, set domain to `bandstr.trmusic.de`
2. Coolify auto-provisions TLS via Let's Encrypt through Traefik
3. Verify DNS: `dig bandstr.trmusic.de` should resolve to your VPS IP

---

## Step 5: Deploy

1. Click **Deploy** in Coolify (or push to the configured branch for auto-deploy)
2. Deployment order:
   1. `migrate` — runs `drizzle-kit migrate`, applies schema changes, exits
   2. `api` — starts Hono server, passes healthcheck (`/health`)
   3. `web` — starts Nginx, Traefik routes HTTPS traffic to it

### Verify Deployment

```bash
# Health check
curl https://bandstr.trmusic.de/health
# → {"ok":true,"version":"abc1234"}

# API endpoint
curl https://bandstr.trmusic.de/api/auth/get-session
# → {"session":null} (or session data if authenticated)

# SPA loads
curl -s https://bandstr.trmusic.de | head -5
# → <!DOCTYPE html>...
```

---

## Database Management

### Run Migrations Manually

```bash
# SSH into VPS
ssh root@your-vps

# Run in the API container
docker exec -it bandstr-api sh -c "npx drizzle-kit migrate"
```

### Backup & Restore

Use the backup script for manual backups:

```bash
# Set your VPS SSH target
export VPS_HOST="root@your-vps"

# Create backup (downloads compressed SQL to ./backups/)
bash scripts/coolify-db-backup.sh backup

# List local backups
bash scripts/coolify-db-backup.sh list

# Restore (WARNING: overwrites current data)
bash scripts/coolify-db-backup.sh restore backups/bandstr_20260326_120000.sql.gz
```

### Connect via Drizzle Studio

Use an SSH tunnel to access the database from your local machine:

```bash
# Terminal 1: SSH tunnel (find PG container IP with: docker inspect <pg-container> | grep IPAddress)
ssh -L 5432:<pg-container-ip>:5432 root@your-vps

# Terminal 2: Run Drizzle Studio locally
cd packages/api
DATABASE_URL="postgresql://bandstr:<password>@localhost:5432/bandstr" pnpm db:studio
# Opens at https://local.drizzle.studio
```

### Direct SQL Access

```bash
# On the VPS
docker exec -it <pg-container> psql -U bandstr -d bandstr

# Useful queries
SELECT count(*) FROM bands;                        -- total bands
SELECT name, plan FROM bands;                      -- all bands with plans
SELECT count(*) FROM songs GROUP BY band_id;       -- songs per band
SELECT pg_size_pretty(pg_database_size('bandstr')); -- database size
```

---

## Networking Details

```
Internet → Traefik (:443) → bandstr-web (Nginx :80) → bandstr-api (Hono :3001) → PostgreSQL (:5432)
           [coolify net]     [coolify + bandstr-net]    [bandstr-net]              [coolify internal]
```

- `web` is on **both** `coolify` (for Traefik) and `bandstr-net` (for API proxy)
- `api` is on `bandstr-net` only — **not** directly exposed to Traefik
- PostgreSQL (Coolify DB) is accessible via Docker internal DNS from any container on the same server
- The `migrate` service shares `bandstr-net` to reach PostgreSQL

---

## Monitoring

### Health Endpoint

The API exposes `GET /health` returning:
```json
{ "ok": true, "version": "abc1234" }
```

Coolify checks this every 30s. If 3 consecutive checks fail, the container restarts.

### Logs

```bash
# On VPS — view live logs
docker logs -f bandstr-api
docker logs -f bandstr-web

# View migration output from last deploy
docker logs bandstr-migrate
```

### Resource Usage

Recommended Coolify resource limits:
| Service | Memory | CPU |
|---|---|---|
| PostgreSQL | 512 MB | 1 core |
| API | 256 MB | 0.5 core |
| Web (Nginx) | 64 MB | 0.25 core |

For ~500 bands these are generous. Monitor via Coolify dashboard and adjust.

---

## Rollback

Coolify keeps previous builds. To rollback:
1. Go to **Deployments** in the resource
2. Click **Rollback** on the previous successful deployment

**Database rollback**: Restore from backup (see Backup & Restore above). Note: Drizzle migrations are forward-only; if a migration needs reverting, write a new migration.

---

## Troubleshooting

### Database connection refused

```bash
# Check if PG container is running
ssh root@your-vps "docker ps | grep postgres"

# Check if API can reach PG (from API container)
docker exec bandstr-api sh -c "wget -qO- http://localhost:3001/health"

# Test DATABASE_URL directly
docker exec bandstr-api sh -c 'node -e "
  const pg = require(\"pg\");
  const p = new pg.Pool({connectionString: process.env.DATABASE_URL});
  p.query(\"SELECT 1\").then(() => console.log(\"OK\")).catch(e => console.error(e.message));
"'
```

### Migration fails

```bash
# Check migration logs
docker logs bandstr-migrate

# Run manually with verbose output
docker exec -it bandstr-api sh -c "npx drizzle-kit migrate"
```

### Auth endpoints 404 or social sign-in 500

Symptoms:
- `POST /api/auth/sign-in/social` returns `404` or `500`
- Logs contain `relation "verification" does not exist`
- OAuth callback ends at `?error=UNKNOWN` / `state_not_found`

Checks:
```bash
# Inside app/api container
curl -i http://127.0.0.1:3001/api/auth/get-session
curl -i http://127.0.0.1:3001/api/auth/sign-in/social

# Startup log should print auth mount path
docker logs <app-container> | grep "bandstr API running"
```

Expected:
- Startup log includes `(auth: /api/auth)`
- `GET /api/auth/get-session` is not `404` (typically `200` or `401`)

Fixes:
1. Ensure API auth config uses `basePath=/api/auth`.
2. If `API_URL` contains `/api`, strip that path for Better Auth `baseURL`.
3. Ensure Better Auth tables exist (`verification`, `session`, `account`, etc.) by running migrations.
4. For unified `Dockerfile` deployments, run migrations before API startup.
5. For split `docker-compose.coolify.yml` deployments, verify the `migrate` service completed successfully.

### Nginx 502 Bad Gateway

The API container is down or not yet healthy:
```bash
docker ps | grep bandstr-api
docker logs bandstr-api --tail 50
```

### SPA shows blank page

Check that `API_URL=/api` was set as a build arg (in `docker-compose.coolify.yml`):
```bash
docker exec bandstr-web sh -c "grep -o 'API_URL[^\"]*' /usr/share/nginx/html/index.html"
```

---

## Local Development

```bash
# 1. Start PostgreSQL only (recommended — run API/Web natively for hot-reload)
docker compose -f docker-compose.dev.yml up postgres

# 2. Copy env templates
cp .env.api.template .env.api
cp .env.web.template .env.web

# 3. Initialize DB extensions
docker exec -i $(docker ps -qf name=postgres) psql -U bandstr -d bandstr < scripts/db-init.sql

# 4. Run migrations
pnpm db:migrate

# 5. Start dev servers
pnpm dev

# OR: Full containerized stack (slower hot-reload)
docker compose -f docker-compose.dev.yml --profile full up
```

---

## Files Reference

| File | Purpose |
|---|---|
| `docker-compose.coolify.yml` | Production Coolify deployment (api + web + migrate) |
| `docker-compose.dev.yml` | Local dev (PostgreSQL + optional full stack) |
| `Dockerfile.api` | Multi-stage API build (pnpm → tsc → Node.js) |
| `Dockerfile.web` | Multi-stage SPA build (pnpm → quasar build → Nginx) |
| `nginx.conf` | Nginx: SPA history fallback + `/api/` reverse proxy |
| `scripts/coolify-setup-db.sh` | Automated Coolify PG database creation via API |
| `scripts/coolify-db-backup.sh` | Backup/restore PostgreSQL via SSH |
| `scripts/db-init.sql` | Post-creation DB initialization (extensions, settings) |
| `.env.api.template` | API environment variable template |
| `.env.web.template` | Web environment variable template |
