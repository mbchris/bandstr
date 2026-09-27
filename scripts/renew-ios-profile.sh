#!/usr/bin/env bash

# Enable Push Notifications capability on the Bundle ID via App Store Connect API
# and generate an updated App Store provisioning profile with Push Notifications (aps-environment)
# reusing the existing distribution certificate from Vaultwarden.

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
signing_item="$(vw_item_id "$VW_SIGNING_ITEM")"
if [[ -z "$asc_item" || -z "$signing_item" ]]; then
  echo "Error: vault items '$VW_ASC_ITEM' and '$VW_SIGNING_ITEM' are required."
  exit 1
fi

export APPSTORE_CONNECT_API_KEY_ID="$(vw_field "$asc_item" APPSTORE_CONNECT_API_KEY_ID)"
export APPSTORE_CONNECT_ISSUER_ID="$(vw_field "$asc_item" APPSTORE_CONNECT_ISSUER_ID)"
export APPLE_BUNDLE_ID="$(vw_field "$asc_item" APPLE_BUNDLE_ID)"
export APPSTORE_CONNECT_API_KEY_PATH="$work_dir/AuthKey_${APPSTORE_CONNECT_API_KEY_ID}.p8"
vw_attachment_by_suffix "$asc_item" ".p8" "$APPSTORE_CONNECT_API_KEY_PATH"

cert_id="$(vw_field "$signing_item" CERT_ID)"
if [[ -z "$cert_id" ]]; then
  echo "Error: CERT_ID not found on vault item '$VW_SIGNING_ITEM'."
  exit 1
fi

echo "Renewing profile for bundle $APPLE_BUNDLE_ID and certificate $cert_id with Push Notifications..."
node "$SCRIPT_DIR/ios/asc-signing.mjs" renew-profile --cert-id "$cert_id" --out-dir "$work_dir/signing"

meta="$work_dir/signing/profile.json"
m() { jq -r --arg k "$1" '.[$k]' "$meta"; }

echo "Updating vault item '$VW_SIGNING_ITEM' with new profile..."
item_json="$(bw get item "$signing_item")"
updated_json="$(printf '%s' "$item_json" | jq \
  --arg uuid "$(m profileUuid)" \
  --arg pname "$(m profileName)" \
  --arg pexp "$(m profileExpires)" \
  '(.fields) |= map(
     if .name == "PROFILE_UUID" then .value = $uuid
     elif .name == "PROFILE_NAME" then .value = $pname
     elif .name == "PROFILE_EXPIRES" then .value = $pexp
     else . end
   )')"

printf '%s' "$updated_json" | bw encode | bw edit item "$signing_item" >/dev/null

vw_replace_attachment "$signing_item" "$work_dir/signing/appstore.mobileprovision"
bw sync >/dev/null

for dir in "$HOME/Library/MobileDevice/Provisioning Profiles" "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"; do
  mkdir -p "$dir"
  chflags nouchg "$dir/$(m profileUuid).mobileprovision" 2>/dev/null || true
  cp -f "$work_dir/signing/appstore.mobileprovision" "$dir/$(m profileUuid).mobileprovision"
  if [[ "$dir" == *"UserData"* ]]; then
    chflags uchg "$dir/$(m profileUuid).mobileprovision" 2>/dev/null || true
  fi
done

echo "Done! Provisioning profile updated in Vaultwarden and installed locally:"
echo "  PROFILE_NAME = $(m profileName)"
echo "  PROFILE_UUID = $(m profileUuid) (expires $(m profileExpires))"
