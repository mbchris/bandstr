#!/usr/bin/env bash
set -euo pipefail

# Probe Google Play Developer API permissions without a real purchase token.
#
# Required env:
#   GPLAY_PACKAGE_NAME
#
# Service account sources (first match wins):
#   1) GPLAY_SERVICE_ACCOUNT_JSON (raw JSON)
#   2) GOOGLE_APPLICATION_CREDENTIALS (path to JSON file)
#
# Logic:
#   - Exchanges JWT for Android Publisher access token.
#   - Calls subscriptionsv2 GET with a dummy token.
#   - Interprets response:
#     * 401/403 permissionDenied => permissions not configured.
#     * 400/404 invalid/not found => endpoint reachable with current permissions.
GPLAY_PACKAGE_NAME=org.capacitor.bandstr
GCP_PROJECT_ID=bandstr
API_BASE_URL=https://bandstr.apps.4ki.app

GOOGLE_APPLICATION_CREDENTIALS=./.gplay_app_credentials_sub.json


if ! command -v node >/dev/null 2>&1; then
  echo "Missing required command: node"
  exit 1
fi

if [[ -z "${GPLAY_PACKAGE_NAME:-}" ]]; then
  echo "GPLAY_PACKAGE_NAME is required"
  exit 1
fi

# Convenience fallback for local runs:
# - current directory: ./.gplay_app_credentials.json
# - repo root (when run from scripts/): ../.gplay_app_credentials.json
if [[ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" && -z "${GPLAY_SERVICE_ACCOUNT_JSON:-}" ]]; then
  if [[ -f "./.gplay_app_credentials.json" ]]; then
    GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/.gplay_app_credentials.json"
  elif [[ -f "../.gplay_app_credentials.json" ]]; then
    GOOGLE_APPLICATION_CREDENTIALS="$(cd .. && pwd)/.gplay_app_credentials.json"
  fi
fi

GPLAY_PACKAGE_NAME="${GPLAY_PACKAGE_NAME:-}" \
GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-}" \
GPLAY_SERVICE_ACCOUNT_JSON="${GPLAY_SERVICE_ACCOUNT_JSON:-}" \
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

function parseErrorReason(text) {
  try {
    const obj = JSON.parse(text);
    return obj?.error?.errors?.[0]?.reason || obj?.error?.status || '';
  } catch {
    return '';
  }
}

async function main() {
  const packageName = process.env.GPLAY_PACKAGE_NAME;
  const dummyToken = 'permission-probe-token-does-not-exist';
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

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(dummyToken)}`;
  const playResp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = await playResp.text();
  if (playResp.ok) {
    console.log('Unexpected 200 with dummy token, but auth/permissions are valid.');
    process.exit(0);
  }

  const reason = parseErrorReason(body);
  if ((playResp.status === 401 || playResp.status === 403) && reason === 'permissionDenied') {
    console.error(`FAIL: permissions are not sufficient (${playResp.status}, ${reason}).`);
    console.error(body);
    process.exit(1);
  }

  if (playResp.status === 400 || playResp.status === 404) {
    console.log(`PASS: endpoint reachable with current credentials (received ${playResp.status} for dummy token).`);
    console.log('This means authentication and baseline API access are working.');
    process.exit(0);
  }

  console.error(`Unexpected response (${playResp.status}).`);
  console.error(body);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
NODE
