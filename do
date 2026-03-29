#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

command="${1:-}"
env_profile="local"
build_apk_sign=1
build_apk_install=1
deploy_apk_device_id=""
apk_api_url=""

if [[ "$command" == "build-apk" ]]; then
  env_profile="${2:-local}"
  for arg in "${@:3}"; do
    case "$arg" in
      --no-sign)
        build_apk_sign=0
        ;;
      --no-install)
        build_apk_install=0
        ;;
      *)
        echo "Error: Unknown option for build-apk: $arg"
        echo "Usage: ./do build-apk [local|production] [--no-sign] [--no-install]"
        exit 1
        ;;
    esac
  done
elif [[ "$command" == "deploy-apk" ]]; then
  deploy_arg="${2:-}"
  if [[ -z "$deploy_arg" ]]; then
    env_profile="local"
    deploy_apk_device_id=""
  elif [[ "$deploy_arg" == "local" || "$deploy_arg" == "production" ]]; then
    env_profile="$deploy_arg"
    deploy_apk_device_id="${3:-}"
  else
    # Backwards compatibility: treat second arg as DEVICE_ID.
    env_profile="local"
    deploy_apk_device_id="$deploy_arg"
  fi
else
  env_profile="${2:-local}"
fi

if [[ -z "$command" ]]; then
  echo "Usage: ./do {start|dev|run|logs|stop|seed|install|build|build-apk|deploy-apk|sync-assets|cleanup-resources} [local|production] [--no-sign] [--no-install]"
  echo "       ./do deploy-apk [local|production] [DEVICE_ID]"
  exit 1
fi

if [[ "$command" == "build-apk" || "$command" == "deploy-apk" ]]; then
  if [[ "$env_profile" != "local" && "$env_profile" != "production" ]]; then
    echo "Error: $command supports only local or production."
    echo "Use: ./do $command {local|production}"
    exit 1
  fi
elif [[ "$env_profile" != "local" ]]; then
  echo "Error: Only local mode is supported for this command. Use: ./do <command> local"
  exit 1
fi

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

if [[ "$command" == "build-apk" || "$command" == "deploy-apk" ]]; then
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

DB_COMPOSE=(docker compose -f docker-compose.dev.yml)
APP_COMPOSE=(docker compose --profile dev)
PROD_COMPOSE=(docker compose --profile prod)
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

  if [[ -f "$release_apk" ]]; then
    printf '%s\n' "$release_apk"
  elif [[ -f "$release_signed_apk" ]]; then
    printf '%s\n' "$release_signed_apk"
  elif [[ -f "$release_unsigned_apk" ]]; then
    printf '%s\n' "$release_unsigned_apk"
  elif [[ -f "$debug_apk" ]]; then
    printf '%s\n' "$debug_apk"
  else
    return 1
  fi
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

  if [[ -z "$sdk_path" && -d "/c/Users/Chris/AppData/Local/Android/Sdk" ]]; then
    sdk_path="/c/Users/Chris/AppData/Local/Android/Sdk"
  fi

  if [[ -n "$sdk_path" ]]; then
    mkdir -p "$(dirname "$android_local_props")"
    local sdk_win
    sdk_win="$(printf '%s' "$sdk_path" | sed 's#^/c/#C:/#; s#/#\\\\#g')"
    printf 'sdk.dir=%s\n' "$sdk_win" > "$android_local_props"
  fi

  local current_java_major=""
  if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
    current_java_major="$(get_java_major "$JAVA_HOME/bin/java" || true)"
  fi

  if [[ -z "$current_java_major" || "$current_java_major" -lt "$min_java_major" ]]; then
    local android_studio_jbr="/c/Program Files/Android/Android Studio/jbr"
    if [[ -x "$android_studio_jbr/bin/java" ]]; then
      local jbr_java_major
      jbr_java_major="$(get_java_major "$android_studio_jbr/bin/java" || true)"
      if [[ -n "$jbr_java_major" && "$jbr_java_major" -ge "$min_java_major" ]]; then
        export JAVA_HOME="$android_studio_jbr"
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
  if [[ -z "$active_java_major" || "$active_java_major" -lt "$min_java_major" ]]; then
    echo "Error: Android build requires Java $min_java_major+."
    echo "Current JAVA_HOME: ${JAVA_HOME:-<not set>}"
    echo "Set JAVA_HOME to a Java $min_java_major+ runtime (Android Studio JBR 21 is recommended)."
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

  echo "Building Android APK (debug)..."
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1
  corepack pnpm --filter @bandstr/web run build:android

  local release_apk="packages/web/src-capacitor/android/app/build/outputs/apk/release/app-release.apk"
  local release_unsigned_apk="packages/web/src-capacitor/android/app/build/outputs/apk/release/app-release-unsigned.apk"
  local release_signed_apk="packages/web/src-capacitor/android/app/build/outputs/apk/release/app-release-signed.apk"
  local final_apk=""

  if [[ -f "$release_apk" ]]; then
    final_apk="$release_apk"
    echo "APK built successfully: $final_apk"
  elif [[ -f "$release_signed_apk" ]]; then
    final_apk="$release_signed_apk"
    echo "APK built successfully: $final_apk"
  elif [[ -f "$release_unsigned_apk" ]]; then
    if [[ "$sign_apk" == "1" ]]; then
      local apksigner_bin=""
      local user_home="${USERPROFILE:-$HOME}"
      local debug_keystore="$user_home/.android/debug.keystore"

      if command -v apksigner >/dev/null 2>&1; then
        apksigner_bin="apksigner"
      elif [[ -n "$sdk_path" && -d "$sdk_path/build-tools" ]]; then
        local latest_build_tools
        latest_build_tools="$(ls -1 "$sdk_path/build-tools" 2>/dev/null | sort -V | tail -n 1 || true)"
        if [[ -n "$latest_build_tools" ]]; then
          if [[ -x "$sdk_path/build-tools/$latest_build_tools/apksigner" ]]; then
            apksigner_bin="$sdk_path/build-tools/$latest_build_tools/apksigner"
          elif [[ -f "$sdk_path/build-tools/$latest_build_tools/apksigner.bat" ]]; then
            apksigner_bin="$sdk_path/build-tools/$latest_build_tools/apksigner.bat"
          fi
        fi
      fi

      if [[ -z "$apksigner_bin" ]]; then
        echo "Error: release APK is unsigned and apksigner was not found."
        echo "Install Android build-tools or run './do build-apk $env_profile --no-sign'."
        exit 1
      fi

      if [[ ! -f "$debug_keystore" ]]; then
        echo "Error: debug keystore not found at $debug_keystore"
        echo "Run an Android debug build once to create it, or run './do build-apk $env_profile --no-sign'."
        exit 1
      fi

      rm -f "$release_signed_apk"
      "$apksigner_bin" sign \
        --ks "$debug_keystore" \
        --ks-key-alias androiddebugkey \
        --ks-pass pass:android \
        --key-pass pass:android \
        --out "$release_signed_apk" \
        "$release_unsigned_apk"

      final_apk="$release_signed_apk"
      echo "APK built and signed successfully: $final_apk"
    else
      final_apk="$release_unsigned_apk"
      echo "APK built successfully (unsigned): $final_apk"
      echo "Signing skipped due to --no-sign."
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
    echo "APK install skipped due to --no-install."
    return 0
  fi

  install_android_apk "$final_apk"
}

sync_assets() {
  echo "Syncing assets from ./assets to build locations..."
  bash ./scripts/sync-assets.sh
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

  apk_path="$(resolve_android_apk_path || true)"
  if [[ -z "$apk_path" ]]; then
    echo "Error: No built APK found."
    echo "Run './do build-apk $profile --no-install' first."
    exit 1
  fi

  echo "Deploying existing APK ($profile): $apk_path"
  install_android_apk "$apk_path" "$explicit_device_id"
}

case "$command" in
  start|dev|run)
    echo "Starting development server (local)..."
    ensure_db
    ensure_migrations_file
    run_migrations_if_needed
    "${APP_COMPOSE[@]}" up
    ;;
  logs)
    echo "Viewing logs..."
    "${APP_COMPOSE[@]}" logs -f
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
  deploy-apk)
    deploy_android_apk "$env_profile" "$deploy_apk_device_id"
    ;;
  sync-assets)
    sync_assets
    ;;
  cleanup-resources)
    echo "Cleaning unneeded resources..."
    bash ./scripts/cleanup-resources.sh
    ;;
  *)
    echo "Usage: ./do {start|dev|run|logs|stop|seed|install|build|build-apk|deploy-apk|sync-assets|cleanup-resources} [local|production] [--no-sign] [--no-install]"
    echo "       ./do deploy-apk [local|production] [DEVICE_ID]"
    exit 1
    ;;
esac
