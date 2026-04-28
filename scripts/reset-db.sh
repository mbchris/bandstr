#!/usr/bin/env bash

set -euo pipefail

ASSUME_YES=0

for arg in "$@"; do
  case "$arg" in
    --yes)
      ASSUME_YES=1
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: bash ./scripts/reset-db.sh [--yes]"
      exit 1
      ;;
  esac
done

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set."
  echo "Export DATABASE_URL first."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql is required but was not found in PATH."
  exit 1
fi

if [[ "$ASSUME_YES" != "1" ]]; then
  echo "This will DELETE the full database structure (schema 'public') and all data."
  echo "Target: ${DATABASE_URL}"
  read -r -p "Type 'reset' to continue: " CONFIRM
  if [[ "$CONFIRM" != "reset" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO CURRENT_USER;
GRANT ALL ON SCHEMA public TO public;
SQL

echo "Database structure reset complete."
