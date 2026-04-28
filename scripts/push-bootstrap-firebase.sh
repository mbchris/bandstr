#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PROJECT_ID="${GCP_PROJECT_ID:-${FCM_PROJECT_ID:-}}"
ANDROID_PACKAGE_NAME="${ANDROID_APPLICATION_ID:-org.capacitor.bandstr}"
ANDROID_APP_DISPLAY_NAME="${ANDROID_APP_DISPLAY_NAME:-bandstr}"
PUSH_SERVICE_ACCOUNT_ID="${PUSH_SERVICE_ACCOUNT_ID:-bandstr-push}"
OUT_GOOGLE_SERVICES_JSON="${OUT_GOOGLE_SERVICES_JSON:-packages/web/src-capacitor/android/app/google-services.json}"
KEY_OUT_DIR="${KEY_OUT_DIR:-.secrets/firebase}"
CREATE_NEW_KEY=0

for arg in "$@"; do
  case "$arg" in
    --create-key)
      CREATE_NEW_KEY=1
      ;;
    --help|-h)
      cat <<'EOF'
Usage: ./scripts/push-bootstrap-firebase.sh [--create-key]

Required env:
  GCP_PROJECT_ID (or FCM_PROJECT_ID)

Optional env:
  ANDROID_APPLICATION_ID      default: org.capacitor.bandstr
  ANDROID_APP_DISPLAY_NAME    default: bandstr
  PUSH_SERVICE_ACCOUNT_ID     default: bandstr-push
  OUT_GOOGLE_SERVICES_JSON    default: packages/web/src-capacitor/android/app/google-services.json
  KEY_OUT_DIR                 default: .secrets/firebase

What it does:
  1) Enables required APIs in GCP/Firebase.
  2) Ensures Firebase Android app exists for ANDROID_APPLICATION_ID.
  3) Downloads google-services.json to OUT_GOOGLE_SERVICES_JSON.
  4) Ensures push service account exists and has roles/firebasecloudmessaging.admin.
  5) Optionally creates a NEW JSON key (--create-key) and prints env export lines.

Notes:
  - Needs: gcloud, firebase, jq
  - Needs authenticated CLI session with permission to manage project, Firebase apps, and IAM.
  - APNs key creation in Apple Developer cannot be fully automated and remains manual.
EOF
      exit 0
      ;;
    *)
      echo "Error: unknown option $arg"
      exit 1
      ;;
  esac
done

if [[ -z "$PROJECT_ID" ]]; then
  echo "Error: Set GCP_PROJECT_ID (or FCM_PROJECT_ID)."
  exit 1
fi

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command not found: $1"
    exit 1
  fi
}

need_cmd gcloud
need_cmd firebase
need_cmd jq
need_cmd base64

SERVICE_ACCOUNT_EMAIL="${PUSH_SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==> Using project: $PROJECT_ID"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "==> Enabling required APIs"
gcloud services enable \
  firebase.googleapis.com \
  firebasecloudmessaging.googleapis.com \
  firebaseinstallations.googleapis.com \
  iam.googleapis.com \
  serviceusage.googleapis.com \
  --project "$PROJECT_ID" >/dev/null

# Ensure Firebase is attached to project.
# This is idempotent: if already Firebase-enabled, command may fail with already-exists wording.
echo "==> Ensuring Firebase project is initialized"
set +e
firebase projects:addfirebase "$PROJECT_ID" >/tmp/bandstr-firebase-init.log 2>&1
status=$?
set -e
if [[ "$status" -ne 0 ]]; then
  if rg -q "already|exist|provisioned" /tmp/bandstr-firebase-init.log; then
    echo "    Firebase already initialized for project."
  else
    echo "Error: firebase projects:addfirebase failed"
    cat /tmp/bandstr-firebase-init.log
    exit 1
  fi
fi

# Find or create Android app

echo "==> Ensuring Firebase Android app exists for package: $ANDROID_PACKAGE_NAME"
ANDROID_APP_ID=""
APPS_JSON="$(firebase apps:list --project "$PROJECT_ID" --json)"
ANDROID_APP_ID="$(printf '%s' "$APPS_JSON" | jq -r --arg pkg "$ANDROID_PACKAGE_NAME" '.result[] | select(.platform=="ANDROID" and .packageName==$pkg) | .appId' | head -n1)"

if [[ -z "$ANDROID_APP_ID" || "$ANDROID_APP_ID" == "null" ]]; then
  echo "    App not found. Creating Android app..."
  CREATE_JSON="$(firebase apps:create android "$ANDROID_APP_DISPLAY_NAME" --package-name "$ANDROID_PACKAGE_NAME" --project "$PROJECT_ID" --json)"
  ANDROID_APP_ID="$(printf '%s' "$CREATE_JSON" | jq -r '.result.appId // .result.sdkConfig.appId // empty')"
fi

if [[ -z "$ANDROID_APP_ID" || "$ANDROID_APP_ID" == "null" ]]; then
  echo "Error: failed to resolve Android Firebase appId"
  exit 1
fi

echo "    Android appId: $ANDROID_APP_ID"

echo "==> Downloading google-services.json"
mkdir -p "$(dirname "$OUT_GOOGLE_SERVICES_JSON")"
firebase apps:sdkconfig ANDROID "$ANDROID_APP_ID" --project "$PROJECT_ID" > "$OUT_GOOGLE_SERVICES_JSON"
echo "    Wrote: $OUT_GOOGLE_SERVICES_JSON"

echo "==> Ensuring push service account exists: $SERVICE_ACCOUNT_EMAIL"
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$PUSH_SERVICE_ACCOUNT_ID" \
    --project "$PROJECT_ID" \
    --display-name "bandstr push sender" >/dev/null
fi

echo "==> Granting FCM IAM role"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role "roles/firebasecloudmessaging.admin" >/dev/null

KEY_PATH=""
if [[ "$CREATE_NEW_KEY" -eq 1 ]]; then
  mkdir -p "$KEY_OUT_DIR"
  ts="$(date +%Y%m%d%H%M%S)"
  KEY_PATH="$KEY_OUT_DIR/${PROJECT_ID}-${PUSH_SERVICE_ACCOUNT_ID}-${ts}.json"
  echo "==> Creating new service account key"
  gcloud iam service-accounts keys create "$KEY_PATH" \
    --iam-account "$SERVICE_ACCOUNT_EMAIL" \
    --project "$PROJECT_ID" >/dev/null
fi

echo
echo "Firebase bootstrap complete."
echo
echo "Use these env values in .env.api:"
echo "FCM_PROJECT_ID=$PROJECT_ID"
if [[ -n "$KEY_PATH" ]]; then
  KEY_B64="$(base64 < "$KEY_PATH" | tr -d '\n')"
  echo "FCM_SERVICE_ACCOUNT_JSON=(cat $KEY_PATH)"
  echo "GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64=$KEY_B64"
  echo
  echo "Key file created: $KEY_PATH"
else
  echo "FCM_SERVICE_ACCOUNT_JSON=<paste JSON key content>"
  echo "or"
  echo "GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64=<base64 of JSON key>"
  echo
  echo "Tip: re-run with --create-key to generate a fresh key file automatically."
fi

echo
echo "Next steps:"
echo "1) ./do push-setup local"
echo "2) Build/install new APK and grant notification permission"
echo "3) For iOS, APNs key/capabilities still need manual Apple/Xcode setup"
