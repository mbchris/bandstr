#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

env_profile="${1:-local}"
sign_build=1

for arg in "${@:2}"; do
  case "$arg" in
    --no-sign)
      sign_build=0
      ;;
    *)
      echo "Error: Unknown option for build-ios: $arg"
      echo "Usage: ./scripts/build-ios.sh [local|production] [--no-sign]"
      exit 1
      ;;
  esac
done

if [[ "$env_profile" != "local" && "$env_profile" != "production" ]]; then
  echo "Error: build-ios supports only local or production."
  exit 1
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: iOS builds require macOS with Xcode."
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Error: xcodebuild not found. Install Xcode command line tools."
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

if command -v corepack >/dev/null 2>&1; then
  pnpm_cmd=(corepack pnpm)
elif command -v pnpm >/dev/null 2>&1; then
  pnpm_cmd=(pnpm)
else
  echo "Error: neither corepack nor pnpm was found."
  exit 1
fi

resolve_bundle_id() {
  local bundle_id="${APPLE_BUNDLE_ID:-}"
  if [[ -z "$bundle_id" ]]; then
    bundle_id="${APNS_BUNDLE_ID:-}"
  fi
  if [[ -z "$bundle_id" && -f "$REPO_ROOT/packages/web/src-capacitor/ios/App/App.xcodeproj/project.pbxproj" ]]; then
    bundle_id="$(sed -n -E 's/.*PRODUCT_BUNDLE_IDENTIFIER[[:space:]]*=[[:space:]]*"?([^";]+)"?;.*/\1/p' "$REPO_ROOT/packages/web/src-capacitor/ios/App/App.xcodeproj/project.pbxproj" | head -n 1 || true)"
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
archive_dir="$ios_dir/build"

# Capacitor/Quasar may invoke `xcodebuild clean` during sync. Mark the shared build
# directory as Xcode-managed so the clean step can delete/recreate it safely.
stamp_xcode_build_dir "$archive_dir"

echo "Building web assets for iOS..."
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1
# CocoaPods (invoked by `capacitor sync ios`) aborts unless the locale is UTF-8.
if [[ "${LC_ALL:-${LANG:-}}" != *"UTF-8"* ]]; then
  export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
fi
# Quasar's default Capacitor iOS packaging step tries to invoke Xcode directly.
# Our release flow archives/exports with xcodebuild below, so only sync the UI/native project here.
"${pnpm_cmd[@]}" --filter @bandstr/web exec quasar build -m capacitor -T ios --skip-pkg

archive_path="$archive_dir/App.xcarchive"
derived_dir="$archive_dir/DerivedData"
export_dir="$archive_dir/export"
export_opts="${IOS_EXPORT_OPTIONS_PLIST:-$REPO_ROOT/scripts/ios/ExportOptions-AppStore.plist}"
bundle_id="$(resolve_bundle_id)"
development_team="${APPLE_TEAM_ID:-${APNS_TEAM_ID:-}}"

echo "Using iOS bundle identifier: $bundle_id"
if [[ -n "$development_team" ]]; then
  echo "Using Apple development team: $development_team"
fi

stamp_xcode_build_dir "$archive_dir"
rm -rf "$archive_path" "$export_dir"

archive_cmd=(
  xcodebuild
  -workspace "$ios_dir/App.xcworkspace"
  -scheme App
  -configuration Release
  -derivedDataPath "$derived_dir"
  -destination "generic/platform=iOS"
  -archivePath "$archive_path"
  PRODUCT_BUNDLE_IDENTIFIER="$bundle_id"
  archive
)

if [[ -n "$development_team" ]]; then
  archive_cmd+=(DEVELOPMENT_TEAM="$development_team")
fi

# Optional build/version overrides (TestFlight requires a unique build number per upload).
if [[ -n "${IOS_BUILD_NUMBER:-}" ]]; then
  echo "Using iOS build number: $IOS_BUILD_NUMBER"
  archive_cmd+=(CURRENT_PROJECT_VERSION="$IOS_BUILD_NUMBER")
fi
if [[ -n "${IOS_MARKETING_VERSION:-}" ]]; then
  echo "Using iOS marketing version: $IOS_MARKETING_VERSION"
  archive_cmd+=(MARKETING_VERSION="$IOS_MARKETING_VERSION")
fi

if [[ "$sign_build" == "0" ]]; then
  archive_cmd+=(CODE_SIGNING_ALLOWED=NO)
else
  archive_cmd+=(-allowProvisioningUpdates)
fi

echo "Archiving iOS app..."
"${archive_cmd[@]}"

if [[ "$sign_build" == "0" ]]; then
  echo "Archive created (unsigned): $archive_path"
  exit 0
fi

if [[ ! -f "$export_opts" ]]; then
  echo "Error: Export options plist not found: $export_opts"
  echo "Set IOS_EXPORT_OPTIONS_PLIST or create scripts/ios/ExportOptions-AppStore.plist."
  exit 1
fi

mkdir -p "$export_dir"

echo "Exporting signed IPA for App Store..."
xcodebuild -exportArchive \
  -archivePath "$archive_path" \
  -exportPath "$export_dir" \
  -exportOptionsPlist "$export_opts" \
  -allowProvisioningUpdates

ipa_path="$(find "$export_dir" -maxdepth 1 -name '*.ipa' | head -n 1 || true)"
if [[ -z "$ipa_path" ]]; then
  echo "Error: IPA export failed. No .ipa found in $export_dir"
  exit 1
fi

build_id="${SOURCE_COMMIT:-}"
if [[ -z "$build_id" || "$build_id" == "UNKNOWN" || "$build_id" == "unknown" ]]; then
  build_id="$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
fi
build_id="$(printf '%s' "$build_id" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g')"

named_ipa="$export_dir/bandstr-ios-b${build_id}.ipa"
cp -f "$ipa_path" "$named_ipa"

echo "IPA created: $ipa_path"
echo "Named IPA artifact: $named_ipa"
