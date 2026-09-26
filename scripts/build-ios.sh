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

vault_work_dir=""
vault_keychain=""
vault_original_keychains=()
pbxproj_backup=""

cleanup_signing() {
  local exit_code=$?
  if ((${#vault_original_keychains[@]})); then
    security list-keychains -d user -s "${vault_original_keychains[@]}" >/dev/null 2>&1 || true
  fi
  if [[ -n "$vault_keychain" ]]; then
    security delete-keychain "$vault_keychain" >/dev/null 2>&1 || true
  fi
  if [[ -n "$vault_work_dir" && -d "$vault_work_dir" ]]; then
    rm -rf "$vault_work_dir"
  fi
  if [[ -n "$pbxproj_backup" && -f "$pbxproj_backup" ]]; then
    cp -p "$pbxproj_backup" "$pbxproj" 2>/dev/null || true
    rm -f "$pbxproj_backup" 2>/dev/null || true
  fi
  return "$exit_code"
}
trap cleanup_signing EXIT

# If manual signing env vars were not passed, but Vaultwarden credentials exist in .creds.config,
# load the distribution certificate and provisioning profile automatically.
if [[ "$sign_build" == "1" && -z "${IOS_SIGN_IDENTITY:-}" && -z "${IOS_PROVISIONING_PROFILE_UUID:-}" && -f "$REPO_ROOT/.creds.config" ]]; then
  if command -v bw >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
    # shellcheck source=lib/vaultwarden.sh
    source "$SCRIPT_DIR/lib/vaultwarden.sh"
    echo "Loading iOS release signing secrets from Vaultwarden..."
    if vw_login >/dev/null 2>&1; then
      signing_item="$(vw_item_id "$VW_SIGNING_ITEM")"
      asc_item="$(vw_item_id "$VW_ASC_ITEM")"
      if [[ -n "$signing_item" ]]; then
        vault_work_dir="$(mktemp -d)"
        vault_keychain="$vault_work_dir/bandstr-signing.keychain-db"
        keychain_password="$(openssl rand -base64 24)"

        while IFS= read -r kc; do
          kc="${kc#"${kc%%[![:space:]]*}"}"
          kc="${kc//\"/}"
          [[ -n "$kc" ]] && vault_original_keychains+=("$kc")
        done < <(security list-keychains -d user)

        p12_password="$(vw_field "$signing_item" P12_PASSWORD)"
        cert_sha1="$(vw_field "$signing_item" CERT_SHA1)"
        profile_uuid="$(vw_field "$signing_item" PROFILE_UUID)"
        vw_attachment_by_suffix "$signing_item" ".p12" "$vault_work_dir/distribution.p12"
        vw_attachment_by_suffix "$signing_item" ".mobileprovision" "$vault_work_dir/appstore.mobileprovision"

        if [[ -n "$asc_item" ]]; then
          val_team="$(vw_field "$asc_item" APPLE_TEAM_ID)"
          val_bundle="$(vw_field "$asc_item" APPLE_BUNDLE_ID)"
          [[ -n "$val_team" ]] && development_team="$val_team"
          [[ -n "$val_bundle" ]] && bundle_id="$val_bundle"
        fi
        vw_lock

        security create-keychain -p "$keychain_password" "$vault_keychain"
        security set-keychain-settings -lut 21600 "$vault_keychain"
        security unlock-keychain -p "$keychain_password" "$vault_keychain"
        security import "$vault_work_dir/distribution.p12" -k "$vault_keychain" -f pkcs12 -P "$p12_password" -T /usr/bin/codesign -T /usr/bin/security >/dev/null
        curl -fsSL https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer -o "$vault_work_dir/AppleWWDRCAG3.cer" 2>/dev/null || true
        if [[ -f "$vault_work_dir/AppleWWDRCAG3.cer" ]]; then
          security import "$vault_work_dir/AppleWWDRCAG3.cer" -k "$vault_keychain" >/dev/null 2>&1 || true
        fi
        security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$keychain_password" "$vault_keychain" >/dev/null 2>&1 || true
        security list-keychains -d user -s "$vault_keychain" "${vault_original_keychains[@]}"

        for dir in "$HOME/Library/MobileDevice/Provisioning Profiles" "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"; do
          mkdir -p "$dir"
          cp -f "$vault_work_dir/appstore.mobileprovision" "$dir/$profile_uuid.mobileprovision"
        done

        export IOS_SIGN_IDENTITY="$cert_sha1"
        export IOS_PROVISIONING_PROFILE_UUID="$profile_uuid"
        export IOS_SIGN_KEYCHAIN="$vault_keychain"
      fi
    fi
  fi
fi

if [[ "$sign_build" == "1" && "$env_profile" == "local" && -z "$development_team" && "$bundle_id" == "org.capacitor.bandstr" && -z "${IOS_SIGN_IDENTITY:-}" ]]; then
  echo "Notice: No Apple Development Team configured and placeholder bundle ID '$bundle_id' is used."
  echo "Defaulting to unsigned archive (--no-sign) for local build."
  sign_build=0
fi

# Manual signing (used by scripts/testflight-from-vault.sh or auto-loaded above):
# set all three to sign with a specific certificate/profile instead of Xcode's automatic signing.
#   IOS_SIGN_IDENTITY              SHA-1 of the Apple Distribution certificate
#   IOS_PROVISIONING_PROFILE_UUID  installed App Store provisioning profile
#   IOS_SIGN_KEYCHAIN              keychain holding the certificate
manual_signing=0
if [[ -n "${IOS_SIGN_IDENTITY:-}" || -n "${IOS_PROVISIONING_PROFILE_UUID:-}" ]]; then
  if [[ -z "${IOS_SIGN_IDENTITY:-}" || -z "${IOS_PROVISIONING_PROFILE_UUID:-}" || -z "${IOS_SIGN_KEYCHAIN:-}" || -z "$development_team" ]]; then
    echo "Error: manual signing needs IOS_SIGN_IDENTITY, IOS_PROVISIONING_PROFILE_UUID, IOS_SIGN_KEYCHAIN and APPLE_TEAM_ID."
    exit 1
  fi
  manual_signing=1
  pbxproj="$ios_dir/App.xcodeproj/project.pbxproj"
  pbxproj_backup="$(mktemp)"
  cp -p "$pbxproj" "$pbxproj_backup"

  # Only the App target uses a provisioning profile; passing these as xcodebuild
  # arguments would also apply them to the Pods targets and fail the build.
  echo "Using manual signing (profile $IOS_PROVISIONING_PROFILE_UUID)"
  python3 - "$pbxproj" "$IOS_SIGN_IDENTITY" "$IOS_PROVISIONING_PROFILE_UUID" "$bundle_id" <<'PY'
import re, sys
path, identity, profile, bundle_id = sys.argv[1:5]
text = open(path, encoding="utf-8").read()

def patch(block):
    body = block.group(0)
    if "PRODUCT_BUNDLE_IDENTIFIER" not in body:
        return body
    body = re.sub(r'CODE_SIGN_IDENTITY = [^;]*;', f'CODE_SIGN_IDENTITY = "{identity}";', body)
    body = re.sub(r'CODE_SIGN_STYLE = [^;]*;', 'CODE_SIGN_STYLE = Manual;', body)
    body = re.sub(r'PROVISIONING_PROFILE_SPECIFIER = [^;]*;', f'PROVISIONING_PROFILE_SPECIFIER = "{profile}";', body)
    body = re.sub(r'PRODUCT_BUNDLE_IDENTIFIER = [^;]*;', f'PRODUCT_BUNDLE_IDENTIFIER = "{bundle_id}";', body)
    return body

patched, count = re.subn(r'isa = XCBuildConfiguration;.*?name = \w+;', patch, text, flags=re.S)
if 'CODE_SIGN_STYLE = Manual;' not in patched:
    sys.exit("Error: could not patch App target signing settings in project.pbxproj")
open(path, "w", encoding="utf-8").write(patched)
PY

  export_opts="$archive_dir/ExportOptions-Manual.plist"
  cat >"$export_opts" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>destination</key>
  <string>export</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>teamID</key>
  <string>$development_team</string>
  <key>signingCertificate</key>
  <string>$IOS_SIGN_IDENTITY</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>$bundle_id</key>
    <string>$IOS_PROVISIONING_PROFILE_UUID</string>
  </dict>
  <key>stripSwiftSymbols</key>
  <true/>
</dict>
</plist>
PLIST
fi

archive_cmd=(
  xcodebuild
  -workspace "$ios_dir/App.xcworkspace"
  -scheme App
  -configuration Release
  -derivedDataPath "$derived_dir"
  -destination "generic/platform=iOS"
  -archivePath "$archive_path"
  archive
)
# Manual signing sets the bundle id on the App target only (see pbxproj patch);
# passing it here would also rename every Pods framework to the app's id.
if [[ "$manual_signing" == "0" ]]; then
  archive_cmd+=(PRODUCT_BUNDLE_IDENTIFIER="$bundle_id")
fi

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
elif [[ "$manual_signing" == "1" ]]; then
  archive_cmd+=(OTHER_CODE_SIGN_FLAGS="--keychain $IOS_SIGN_KEYCHAIN")
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
export_cmd=(
  xcodebuild -exportArchive
  -archivePath "$archive_path"
  -exportPath "$export_dir"
  -exportOptionsPlist "$export_opts"
)
if [[ "$manual_signing" == "0" ]]; then
  export_cmd+=(-allowProvisioningUpdates)
fi
"${export_cmd[@]}"

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
