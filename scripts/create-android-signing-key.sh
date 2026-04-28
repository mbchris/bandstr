#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/create-android-signing-key.sh --store-pass <password> [options]

Options:
  --out <path>            Keystore output path (default: ./.secrets/android-release.jks)
  --alias <name>          Key alias (default: ***REMOVED***)
  --store-pass <pass>     Keystore password (required)
  --key-pass <pass>       Key password (default: same as --store-pass)
  --dname <value>         X.500 distinguished name
                          (default: CN=bandstr, OU=Mobile, O=bandstr, L=Berlin, ST=Berlin, C=DE)
  --validity <days>       Certificate validity days (default: 9125)
  --force                 Overwrite existing output file
  --help                  Show this help

Output:
  Prints export-ready environment variable lines:
  - ANDROID_SIGNING_KEYSTORE_BASE64
  - ANDROID_SIGNING_KEY_ALIAS
  - ANDROID_SIGNING_KEYSTORE_PASSWORD
  - ANDROID_SIGNING_KEY_PASSWORD
EOF
}

out_path="./.secrets/android-release.jks"
alias_name="***REMOVED***"
store_pass=""
key_pass=""
dname="CN=bandstr, OU=Mobile, O=bandstr, L=Berlin, ST=Berlin, C=DE"
validity="9125"
force="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)
      out_path="${2:-}"
      shift 2
      ;;
    --alias)
      alias_name="${2:-}"
      shift 2
      ;;
    --store-pass)
      store_pass="${2:-}"
      shift 2
      ;;
    --key-pass)
      key_pass="${2:-}"
      shift 2
      ;;
    --dname)
      dname="${2:-}"
      shift 2
      ;;
    --validity)
      validity="${2:-}"
      shift 2
      ;;
    --force)
      force="1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$store_pass" ]]; then
  echo "Error: --store-pass is required."
  usage
  exit 1
fi

if [[ -z "$key_pass" ]]; then
  key_pass="$store_pass"
fi

if ! command -v keytool >/dev/null 2>&1; then
  echo "Error: keytool not found in PATH. Install a JDK and retry."
  exit 1
fi

mkdir -p "$(dirname "$out_path")"

if [[ -f "$out_path" && "$force" != "1" ]]; then
  echo "Error: output file already exists: $out_path"
  echo "Use --force to overwrite."
  exit 1
fi

if [[ -f "$out_path" && "$force" == "1" ]]; then
  rm -f "$out_path"
fi

keytool -genkeypair \
  -v \
  -keystore "$out_path" \
  -storetype JKS \
  -alias "$alias_name" \
  -keyalg RSA \
  -keysize 2048 \
  -validity "$validity" \
  -storepass "$store_pass" \
  -keypass "$key_pass" \
  -dname "$dname"

if base64 --help 2>&1 | grep -q -- '--wrap'; then
  keystore_b64="$(base64 --wrap=0 "$out_path")"
else
  keystore_b64="$(base64 "$out_path" | tr -d '\r\n')"
fi

echo "Keystore created at: $out_path"
echo
echo "Use these environment variables in CI/build:"
echo "ANDROID_SIGNING_KEYSTORE_BASE64=$keystore_b64"
echo "ANDROID_SIGNING_KEY_ALIAS=$alias_name"
echo "ANDROID_SIGNING_KEYSTORE_PASSWORD=$store_pass"
echo "ANDROID_SIGNING_KEY_PASSWORD=$key_pass"
