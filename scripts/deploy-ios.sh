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

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Error: Xcode is installed but not fully initialized."
  echo "Run these commands and retry:"
  echo "  sudo xcodebuild -runFirstLaunch"
  echo "  sudo xcodebuild -license accept"
  echo "If that still fails, open Xcode once and let it finish installing components."
  exit 1
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "Error: CocoaPods is not installed."
  echo "Install it on macOS with one of:"
  echo "  brew install cocoapods"
  echo "  sudo gem install cocoapods"
  echo "Then run once:"
  echo "  pod setup"
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

resolve_bundle_id() {
  local bundle_id="${APPLE_BUNDLE_ID:-}"
  if [[ -z "$bundle_id" ]]; then
    bundle_id="${APNS_BUNDLE_ID:-}"
  fi
  if [[ -z "$bundle_id" && -f "$REPO_ROOT/packages/web/src-capacitor/capacitor.config.json" ]]; then
    bundle_id="$(sed -n -E 's/.*"appId"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$REPO_ROOT/packages/web/src-capacitor/capacitor.config.json" | head -n 1 || true)"
  fi
  bundle_id="${bundle_id:-org.capacitor.bandstr}"
  printf '%s\n' "$bundle_id"
}

stamp_xcode_build_dir() {
  local dir="$1"
  mkdir -p "$dir"
  if command -v xattr >/dev/null 2>&1; then
    xattr -w com.apple.xcode.CreatedByBuildSystem true "$dir" 2>/dev/null || true
  fi
}

ios_dir="packages/web/src-capacitor/ios/App"
stamp_xcode_build_dir "$ios_dir/build"

echo "Building web assets for iOS..."
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1
# Quasar's default Capacitor iOS packaging step tries to invoke Xcode directly.
# Our deploy flow compiles with xcodebuild below, so only sync the UI/native project here.
corepack pnpm --filter @bandstr/web exec quasar build -m capacitor -T ios --skip-pkg

derived_dir="$ios_dir/build/DerivedData"
bundle_id="$(resolve_bundle_id)"
development_team="${APPLE_TEAM_ID:-${APNS_TEAM_ID:-}}"

destination="generic/platform=iOS"
if [[ -n "$device_id" ]]; then
  destination="id=$device_id"
fi

echo "Using iOS bundle identifier: $bundle_id"
if [[ -n "$development_team" ]]; then
  echo "Using Apple development team: $development_team"
fi
echo "Compiling debug app for device destination: $destination"
build_cmd=(
  xcodebuild
  -workspace "$ios_dir/App.xcworkspace"
  -scheme App
  -configuration Debug
  -derivedDataPath "$derived_dir"
  -destination "$destination"
  -allowProvisioningUpdates
  PRODUCT_BUNDLE_IDENTIFIER="$bundle_id"
  build
)

if [[ -n "$development_team" ]]; then
  build_cmd+=(DEVELOPMENT_TEAM="$development_team")
fi

"${build_cmd[@]}"

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
