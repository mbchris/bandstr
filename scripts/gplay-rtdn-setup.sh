#!/usr/bin/env bash
set -euo pipefail

# Configure Google Play RTDN topic + IAM + Pub/Sub push subscription.
#
# Required environment variables:
#   GCP_PROJECT_ID            e.g. bandstr
#   API_BASE_URL              e.g. https://api.bandstr.example
#   GPLAY_RTDN_TOKEN          shared secret appended as ?token=
#
# Optional:
#   GPLAY_RTDN_TOPIC          default: play-rtdn
#   GPLAY_RTDN_SUBSCRIPTION   default: play-rtdn-push
#   GPLAY_RTDN_PATH           default: /api/billing/webhook/google_play
#
# Flags:
#   --dry-run                 print commands only
#   --recreate-subscription   delete/recreate subscription if it exists

DRY_RUN=false
RECREATE_SUBSCRIPTION=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --recreate-subscription) RECREATE_SUBSCRIPTION=true ;;
    *)
      echo "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

run_cmd() {
  echo "+ $*"
  if [[ "$DRY_RUN" == "false" ]]; then
    "$@"
  fi
}

require_cmd gcloud

PROJECT_ID="${GCP_PROJECT_ID:-}"
TOPIC="${GPLAY_RTDN_TOPIC:-play-rtdn}"
SUBSCRIPTION="${GPLAY_RTDN_SUBSCRIPTION:-play-rtdn-push}"
API_BASE_URL="${API_BASE_URL:-}"
RTDN_TOKEN="${GPLAY_RTDN_TOKEN:-}"
PUSH_PATH="${GPLAY_RTDN_PATH:-/api/billing/webhook/google_play}"

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
PUSH_ENDPOINT="${API_BASE_URL}${PUSH_PATH}?token=${RTDN_TOKEN}"
PLAY_PUBLISHER_SA="google-play-developer-notifications@system.gserviceaccount.com"

echo "Project:       $PROJECT_ID"
echo "Topic:         $TOPIC"
echo "Subscription:  $SUBSCRIPTION"
echo "Push endpoint: $PUSH_ENDPOINT"
echo ""

run_cmd gcloud services enable pubsub.googleapis.com androidpublisher.googleapis.com --project "$PROJECT_ID"

if gcloud pubsub topics describe "$TOPIC" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "Topic already exists: $TOPIC"
else
  run_cmd gcloud pubsub topics create "$TOPIC" --project "$PROJECT_ID"
fi

run_cmd gcloud pubsub topics add-iam-policy-binding "$TOPIC" \
  --project "$PROJECT_ID" \
  --member "serviceAccount:${PLAY_PUBLISHER_SA}" \
  --role "roles/pubsub.publisher"

if gcloud pubsub subscriptions describe "$SUBSCRIPTION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  if [[ "$RECREATE_SUBSCRIPTION" == "true" ]]; then
    run_cmd gcloud pubsub subscriptions delete "$SUBSCRIPTION" --project "$PROJECT_ID"
    run_cmd gcloud pubsub subscriptions create "$SUBSCRIPTION" \
      --project "$PROJECT_ID" \
      --topic "$TOPIC" \
      --push-endpoint "$PUSH_ENDPOINT"
  else
    run_cmd gcloud pubsub subscriptions update "$SUBSCRIPTION" \
      --project "$PROJECT_ID" \
      --push-endpoint "$PUSH_ENDPOINT"
  fi
else
  run_cmd gcloud pubsub subscriptions create "$SUBSCRIPTION" \
    --project "$PROJECT_ID" \
    --topic "$TOPIC" \
    --push-endpoint "$PUSH_ENDPOINT"
fi

echo ""
echo "Done."
echo "Play Console RTDN topic value:"
echo "projects/${PROJECT_ID}/topics/${TOPIC}"
