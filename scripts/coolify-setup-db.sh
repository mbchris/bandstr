#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# coolify-setup-db.sh — Create and configure the bandstr PostgreSQL database
#                        resource in Coolify via its API.
#
# Prerequisites:
#   - Coolify instance running and accessible
#   - COOLIFY_TOKEN: API token (Settings → API Tokens in Coolify dashboard)
#   - COOLIFY_URL: Base URL of your Coolify instance (e.g. https://coolify.example.com)
#   - COOLIFY_SERVER_UUID: Target server UUID (from Coolify → Servers)
#   - Optionally: COOLIFY_PROJECT_UUID, COOLIFY_ENVIRONMENT_NAME
#
# Usage:
#   export COOLIFY_TOKEN="your-api-token"
#   export COOLIFY_URL="https://coolify.trmusic.de"   # adjust to your Coolify URL
#   export COOLIFY_SERVER_UUID="your-server-uuid"
#   bash scripts/coolify-setup-db.sh
#
# What this script does:
#   1. Creates a PostgreSQL 16 database resource in Coolify
#   2. Outputs the DATABASE_URL to configure in the app resource
#   3. Optionally starts the database
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
COOLIFY_URL="${COOLIFY_URL:?Set COOLIFY_URL (e.g. https://coolify.trmusic.de)}"
COOLIFY_TOKEN="${COOLIFY_TOKEN:?Set COOLIFY_TOKEN (Coolify → Settings → API Tokens)}"
COOLIFY_SERVER_UUID="${COOLIFY_SERVER_UUID:?Set COOLIFY_SERVER_UUID (Coolify → Servers → UUID)}"
COOLIFY_PROJECT_UUID="${COOLIFY_PROJECT_UUID:-}"
COOLIFY_ENVIRONMENT_NAME="${COOLIFY_ENVIRONMENT_NAME:-production}"

DB_NAME="bandstr"
DB_USER="bandstr"
DB_IMAGE="postgres:16-alpine"

# Generate a secure random password
DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         Coolify PostgreSQL Setup for bandstr                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: List projects if none specified ──────────────────────────────────
if [ -z "$COOLIFY_PROJECT_UUID" ]; then
    echo "→ No COOLIFY_PROJECT_UUID set. Listing available projects..."
    echo ""

    PROJECTS=$(curl -s -X GET \
        "${COOLIFY_URL}/api/v1/projects" \
        -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
        -H "Accept: application/json")

    echo "$PROJECTS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if isinstance(data, list):
    for p in data:
        print(f\"  UUID: {p.get('uuid', 'N/A')}  Name: {p.get('name', 'N/A')}\")
else:
    print('  No projects found or unexpected response.')
" 2>/dev/null || echo "$PROJECTS"

    echo ""
    read -rp "Enter COOLIFY_PROJECT_UUID (or press Enter to create a new project): " COOLIFY_PROJECT_UUID

    if [ -z "$COOLIFY_PROJECT_UUID" ]; then
        echo ""
        echo "→ Creating new project 'bandstr'..."

        CREATE_PROJ=$(curl -s -X POST \
            "${COOLIFY_URL}/api/v1/projects" \
            -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
            -H "Content-Type: application/json" \
            -H "Accept: application/json" \
            -d "{\"name\": \"bandstr\", \"description\": \"Band management SaaS\"}")

        COOLIFY_PROJECT_UUID=$(echo "$CREATE_PROJ" | python3 -c "import json,sys; print(json.load(sys.stdin).get('uuid',''))" 2>/dev/null)

        if [ -z "$COOLIFY_PROJECT_UUID" ]; then
            echo "ERROR: Failed to create project. Response:"
            echo "$CREATE_PROJ"
            exit 1
        fi
        echo "  ✓ Project created: ${COOLIFY_PROJECT_UUID}"
    fi
fi

echo ""
echo "→ Using project: ${COOLIFY_PROJECT_UUID}"
echo "→ Environment:   ${COOLIFY_ENVIRONMENT_NAME}"
echo ""

# ── Step 2: Create PostgreSQL database resource ─────────────────────────────
echo "→ Creating PostgreSQL database resource..."

RESPONSE=$(curl -s -X POST \
    "${COOLIFY_URL}/api/v1/databases/postgresql" \
    -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d "{
        \"server_uuid\": \"${COOLIFY_SERVER_UUID}\",
        \"project_uuid\": \"${COOLIFY_PROJECT_UUID}\",
        \"environment_name\": \"${COOLIFY_ENVIRONMENT_NAME}\",
        \"name\": \"bandstr-postgres\",
        \"description\": \"bandstr PostgreSQL database\",
        \"image\": \"${DB_IMAGE}\",
        \"postgres_user\": \"${DB_USER}\",
        \"postgres_password\": \"${DB_PASSWORD}\",
        \"postgres_db\": \"${DB_NAME}\",
        \"is_public\": false,
        \"instant_deploy\": true,
        \"limits_memory\": \"512M\",
        \"limits_cpu\": \"1\"
    }")

DB_UUID=$(echo "$RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('uuid',''))" 2>/dev/null || echo "")

if [ -z "$DB_UUID" ]; then
    echo "ERROR: Failed to create database. Response:"
    echo "$RESPONSE"
    echo ""
    echo "If the API returned an error, you may need to create the database manually."
    echo "See: docs/coolify-deployment.md for manual setup instructions."
    exit 1
fi

echo "  ✓ Database resource created: ${DB_UUID}"
echo ""

# ── Step 3: Retrieve the internal connection URL ────────────────────────────
echo "→ Fetching database connection details..."

# Give Coolify a moment to provision the container
sleep 3

DB_INFO=$(curl -s -X GET \
    "${COOLIFY_URL}/api/v1/databases/${DB_UUID}" \
    -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
    -H "Accept: application/json")

INTERNAL_HOST=$(echo "$DB_INFO" | python3 -c "
import json, sys
data = json.load(sys.stdin)
# The internal hostname is typically the container name on the Docker network
print(data.get('internal_db_url', '') or f\"{data.get('uuid','bandstr-postgres')}:5432\")
" 2>/dev/null || echo "")

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    DATABASE CREATED                         ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                             ║"
echo "  Resource UUID: ${DB_UUID}"
echo "  Database:      ${DB_NAME}"
echo "  User:          ${DB_USER}"
echo "  Password:      ${DB_PASSWORD}"
echo "║                                                             ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  DATABASE_URL (for .env.api / Coolify env vars):            ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo ""
echo "  postgresql://${DB_USER}:${DB_PASSWORD}@${DB_UUID}:5432/${DB_NAME}"
echo ""
echo "  NOTE: The hostname above uses the Coolify resource UUID as"
echo "  the Docker container name. Verify in Coolify dashboard under"
echo "  the database resource → 'Internal URL' field."
echo ""
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  NEXT STEPS                                                 ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo ""
echo "  1. Copy the DATABASE_URL above"
echo "  2. In Coolify, go to your bandstr app resource → Environment"
echo "  3. Add/update DATABASE_URL in the .env.api section"
echo "  4. Deploy the app"
echo ""
echo "  To save credentials locally (DO NOT commit):"
echo "    echo 'DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}' >> .env.api"
echo ""
echo "╚══════════════════════════════════════════════════════════════╝"

# ── Step 4: Save credentials to a local file (gitignored) ───────────────────
CREDS_FILE=".coolify-db-credentials"
cat > "${CREDS_FILE}" <<CREDS
# Coolify PostgreSQL credentials — DO NOT COMMIT
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
COOLIFY_DB_UUID=${DB_UUID}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_UUID}:5432/${DB_NAME}
CREDS

echo ""
echo "→ Credentials saved to ${CREDS_FILE} (gitignored)"
