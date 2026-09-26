#!/usr/bin/env bash

# Create a fresh Apple Distribution certificate + App Store provisioning profile
# via the App Store Connect API and store them in Vaultwarden.
#
# Reads the App Store Connect API key from the vault item
# "bandstr iOS — App Store Connect" (see ios-secrets-to-vaultwarden.sh) and writes
# "bandstr iOS — Distribution Signing" with:
#   fields:      P12_PASSWORD (hidden), CERT_SHA1, CERT_ID, CERT_EXPIRES,
#                PROFILE_UUID, PROFILE_NAME, PROFILE_EXPIRES, APPLE_BUNDLE_ID
#   attachments: distribution.p12, appstore.mobileprovision
#
# Note: Apple allows only a few distribution certificates per team. Run this
# once per year (certificates expire after 12 months), not per build.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
# shellcheck source=lib/vaultwarden.sh
source "$SCRIPT_DIR/lib/vaultwarden.sh"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"; vw_lock' EXIT

vw_login

asc_item="$(vw_item_id "$VW_ASC_ITEM")"
if [[ -z "$asc_item" ]]; then
  echo "Error: vault item '$VW_ASC_ITEM' not found. Run scripts/ios-secrets-to-vaultwarden.sh first."
  exit 1
fi

export APPSTORE_CONNECT_API_KEY_ID="$(vw_field "$asc_item" APPSTORE_CONNECT_API_KEY_ID)"
export APPSTORE_CONNECT_ISSUER_ID="$(vw_field "$asc_item" APPSTORE_CONNECT_ISSUER_ID)"
export APPLE_BUNDLE_ID="$(vw_field "$asc_item" APPLE_BUNDLE_ID)"
export APPSTORE_CONNECT_API_KEY_PATH="$work_dir/AuthKey_${APPSTORE_CONNECT_API_KEY_ID}.p8"
vw_attachment_by_suffix "$asc_item" ".p8" "$APPSTORE_CONNECT_API_KEY_PATH"

node "$SCRIPT_DIR/ios/asc-signing.mjs" create-signing --out-dir "$work_dir/signing"

meta="$work_dir/signing/signing.json"
m() { jq -r --arg k "$1" '.[$k]' "$meta"; }

item_json="$(bw get template item | jq \
  --arg name "$VW_SIGNING_ITEM" \
  --arg notes "Apple Distribution certificate + App Store provisioning profile for bandstr. Managed by scripts/ios-signing-to-vaultwarden.sh — do not edit by hand." \
  --arg pw "$(m p12Password)" \
  --arg sha1 "$(m certificateSha1)" \
  --arg certid "$(m certificateId)" \
  --arg certexp "$(m certificateExpires)" \
  --arg uuid "$(m profileUuid)" \
  --arg pname "$(m profileName)" \
  --arg pexp "$(m profileExpires)" \
  --arg bundle "$(m bundleId)" \
  '.type = 2
   | .name = $name
   | .notes = $notes
   | .secureNote = {type: 0}
   | del(.login)
   | .fields = [
       {name: "P12_PASSWORD",    value: $pw,      type: 1},
       {name: "CERT_SHA1",       value: $sha1,    type: 0},
       {name: "CERT_ID",         value: $certid,  type: 0},
       {name: "CERT_EXPIRES",    value: $certexp, type: 0},
       {name: "PROFILE_UUID",    value: $uuid,    type: 0},
       {name: "PROFILE_NAME",    value: $pname,   type: 0},
       {name: "PROFILE_EXPIRES", value: $pexp,    type: 0},
       {name: "APPLE_BUNDLE_ID", value: $bundle,  type: 0}
     ]')"

item_id="$(vw_item_id "$VW_SIGNING_ITEM")"
if [[ -n "$item_id" ]]; then
  echo "Updating vault item '$VW_SIGNING_ITEM' ..."
  printf '%s' "$item_json" | bw encode | bw edit item "$item_id" >/dev/null
else
  echo "Creating vault item '$VW_SIGNING_ITEM' ..."
  item_id="$(printf '%s' "$item_json" | bw encode | bw create item | jq -r '.id')"
fi

vw_replace_attachment "$item_id" "$work_dir/signing/distribution.p12"
vw_replace_attachment "$item_id" "$work_dir/signing/appstore.mobileprovision"
bw sync >/dev/null

echo
echo "Done. '$VW_SIGNING_ITEM' holds distribution.p12 (password in hidden field) and appstore.mobileprovision."
echo "  CERT_SHA1    = $(m certificateSha1)  (expires $(m certificateExpires))"
echo "  PROFILE_UUID = $(m profileUuid)  (expires $(m profileExpires))"
