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

if [[ -n "$key_path" ]]; then
  if [[ ! -f "$key_path" ]]; then
    echo "Error: APPSTORE_CONNECT_API_KEY_PATH does not exist: $key_path"
    exit 1
  fi
  export APPSTORE_CONNECT_API_KEY_PATH="$key_path"
fi

echo "Uploading IPA to App Store Connect: $ipa_path"
xcrun iTMSTransporter \
  -m upload \
  -assetFile "$ipa_path" \
  -apiKey "$api_key_id" \
  -apiIssuer "$issuer_id"

echo "Upload submitted successfully."
