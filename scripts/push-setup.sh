#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

profile="${1:-local}"
check_only=0
android_enabled=1
ios_enabled=1

shift || true
for arg in "$@"; do
  case "$arg" in
    --check)
      check_only=1
      ;;
    --android-only)
      ios_enabled=0
      ;;
    --ios-only)
      android_enabled=0
      ;;
    *)
      echo "Error: Unknown option: $arg"
      echo "Usage: ./scripts/push-setup.sh [local|production] [--check] [--android-only|--ios-only]"
      exit 1
      ;;
  esac
done

if [[ "$profile" != "local" && "$profile" != "production" ]]; then
  echo "Error: profile must be local or production"
  exit 1
fi

if [[ "$android_enabled" -eq 0 && "$ios_enabled" -eq 0 ]]; then
  echo "Error: both Android and iOS are disabled."
  exit 1
fi

printf '\n=== bandstr push setup (%s) ===\n' "$profile"

print_sources() {
  cat <<'EOF'
Where to get required values:

FCM (Android + optional iOS via Firebase):
1) Firebase project ID (`FCM_PROJECT_ID`):
   Firebase Console -> Project settings -> General -> Project ID
2) Service account JSON (`FCM_SERVICE_ACCOUNT_JSON`) [recommended]:
   Firebase Console -> Project settings -> Service accounts -> Generate new private key
   (or Google Cloud Console -> IAM & Admin -> Service Accounts -> Keys -> Add key -> JSON)
3) `google-services.json` (Android app config):
   Firebase Console -> Project settings -> General -> Your apps -> Android app -> Download google-services.json

APNs (iOS):
1) `APNS_TEAM_ID`:
   Apple Developer -> Membership -> Team ID
2) `APNS_KEY_ID` + `APNS_PRIVATE_KEY` (.p8):
   Apple Developer -> Certificates, Identifiers & Profiles -> Keys -> + -> enable Apple Push Notifications service (APNs)
3) `APNS_BUNDLE_ID`:
   Xcode target Bundle Identifier (must match Apple Developer App ID)
EOF
}

print_sources

android_config_path="packages/web/src-capacitor/android/app/google-services.json"

trim() {
  local raw="${1:-}"
  raw="${raw##[[:space:]]}"
  raw="${raw%%[[:space:]]}"
  printf '%s' "$raw"
}

has_fcm_project=0
has_fcm_cred=0
if [[ -n "$(trim "${FCM_PROJECT_ID:-}")" ]]; then
  has_fcm_project=1
fi
if [[ -n "$(trim "${FCM_SERVICE_ACCOUNT_JSON:-}")" ]]; then
  has_fcm_cred=1
elif [[ -n "$(trim "${GOOGLE_APPLICATION_CREDENTIALS_JSON:-}")" ]]; then
  has_fcm_cred=1
elif [[ -n "$(trim "${GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64:-}")" ]]; then
  has_fcm_cred=1
elif [[ -n "$(trim "${FCM_SERVICE_ACCOUNT_EMAIL:-}")" && -n "$(trim "${FCM_SERVICE_ACCOUNT_PRIVATE_KEY:-}")" ]]; then
  has_fcm_cred=1
fi

if [[ "$has_fcm_project" -eq 0 && -n "$(trim "${GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64:-}")" ]]; then
  decoded_project_id="$(printf '%s' "${GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64}" | base64 --decode 2>/dev/null | sed -n -E 's/.*"project_id"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' | head -n 1 || true)"
  if [[ -n "$decoded_project_id" ]]; then
    has_fcm_project=1
    echo "[INFO] FCM_PROJECT_ID inferred from GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64: $decoded_project_id"
  fi
fi

has_apns_team=0
has_apns_key=0
has_apns_private=0
if [[ -n "$(trim "${APNS_TEAM_ID:-}")" ]]; then
  has_apns_team=1
fi
if [[ -n "$(trim "${APNS_KEY_ID:-}")" ]]; then
  has_apns_key=1
fi
if [[ -n "$(trim "${APNS_PRIVATE_KEY:-}")" ]]; then
  has_apns_private=1
fi

if [[ "$android_enabled" -eq 1 ]]; then
  if [[ -n "$(trim "${GOOGLE_SERVICES_JSON_PATH:-}")" ]]; then
    if [[ -f "${GOOGLE_SERVICES_JSON_PATH}" ]]; then
      cp "${GOOGLE_SERVICES_JSON_PATH}" "$android_config_path"
      echo "[OK] Copied google-services.json from GOOGLE_SERVICES_JSON_PATH -> $android_config_path"
    else
      echo "[WARN] GOOGLE_SERVICES_JSON_PATH is set but file not found: ${GOOGLE_SERVICES_JSON_PATH}"
    fi
  elif [[ -n "$(trim "${GOOGLE_SERVICES_JSON_BASE64:-}")" ]]; then
    mkdir -p "$(dirname "$android_config_path")"
    if printf '%s' "$GOOGLE_SERVICES_JSON_BASE64" | base64 --decode > "$android_config_path" 2>/dev/null || printf '%s' "$GOOGLE_SERVICES_JSON_BASE64" | base64 -d > "$android_config_path" 2>/dev/null; then
      echo "[OK] Wrote $android_config_path from GOOGLE_SERVICES_JSON_BASE64"
    else
      echo "[WARN] Failed to decode GOOGLE_SERVICES_JSON_BASE64"
    fi
  fi

  if [[ -f "$android_config_path" ]]; then
    echo "[OK] Android config file exists: $android_config_path"
  else
    echo "[WARN] Missing $android_config_path"
    echo "       Download it from Firebase Console and place it there,"
    echo "       or set GOOGLE_SERVICES_JSON_PATH / GOOGLE_SERVICES_JSON_BASE64 in your env."
  fi

  if [[ "$has_fcm_project" -eq 1 && "$has_fcm_cred" -eq 1 ]]; then
    echo "[OK] FCM server credentials look configured"
  else
    echo "[WARN] FCM server credentials are incomplete"
    echo "       Need FCM_PROJECT_ID and either FCM_SERVICE_ACCOUNT_JSON"
    echo "       or GOOGLE_APPLICATION_CREDENTIALS_JSON / GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64"
    echo "       or FCM_SERVICE_ACCOUNT_EMAIL + FCM_SERVICE_ACCOUNT_PRIVATE_KEY"
  fi
fi

if [[ "$ios_enabled" -eq 1 ]]; then
  if [[ "$has_apns_team" -eq 1 && "$has_apns_key" -eq 1 && "$has_apns_private" -eq 1 ]]; then
    echo "[OK] APNs credentials look configured"
  else
    echo "[WARN] APNs credentials are incomplete"
    echo "       Need APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY"
  fi

  if [[ -n "$(trim "${APNS_BUNDLE_ID:-}")" ]]; then
    echo "[OK] APNS_BUNDLE_ID=${APNS_BUNDLE_ID}"
  else
    echo "[WARN] APNS_BUNDLE_ID is empty (default in app is org.capacitor.bandstr)"
  fi

  echo "[INFO] In Xcode, ensure Push Notifications capability + aps-environment entitlement are enabled."
fi

if [[ "$check_only" -eq 1 ]]; then
  printf '\nCheck complete (no native sync executed due to --check).\n'
  exit 0
fi

if [[ "$android_enabled" -eq 1 ]]; then
  printf '\nSyncing Capacitor Android plugins...\n'
  if pnpm --dir packages/web/src-capacitor exec npx cap sync android; then
    echo "[OK] cap sync android completed"
  else
    echo "[WARN] cap sync android failed. Run manually:"
    echo "       pnpm --dir packages/web/src-capacitor exec npx cap sync android"
  fi
fi

if [[ "$ios_enabled" -eq 1 ]]; then
  printf '\nSyncing Capacitor iOS plugins...\n'
  if pnpm --dir packages/web/src-capacitor exec npx cap sync ios; then
    echo "[OK] cap sync ios completed"
  else
    echo "[WARN] cap sync ios failed (often CocoaPods missing). Run manually after installing pods:"
    echo "       pnpm --dir packages/web/src-capacitor exec npx cap sync ios"
  fi
fi

printf '\nPush setup finished.\n'
