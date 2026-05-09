#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

command="${1:-}"
env_profile="local"
build_apk_sign=1
build_apk_install=1
build_bundle_sign=1
android_version_bump="patch"
deploy_apk_device_id=""
deploy_ios_device_id=""
deploy_play_console_aab_path=""
sign_apk_input_path=""
upload_ios_input_path=""
apk_api_url=""
push_setup_args=()

to_uppercase() {
  printf '%s' "$1" | tr '[:lower:]' '[:upper:]'
}

is_profile_scoped_command() {
  case "$1" in
    build-apk|create-apk-bundle|deploy-apk|deploy-play-console|sign-apk|build-ios|deploy-ios|upload-ios|appstore-checklist|push-setup)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

profile_summary_enabled=0
if is_profile_scoped_command "$command"; then
  profile_summary_enabled=1
fi

print_profile_summary() {
  local status=$?
  if [[ "$profile_summary_enabled" == "1" ]]; then
    echo
    echo "########################################"
    echo "PROFILE USED: $(to_uppercase "$env_profile")"
    if [[ "$status" == "0" ]]; then
      echo "RESULT: SUCCESS"
    else
      echo "RESULT: FAILED (exit $status)"
    fi
    echo "########################################"
    echo
  fi
  return "$status"
}

trap 'print_profile_summary' EXIT

print_usage() {
  cat <<'EOF'
Usage:
  ./do <command> [args...]

Commands:
  start local
    Start local dev stack (DB + migrations + dev containers).

  dev local
    Alias for `start local`.

  run local
    Alias for `start local`.

  logs local
    Follow local dev container logs.

  stop local
    Stop local dev containers and local DB.

  install local
    Install workspace dependencies inside the dev container.

  seed local
    Run DB migrations (if needed) and seed local database.

  build local
    Build production Docker image locally and tag latest.

  build-apk [local|production] [--no-sign] [--no-install] [maj+|min+]
    Build Android APK.
    Default profile: production (if omitted)
    - local uses .env.local (fallback .env)
    - production uses .env.production (fallback .env)
    - --no-sign skips signing
    - --no-install skips adb install
    - maj+ increments MAJOR and resets MINOR/PATCH to 0
    - min+ increments MINOR and resets PATCH to 0
    - default behavior increments PATCH by 1
    Signing env vars for release key (base64):
      ANDROID_SIGNING_KEYSTORE_BASE64
      ANDROID_SIGNING_KEY_ALIAS
      ANDROID_SIGNING_KEYSTORE_PASSWORD
      ANDROID_SIGNING_KEY_PASSWORD
    Note: versionCode is auto-incremented and versionName is bumped on every build.
    Output: creates named artifact like <appName>-vc<versionCode>-b<buildId>.apk.

  create-apk-bundle [local|production] [--no-sign] [maj+|min+]
    Build Android App Bundle (.aab) for Play Store upload.
    Default profile: production (if omitted)
    - local uses .env.local (fallback .env)
    - production uses .env.production (fallback .env)
    - --no-sign skips signing/validation and leaves raw app-release.aab
    - maj+ increments MAJOR and resets MINOR/PATCH to 0
    - min+ increments MINOR and resets PATCH to 0
    - default behavior increments PATCH by 1
    Signing env vars for release key (base64):
      ANDROID_SIGNING_KEYSTORE_BASE64
      ANDROID_SIGNING_KEY_ALIAS
      ANDROID_SIGNING_KEYSTORE_PASSWORD
      ANDROID_SIGNING_KEY_PASSWORD
    Note: versionCode is auto-incremented and versionName is bumped on every build.
    Output: creates named artifact like <appName>-vc<versionCode>-b<buildId>.aab.

  deploy-play-console [local|production] [AAB_PATH]
    Deploy an existing App Bundle (.aab) to the Google Play Console internal track.
    Default profile: production (if omitted)
    If AAB_PATH is omitted, uses the signed release AAB from the build directory.
    - local uses .env.local
    - production uses .env.production

  install-bundletool
    Download bundletool JAR into ./.tools/bundletool (if missing).

  sign-apk [local|production] [APK_PATH]
    Sign an existing Android APK without rebuilding.
    - If APK_PATH is omitted, defaults to:
      packages/web/src-capacitor/android/app/build/outputs/apk/release/app-release-unsigned.apk
    - Uses release key env vars when provided, otherwise debug keystore fallback.

  deploy-apk [local|production] [DEVICE_ID]
    Install an already built APK to a connected device via adb.
    DEVICE_ID can also be set via ANDROID_DEVICE_ID or ADB_DEVICE_ID in env file.
    If the resolved APK is unsigned, it will be signed automatically before install.

  build-ios [local|production] [--no-sign]
    Build iOS archive and export IPA on macOS.
    - local uses .env.local (fallback .env)
    - production uses .env.production (fallback .env)
    - --no-sign skips IPA export and creates only an unsigned archive

  deploy-ios [local|production] [DEVICE_ID]
    Build and deploy iOS app to a connected device on macOS.
    DEVICE_ID can also be set via IOS_DEVICE_ID in env file.
    Requires `ios-deploy` and valid iOS signing setup.

  upload-ios [local|production] [IPA_PATH]
    Upload an IPA to App Store Connect using iTMSTransporter.
    Default profile: production (if omitted)
    If IPA_PATH is omitted, uses the latest exported IPA from the iOS build directory.
    Required env vars:
      APPSTORE_CONNECT_API_KEY_ID
      APPSTORE_CONNECT_ISSUER_ID
    Optional:
      APPSTORE_CONNECT_API_KEY_PATH
    Recommended env vars for signing/export:
      APPLE_BUNDLE_ID
      IOS_EXPORT_OPTIONS_PLIST

  appstore-checklist [local|production]
    Print the Apple Developer / App Store Connect handoff checklist for iOS release setup.
    Default profile: production (if omitted)

  keygen-apk [args...]
    Create a release signing key and print CI env vars.
    Pass-through to: ./scripts/create-android-signing-key.sh
    Example:
      ./do keygen-apk --store-pass "<strong-password>"

  push-setup [local|production] [--check] [--android-only|--ios-only]
    Validate and configure native OS push notification setup.
    - validates FCM/APNs env variables from the selected env profile
    - can materialize Android google-services.json from:
      - GOOGLE_SERVICES_JSON_PATH
      - GOOGLE_SERVICES_JSON_BASE64
    - runs Capacitor sync for Android/iOS (unless --check)
    - prints where to get each required value (Firebase + Apple Developer)

  push-bootstrap-firebase [--create-key]
    Bootstrap Firebase/FCM project-side setup for Android push:
    - enables required APIs
    - ensures Firebase Android app exists
    - downloads google-services.json into Capacitor Android app folder
    - ensures push service-account + IAM role
    - optional: create service-account key and print env values
    Required env: GCP_PROJECT_ID (or FCM_PROJECT_ID)

  sync-assets local
    Sync assets from ./assets to app/public targets.

  security-scan local
    Run security scans for web and backend dependencies.

  cleanup-resources local
    Cleanup generated or unneeded resources.
EOF
}

if [[ "$command" == "build-apk" ]]; then
  second_arg="${2:-}"
  if [[ -z "$second_arg" ]]; then
    env_profile="production"
    start_idx=2
  elif [[ "$second_arg" == "local" || "$second_arg" == "production" ]]; then
    env_profile="$second_arg"
    start_idx=3
  else
    env_profile="production"
    start_idx=2
  fi
  for arg in "${@:start_idx}"; do
    case "$arg" in
      --no-sign)
        build_apk_sign=0
        ;;
      --no-install)
        build_apk_install=0
        ;;
      maj+)
        android_version_bump="major"
        ;;
      min+)
        android_version_bump="minor"
        ;;
      *)
        echo "Error: Unknown option for build-apk: $arg"
        echo "Usage: ./do build-apk [local|production] [--no-sign] [--no-install] [maj+|min+]"
        exit 1
        ;;
    esac
  done
elif [[ "$command" == "create-apk-bundle" ]]; then
  second_arg="${2:-}"
  if [[ -z "$second_arg" ]]; then
    env_profile="production"
    start_idx=2
  elif [[ "$second_arg" == "local" || "$second_arg" == "production" ]]; then
    env_profile="$second_arg"
    start_idx=3
  else
    env_profile="production"
    start_idx=2
  fi
  for arg in "${@:start_idx}"; do
    case "$arg" in
      --no-sign)
        build_bundle_sign=0
        ;;
      maj+)
        android_version_bump="major"
        ;;
      min+)
        android_version_bump="minor"
        ;;
      *)
        echo "Error: Unknown option for create-apk-bundle: $arg"
        echo "Usage: ./do create-apk-bundle [local|production] [--no-sign] [maj+|min+]"
        exit 1
        ;;
    esac
  done
elif [[ "$command" == "deploy-apk" ]]; then
  deploy_arg="${2:-}"
  if [[ -z "$deploy_arg" ]]; then
    env_profile="production"
    deploy_apk_device_id=""
  elif [[ "$deploy_arg" == "local" || "$deploy_arg" == "production" ]]; then
    env_profile="$deploy_arg"
    deploy_apk_device_id="${3:-}"
  else
    # Backwards compatibility: treat second arg as DEVICE_ID.
    env_profile="production"
    deploy_apk_device_id="$deploy_arg"
  fi
elif [[ "$command" == "deploy-play-console" ]]; then
  deploy_arg="${2:-}"
  if [[ -z "$deploy_arg" ]]; then
    env_profile="production"
    deploy_play_console_aab_path=""
  elif [[ "$deploy_arg" == "local" || "$deploy_arg" == "production" ]]; then
    env_profile="$deploy_arg"
    deploy_play_console_aab_path="${3:-}"
  else
    # Treat second arg as AAB_PATH, default to production.
    env_profile="production"
    deploy_play_console_aab_path="$deploy_arg"
  fi
elif [[ "$command" == "deploy-ios" ]]; then
  deploy_arg="${2:-}"
  if [[ -z "$deploy_arg" ]]; then
    env_profile="local"
    deploy_ios_device_id=""
  elif [[ "$deploy_arg" == "local" || "$deploy_arg" == "production" ]]; then
    env_profile="$deploy_arg"
    deploy_ios_device_id="${3:-}"
  else
    env_profile="local"
    deploy_ios_device_id="$deploy_arg"
  fi
elif [[ "$command" == "sign-apk" ]]; then
  sign_arg="${2:-}"
  if [[ -z "$sign_arg" ]]; then
    env_profile="local"
    sign_apk_input_path=""
  elif [[ "$sign_arg" == "local" || "$sign_arg" == "production" ]]; then
    env_profile="$sign_arg"
    sign_apk_input_path="${3:-}"
    if [[ "${4:-}" != "" ]]; then
      echo "Error: Too many arguments for sign-apk."
      echo "Usage: ./do sign-apk [local|production] [APK_PATH]"
      exit 1
    fi
  else
    # Backwards compatibility: treat second arg as APK_PATH.
    env_profile="local"
    sign_apk_input_path="$sign_arg"
    if [[ "${3:-}" != "" ]]; then
      echo "Error: Too many arguments for sign-apk."
      echo "Usage: ./do sign-apk [local|production] [APK_PATH]"
      exit 1
    fi
  fi
elif [[ "$command" == "upload-ios" ]]; then
  upload_arg="${2:-}"
  if [[ -z "$upload_arg" ]]; then
    env_profile="production"
    upload_ios_input_path=""
  elif [[ "$upload_arg" == "local" || "$upload_arg" == "production" ]]; then
    env_profile="$upload_arg"
    upload_ios_input_path="${3:-}"
  else
    env_profile="production"
    upload_ios_input_path="$upload_arg"
  fi
elif [[ "$command" == "appstore-checklist" ]]; then
  checklist_arg="${2:-}"
  if [[ -z "$checklist_arg" ]]; then
    env_profile="production"
  elif [[ "$checklist_arg" == "local" || "$checklist_arg" == "production" ]]; then
    env_profile="$checklist_arg"
  else
    echo "Error: appstore-checklist supports only local or production."
    echo "Usage: ./do appstore-checklist [local|production]"
    exit 1
  fi
elif [[ "$command" == "push-setup" ]]; then
  second_arg="${2:-}"
  if [[ "$second_arg" == "local" || "$second_arg" == "production" ]]; then
    env_profile="$second_arg"
    if [[ "$#" -ge 3 ]]; then
      push_setup_args=("${@:3}")
    fi
  else
    env_profile="local"
    if [[ "$#" -ge 2 ]]; then
      push_setup_args=("${@:2}")
    fi
  fi
else
  env_profile="${2:-local}"
fi

if [[ -z "$command" ]]; then
  print_usage
  exit 1
fi

if [[ "$command" == "help" || "$command" == "-h" || "$command" == "--help" ]]; then
  print_usage
  exit 0
fi

if [[ "$command" == "keygen-apk" ]]; then
  bash ./scripts/create-android-signing-key.sh "${@:2}"
  exit $?
fi

if [[ "$command" == "push-bootstrap-firebase" ]]; then
  bash ./scripts/push-bootstrap-firebase.sh "${@:2}"
  exit $?
fi

if [[ "$command" == "build-apk" || "$command" == "create-apk-bundle" || "$command" == "deploy-apk" || "$command" == "deploy-play-console" || "$command" == "sign-apk" || "$command" == "build-ios" || "$command" == "deploy-ios" || "$command" == "upload-ios" || "$command" == "appstore-checklist" ]]; then
  if [[ "$env_profile" != "local" && "$env_profile" != "production" ]]; then
    echo "Error: $command supports only local or production."
    echo "Use: ./do $command {local|production}"
    exit 1
  fi
elif [[ "$env_profile" != "local" ]]; then
  echo "Error: Only local mode is supported for this command. Use: ./do <command> local"
  exit 1
fi

if [[ "$command" != "install-bundletool" && "$command" != "security-scan" ]]; then
  if [[ "$env_profile" == "production" ]]; then
    if [[ -f ".env.production" ]]; then
      env_file=".env.production"
    elif [[ -f ".env" ]]; then
      echo "Warning: .env.production not found. Falling back to .env"
      env_file=".env"
    else
      echo "Error: Neither .env.production nor .env found."
      exit 1
    fi
  else
    if [[ -f ".env.local" ]]; then
      env_file=".env.local"
    elif [[ -f ".env" ]]; then
      echo "Warning: .env.local not found. Falling back to .env"
      env_file=".env"
    else
      echo "Error: Neither .env.local nor .env found."
      exit 1
    fi
  fi

  echo "Using environment configuration: $env_file"
  export ENV_FILE="$env_file"
fi

get_env_value() {
  local key="$1"
  local file="$2"
  local line
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 1
  fi
  local value="${line#*=}"
  value="${value%$'\r'}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s\n' "$value"
}

if [[ "$command" == "build-apk" || "$command" == "create-apk-bundle" || "$command" == "deploy-apk" || "$command" == "build-ios" ]]; then
  apk_api_url="$(get_env_value API_URL "$env_file" || true)"
  if [[ -z "$apk_api_url" ]]; then
    echo "Error: API_URL is not set in $env_file."
    if [[ "$env_profile" == "local" ]]; then
      echo "Set API_URL in .env.local/.env for local APK builds, or use:"
      echo "  ./do $command production"
    else
      echo "Set API_URL in .env.production or .env."
    fi
    exit 1
  fi
fi

export_env_file() {
  local file="$1"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" ]] && continue
    [[ "${line:0:1}" == "#" ]] && continue
    [[ "$line" != *=* ]] && continue

    local key="${line%%=*}"
    local value="${line#*=}"

    key="$(echo "$key" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
    value="$(echo "$value" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
  done < "$file"
}

to_windows_path() {
  local input_path="$1"
  if [[ -z "$input_path" ]]; then
    return 1
  fi
  if [[ "$input_path" =~ ^[A-Za-z]:[\\/].* ]]; then
    printf '%s\n' "$input_path"
    return 0
  fi
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$input_path"
    return $?
  fi
  if [[ "$input_path" =~ ^/([A-Za-z])/(.*)$ ]]; then
    local drive="${BASH_REMATCH[1]}"
    local rest="${BASH_REMATCH[2]}"
    local drive_upper
    drive_upper="$(to_uppercase "$drive")"
    rest="${rest//\//\\}"
    printf '%s:\\%s\n' "$drive_upper" "$rest"
    return 0
  fi
  printf '%s\n' "$input_path"
}

resolve_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    printf 'docker compose\n'
    return 0
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    printf 'docker-compose\n'
    return 0
  fi

  echo "Error: Docker Compose is not available."
  echo "Install Docker Compose plugin (docker compose) or docker-compose binary."
  exit 1
}

COMPOSE_CMD_STR="$(resolve_compose_cmd)"
if [[ "$COMPOSE_CMD_STR" == "docker compose" ]]; then
  COMPOSE_CMD=(docker compose)
else
  COMPOSE_CMD=(docker-compose)
fi

DB_COMPOSE=("${COMPOSE_CMD[@]}" -f docker-compose.dev.yml)
APP_COMPOSE=("${COMPOSE_CMD[@]}" --profile dev)
PROD_COMPOSE=("${COMPOSE_CMD[@]}" --profile prod)
COREPACK_NONINTERACTIVE='export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1;'

ensure_db() {
  echo "Ensuring local PostgreSQL is running (docker-compose.dev.yml)..."
  "${DB_COMPOSE[@]}" up -d postgres
}

ensure_migrations_file() {
  if ! ls packages/api/src/db/migrations/*.sql >/dev/null 2>&1; then
    echo "No migration files found. Generating initial migration..."
    "${APP_COMPOSE[@]}" run --rm dev sh -c "$COREPACK_NONINTERACTIVE corepack enable && pnpm install && pnpm --filter @bandstr/api run db:generate"
  fi
}

run_migrations_if_needed() {
  echo "Running local database migrations..."
  "${APP_COMPOSE[@]}" run --rm dev sh -c "$COREPACK_NONINTERACTIVE corepack enable && pnpm install && pnpm --filter @bandstr/api exec tsx src/db/migrate.ts"
}

resolve_android_apk_path() {
  local release_apk="packages/web/src-capacitor/android/app/build/outputs/apk/release/app-release.apk"
  local release_signed_apk="packages/web/src-capacitor/android/app/build/outputs/apk/release/app-release-signed.apk"
  local release_unsigned_apk="packages/web/src-capacitor/android/app/build/outputs/apk/release/app-release-unsigned.apk"
  local debug_apk="packages/web/src-capacitor/android/app/build/outputs/apk/debug/app-debug.apk"

  if [[ -f "$release_signed_apk" ]]; then
    printf '%s\n' "$release_signed_apk"
  elif [[ -f "$release_apk" ]]; then
    printf '%s\n' "$release_apk"
  elif [[ -f "$release_unsigned_apk" ]]; then
    printf '%s\n' "$release_unsigned_apk"
  elif [[ -f "$debug_apk" ]]; then
    printf '%s\n' "$debug_apk"
  else
    return 1
  fi
}

resolve_android_version_code() {
  local gradle_file="packages/web/src-capacitor/android/app/build.gradle"
  if [[ ! -f "$gradle_file" ]]; then
    return 1
  fi
  grep -E '^[[:space:]]*versionCode[[:space:]]+[0-9]+' "$gradle_file" | head -n 1 | awk '{print $2}'
}

sanitize_filename_component() {
  local value="$1"
  local normalized
  normalized="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+|-+$//g')"
  if [[ -z "$normalized" ]]; then
    normalized="unknown"
  fi
  printf '%s\n' "$normalized"
}

resolve_android_app_name() {
  local config_file="packages/web/src-capacitor/capacitor.config.json"
  if [[ -f "$config_file" ]]; then
    local parsed
    parsed="$(sed -n -E 's/.*"appName"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$config_file" | head -n 1)"
    if [[ -n "$parsed" ]]; then
      printf '%s\n' "$parsed"
      return 0
    fi
  fi
  printf 'bandstr\n'
}

resolve_build_id() {
  local from_env="${SOURCE_COMMIT:-}"
  if [[ -n "$from_env" && "$from_env" != "UNKNOWN" && "$from_env" != "unknown" ]]; then
    printf '%s\n' "$(sanitize_filename_component "${from_env:0:12}")"
    return 0
  fi

  if git rev-parse --short HEAD >/dev/null 2>&1; then
    printf '%s\n' "$(sanitize_filename_component "$(git rev-parse --short HEAD)")"
    return 0
  fi

  printf '%s\n' "$(date +%Y%m%d%H%M%S)"
}

create_named_android_artifact() {
  local source_path="$1"
  if [[ ! -f "$source_path" ]]; then
    echo "Error: Artifact not found: $source_path"
    return 1
  fi

  local extension="${source_path##*.}"
  local artifact_dir
  artifact_dir="$(dirname "$source_path")"
  local app_name
  app_name="$(sanitize_filename_component "$(resolve_android_app_name)")"
  local version_code
  version_code="$(resolve_android_version_code || true)"
  if [[ -z "$version_code" ]]; then
    version_code="0"
  fi
  local build_id
  build_id="$(resolve_build_id)"

  local named_path="${artifact_dir}/${app_name}-vc${version_code}-b${build_id}.${extension}"
  cp -f "$source_path" "$named_path"
  printf '%s\n' "$named_path"
}

resolve_apksigner_bin() {
  local sdk_path="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  if command -v apksigner >/dev/null 2>&1; then
    printf '%s\n' "apksigner"
    return 0
  fi

  if [[ -n "$sdk_path" && -d "$sdk_path/build-tools" ]]; then
    local latest_build_tools=""
    latest_build_tools="$(ls -1 "$sdk_path/build-tools" 2>/dev/null | sort -V | tail -n 1 || true)"
    if [[ -n "$latest_build_tools" ]]; then
      if [[ -x "$sdk_path/build-tools/$latest_build_tools/apksigner" ]]; then
        printf '%s\n' "$sdk_path/build-tools/$latest_build_tools/apksigner"
        return 0
      fi
      if [[ -f "$sdk_path/build-tools/$latest_build_tools/apksigner.bat" ]]; then
        printf '%s\n' "$sdk_path/build-tools/$latest_build_tools/apksigner.bat"
        return 0
      fi
    fi
  fi

  return 1
}

verify_apk_signature() {
  local apksigner_bin="$1"
  local apk_path="$2"
  "$apksigner_bin" verify --print-certs "$apk_path" >/dev/null
}

resolve_jarsigner_bin() {
  if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/jarsigner" ]]; then
    printf '%s\n' "$JAVA_HOME/bin/jarsigner"
    return 0
  fi

  if command -v jarsigner >/dev/null 2>&1; then
    printf '%s\n' "jarsigner"
    return 0
  fi

  return 1
}

resolve_bundletool_jar() {
  local version="${BUNDLETOOL_VERSION:-1.18.1}"
  local tools_dir="$SCRIPT_DIR/.tools/bundletool"
  local jar_path="$tools_dir/bundletool-all-$version.jar"

  if [[ -f "$jar_path" ]]; then
    printf '%s\n' "$jar_path"
    return 0
  fi

  mkdir -p "$tools_dir"
  local download_url="https://github.com/google/bundletool/releases/download/$version/bundletool-all-$version.jar"
  echo "Installing bundletool $version to $jar_path"

  if command -v curl >/dev/null 2>&1; then
    curl -fL "$download_url" -o "$jar_path"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$jar_path" "$download_url"
  else
    echo "Error: curl or wget is required to download bundletool."
    return 1
  fi

  if [[ ! -s "$jar_path" ]]; then
    echo "Error: bundletool download failed ($jar_path is empty)."
    return 1
  fi

  printf '%s\n' "$jar_path"
}

run_bundletool() {
  if command -v bundletool >/dev/null 2>&1; then
    bundletool "$@"
    return $?
  fi

  local jar_path=""
  jar_path="$(resolve_bundletool_jar || true)"
  if [[ -z "$jar_path" ]]; then
    return 1
  fi

  local java_bin="java"
  if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
    java_bin="$JAVA_HOME/bin/java"
  fi

  local jar_for_java="$jar_path"
  local converted_args=("$@")
  if [[ "${OS:-}" == "Windows_NT" || -n "${MSYSTEM:-}" ]]; then
    jar_for_java="$(to_windows_path "$jar_for_java" || printf '%s' "$jar_for_java")"
    converted_args=()
    for arg in "$@"; do
      case "$arg" in
        --bundle=*|--output=*|--ks=*|--aab=*|--apks=*|--device-spec=*)
          local key="${arg%%=*}"
          local value="${arg#*=}"
          local converted_value
          converted_value="$(to_windows_path "$value" || printf '%s' "$value")"
          converted_args+=("${key}=${converted_value}")
          ;;
        *)
          converted_args+=("$arg")
          ;;
      esac
    done
  fi

  "$java_bin" -jar "$jar_for_java" "${converted_args[@]}"
}

install_bundletool() {
  local jar_path=""
  jar_path="$(resolve_bundletool_jar)"
  echo "bundletool ready: $jar_path"
}

sign_apk_file() {
  local input_apk="$1"
  local output_apk="$2"
  local is_windows_shell=0
  if [[ "${OS:-}" == "Windows_NT" || -n "${MSYSTEM:-}" ]]; then
    is_windows_shell=1
  fi

  local apksigner_bin=""
  local user_home="${USERPROFILE:-$HOME}"
  local debug_keystore="$user_home/.android/debug.keystore"
  local encoded_keystore="${ANDROID_SIGNING_KEYSTORE_BASE64:-}"
  local keystore_password="${ANDROID_SIGNING_KEYSTORE_PASSWORD:-}"
  local key_alias="${ANDROID_SIGNING_KEY_ALIAS:-}"
  local key_password="${ANDROID_SIGNING_KEY_PASSWORD:-}"
  local temp_keystore=""
  local cleanup_temp_keystore=0

  apksigner_bin="$(resolve_apksigner_bin || true)"
  if [[ -z "$apksigner_bin" ]]; then
    echo "Error: apksigner was not found."
    echo "Install Android build-tools or add apksigner to PATH."
    return 1
  fi

  if [[ -n "$encoded_keystore" ]]; then
    if [[ -z "$keystore_password" || -z "$key_alias" || -z "$key_password" ]]; then
      echo "Error: ANDROID_SIGNING_KEYSTORE_BASE64 is set but signing credentials are missing."
      echo "Required: ANDROID_SIGNING_KEYSTORE_PASSWORD, ANDROID_SIGNING_KEY_ALIAS, ANDROID_SIGNING_KEY_PASSWORD."
      return 1
    fi

    local temp_root="${TMPDIR:-${TEMP:-${TMP:-}}}"
    if [[ -z "$temp_root" && "$is_windows_shell" == "1" ]]; then
      temp_root="${LOCALAPPDATA:-$user_home/AppData/Local}/Temp"
    fi
    temp_root="${temp_root:-/tmp}"
    mkdir -p "$temp_root"
    temp_keystore="$(mktemp "$temp_root/bandstr-signing-XXXXXX.jks")"
    if ! printf '%s' "$encoded_keystore" | base64 --decode > "$temp_keystore" 2>/dev/null; then
      if ! printf '%s' "$encoded_keystore" | base64 -d > "$temp_keystore" 2>/dev/null; then
        rm -f "$temp_keystore"
        echo "Error: failed to decode ANDROID_SIGNING_KEYSTORE_BASE64."
        return 1
      fi
    fi
    cleanup_temp_keystore=1
  elif [[ ! -f "$debug_keystore" ]]; then
    echo "Error: no release keystore provided and debug keystore not found at $debug_keystore"
    echo "Set ANDROID_SIGNING_KEYSTORE_BASE64 env vars, or run an Android debug build once."
    return 1
  else
    temp_keystore="$debug_keystore"
    keystore_password="android"
    key_alias="androiddebugkey"
    key_password="android"
  fi

  local ks_for_sign="$temp_keystore"
  local out_for_sign="$output_apk"
  local in_for_sign="$input_apk"
  if [[ "$is_windows_shell" == "1" ]]; then
    ks_for_sign="$(to_windows_path "$ks_for_sign" || printf '%s' "$ks_for_sign")"
    out_for_sign="$(to_windows_path "$out_for_sign" || printf '%s' "$out_for_sign")"
    in_for_sign="$(to_windows_path "$in_for_sign" || printf '%s' "$in_for_sign")"
  fi

  rm -f "$output_apk"
  "$apksigner_bin" sign \
    --ks "$ks_for_sign" \
    --ks-key-alias "$key_alias" \
    --ks-pass "pass:$keystore_password" \
    --key-pass "pass:$key_password" \
    --out "$out_for_sign" \
    "$in_for_sign"

  if [[ "$cleanup_temp_keystore" == "1" ]]; then
    rm -f "$temp_keystore"
  fi

  local verify_target="$output_apk"
  if [[ "$is_windows_shell" == "1" ]]; then
    verify_target="$(to_windows_path "$verify_target" || printf '%s' "$verify_target")"
  fi
  if ! verify_apk_signature "$apksigner_bin" "$verify_target"; then
    echo "Error: APK signature verification failed for $output_apk."
    return 1
  fi

  return 0
}

sign_aab_file_for_playstore() {
  local input_aab="$1"
  local output_aab="$2"
  local is_windows_shell=0
  if [[ "${OS:-}" == "Windows_NT" || -n "${MSYSTEM:-}" ]]; then
    is_windows_shell=1
  fi

  local jarsigner_bin=""
  local encoded_keystore="${ANDROID_SIGNING_KEYSTORE_BASE64:-}"
  local keystore_password="${ANDROID_SIGNING_KEYSTORE_PASSWORD:-}"
  local key_alias="${ANDROID_SIGNING_KEY_ALIAS:-}"
  local key_password="${ANDROID_SIGNING_KEY_PASSWORD:-}"
  local temp_keystore=""
  local cleanup_temp_keystore=0
  local user_home="${USERPROFILE:-$HOME}"

  if [[ -z "$encoded_keystore" || -z "$keystore_password" || -z "$key_alias" || -z "$key_password" ]]; then
    echo "Error: create-apk-bundle requires release signing env vars:"
    echo "  ANDROID_SIGNING_KEYSTORE_BASE64"
    echo "  ANDROID_SIGNING_KEYSTORE_PASSWORD"
    echo "  ANDROID_SIGNING_KEY_ALIAS"
    echo "  ANDROID_SIGNING_KEY_PASSWORD"
    return 1
  fi

  jarsigner_bin="$(resolve_jarsigner_bin || true)"
  if [[ -z "$jarsigner_bin" ]]; then
    echo "Error: jarsigner not found."
    return 1
  fi

  local temp_root="${TMPDIR:-${TEMP:-${TMP:-}}}"
  if [[ -z "$temp_root" && "$is_windows_shell" == "1" ]]; then
    temp_root="${LOCALAPPDATA:-$user_home/AppData/Local}/Temp"
  fi
  temp_root="${temp_root:-/tmp}"
  mkdir -p "$temp_root"
  temp_keystore="$(mktemp "$temp_root/bandstr-signing-XXXXXX.jks")"
  if ! printf '%s' "$encoded_keystore" | base64 --decode > "$temp_keystore" 2>/dev/null; then
    if ! printf '%s' "$encoded_keystore" | base64 -d > "$temp_keystore" 2>/dev/null; then
      rm -f "$temp_keystore"
      echo "Error: failed to decode ANDROID_SIGNING_KEYSTORE_BASE64."
      return 1
    fi
  fi
  cleanup_temp_keystore=1

  cp "$input_aab" "$output_aab"

  local ks_for_sign="$temp_keystore"
  local out_for_sign="$output_aab"
  if [[ "$is_windows_shell" == "1" ]]; then
    ks_for_sign="$(to_windows_path "$ks_for_sign" || printf '%s' "$ks_for_sign")"
    out_for_sign="$(to_windows_path "$out_for_sign" || printf '%s' "$out_for_sign")"
  fi

  "$jarsigner_bin" \
    -sigalg SHA256withRSA \
    -digestalg SHA-256 \
    -keystore "$ks_for_sign" \
    -storepass "$keystore_password" \
    -keypass "$key_password" \
    "$out_for_sign" \
    "$key_alias" >/dev/null

  if [[ "$cleanup_temp_keystore" == "1" ]]; then
    rm -f "$temp_keystore"
  fi

  if ! "$jarsigner_bin" -verify -certs "$out_for_sign" >/dev/null 2>&1; then
    echo "Error: AAB signature verification failed for $output_aab."
    echo "Details:"
    "$jarsigner_bin" -verify -certs "$out_for_sign" || true
    return 1
  fi

  if ! run_bundletool validate --bundle="$output_aab" >/dev/null 2>&1; then
    echo "Error: bundletool validation failed for $output_aab."
    echo "Run manually for details:"
    echo "  bundletool validate --bundle=\"$output_aab\""
    run_bundletool validate --bundle="$output_aab" || true
    return 1
  fi

  return 0
}

install_android_apk() {
  local apk_path="$1"
  local explicit_device_id="${2:-}"

  if ! command -v adb >/dev/null 2>&1; then
    echo "Error: adb not found in PATH."
    echo "Install Android platform-tools."
    exit 1
  fi

  local device_id="$explicit_device_id"
  if [[ -z "$device_id" ]]; then
    device_id="$(get_env_value ANDROID_DEVICE_ID "$env_file" || true)"
  fi
  if [[ -z "$device_id" ]]; then
    device_id="$(get_env_value ADB_DEVICE_ID "$env_file" || true)"
  fi

  if [[ -n "$device_id" ]]; then
    if [[ "$env_profile" == "local" && "$apk_api_url" =~ ^http://(localhost|127\.0\.0\.1)(:([0-9]+))?(/|$) ]]; then
      local reverse_port="${BASH_REMATCH[3]:-80}"
      echo "Configuring adb reverse for local API: tcp:$reverse_port -> tcp:$reverse_port"
      adb -s "$device_id" reverse "tcp:$reverse_port" "tcp:$reverse_port" >/dev/null || true
    fi
    echo "Installing APK via adb to device: $device_id"
    adb -s "$device_id" install -r "$apk_path"
  else
    if [[ "$env_profile" == "local" && "$apk_api_url" =~ ^http://(localhost|127\.0\.0\.1)(:([0-9]+))?(/|$) ]]; then
      local reverse_port="${BASH_REMATCH[3]:-80}"
      echo "Configuring adb reverse for local API: tcp:$reverse_port -> tcp:$reverse_port"
      adb reverse "tcp:$reverse_port" "tcp:$reverse_port" >/dev/null || true
    fi
    echo "Installing APK via adb to default connected device"
    adb install -r "$apk_path"
  fi

  echo "APK installed successfully."
}

build_android_apk() {
  local sign_apk="$1"
  local install_apk="$2"

  export_env_file "$env_file"
  local is_windows_shell=0
  if [[ "${OS:-}" == "Windows_NT" || -n "${MSYSTEM:-}" ]]; then
    is_windows_shell=1
  fi

  get_java_major() {
    local java_bin="$1"
    local first_line
    first_line="$("$java_bin" -version 2>&1 | head -n 1)"
    if [[ "$first_line" =~ \"([0-9]+)\. ]]; then
      printf '%s\n' "${BASH_REMATCH[1]}"
      return 0
    fi
    return 1
  }

  local android_local_props="packages/web/src-capacitor/android/local.properties"
  local sdk_path="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  local min_java_major=21
  local max_java_major=23

  if [[ -z "$sdk_path" && -d "/c/Users/Chris/AppData/Local/Android/Sdk" ]]; then
    sdk_path="/c/Users/Chris/AppData/Local/Android/Sdk"
  fi
  if [[ -z "$sdk_path" && -d "$HOME/Library/Android/sdk" ]]; then
    sdk_path="$HOME/Library/Android/sdk"
  fi
  if [[ -z "$sdk_path" && -d "$HOME/Library/Android/Sdk" ]]; then
    sdk_path="$HOME/Library/Android/Sdk"
  fi
  if [[ -z "$sdk_path" && -d "$HOME/Android/Sdk" ]]; then
    sdk_path="$HOME/Android/Sdk"
  fi

  if [[ -n "$sdk_path" ]]; then
    local sdk_path_win
    sdk_path_win="$(to_windows_path "$sdk_path" || true)"
    if [[ -n "$sdk_path_win" ]]; then
      sdk_path="$sdk_path_win"
    fi
    export ANDROID_HOME="$sdk_path"
    export ANDROID_SDK_ROOT="$sdk_path"
    mkdir -p "$(dirname "$android_local_props")"
    # local.properties is a Java properties file: backslashes must be escaped.
    local sdk_props
    sdk_props="$(printf '%s' "$sdk_path" | sed 's#\\#/#g; s#/#\\\\#g')"
    printf 'sdk.dir=%s\n' "$sdk_props" > "$android_local_props"
  fi

  local current_java_major=""
  if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
    current_java_major="$(get_java_major "$JAVA_HOME/bin/java" || true)"
  fi
  if [[ -n "$current_java_major" && "$current_java_major" -gt "$max_java_major" ]]; then
    # Gradle/AGP in this repo currently fails on very new JDKs (e.g. Java 25).
    unset JAVA_HOME
    current_java_major=""
  fi

  if [[ -z "$current_java_major" || "$current_java_major" -lt "$min_java_major" ]]; then
    local android_studio_jbr="/c/Program Files/Android/Android Studio/jbr"
    if [[ -x "$android_studio_jbr/bin/java" ]]; then
      local jbr_java_major
      jbr_java_major="$(get_java_major "$android_studio_jbr/bin/java" || true)"
      if [[ -n "$jbr_java_major" && "$jbr_java_major" -ge "$min_java_major" && "$jbr_java_major" -le "$max_java_major" ]]; then
        export JAVA_HOME="$android_studio_jbr"
      fi
    fi
  fi

  if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" ]]; then
    local android_studio_jbr_macos="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
    if [[ -x "$android_studio_jbr_macos/bin/java" ]]; then
      local jbr_macos_java_major
      jbr_macos_java_major="$(get_java_major "$android_studio_jbr_macos/bin/java" || true)"
      if [[ -n "$jbr_macos_java_major" && "$jbr_macos_java_major" -ge "$min_java_major" && "$jbr_macos_java_major" -le "$max_java_major" ]]; then
        export JAVA_HOME="$android_studio_jbr_macos"
      fi
    fi
  fi

  if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" ]]; then
    if [[ -x "/usr/libexec/java_home" ]]; then
      local detected_java_home=""
      detected_java_home="$(/usr/libexec/java_home -v "$min_java_major" 2>/dev/null || true)"
      if [[ -z "$detected_java_home" ]]; then
        detected_java_home="$(/usr/libexec/java_home -v 22 2>/dev/null || true)"
      fi
      if [[ -z "$detected_java_home" ]]; then
        detected_java_home="$(/usr/libexec/java_home -v 23 2>/dev/null || true)"
      fi
      if [[ -n "$detected_java_home" && -x "$detected_java_home/bin/java" ]]; then
        export JAVA_HOME="$detected_java_home"
      fi
    fi
  fi

  if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
    export PATH="$JAVA_HOME/bin:$PATH"
  fi

  local active_java_major=""
  if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
    active_java_major="$(get_java_major "$JAVA_HOME/bin/java" || true)"
  fi
  if [[ -z "$active_java_major" || "$active_java_major" -lt "$min_java_major" || "$active_java_major" -gt "$max_java_major" ]]; then
    echo "Error: Android build requires Java $min_java_major-$max_java_major."
    echo "Current JAVA_HOME: ${JAVA_HOME:-<not set>}"
    echo "Set JAVA_HOME to a Java 21 runtime (Android Studio JBR 21 is recommended)."
    exit 1
  fi

  local quasar_cli_path="packages/web/node_modules/@quasar/app-vite/bin/quasar.js"
  if [[ ! -f "$quasar_cli_path" ]]; then
    echo "Missing web build tooling (@quasar/app-vite). Installing workspace dependencies with devDependencies..."

    local had_node_env=0
    local prev_node_env=""
    if [[ -n "${NODE_ENV+x}" ]]; then
      had_node_env=1
      prev_node_env="$NODE_ENV"
    fi

    unset NODE_ENV
    export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1
    corepack pnpm install --prod=false

    if [[ "$had_node_env" -eq 1 ]]; then
      export NODE_ENV="$prev_node_env"
    else
      unset NODE_ENV
    fi
  fi

  bump_android_version

  echo "Building Android APK (debug)..."
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1
  local gradle_java_home="${JAVA_HOME:-}"
  local gradle_android_home="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  local gradle_user_home="${GRADLE_USER_HOME:-}"
  if [[ -n "$gradle_java_home" ]]; then
    gradle_java_home="$(to_windows_path "$gradle_java_home" || printf '%s' "$gradle_java_home")"
  fi
  if [[ -n "$gradle_android_home" ]]; then
    gradle_android_home="$(to_windows_path "$gradle_android_home" || printf '%s' "$gradle_android_home")"
  fi
  if [[ -z "$gradle_user_home" ]]; then
    if [[ -n "${USERPROFILE:-}" ]]; then
      gradle_user_home="${USERPROFILE}\\.gradle"
    elif [[ -n "${HOME:-}" ]]; then
      gradle_user_home="${HOME}/.gradle"
    fi
  fi
  if [[ -n "$gradle_user_home" ]]; then
    gradle_user_home="$(to_windows_path "$gradle_user_home" || printf '%s' "$gradle_user_home")"
  fi

  # Prevent Git Bash/MSYS from rewriting Windows paths/args passed to gradle.bat.
  export MSYS_NO_PATHCONV=1
  export MSYS2_ARG_CONV_EXCL='*'
  export MSYS2_ENV_CONV_EXCL='CLASSPATH;JAVA_HOME;ANDROID_HOME;ANDROID_SDK_ROOT;GRADLE_USER_HOME;PATH'

  echo "Android build env:"
  echo "  JAVA_HOME=${gradle_java_home:-<empty>}"
  echo "  ANDROID_HOME=${gradle_android_home:-<empty>}"
  echo "  ANDROID_SDK_ROOT=${gradle_android_home:-<empty>}"
  echo "  GRADLE_USER_HOME=${gradle_user_home:-<empty>}"
  if [[ -f "$android_local_props" ]]; then
    echo "  local.properties: $(tr -d '\r' < "$android_local_props")"
  fi

  if [[ "$is_windows_shell" == "1" ]] && command -v cmd.exe >/dev/null 2>&1; then
    # In Git Bash with MSYS path-conversion disabled, invoking corepack directly can
    # resolve to an invalid path like C:\c\Program Files\...\corepack.js.
    # Running through cmd.exe avoids that translation issue.
    JAVA_HOME="$gradle_java_home" \
    ANDROID_HOME="$gradle_android_home" \
    ANDROID_SDK_ROOT="$gradle_android_home" \
    GRADLE_USER_HOME="$gradle_user_home" \
    cmd.exe /d /s /c "corepack pnpm --filter @bandstr/web run build:android"
  else
    JAVA_HOME="$gradle_java_home" \
    ANDROID_HOME="$gradle_android_home" \
    ANDROID_SDK_ROOT="$gradle_android_home" \
    GRADLE_USER_HOME="$gradle_user_home" \
    corepack pnpm --filter @bandstr/web run build:android
  fi

  local release_apk="packages/web/src-capacitor/android/app/build/outputs/apk/release/app-release.apk"
  local release_unsigned_apk="packages/web/src-capacitor/android/app/build/outputs/apk/release/app-release-unsigned.apk"
  local release_signed_apk="packages/web/src-capacitor/android/app/build/outputs/apk/release/app-release-signed.apk"
  local final_apk=""

  if [[ -f "$release_unsigned_apk" ]]; then
    if [[ "$sign_apk" == "1" ]]; then
      if ! sign_apk_file "$release_unsigned_apk" "$release_signed_apk"; then
        exit 1
      fi

      final_apk="$release_signed_apk"
      echo "APK built and signed successfully: $final_apk"
    else
      final_apk="$release_unsigned_apk"
      echo "APK built successfully (unsigned): $final_apk"
      echo "Signing skipped due to --no-sign."
    fi
  elif [[ -f "$release_signed_apk" ]]; then
    final_apk="$release_signed_apk"
    echo "APK built successfully: $final_apk"
    if [[ "$sign_apk" == "1" ]]; then
      local apksigner_bin=""
      apksigner_bin="$(resolve_apksigner_bin || true)"
      if [[ -z "$apksigner_bin" ]]; then
        echo "Error: apksigner not found for signature verification."
        exit 1
      fi
      local verify_target="$final_apk"
      if [[ "$is_windows_shell" == "1" ]]; then
        verify_target="$(to_windows_path "$verify_target" || printf '%s' "$verify_target")"
      fi
      if ! verify_apk_signature "$apksigner_bin" "$verify_target"; then
        echo "Error: APK signature verification failed for $final_apk."
        exit 1
      fi
    fi
  elif [[ -f "$release_apk" ]]; then
    final_apk="$release_apk"
    echo "APK built successfully: $final_apk"
    if [[ "$sign_apk" == "1" ]]; then
      local apksigner_bin=""
      apksigner_bin="$(resolve_apksigner_bin || true)"
      if [[ -z "$apksigner_bin" ]]; then
        echo "Error: apksigner not found for signature verification."
        exit 1
      fi
      local verify_target="$final_apk"
      if [[ "$is_windows_shell" == "1" ]]; then
        verify_target="$(to_windows_path "$verify_target" || printf '%s' "$verify_target")"
      fi
      if ! verify_apk_signature "$apksigner_bin" "$verify_target"; then
        echo "Error: APK signature verification failed for $final_apk."
        exit 1
      fi
    fi
  else
    final_apk="$(resolve_android_apk_path || true)"
    if [[ -n "$final_apk" ]]; then
      echo "APK built successfully: $final_apk"
    else
      echo "Error: APK build finished but file not found at: $release_apk, $release_signed_apk, $release_unsigned_apk (or debug APK)"
      exit 1
    fi
  fi

  if [[ "$install_apk" != "1" ]]; then
    local named_apk=""
    named_apk="$(create_named_android_artifact "$final_apk")"
    if [[ -n "$named_apk" ]]; then
      echo "Named APK artifact: $named_apk"
    fi
    echo "APK install skipped due to --no-install."
    return 0
  fi

  local deploy_apk="$final_apk"
  local named_apk=""
  named_apk="$(create_named_android_artifact "$final_apk")"
  if [[ -n "$named_apk" ]]; then
    echo "Named APK artifact: $named_apk"
    deploy_apk="$named_apk"
  fi

  install_android_apk "$deploy_apk"
}

resolve_android_version_commit_id() {
  local from_env="${SOURCE_COMMIT:-}"
  if [[ -n "$from_env" && "$from_env" != "UNKNOWN" && "$from_env" != "unknown" ]]; then
    local sanitized
    sanitized="$(sanitize_filename_component "$from_env")"
    if [[ -n "$sanitized" ]]; then
      printf '%s\n' "${sanitized:0:8}"
      return 0
    fi
  fi

  if git rev-parse --short=8 HEAD >/dev/null 2>&1; then
    git rev-parse --short=8 HEAD
    return 0
  fi

  printf 'unknown\n'
}

bump_android_version() {
  local gradle_file="packages/web/src-capacitor/android/app/build.gradle"
  if [[ ! -f "$gradle_file" ]]; then
    echo "Error: Android Gradle file not found: $gradle_file"
    exit 1
  fi

  local current_version_code=""
  current_version_code="$(grep -E '^[[:space:]]*versionCode[[:space:]]+[0-9]+' "$gradle_file" | head -n 1 | awk '{print $2}')"
  if [[ -z "$current_version_code" ]]; then
    echo "Error: Could not determine current versionCode in $gradle_file"
    exit 1
  fi

  local current_version_name=""
  current_version_name="$(grep -E '^[[:space:]]*versionName[[:space:]]+"[^"]+"' "$gradle_file" | head -n 1 | sed -E 's/^[[:space:]]*versionName[[:space:]]+"([^"]+)".*/\1/')"
  if [[ -z "$current_version_name" ]]; then
    echo "Error: Could not determine current versionName in $gradle_file"
    exit 1
  fi

  local semver_base="$current_version_name"
  semver_base="$(printf '%s' "$semver_base" | sed -E 's/[[:space:]]*\([^)]+\)[[:space:]]*$//')"
  local semver_compact
  semver_compact="$(printf '%s' "$semver_base" | tr -d '[:space:]')"

  if [[ ! "$semver_compact" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    echo "Error: Current versionName must contain SemVer MAJOR.MINOR.PATCH. Found: $current_version_name"
    exit 1
  fi

  local major=$((10#${BASH_REMATCH[1]}))
  local minor=$((10#${BASH_REMATCH[2]}))
  local patch=$((10#${BASH_REMATCH[3]}))

  case "$android_version_bump" in
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    patch)
      patch=$((patch + 1))
      ;;
    *)
      echo "Error: Unsupported version bump mode: $android_version_bump"
      exit 1
      ;;
  esac

  local commit_id=""
  commit_id="$(resolve_android_version_commit_id)"
  local minor_padded=""
  local patch_padded=""
  printf -v minor_padded "%02d" "$minor"
  printf -v patch_padded "%02d" "$patch"
  local next_version_name="${major}.${minor_padded}.${patch_padded} (${commit_id})"

  local next_version_code=$((current_version_code + 1))
  local temp_root="${TMPDIR:-${TEMP:-${TMP:-/tmp}}}"
  mkdir -p "$temp_root"
  local tmp_file
  tmp_file="$(mktemp "$temp_root/bandstr-versioncode-XXXXXX")"

  if ! awk -v nextcode="$next_version_code" -v nextname="$next_version_name" '
    BEGIN { updated_code = 0; updated_name = 0 }
    {
      if (!updated_code && $0 ~ /^[[:space:]]*versionCode[[:space:]]+[0-9]+[[:space:]]*$/) {
        sub(/[0-9]+[[:space:]]*$/, nextcode)
        updated_code = 1
      }
      if (!updated_name && $0 ~ /^[[:space:]]*versionName[[:space:]]+"[^"]+"[[:space:]]*$/) {
        sub(/"[^"]+"[[:space:]]*$/, "\"" nextname "\"")
        updated_name = 1
      }
      print
    }
    END {
      if (!updated_code || !updated_name) {
        exit 2
      }
    }
  ' "$gradle_file" > "$tmp_file"; then
    rm -f "$tmp_file"
    echo "Error: Failed to update versionCode/versionName in $gradle_file"
    exit 1
  fi

  mv "$tmp_file" "$gradle_file"
  echo "Android versionCode bumped: $current_version_code -> $next_version_code"
  echo "Android versionName bumped: $current_version_name -> $next_version_name"
}

build_android_bundle() {
  local sign_bundle="$1"

  # Reuse the existing Android build preparation (Java/SDK checks + Capacitor release build).
  build_android_apk 0 0

  local android_dir="packages/web/src-capacitor/android"
  local release_aab="packages/web/src-capacitor/android/app/build/outputs/bundle/release/app-release.aab"
  local release_signed_aab="packages/web/src-capacitor/android/app/build/outputs/bundle/release/app-release-signed.aab"

  if [[ ! -f "$release_aab" ]]; then
    echo "Generating release App Bundle (.aab) via Gradle bundleRelease..."
    if [[ "${OS:-}" == "Windows_NT" || -n "${MSYSTEM:-}" ]]; then
      (
        cd "$android_dir"
        cmd.exe /c ".\\gradlew.bat bundleRelease"
      )
    else
      (
        cd "$android_dir"
        ./gradlew bundleRelease
      )
    fi
  fi

  if [[ ! -f "$release_aab" ]]; then
    echo "Error: AAB build finished but file not found at: $release_aab"
    exit 1
  fi

  if [[ "$sign_bundle" == "1" ]]; then
    if ! sign_aab_file_for_playstore "$release_aab" "$release_signed_aab"; then
      exit 1
    fi
    echo "AAB built, signed, and validated successfully: $release_signed_aab"
    local named_aab=""
    named_aab="$(create_named_android_artifact "$release_signed_aab")"
    if [[ -n "$named_aab" ]]; then
      echo "Named AAB artifact: $named_aab"
    fi
  else
    echo "AAB built successfully (unsigned): $release_aab"
    echo "Signing skipped due to --no-sign."
    local named_aab=""
    named_aab="$(create_named_android_artifact "$release_aab")"
    if [[ -n "$named_aab" ]]; then
      echo "Named AAB artifact: $named_aab"
    fi
  fi
}

sync_assets() {
  echo "Syncing assets from ./assets to build locations..."
  bash ./scripts/sync-assets.sh
}

run_security_scan() {
  echo "Running security scans (web + backend)..."
  pnpm run security
}

resolve_git_rev() {
  local from_env="${SOURCE_COMMIT:-}"
  if [[ -n "$from_env" && "$from_env" != "UNKNOWN" && "$from_env" != "unknown" ]]; then
    printf '%s\n' "${from_env:0:12}"
    return 0
  fi

  if git rev-parse --short HEAD >/dev/null 2>&1; then
    git rev-parse --short HEAD
    return 0
  fi

  printf 'unknown\n'
}

build_production_image() {
  local git_rev="$1"
  local commit_full="${SOURCE_COMMIT:-$git_rev}"
  local prod_image="bandstr-prod:$git_rev"

  echo "Building production Docker image: $prod_image"
  GIT_REV="$git_rev" SOURCE_COMMIT="$commit_full" "${PROD_COMPOSE[@]}" build prod

  if command -v docker >/dev/null 2>&1; then
    echo "Tagging newest image as bandstr-prod:latest"
    docker tag "$prod_image" "bandstr-prod:latest"
  fi
}

deploy_android_apk() {
  local profile="$1"
  local explicit_device_id="${2:-}"
  local apk_path=""

  export_env_file "$env_file"

  apk_path="$(resolve_android_apk_path || true)"
  if [[ -z "$apk_path" ]]; then
    echo "Error: No built APK found."
    echo "Run './do build-apk $profile --no-install' first."
    exit 1
  fi

  # adb install requires a signed APK. Auto-sign unsigned release APKs.
  if [[ "$apk_path" == *"-unsigned.apk" ]]; then
    local signed_apk="${apk_path%-unsigned.apk}-signed.apk"
    echo "Found unsigned APK. Signing it before deploy: $apk_path -> $signed_apk"
    if ! sign_apk_file "$apk_path" "$signed_apk"; then
      exit 1
    fi
    apk_path="$signed_apk"
  fi

  echo "Deploying existing APK ($profile): $apk_path"
  install_android_apk "$apk_path" "$explicit_device_id"
}

deploy_play_console_bundle() {
  local profile="$1"
  local aab_path="${2:-}"
  export_env_file "$env_file"

  if [[ -z "$aab_path" ]]; then
    aab_path="packages/web/src-capacitor/android/app/build/outputs/bundle/release/app-release-signed.aab"
  fi

  if [[ ! -f "$aab_path" ]]; then
    echo "Error: AAB file not found at $aab_path."
    echo "Please build an AAB first using:"
    echo "  ./do create-apk-bundle $profile"
    exit 1
  fi

  local deploy_script="scripts/deploy-play-console.mjs"
  echo "Deploying $aab_path to Play Console (internal track)..."
  node "$deploy_script" "$aab_path"
}

sign_existing_android_apk() {
  local profile="$1"
  local input_path="${2:-}"
  local default_unsigned_apk="packages/web/src-capacitor/android/app/build/outputs/apk/release/app-release-unsigned.apk"

  export_env_file "$env_file"

  if [[ -z "$input_path" ]]; then
    input_path="$default_unsigned_apk"
  fi

  if [[ ! -f "$input_path" ]]; then
    echo "Error: APK not found at: $input_path"
    echo "Build first with './do build-apk $profile --no-sign --no-install' or pass an explicit APK path."
    exit 1
  fi

  local output_path=""
  if [[ "$input_path" == *"-unsigned.apk" ]]; then
    output_path="${input_path%-unsigned.apk}-signed.apk"
  elif [[ "$input_path" == *.apk ]]; then
    output_path="${input_path%.apk}-signed.apk"
  else
    echo "Error: Input file must be an .apk: $input_path"
    exit 1
  fi

  if ! sign_apk_file "$input_path" "$output_path"; then
    exit 1
  fi

  echo "APK signed successfully: $output_path"
}

case "$command" in
  start|dev|run)
    echo "Starting development server (local)..."
    ensure_db
    ensure_migrations_file
    run_migrations_if_needed
    "${APP_COMPOSE[@]}" up dev
    ;;
  logs)
    echo "Viewing logs..."
    "${APP_COMPOSE[@]}" logs -f dev
    ;;
  stop)
    echo "Stopping containers..."
    "${APP_COMPOSE[@]}" down
    "${DB_COMPOSE[@]}" down
    ;;
  install)
    echo "Installing dependencies..."
    "${APP_COMPOSE[@]}" run --rm dev sh -c "$COREPACK_NONINTERACTIVE corepack enable && pnpm install"
    ;;
  seed)
    echo "Seeding local database..."
    ensure_db
    ensure_migrations_file
    run_migrations_if_needed
    "${APP_COMPOSE[@]}" run --rm dev sh -c "$COREPACK_NONINTERACTIVE corepack enable && pnpm install && pnpm --filter @bandstr/api run db:seed"
    ;;
  build)
    sync_assets
    git_rev="$(resolve_git_rev)"
    echo "Using build version: $git_rev"
    build_production_image "$git_rev"
    ;;
  build-apk)
    sync_assets
    build_android_apk "$build_apk_sign" "$build_apk_install"
    ;;
  create-apk-bundle)
    sync_assets
    build_android_bundle "$build_bundle_sign"
    ;;
  deploy-play-console)
    deploy_play_console_bundle "$env_profile" "$deploy_play_console_aab_path"
    ;;
  deploy-apk)
    deploy_android_apk "$env_profile" "$deploy_apk_device_id"
    ;;
  build-ios)
    export_env_file "$env_file"
    bash ./scripts/build-ios.sh "$env_profile" "${@:3}"
    ;;
  deploy-ios)
    export_env_file "$env_file"
    if [[ -z "$deploy_ios_device_id" ]]; then
      deploy_ios_device_id="$(get_env_value IOS_DEVICE_ID "$env_file" || true)"
    fi
    bash ./scripts/deploy-ios.sh "$env_profile" "$deploy_ios_device_id"
    ;;
  push-setup)
    export_env_file "$env_file"
    bash ./scripts/push-setup.sh "$env_profile" "${push_setup_args[@]}"
    ;;
  upload-ios)
    export_env_file "$env_file"
    bash ./scripts/upload-ios-appstore.sh "$upload_ios_input_path"
    ;;
  appstore-checklist)
    export_env_file "$env_file"
    bash ./scripts/appstore-connect-checklist.sh "$env_profile"
    ;;
  sign-apk)
    sign_existing_android_apk "$env_profile" "$sign_apk_input_path"
    ;;
  install-bundletool)
    install_bundletool
    ;;
  sync-assets)
    sync_assets
    ;;
  security-scan)
    run_security_scan
    ;;
  cleanup-resources)
    echo "Cleaning unneeded resources..."
    bash ./scripts/cleanup-resources.sh
    ;;
  *)
    print_usage
    exit 1
    ;;
esac
