#!/usr/bin/env bash
set -euo pipefail

# Probe Google Play Developer API permissions from local env.
#
# Required env:
#   GPLAY_PACKAGE_NAME
#   GPLAY_TEST_PURCHASE_TOKEN
#
# Service account sources (first match wins):
#   1) GPLAY_SERVICE_ACCOUNT_JSON (raw JSON)
#   2) GOOGLE_APPLICATION_CREDENTIALS (path to JSON file)
#
# Exit code:
#   0 when subscriptionsv2 GET succeeds
#   1 on permission/auth/config errors
GPLAY_PACKAGE_NAME=org.capacitor.bandstr
GCP_PROJECT_ID=bandstr
API_BASE_URL=https://bandstr.apps.4ki.app

GOOGLE_APPLICATION_CREDENTIALS=./.gplay_app_credentials.json



if ! command -v node >/dev/null 2>&1; then
  echo "Missing required command: node"
  exit 1
fi

if [[ -z "${GPLAY_PACKAGE_NAME:-}" ]]; then
  echo "GPLAY_PACKAGE_NAME is required"
  exit 1
fi
if [[ -z "${GPLAY_TEST_PURCHASE_TOKEN:-}" ]]; then
  echo "GPLAY_TEST_PURCHASE_TOKEN is required"
  exit 1
fi

node <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');

function readServiceAccount() {
  if (process.env.GPLAY_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GPLAY_SERVICE_ACCOUNT_JSON);
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const json = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
    return JSON.parse(json);
  }
  throw new Error('Missing service account credentials. Set GPLAY_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
}

function makeJwt(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const sig = signer.sign(privateKey, 'base64url');
  return `${unsigned}.${sig}`;
}

async function main() {
  const packageName = process.env.GPLAY_PACKAGE_NAME;
  const purchaseToken = process.env.GPLAY_TEST_PURCHASE_TOKEN;
  const sa = readServiceAccount();
  if (!sa.client_email || !sa.private_key) {
    throw new Error('Service account JSON must contain client_email and private_key.');
  }

  console.log(`Service account: ${sa.client_email}`);
  console.log(`Package name:    ${packageName}`);

  const jwt = makeJwt(sa.client_email, sa.private_key);
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!tokenResp.ok) {
    const text = await tokenResp.text();
    throw new Error(`Token exchange failed (${tokenResp.status}): ${text}`);
  }
  const tokenData = await tokenResp.json();
  const accessToken = tokenData.access_token;

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const playResp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const text = await playResp.text();
  if (!playResp.ok) {
    console.error(`subscriptionsv2 GET failed (${playResp.status})`);
    console.error(text);
    process.exit(1);
  }

  const data = JSON.parse(text);
  console.log('subscriptionsv2 GET succeeded');
  console.log(`subscriptionState: ${data.subscriptionState ?? '(missing)'}`);
  if (Array.isArray(data.lineItems) && data.lineItems[0]) {
    console.log(`productId:         ${data.lineItems[0].productId ?? '(missing)'}`);
  }
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
NODE
