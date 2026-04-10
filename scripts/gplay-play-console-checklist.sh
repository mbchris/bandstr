#!/usr/bin/env bash
set -euo pipefail

# Prints a concise Play Console checklist for service-account assignment.
# There is no official gcloud command to grant Play Console app permissions.


PACKAGE_NAME="${GPLAY_PACKAGE_NAME:-}"
PROJECT_ID="${GCP_PROJECT_ID:-}"
TOPIC="${GPLAY_RTDN_TOPIC:-play-rtdn}"
SA_EMAIL="${GPLAY_SERVICE_ACCOUNT_EMAIL:-}"

PACKAGE_NAME=org.capacitor.bandstr
PROJECT_ID=bandstr
TOPIC="bandstr-rtdn}"
SA_EMAIL="bandstr-subscription@bandstr.iam.gserviceaccount.com"


if [[ -z "$SA_EMAIL" && -n "${GPLAY_SERVICE_ACCOUNT_JSON:-}" ]]; then
  SA_EMAIL="$(node -e "try{const sa=JSON.parse(process.env.GPLAY_SERVICE_ACCOUNT_JSON||'{}');process.stdout.write(sa.client_email||'')}catch{process.stdout.write('')}")"
fi

if [[ -z "$SA_EMAIL" && -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" && -f "${GOOGLE_APPLICATION_CREDENTIALS}" ]]; then
  SA_EMAIL="$(node -e "const fs=require('fs');try{const sa=JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'));process.stdout.write(sa.client_email||'')}catch{process.stdout.write('')}")"
fi

echo "Play Console Manual Assignment Checklist"
echo "======================================="
echo ""
echo "1) Open Play Console:"
echo "   https://play.google.com/console"
echo ""
echo "2) Go to: Users and permissions"
echo "   Add user (service account email): ${SA_EMAIL:-<set GPLAY_SERVICE_ACCOUNT_EMAIL>}"
echo ""
echo "3) Grant required permissions:"
echo "   - Manage orders and subscriptions"
echo "   - View financial data, orders, and cancellation survey responses"
echo ""
echo "4) App access:"
echo "   - Restrict to your app and include: ${PACKAGE_NAME:-<set GPLAY_PACKAGE_NAME>}"
echo ""
echo "5) RTDN topic in Monetization setup:"
if [[ -n "$PROJECT_ID" ]]; then
  echo "   projects/${PROJECT_ID}/topics/${TOPIC}"
else
  echo "   projects/<GCP_PROJECT_ID>/topics/${TOPIC}"
fi
echo ""
echo "6) Send RTDN test message and confirm webhook gets HTTP 200."
