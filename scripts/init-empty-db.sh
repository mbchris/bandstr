#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

RUN_SQL_INIT=1
RUN_SEED=1

for arg in "$@"; do
  case "$arg" in
    --skip-sql-init)
      RUN_SQL_INIT=0
      ;;
    --no-seed)
      RUN_SEED=0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: bash ./scripts/init-empty-db.sh [--skip-sql-init] [--no-seed]"
      exit 1
      ;;
  esac
done

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set."
  echo "Export DATABASE_URL first, then run this script."
  exit 1
fi

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  else
    corepack pnpm "$@"
  fi
}

echo "Initializing empty bandstr database..."
echo "Repo root: ${REPO_ROOT}"

if [[ "$RUN_SQL_INIT" == "1" ]]; then
  if ! command -v psql >/dev/null 2>&1; then
    echo "Error: psql is required for SQL initialization but was not found."
    echo "Install PostgreSQL client tools or run with --skip-sql-init."
    exit 1
  fi

  echo "1/3 Applying scripts/db-init.sql"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${REPO_ROOT}/scripts/db-init.sql"
else
  echo "1/3 Skipping scripts/db-init.sql (--skip-sql-init)"
fi

echo "2/3 Running runtime migrations"
run_pnpm --filter @bandstr/api exec tsx src/db/migrate.ts

if [[ "$RUN_SEED" == "1" ]]; then
  echo "3/3 Seeding default data (scripts/seed_example.sql)"
  run_pnpm --filter @bandstr/api run db:seed
else
  echo "3/3 Skipping seed (--no-seed)"
fi

echo "Database initialization complete."
