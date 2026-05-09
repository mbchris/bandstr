#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

profile="${1:-production}"
if [[ "$profile" != "local" && "$profile" != "production" ]]; then
  echo "Error: profile must be local or production"
  echo "Usage: ./scripts/appstore-connect-checklist.sh [local|production]"
  exit 1
fi

bundle_id="${APPLE_BUNDLE_ID:-}"
if [[ -z "$bundle_id" && -f packages/web/src-capacitor/capacitor.config.json ]]; then
  bundle_id="$(sed -n -E 's/.*"appId"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' packages/web/src-capacitor/capacitor.config.json | head -n 1 || true)"
fi
bundle_id="${bundle_id:-org.capacitor.bandstr}"

monthly_sku="${APPLE_PRODUCT_PRO_MONTHLY:-}"
yearly_sku="${APPLE_PRODUCT_PRO_YEARLY:-}"
api_key_id="${APPSTORE_CONNECT_API_KEY_ID:-}"
issuer_id="${APPSTORE_CONNECT_ISSUER_ID:-}"
api_key_path="${APPSTORE_CONNECT_API_KEY_PATH:-}"
export_plist="${IOS_EXPORT_OPTIONS_PLIST:-scripts/ios/ExportOptions-AppStore.plist}"

cat <<EOF
bandstr iOS release checklist ($profile)
=======================================

Your situation:
- You do not own the Apple Developer account.
- The Apple account owner (your friend) must complete the Apple-side setup or invite you to the team.
- This repo can already build, export, and upload the iOS app once signing + App Store Connect access are in place.

Current repo values:
- Bundle ID: $bundle_id
- Monthly subscription product: ${monthly_sku:-<missing APPLE_PRODUCT_PRO_MONTHLY>}
- Yearly subscription product: ${yearly_sku:-<missing APPLE_PRODUCT_PRO_YEARLY>}
- App Store Connect API key id: ${api_key_id:-<missing APPSTORE_CONNECT_API_KEY_ID>}
- App Store Connect issuer id: ${issuer_id:-<missing APPSTORE_CONNECT_ISSUER_ID>}
- App Store Connect key path: ${api_key_path:-<optional; set APPSTORE_CONNECT_API_KEY_PATH>}
- Export options plist: $export_plist

Friend/account-owner tasks in Apple Developer / App Store Connect:
1) Create or confirm the App ID for "$bundle_id".
2) Enable capabilities required by bandstr:
   - In-App Purchase
   - Push Notifications
3) Create the App Store Connect app entry for bandstr with the same bundle ID.
4) Create the auto-renewable subscriptions used by the app:
   - ${monthly_sku:-<set APPLE_PRODUCT_PRO_MONTHLY first>}
   - ${yearly_sku:-<set APPLE_PRODUCT_PRO_YEARLY first>}
5) Create signing assets for release builds:
   - iOS Distribution certificate
   - App Store provisioning profile for "$bundle_id"
6) Decide handoff mode:
   - Invite you to the Apple team / App Store Connect with enough permissions, or
   - Keep final signing/upload on your friend's Mac/account
7) If API-key upload should be used from your Mac, create an App Store Connect API key and share:
   - APPSTORE_CONNECT_API_KEY_ID
   - APPSTORE_CONNECT_ISSUER_ID
   - AuthKey_<KEY_ID>.p8 file path for APPSTORE_CONNECT_API_KEY_PATH

Your local Mac tasks:
1) Install Xcode, CocoaPods, and ios-deploy if you want on-device deployment.
2) Open packages/web/src-capacitor/ios/App/App.xcworkspace once in Xcode and verify:
   - Team
   - Signing
   - Bundle identifier
   - Push Notifications capability
   - aps-environment entitlement
3) Build a signed IPA:
   ./do build-ios $profile
4) Upload the IPA to App Store Connect:
   ./do upload-ios $profile
5) If you only need the account-owner checklist again later:
   ./do appstore-checklist $profile

Notes:
- ./do upload-ios now supports the same local|production profile style as Android release commands.
- If signing cannot be configured on your Mac because the Apple account stays only with your friend, build an unsigned archive with:
  ./do build-ios $profile --no-sign
  Then let your friend handle signing/export/upload from Xcode on their machine.
EOF
