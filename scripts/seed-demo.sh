#!/usr/bin/env bash
#
# Bring up a local bandstr stack filled with fictional demo data and mint a
# session token for the demo owner, so marketing screenshots can be captured
# without touching production or typing a password.
#
# Usage: ./scripts/seed-demo.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

compose=(docker compose -f docker-compose.dev.yml)
psql_demo=("${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U bandstr -d bandstr)

if [[ ! -f .env.api ]]; then
  echo "Error: .env.api is missing. Copy it from .env.api.template first."
  exit 1
fi

echo "Starting postgres..."
"${compose[@]}" up -d postgres

echo "Waiting for postgres to accept connections..."
for _ in $(seq 1 60); do
  if "${compose[@]}" exec -T postgres pg_isready -U bandstr >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "Applying database migrations..."
DATABASE_URL="postgresql://bandstr:bandstr_dev@localhost:5432/bandstr" pnpm db:migrate

echo "Seeding fictional demo content..."
"${psql_demo[@]}" < scripts/seed_demo.sql >/dev/null

# Mint a Better Auth session for the demo owner. The web app accepts a bearer
# token via ?token= on /login (see stores/auth.ts), which lets us sign the
# simulator in with a deep link instead of credentials.
token="demo-$(openssl rand -hex 24)"
"${psql_demo[@]}" >/dev/null <<SQL
DELETE FROM session WHERE user_id = 'demo-user-1';
INSERT INTO session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id)
VALUES ('demo-session-1', now() + interval '30 days', '${token}', now(), now(), '127.0.0.1', 'bandstr-marketing', 'demo-user-1');
SQL

echo
echo "Demo data ready. Band 'Neon Kompass', signed in as Mira Falk."
echo
echo "Session token:"
echo "  ${token}"
echo
echo "Simulator deep link:"
echo "  org.capacitor.bandstr://localhost/#/login?token=${token}"
