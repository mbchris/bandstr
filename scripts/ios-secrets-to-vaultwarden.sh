#!/usr/bin/env bash

# Upload the App Store Connect API key + iOS release identifiers to the
# Vaultwarden instance described in .creds.config.
#
# Stores a Secure Note item "bandstr iOS — App Store Connect" with custom fields
# (KEY_ID / ISSUER_ID / TEAM_ID / BUNDLE_ID) and attaches the AuthKey_<KEY_ID>.p8
# file so a fresh Mac can pull everything needed for `./do testflight`.
#
# Expects these in the environment (exported from .env.production by `./do`):
#   APPSTORE_CONNECT_API_KEY_ID
#   APPSTORE_CONNECT_ISSUER_ID
#   APPSTORE_CONNECT_API_KEY_PATH   (AuthKey_<KEY_ID>.p8)
#   APPLE_TEAM_ID
#   APPLE_BUNDLE_ID

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

ITEM_NAME="bandstr iOS — App Store Connect"
CREDS_FILE="$REPO_ROOT/.creds.config"

for tool in bw jq; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Error: '$tool' is required but not installed."
    [[ "$tool" == "bw" ]] && echo "  Install with: brew install bitwarden-cli"
    [[ "$tool" == "jq" ]] && echo "  Install with: brew install jq"
    exit 1
  fi
done

if [[ ! -f "$CREDS_FILE" ]]; then
  echo "Error: $CREDS_FILE not found (needs VAULTWARDEN_SERVER/USER/MASTER_PASSWORD)."
  exit 1
fi

creds_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$CREDS_FILE" | tail -n 1 || true)"
  local value="${line#*=}"
  value="${value%$'\r'}"
  printf '%s' "$value"
}

VW_SERVER="$(creds_value VAULTWARDEN_SERVER)"
VW_USER="$(creds_value VAULTWARDEN_USER)"
VW_PASSWORD="$(creds_value VAULTWARDEN_MASTER_PASSWORD)"

if [[ -z "$VW_SERVER" || -z "$VW_USER" || -z "$VW_PASSWORD" ]]; then
  echo "Error: VAULTWARDEN_SERVER, VAULTWARDEN_USER and VAULTWARDEN_MASTER_PASSWORD must all be set in $CREDS_FILE."
  exit 1
fi

key_id="${APPSTORE_CONNECT_API_KEY_ID:-}"
issuer_id="${APPSTORE_CONNECT_ISSUER_ID:-}"
key_path="${APPSTORE_CONNECT_API_KEY_PATH:-}"
team_id="${APPLE_TEAM_ID:-}"
bundle_id="${APPLE_BUNDLE_ID:-}"

missing=0
for pair in \
  "APPSTORE_CONNECT_API_KEY_ID:$key_id" \
  "APPSTORE_CONNECT_ISSUER_ID:$issuer_id" \
  "APPSTORE_CONNECT_API_KEY_PATH:$key_path" \
  "APPLE_TEAM_ID:$team_id" \
  "APPLE_BUNDLE_ID:$bundle_id"; do
  name="${pair%%:*}"
  val="${pair#*:}"
  if [[ -z "$val" ]]; then
    echo "Error: $name is not set (fill it in .env.production)."
    missing=1
  fi
done
[[ "$missing" == "1" ]] && exit 1

if [[ ! -f "$key_path" ]]; then
  echo "Error: API key file not found: $key_path"
  exit 1
fi

echo "Configuring Bitwarden CLI for $VW_SERVER ..."
bw config server "$VW_SERVER" >/dev/null

status="$(bw status | jq -r '.status')"
case "$status" in
  unauthenticated)
    echo "Logging in as $VW_USER ..."
    BW_SESSION="$(bw login "$VW_USER" "$VW_PASSWORD" --raw)"
    ;;
  locked|unlocked)
    echo "Unlocking existing vault ..."
    BW_SESSION="$(bw unlock "$VW_PASSWORD" --raw)"
    ;;
  *)
    echo "Error: unexpected bw status '$status'."
    exit 1
    ;;
esac
export BW_SESSION

bw sync >/dev/null

existing_id="$(bw list items --search "$ITEM_NAME" \
  | jq -r --arg n "$ITEM_NAME" 'map(select(.name==$n)) | (.[0].id // "")')"

item_json="$(bw get template item | jq \
  --arg name "$ITEM_NAME" \
  --arg notes "iOS TestFlight upload credentials for bandstr. Managed by scripts/ios-secrets-to-vaultwarden.sh — do not edit by hand." \
  --arg keyid "$key_id" \
  --arg issuer "$issuer_id" \
  --arg team "$team_id" \
  --arg bundle "$bundle_id" \
  '.type = 2
   | .name = $name
   | .notes = $notes
   | .secureNote = {type: 0}
   | del(.login)
   | .fields = [
       {name: "APPSTORE_CONNECT_API_KEY_ID", value: $keyid, type: 0},
       {name: "APPSTORE_CONNECT_ISSUER_ID",  value: $issuer, type: 0},
       {name: "APPLE_TEAM_ID",               value: $team,  type: 0},
       {name: "APPLE_BUNDLE_ID",             value: $bundle, type: 0}
     ]')"

if [[ -n "$existing_id" ]]; then
  echo "Updating existing item ($existing_id) ..."
  printf '%s' "$item_json" | bw encode | bw edit item "$existing_id" >/dev/null
  item_id="$existing_id"
else
  echo "Creating new Secure Note item ..."
  item_id="$(printf '%s' "$item_json" | bw encode | bw create item | jq -r '.id')"
fi

# Replace any prior copy of the same key file, then attach the current one.
fname="$(basename "$key_path")"
while IFS= read -r aid; do
  [[ -n "$aid" ]] || continue
  echo "Removing stale attachment $fname ($aid) ..."
  bw delete attachment "$aid" --itemid "$item_id" >/dev/null
done < <(bw get item "$item_id" | jq -r --arg f "$fname" '(.attachments // []) | map(select(.fileName==$f)) | .[].id')

echo "Attaching $fname ..."
bw create attachment --file "$key_path" --itemid "$item_id" >/dev/null

bw sync >/dev/null
bw lock >/dev/null 2>&1 || true

echo
echo "Done. Vault item '$ITEM_NAME' now holds:"
echo "  - APPSTORE_CONNECT_API_KEY_ID = $key_id"
echo "  - APPSTORE_CONNECT_ISSUER_ID  = $issuer_id"
echo "  - APPLE_TEAM_ID               = $team_id"
echo "  - APPLE_BUNDLE_ID             = $bundle_id"
echo "  - attachment                  = $fname"
