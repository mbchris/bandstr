#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE=".creds.config"
ENV_FILE=""
PACKAGE_NAME_ARG=""
OVERWRITE_EMPTY=0
MODE=""

log_step() {
  echo "[creds] $1"
}

bw_noinput() {
  bw --nointeraction "$@" </dev/null
}

bw_session() {
  bw --nointeraction --session "$BW_SESSION" "$@"
}

cleanup() {
  # Keep runs stateless and avoid server-switch prompts on the next invocation.
  bw_noinput logout >/dev/null 2>&1 || true
}

print_help() {
  cat <<'EOF'
Usage: ./creds.sh <push|pull|test> [options]

Modes:
  push                            Sync env key/values to Vaultwarden
  pull                            Sync Vaultwarden key/values to env file
  test                            Test Vaultwarden connection and list folders

Options:
  --env-file <path>               Env file path (default: VAULTWARDEN_ENV_GLOB from config, else .env.production)
  --config <path>                 Config file (default: .creds.config)
  --package-name <name>           Override PACKAGE_NAME from env file
  --overwrite-empty               Include empty values during sync
  -h, --help                      Show this help

Examples:
  ./creds.sh push --env-file .env.production
  ./creds.sh pull --env-file .env.production --package-name app.example
  ./creds.sh test
EOF
}

require_cmd() {
  local cmd="$1"
  local install_url="${2:-}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    if [[ -n "$install_url" ]]; then
      echo "Install it here: $install_url" >&2
    fi
    exit 1
  fi
}

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

load_config() {
  if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "Config file not found: $CONFIG_FILE" >&2
    exit 1
  fi

  # shellcheck source=/dev/null
  source "$CONFIG_FILE"

  VAULTWARDEN_SERVER="${VAULTWARDEN_SERVER:-${VAULTWARDEN_API_BASE:-}}"
  VAULTWARDEN_USER="${VAULTWARDEN_USER:-}"
  VAULTWARDEN_MASTER_PASSWORD="${VAULTWARDEN_MASTER_PASSWORD:-}"
  VAULTWARDEN_ORGANIZATION_ID="${VAULTWARDEN_ORGANIZATION_ID:-}"

  if [[ -z "${ENV_FILE}" ]]; then
    ENV_FILE="${VAULTWARDEN_ENV_GLOB:-.env.production}"
  fi

  if [[ -z "$VAULTWARDEN_SERVER" || -z "$VAULTWARDEN_USER" || -z "$VAULTWARDEN_MASTER_PASSWORD" ]]; then
    echo "Missing required config values in $CONFIG_FILE." >&2
    echo "Need VAULTWARDEN_SERVER (or VAULTWARDEN_API_BASE), VAULTWARDEN_USER, VAULTWARDEN_MASTER_PASSWORD." >&2
    exit 1
  fi
}

resolve_package_name_from_env() {
  local file_path="$1"
  if [[ ! -f "$file_path" ]]; then
    return 1
  fi
  sed -n 's/^PACKAGE_NAME=\(.*\)$/\1/p' "$file_path" | head -n1
}

bw_auth() {
  local status
  export CREDS_BW_MASTER_PASSWORD="$VAULTWARDEN_MASTER_PASSWORD"

  log_step "Logging out any existing Bitwarden session"
  bw_noinput logout >/dev/null 2>&1 || true

  log_step "Setting Bitwarden server: $VAULTWARDEN_SERVER"
  bw_noinput config server "$VAULTWARDEN_SERVER" >/dev/null

  log_step "Checking Bitwarden auth status"
  status="$(bw_noinput status 2>/dev/null | jq -r '.status' 2>/dev/null || echo "unknown")"
  log_step "Current status: $status"
  if [[ "$status" == "unauthenticated" || "$status" == "unknown" ]]; then
    log_step "Running login for user: $VAULTWARDEN_USER"
    bw_noinput login "$VAULTWARDEN_USER" --passwordenv CREDS_BW_MASTER_PASSWORD >/dev/null
  fi

  log_step "Unlocking vault"
  BW_SESSION="$(bw_noinput unlock --raw --passwordenv CREDS_BW_MASTER_PASSWORD)"
  if [[ -z "$BW_SESSION" ]]; then
    echo "Failed to unlock vault." >&2
    exit 1
  fi
  export BW_SESSION
  log_step "Vault unlocked successfully"
}

find_folder_id() {
  local package_name="$1"
  bw_session list folders | jq -r --arg name "$package_name" '.[] | select(.name == $name) | .id' | head -n1
}

ensure_folder_id() {
  local package_name="$1"
  local folder_id
  folder_id="$(find_folder_id "$package_name")"

  if [[ -z "$folder_id" || "$folder_id" == "null" ]]; then
    local folder_template folder_payload
    folder_template="$(bw_session get template folder)"
    folder_payload="$(echo "$folder_template" | jq --arg name "$package_name" '.name = $name')"
    folder_id="$(echo "$folder_payload" | bw encode | bw_session create folder | jq -r '.id')"
    echo "$folder_id"
    return
  fi

  echo "$folder_id"
}

list_items_json() {
  if [[ -n "$VAULTWARDEN_ORGANIZATION_ID" ]]; then
    bw_session list items --organizationid "$VAULTWARDEN_ORGANIZATION_ID"
  else
    bw_session list items
  fi
}

sync_push() {
  local package_name="$1"
  local folder_id items_json
  log_step "Resolving folder for package: $package_name"
  folder_id="$(ensure_folder_id "$package_name")"
  log_step "Using folder id: $folder_id"
  log_step "Loading existing items"
  items_json="$(list_items_json)"

  declare -A processed_keys=()
  local created=0
  local updated=0
  local skipped_empty=0
  local skipped_invalid=0

  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    local line line_trimmed key value existing_id item_template item_payload existing_item updated_item

    line="${raw_line%$'\r'}"
    line_trimmed="$(trim "$line")"

    if [[ -z "$line_trimmed" || "$line_trimmed" == \#* ]]; then
      continue
    fi

    if [[ "$line_trimmed" != *=* ]]; then
      skipped_invalid=$((skipped_invalid + 1))
      continue
    fi

    key="${line_trimmed%%=*}"
    value="${line_trimmed#*=}"
    key="$(trim "$key")"

    if [[ -z "$key" ]]; then
      skipped_invalid=$((skipped_invalid + 1))
      continue
    fi

    if [[ -v "processed_keys[$key]" ]]; then
      continue
    fi
    processed_keys["$key"]=1

    if [[ -z "$value" && "$OVERWRITE_EMPTY" -ne 1 ]]; then
      skipped_empty=$((skipped_empty + 1))
      continue
    fi

    existing_id="$(
      echo "$items_json" | jq -r \
        --arg folderId "$folder_id" \
        --arg name "$key" \
        --arg org "$VAULTWARDEN_ORGANIZATION_ID" \
        '
          .[]
          | select(.folderId == $folderId and .name == $name)
          | select(($org == "") or (.organizationId == $org))
          | .id
        ' | head -n1
    )"

    if [[ -z "$existing_id" || "$existing_id" == "null" ]]; then
      item_template="$(bw_session get template item)"
      item_payload="$(
        echo "$item_template" | jq \
          --arg name "$key" \
          --arg notes "$value" \
          --arg folderId "$folder_id" \
          --arg org "$VAULTWARDEN_ORGANIZATION_ID" \
          '
            .name = $name
            | .type = 2
            | .secureNote.type = 0
            | .notes = $notes
            | .folderId = $folderId
            | (if $org != "" then .organizationId = $org else . end)
          '
      )"
      echo "$item_payload" | bw encode | bw_session create item >/dev/null
      created=$((created + 1))
    else
      existing_item="$(bw_session get item "$existing_id")"
      updated_item="$(echo "$existing_item" | jq --arg notes "$value" '.notes = $notes')"
      echo "$updated_item" | bw encode | bw_session edit item "$existing_id" >/dev/null
      updated=$((updated + 1))
    fi
  done < "$ENV_FILE"

  echo "Push complete."
  echo "Created: $created"
  echo "Updated: $updated"
  echo "Skipped empty values: $skipped_empty"
  echo "Skipped invalid lines: $skipped_invalid"
}

sync_pull() {
  local package_name="$1"
  local folder_id items_json filtered_json
  log_step "Resolving folder for package: $package_name"
  folder_id="$(find_folder_id "$package_name")"

  if [[ -z "$folder_id" || "$folder_id" == "null" ]]; then
    echo "Folder '$package_name' not found in vault." >&2
    exit 1
  fi

  log_step "Loading existing items"
  items_json="$(list_items_json)"
  filtered_json="$(
    echo "$items_json" | jq \
      --arg folderId "$folder_id" \
      --arg org "$VAULTWARDEN_ORGANIZATION_ID" \
      '
        [ .[]
          | select(.folderId == $folderId)
          | select(($org == "") or (.organizationId == $org))
        ]
      '
  )"

  {
    echo "PACKAGE_NAME=$package_name"
    echo
    echo "$filtered_json" | jq -r '
      sort_by(.name)
      | .[]
      | select(.name != "PACKAGE_NAME")
      | "\(.name)=\((.notes // "") | gsub("\r"; "") | gsub("\n"; "\\n"))"
    '
  } > "$ENV_FILE"

  local pulled_count
  pulled_count="$(echo "$filtered_json" | jq -r 'length')"
  echo "Pull complete."
  echo "Wrote: $ENV_FILE"
  echo "Items pulled: $pulled_count"
}

run_test() {
  log_step "Connection test successful"
  echo "Folders:"
  bw_session list folders | jq -r '.[] | "- \(.name) (\(.id))"'
}

if [[ $# -eq 0 ]]; then
  print_help
  exit 1
fi

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  print_help
  exit 0
fi

MODE="$1"
shift

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      [[ $# -ge 2 ]] || { echo "--env-file requires a value" >&2; exit 1; }
      ENV_FILE="$2"
      shift 2
      ;;
    --config)
      [[ $# -ge 2 ]] || { echo "--config requires a value" >&2; exit 1; }
      CONFIG_FILE="$2"
      shift 2
      ;;
    --package-name)
      [[ $# -ge 2 ]] || { echo "--package-name requires a value" >&2; exit 1; }
      PACKAGE_NAME_ARG="$2"
      shift 2
      ;;
    --overwrite-empty)
      OVERWRITE_EMPTY=1
      shift
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      print_help
      exit 1
      ;;
  esac
done

if [[ "$MODE" != "push" && "$MODE" != "pull" && "$MODE" != "test" ]]; then
  echo "First argument must be 'push', 'pull', or 'test'." >&2
  print_help
  exit 1
fi

require_cmd bw "https://bitwarden.com/help/cli/#download-and-install"
require_cmd jq "https://jqlang.org/download/"
load_config
trap cleanup EXIT

if [[ "$MODE" == "push" && ! -f "$ENV_FILE" ]]; then
  echo "Env file not found for push: $ENV_FILE" >&2
  exit 1
fi

if [[ "$MODE" == "push" || "$MODE" == "pull" ]]; then
  PACKAGE_NAME="${PACKAGE_NAME_ARG:-}"
  if [[ -z "$PACKAGE_NAME" ]]; then
    PACKAGE_NAME="$(resolve_package_name_from_env "$ENV_FILE" || true)"
  fi
  if [[ -z "$PACKAGE_NAME" ]]; then
    echo "PACKAGE_NAME not found. Set PACKAGE_NAME in env or pass --package-name." >&2
    exit 1
  fi
fi

log_step "Configuring Bitwarden connection..."
bw_auth

if [[ "$MODE" == "push" ]]; then
  sync_push "$PACKAGE_NAME"
elif [[ "$MODE" == "pull" ]]; then
  sync_pull "$PACKAGE_NAME"
else
  run_test
fi
