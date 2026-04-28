#!/usr/bin/env bash
set -euo pipefail

# Verify Google Play RTDN setup in GCP.
#
# Required env:
#   GCP_PROJECT_ID
#   API_BASE_URL
#   GPLAY_RTDN_TOKEN
#
# Optional:
#   GPLAY_RTDN_TOPIC          default: play-rtdn
#   GPLAY_RTDN_SUBSCRIPTION   default: play-rtdn-push
#   GPLAY_RTDN_PATH           default: /api/billing/webhook/google_play

GCP_PROJECT_ID=bandstr
API_BASE_URL=https://bandstr.apps.4ki.app
GPLAY_RTDN_TOKEN=***REMOVED***

GPLAY_RTDN_TOPIC=bandstr-rtdn
GPLAY_RTDN_SUBSCRIPTION=play-rtdn-push

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd gcloud

PROJECT_ID="${GCP_PROJECT_ID:-}"
TOPIC="${GPLAY_RTDN_TOPIC:-play-rtdn}"
SUBSCRIPTION="${GPLAY_RTDN_SUBSCRIPTION:-play-rtdn-push}"
API_BASE_URL="${API_BASE_URL:-}"
RTDN_TOKEN="${GPLAY_RTDN_TOKEN:-}"
PUSH_PATH="${GPLAY_RTDN_PATH:-/api/billing/webhook/google_play}"
PLAY_PUBLISHER_SA="serviceAccount:google-play-developer-notifications@system.gserviceaccount.com"

if [[ -z "$PROJECT_ID" ]]; then
  echo "GCP_PROJECT_ID is required"
  exit 1
fi
if [[ -z "$API_BASE_URL" ]]; then
  echo "API_BASE_URL is required"
  exit 1
fi
if [[ -z "$RTDN_TOKEN" ]]; then
  echo "GPLAY_RTDN_TOKEN is required"
  exit 1
fi

API_BASE_URL="${API_BASE_URL%/}"
EXPECTED_PUSH_ENDPOINT="${API_BASE_URL}${PUSH_PATH}?token=${RTDN_TOKEN}"

errors=0

check_service_enabled() {
  local svc="$1"
  if gcloud services list --enabled --project "$PROJECT_ID" --format="value(config.name)" | grep -Fxq "$svc"; then
    echo "[OK] API enabled: $svc"
  else
    echo "[FAIL] API not enabled: $svc"
    errors=$((errors + 1))
  fi
}

echo "Verifying project: $PROJECT_ID"
echo ""

check_service_enabled "pubsub.googleapis.com"
check_service_enabled "androidpublisher.googleapis.com"

if gcloud pubsub topics describe "$TOPIC" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "[OK] Topic exists: $TOPIC"
else
  echo "[FAIL] Topic missing: $TOPIC"
  errors=$((errors + 1))
fi

publisher_binding="$(gcloud pubsub topics get-iam-policy "$TOPIC" \
  --project "$PROJECT_ID" \
  --flatten="bindings[].members" \
  --filter="bindings.role=roles/pubsub.publisher AND bindings.members=${PLAY_PUBLISHER_SA}" \
  --format="value(bindings.members)" 2>/dev/null || true)"

if [[ "$publisher_binding" == "$PLAY_PUBLISHER_SA" ]]; then
  echo "[OK] Topic publisher binding present for Google Play system account"
else
  echo "[FAIL] Missing topic publisher binding for Google Play system account"
  errors=$((errors + 1))
fi

if gcloud pubsub subscriptions describe "$SUBSCRIPTION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "[OK] Subscription exists: $SUBSCRIPTION"
  actual_endpoint="$(gcloud pubsub subscriptions describe "$SUBSCRIPTION" --project "$PROJECT_ID" --format="value(pushConfig.pushEndpoint)")"
  if [[ "$actual_endpoint" == "$EXPECTED_PUSH_ENDPOINT" ]]; then
    echo "[OK] Push endpoint matches expected URL+token"
  else
    echo "[FAIL] Push endpoint mismatch"
    echo "       expected: $EXPECTED_PUSH_ENDPOINT"
    echo "       actual:   $actual_endpoint"
    errors=$((errors + 1))
  fi
else
  echo "[FAIL] Subscription missing: $SUBSCRIPTION"
  errors=$((errors + 1))
fi

echo ""
echo "Play Console RTDN topic should be:"
echo "projects/${PROJECT_ID}/topics/${TOPIC}"

if [[ "$errors" -gt 0 ]]; then
  echo ""
  echo "Verification failed with $errors issue(s)."
  exit 1
fi

echo ""
echo "Verification passed."
