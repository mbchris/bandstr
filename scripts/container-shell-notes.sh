#!/bin/sh

# Show command hints in interactive shells (docker exec -it <container> sh).
if [ -z "$PS1" ]; then
  return 0 2>/dev/null || exit 0
fi

if [ "${bandstr_SHELL_NOTES_SHOWN:-}" = "1" ]; then
  return 0 2>/dev/null || exit 0
fi

export bandstr_SHELL_NOTES_SHOWN=1

cat <<'EOF'

bandstr container shell
---------------------
Useful commands:

- API health
  curl -fsS http://localhost:3001/health

- Session check
  curl -fsS http://localhost:3001/api/auth/get-session

- Run DB migrations (runtime-safe)
  node /app/packages/api/dist/db/migrate.js

- Seed default data (from /app/scripts/seed_example.sql)
  node /app/packages/api/dist/db/seed.js
  ls -la /app/scripts/seed_example.sql

- Grant user internal pro access (dev override)
  INTERNAL_ADMIN_TOKEN='<token>' USER_ID='<user-id>' \
  curl -fsS -X POST http://localhost:3001/api/billing/internal/assign-user-pro \
    -H "x-internal-admin-token: $INTERNAL_ADMIN_TOKEN" \
    -H "content-type: application/json" \
    --data "{\"userId\":\"$USER_ID\",\"enabled\":true}"

- Assign a band to pro-zero plan
  INTERNAL_ADMIN_TOKEN='<token>' BAND_ID='<band-id>' \
  curl -fsS -X POST http://localhost:3001/api/billing/internal/assign-pro-zero \
    -H "x-internal-admin-token: $INTERNAL_ADMIN_TOKEN" \
    -H "content-type: application/json" \
    --data "{\"bandId\":$BAND_ID}"

- Check bundled migration files
  ls -la /app/packages/api/dist/db/migrations

- Admin CLI help
  /app/bandstr-cli help

- List users / bands
  /app/bandstr-cli list-users
  /app/bandstr-cli list-bands

- Add/delete user
  /app/bandstr-cli add-user --name "Jane Admin" --email "jane@example.com"
  /app/bandstr-cli delete-user --user-id "<user-id>"

- Assign/remove band membership
  /app/bandstr-cli assign-user-to-band --user-id "<user-id>" --band-id 1 --role admin
  /app/bandstr-cli remove-user-from-band --user-id "<user-id>" --band-id 1

- Import songs/votings from another SQL(Postgres) DB
  /app/bandstr-cli import-songs-from-sql-db --source-db-url "<postgres-url>" --source-band-id 1 --target-band-id 1
  /app/bandstr-cli import-votings-from-sql-db --source-db-url "<postgres-url>" --source-band-id 1 --target-band-id 1

- Import bundled at issue predecessor backup (creates/replaces band slug "at-issue")
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/scripts/import-at-issue.sql

- Toggle per-user pro subscription override (band inherits for owner/admin users)
  /app/bandstr-cli change-subscription-for-user --user-id "<user-id>" --enabled true

EOF
