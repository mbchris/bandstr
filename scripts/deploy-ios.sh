#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

env_profile="${1:-local}"
device_id="${2:-${IOS_DEVICE_ID:-}}"

if [[ "$env_profile" != "local" && "$env_profile" != "production" ]]; then
  echo "Error: deploy-ios supports only local or production."
  exit 1
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: iOS deploy requires macOS."
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Error: xcodebuild not found."
  exit 1
fi

if ! command -v ios-deploy >/dev/null 2>&1; then
  echo "Error: ios-deploy not found. Install it with: npm i -g ios-deploy"
  exit 1
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "Error: corepack not found."
  exit 1
fi

echo "Building web assets for iOS..."
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1
corepack pnpm --filter @bandstr/web run build:ios

ios_dir="packages/web/src-capacitor/ios/App"
derived_dir="$ios_dir/build/DerivedData"

destination="generic/platform=iOS"
if [[ -n "$device_id" ]]; then
  destination="id=$device_id"
fi

echo "Compiling debug app for device destination: $destination"
xcodebuild \
  -workspace "$ios_dir/App.xcworkspace" \
  -scheme App \
  -configuration Debug \
  -derivedDataPath "$derived_dir" \
  -destination "$destination" \
  build

app_path="$(find "$derived_dir/Build/Products" -type d -name 'App.app' | head -n 1 || true)"
if [[ -z "$app_path" ]]; then
  echo "Error: App bundle not found in $derived_dir"
  exit 1
fi

echo "Deploying app bundle to connected iOS device..."
if [[ -n "$device_id" ]]; then
  ios-deploy --id "$device_id" --bundle "$app_path" --justlaunch
else
  ios-deploy --bundle "$app_path" --justlaunch
fi

echo "Deployed successfully: $app_path"
