#!/usr/bin/env bash

# Export existing iOS signing and App Store Connect secrets from Vaultwarden
# into base64 environment variables in .env.production (or specified env file).
#
# Once added to your .env file, running `./creds.sh push` will store them
# under the package folder in Vaultwarden so `./creds.sh pull` fetches them
# automatically on any machine without needing extra vault queries during builds.
#
# Usage:
#   ./scripts/sync-ios-secrets-to-env.sh [--env-file .env.production]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE=".env.production"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./scripts/sync-ios-secrets-to-env.sh [--env-file .env.production]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# shellcheck source=lib/vaultwarden.sh
source "$SCRIPT_DIR/lib/vaultwarden.sh"

work_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$work_dir"
  vw_lock
}
trap cleanup EXIT

echo "Connecting to Vaultwarden to fetch iOS release secrets..."
vw_login

asc_item="$(vw_item_id "$VW_ASC_ITEM")"
signing_item="$(vw_item_id "$VW_SIGNING_ITEM")"

if [[ -z "$asc_item" && -z "$signing_item" ]]; then
  echo "Error: Neither '$VW_ASC_ITEM' nor '$VW_SIGNING_ITEM' was found in Vaultwarden."
  exit 1
fi

set_or_replace_env() {
  local file="$1"
  local key="$2"
  local value="$3"

  if [[ ! -f "$file" ]]; then
    touch "$file"
  fi

  if grep -q "^${key}=" "$file"; then
    local tmp
    tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" 'BEGIN{done=0} { if ($0 ~ "^" k "=") { print k "=" v; done=1 } else { print } } END{}' "$file" > "$tmp"
    mv "$tmp" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

echo "Extracting secrets..."

if [[ -n "$asc_item" ]]; then
  api_key_id="$(vw_field "$asc_item" APPSTORE_CONNECT_API_KEY_ID)"
  issuer_id="$(vw_field "$asc_item" APPSTORE_CONNECT_ISSUER_ID)"
  team_id="$(vw_field "$asc_item" APPLE_TEAM_ID)"
  bundle_id="$(vw_field "$asc_item" APPLE_BUNDLE_ID)"

  p8_path="$work_dir/AuthKey_${api_key_id}.p8"
  vw_attachment_by_suffix "$asc_item" ".p8" "$p8_path"
  p8_base64="$(base64 < "$p8_path" | tr -d '\r\n')"

  [[ -n "$api_key_id" ]] && set_or_replace_env "$ENV_FILE" "APPSTORE_CONNECT_API_KEY_ID" "$api_key_id"
  [[ -n "$issuer_id" ]] && set_or_replace_env "$ENV_FILE" "APPSTORE_CONNECT_ISSUER_ID" "$issuer_id"
  [[ -n "$team_id" ]] && set_or_replace_env "$ENV_FILE" "APPLE_TEAM_ID" "$team_id"
  [[ -n "$bundle_id" ]] && set_or_replace_env "$ENV_FILE" "APPLE_BUNDLE_ID" "$bundle_id"
  [[ -n "$p8_base64" ]] && set_or_replace_env "$ENV_FILE" "APPSTORE_CONNECT_API_KEY_BASE64" "$p8_base64"
  echo "✓ Staged App Store Connect API variables in $ENV_FILE"
fi

if [[ -n "$signing_item" ]]; then
  p12_password="$(vw_field "$signing_item" P12_PASSWORD)"
  cert_sha1="$(vw_field "$signing_item" CERT_SHA1)"
  profile_uuid="$(vw_field "$signing_item" PROFILE_UUID)"

  p12_path="$work_dir/distribution.p12"
  prov_path="$work_dir/appstore.mobileprovision"
  vw_attachment_by_suffix "$signing_item" ".p12" "$p12_path"
  vw_attachment_by_suffix "$signing_item" ".mobileprovision" "$prov_path"

  p12_base64="$(base64 < "$p12_path" | tr -d '\r\n')"
  prov_base64="$(base64 < "$prov_path" | tr -d '\r\n')"

  [[ -n "$p12_base64" ]] && set_or_replace_env "$ENV_FILE" "IOS_DISTRIBUTION_P12_BASE64" "$p12_base64"
  [[ -n "$p12_password" ]] && set_or_replace_env "$ENV_FILE" "IOS_P12_PASSWORD" "$p12_password"
  [[ -n "$prov_base64" ]] && set_or_replace_env "$ENV_FILE" "IOS_MOBILEPROVISION_BASE64" "$prov_base64"
  [[ -n "$cert_sha1" ]] && set_or_replace_env "$ENV_FILE" "IOS_SIGN_IDENTITY" "$cert_sha1"
  [[ -n "$profile_uuid" ]] && set_or_replace_env "$ENV_FILE" "IOS_PROVISIONING_PROFILE_UUID" "$profile_uuid"
  echo "✓ Staged iOS Distribution signing variables in $ENV_FILE"
fi

echo
echo "Successfully updated $ENV_FILE with iOS release signing variables."
echo "You can now run:"
echo "  ./creds.sh push --env-file $ENV_FILE"
echo "to sync these variables into the Vaultwarden package folder for everyone."
