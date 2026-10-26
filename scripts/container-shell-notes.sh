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

================================================================================
bandstr container shell — admin commands
================================================================================
Show all commands and options:
  /app/bandstr-cli help
  /app/bandstr-mail-test help

--------------------------------------------------------------------------------
DATABASE & MIGRATIONS
--------------------------------------------------------------------------------
- Apply pending database migrations (runtime-safe)
  node /app/packages/api/dist/db/migrate.js

- Seed example database records (from /app/scripts/seed_example.sql)
  node /app/packages/api/dist/db/seed.js

- Import predecessor backup SQL (creates/replaces "at-issue" band)
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/scripts/import-at-issue.sql

- Interactive PostgreSQL shell
  psql "$DATABASE_URL"

--------------------------------------------------------------------------------
USER & ACCOUNT MANAGEMENT
--------------------------------------------------------------------------------
- List all users with ID, email, name, devProPlan status, and band count
  /app/bandstr-cli list-users
  Show full usage: /app/bandstr-cli list-users --help

- Create a new user record in the database
  /app/bandstr-cli add-user --name "Jane Admin" --email "jane@example.com"
  Show full usage: /app/bandstr-cli add-user --help

- Set or update user email verification status
  /app/bandstr-cli verify-user-email --email "jane@example.com" --verified true
  /app/bandstr-cli verify-user-email --user-id "<user-id>" --verified true
  Show full usage: /app/bandstr-cli verify-user-email --help

- Permanently delete a user account and associated memberships
  /app/bandstr-cli delete-user --user-id "<user-id>"
  Show full usage: /app/bandstr-cli delete-user --help

- Toggle developer Pro subscription override for a user (band inherits Pro)
  /app/bandstr-cli change-subscription-for-user --user-id "<user-id>" --enabled true
  Show full usage: /app/bandstr-cli change-subscription-for-user --help

- Seed or reset App Store reviewer demo account (appcert@example.org) with demo band
  /app/bandstr-cli seed-demo-account --password "<password>"
  Show full usage: /app/bandstr-cli seed-demo-account --help

--------------------------------------------------------------------------------
BAND & MEMBERSHIP MANAGEMENT
--------------------------------------------------------------------------------
- List all bands with ID, slug, name, plan, member count, and admin Pro status
  /app/bandstr-cli list-bands
  Show full usage: /app/bandstr-cli list-bands --help

- Assign user to a band or update their membership role (owner|admin|member)
  /app/bandstr-cli assign-user-to-band --user-id "<user-id>" --band-id 1 --role admin
  Show full usage: /app/bandstr-cli assign-user-to-band --help

- Remove user membership from a band
  /app/bandstr-cli remove-user-from-band --user-id "<user-id>" --band-id 1
  Show full usage: /app/bandstr-cli remove-user-from-band --help

--------------------------------------------------------------------------------
PUSH NOTIFICATIONS (APNs / FCM)
--------------------------------------------------------------------------------
- List registered mobile push tokens and device info for a band
  /app/bandstr-cli list-band-push-devices --band-id 1
  Show full usage: /app/bandstr-cli list-band-push-devices --help

- Send push notification to all active devices in a band (live or dry-run)
  /app/bandstr-cli send-band-push --band-id 1 --title "Rehearsal" --body "Tonight at 8"
  /app/bandstr-cli send-band-push --band-id 1 --title "Test" --body "Dry run" --dry-run true
  Shortcut: /app/bandstr-cli push-test --band-id 1 --title "Test" --body "Dry run" --dry-run true
  Show full usage: /app/bandstr-cli send-band-push --help

--------------------------------------------------------------------------------
EMAIL DELIVERY TESTING
--------------------------------------------------------------------------------
- Test auth email delivery via configured SMTP, webhook, or console
  /app/bandstr-mail-test send --to "admin@example.com"
  /app/bandstr-mail-test send --to "admin@example.com" --kind reset-password --link "https://example.com/reset"
  Show full usage: /app/bandstr-mail-test --help

--------------------------------------------------------------------------------
CREDENTIAL CHECKS
--------------------------------------------------------------------------------
- Test every configured secret against its service (harmless requests, values never printed)
  node /app/packages/api/dist/cli/verify-secrets.js
  Compare with leaked values: run scripts/leaked-secret-fingerprints.mjs locally, paste its command here
  Show full usage: node /app/packages/api/dist/cli/verify-secrets.js --help

--------------------------------------------------------------------------------
DATA IMPORTS
--------------------------------------------------------------------------------
- Import songs from an external PostgreSQL database into a band
  /app/bandstr-cli import-songs-from-sql-db --source-db-url "<postgres-url>" --source-band-id 1 --target-band-id 1
  Show full usage: /app/bandstr-cli import-songs-from-sql-db --help

- Import song votings and member votes from an external PostgreSQL database
  /app/bandstr-cli import-votings-from-sql-db --source-db-url "<postgres-url>" --source-band-id 1 --target-band-id 1
  Show full usage: /app/bandstr-cli import-votings-from-sql-db --help

--------------------------------------------------------------------------------
API DIAGNOSTICS & INTERNAL ENDPOINTS
--------------------------------------------------------------------------------
- Check API health and build version
  curl -fsS http://localhost:3001/health

- Check auth session endpoint
  curl -fsS http://localhost:3001/api/auth/get-session

- Grant user internal Pro access (dev override via internal token)
  INTERNAL_ADMIN_TOKEN='<token>' USER_ID='<user-id>' \
  curl -fsS -X POST http://localhost:3001/api/billing/internal/assign-user-pro \
    -H "x-internal-admin-token: $INTERNAL_ADMIN_TOKEN" \
    -H "content-type: application/json" \
    --data "{\"userId\":\"$USER_ID\",\"enabled\":true}"

- Assign a band to pro-zero plan (via internal token)
  INTERNAL_ADMIN_TOKEN='<token>' BAND_ID='<band-id>' \
  curl -fsS -X POST http://localhost:3001/api/billing/internal/assign-pro-zero \
    -H "x-internal-admin-token: $INTERNAL_ADMIN_TOKEN" \
    -H "content-type: application/json" \
    --data "{\"bandId\":$BAND_ID}"

================================================================================
EOF
