#!/usr/bin/env bash

# Build a signed iOS release and upload it to TestFlight using only what is
# stored in Vaultwarden — no Xcode account login, no certificate in the login
# keychain. Xcode (command line tools) is still required to compile the app.
#
# Pulls from Vaultwarden:
#   "bandstr iOS — App Store Connect"      API key (.p8), issuer, team, bundle id
#   "bandstr iOS — Distribution Signing"   distribution.p12 + password, profile
#
# Usage: ./scripts/testflight-from-vault.sh [local|production]
#   IOS_BUILD_NUMBER    optional; defaults to (highest uploaded build) + 1
#   IOS_SKIP_UPLOAD=1   build + sign only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
# shellcheck source=lib/vaultwarden.sh
source "$SCRIPT_DIR/lib/vaultwarden.sh"

env_profile="${1:-production}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: iOS builds require macOS."
  exit 1
fi

work_dir="$(mktemp -d)"
keychain="$work_dir/bandstr-signing.keychain-db"
keychain_password="$(openssl rand -base64 24)"
original_keychains=()
while IFS= read -r kc; do
  kc="${kc#"${kc%%[![:space:]]*}"}"
  kc="${kc//\"/}"
  [[ -n "$kc" ]] && original_keychains+=("$kc")
done < <(security list-keychains -d user)

cleanup() {
  if ((${#original_keychains[@]})); then
    security list-keychains -d user -s "${original_keychains[@]}" >/dev/null 2>&1 || true
  fi
  security delete-keychain "$keychain" >/dev/null 2>&1 || true
  rm -rf "$work_dir"
  vw_lock
}
trap cleanup EXIT

# --- 1. Secrets from Vaultwarden -------------------------------------------
vw_login

asc_item="$(vw_item_id "$VW_ASC_ITEM")"
signing_item="$(vw_item_id "$VW_SIGNING_ITEM")"
if [[ -z "$asc_item" || -z "$signing_item" ]]; then
  echo "Error: vault items '$VW_ASC_ITEM' and '$VW_SIGNING_ITEM' are required."
  echo "  Create them with scripts/ios-secrets-to-vaultwarden.sh and scripts/ios-signing-to-vaultwarden.sh."
  exit 1
fi

export APPSTORE_CONNECT_API_KEY_ID="$(vw_field "$asc_item" APPSTORE_CONNECT_API_KEY_ID)"
export APPSTORE_CONNECT_ISSUER_ID="$(vw_field "$asc_item" APPSTORE_CONNECT_ISSUER_ID)"
export APPLE_TEAM_ID="$(vw_field "$asc_item" APPLE_TEAM_ID)"
export APPLE_BUNDLE_ID="$(vw_field "$asc_item" APPLE_BUNDLE_ID)"
export APPSTORE_CONNECT_API_KEY_PATH="$work_dir/AuthKey_${APPSTORE_CONNECT_API_KEY_ID}.p8"
vw_attachment_by_suffix "$asc_item" ".p8" "$APPSTORE_CONNECT_API_KEY_PATH"

p12_password="$(vw_field "$signing_item" P12_PASSWORD)"
cert_sha1="$(vw_field "$signing_item" CERT_SHA1)"
profile_uuid="$(vw_field "$signing_item" PROFILE_UUID)"
profile_expires="$(vw_field "$signing_item" PROFILE_EXPIRES)"
vw_attachment_by_suffix "$signing_item" ".p12" "$work_dir/distribution.p12"
vw_attachment_by_suffix "$signing_item" ".mobileprovision" "$work_dir/appstore.mobileprovision"
vw_lock

echo "Team $APPLE_TEAM_ID · bundle $APPLE_BUNDLE_ID · profile $profile_uuid (expires $profile_expires)"

# --- 2. Temporary keychain with the distribution certificate ----------------
security create-keychain -p "$keychain_password" "$keychain"
security set-keychain-settings -lut 21600 "$keychain"
security unlock-keychain -p "$keychain_password" "$keychain"
security import "$work_dir/distribution.p12" -k "$keychain" -f pkcs12 -P "$p12_password" -T /usr/bin/codesign -T /usr/bin/security >/dev/null
# Intermediate CA so codesign can build the full chain.
curl -fsSL https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer -o "$work_dir/AppleWWDRCAG3.cer"
security import "$work_dir/AppleWWDRCAG3.cer" -k "$keychain" >/dev/null 2>&1 || true
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$keychain_password" "$keychain" >/dev/null
security list-keychains -d user -s "$keychain" "${original_keychains[@]}"

if ! security find-identity -v -p codesigning "$keychain" | grep -q "$cert_sha1"; then
  echo "Error: distribution certificate $cert_sha1 is not a valid signing identity (expired or revoked?)."
  echo "  Recreate it with scripts/ios-signing-to-vaultwarden.sh."
  exit 1
fi

# --- 3. Install the provisioning profile -------------------------------------
for dir in "$HOME/Library/MobileDevice/Provisioning Profiles" "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"; do
  mkdir -p "$dir"
  chflags nouchg "$dir/$profile_uuid.mobileprovision" 2>/dev/null || true
  cp -f "$work_dir/appstore.mobileprovision" "$dir/$profile_uuid.mobileprovision"
  if [[ "$dir" == *"UserData"* ]]; then
    chflags uchg "$dir/$profile_uuid.mobileprovision" 2>/dev/null || true
  fi
done

# --- 4. Build number ---------------------------------------------------------
if [[ -z "${IOS_BUILD_NUMBER:-}" ]]; then
  IOS_BUILD_NUMBER="$(node "$SCRIPT_DIR/ios/asc-signing.mjs" next-build-number)"
fi
export IOS_BUILD_NUMBER
echo "Build number: $IOS_BUILD_NUMBER"

# --- 5. Build, sign, upload --------------------------------------------------
IOS_SIGN_IDENTITY="$cert_sha1" \
IOS_PROVISIONING_PROFILE_UUID="$profile_uuid" \
IOS_SIGN_KEYCHAIN="$keychain" \
  bash "$SCRIPT_DIR/build-ios.sh" "$env_profile"

ipa_path="$(find packages/web/src-capacitor/ios/App/build/export -maxdepth 1 -name '*.ipa' ! -name 'bandstr-ios-*' | head -n 1)"
if [[ -z "$ipa_path" ]]; then
  echo "Error: no IPA found after build."
  exit 1
fi

if [[ "${IOS_SKIP_UPLOAD:-0}" == "1" ]]; then
  echo "Signed IPA ready (upload skipped): $ipa_path"
  exit 0
fi

bash "$SCRIPT_DIR/upload-ios-appstore.sh" "$ipa_path"
echo "Build $IOS_BUILD_NUMBER uploaded. It appears in TestFlight after Apple's processing (usually 5–30 min)."
