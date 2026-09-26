#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

ipa_path="${1:-}"
if [[ -z "$ipa_path" ]]; then
  ipa_path="$(find packages/web/src-capacitor/ios/App/build/export -maxdepth 1 -name '*.ipa' | head -n 1 || true)"
fi

if [[ -z "$ipa_path" || ! -f "$ipa_path" ]]; then
  echo "Error: IPA file not found. Pass path explicitly:"
  echo "  ./scripts/upload-ios-appstore.sh <path-to-ipa>"
  exit 1
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: App Store upload requires macOS."
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "Error: xcrun not found."
  exit 1
fi

api_key_id="${APPSTORE_CONNECT_API_KEY_ID:-}"
issuer_id="${APPSTORE_CONNECT_ISSUER_ID:-}"
key_path="${APPSTORE_CONNECT_API_KEY_PATH:-}"

if [[ -z "$api_key_id" || -z "$issuer_id" ]]; then
  echo "Error: Missing App Store Connect API credentials."
  echo "Required env vars:"
  echo "  APPSTORE_CONNECT_API_KEY_ID"
  echo "  APPSTORE_CONNECT_ISSUER_ID"
  echo "Optional:"
  echo "  APPSTORE_CONNECT_API_KEY_PATH (AuthKey_<ID>.p8)"
  exit 1
fi

if [[ -n "${APPSTORE_CONNECT_API_KEY_BASE64:-}" && -z "$key_path" ]]; then
  mkdir -p "$HOME/.appstoreconnect/private_keys"
  mkdir -p "$HOME/.private_keys"
  echo "$APPSTORE_CONNECT_API_KEY_BASE64" | base64 --decode > "$HOME/.appstoreconnect/private_keys/AuthKey_${api_key_id}.p8"
  cp "$HOME/.appstoreconnect/private_keys/AuthKey_${api_key_id}.p8" "$HOME/.private_keys/AuthKey_${api_key_id}.p8"
  key_path="$HOME/.appstoreconnect/private_keys/AuthKey_${api_key_id}.p8"
fi

if [[ -n "$key_path" ]]; then
  if [[ ! -f "$key_path" ]]; then
    echo "Error: APPSTORE_CONNECT_API_KEY_PATH does not exist: $key_path"
    exit 1
  fi
  export APPSTORE_CONNECT_API_KEY_PATH="$key_path"
  # iTMSTransporter discovers the key by file name in one of the private_keys
  # search dirs; it does not read APPSTORE_CONNECT_API_KEY_PATH. Stage it there.
  private_keys_dir="$HOME/.appstoreconnect/private_keys"
  mkdir -p "$private_keys_dir"
  cp -f "$key_path" "$private_keys_dir/AuthKey_${api_key_id}.p8"
  chmod 600 "$private_keys_dir/AuthKey_${api_key_id}.p8"
fi

echo "Uploading IPA to App Store Connect: $ipa_path"
xcrun iTMSTransporter \
  -m upload \
  -assetFile "$ipa_path" \
  -apiKey "$api_key_id" \
  -apiIssuer "$issuer_id"

echo "Upload submitted successfully."
