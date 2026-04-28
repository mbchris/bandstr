#!/usr/bin/env bash

set -euo pipefail

COOLIFY_DEPLOY_URL="${COOLIFY_DEPLOY_URL:-${1:-}}"
COOLIFY_AUTH_TOKEN="${COOLIFY_AUTH_TOKEN:-${2:-}}"

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

load_coolify_env_from_file() {
  local env_file="$1"
  local raw_line line key value

  [[ -f "$env_file" ]] || return 0

  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="$(trim "$raw_line")"
    [[ -z "$line" || "${line:0:1}" == "#" ]] && continue
    [[ "$line" == export* ]] && line="$(trim "${line#export}")"
    [[ "$line" != *=* ]] && continue

    key="$(trim "${line%%=*}")"
    value="$(trim "${line#*=}")"

    if [[ ${#value} -ge 2 && "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      value="${value:1:-1}"
    elif [[ ${#value} -ge 2 && "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
      value="${value:1:-1}"
    fi

    case "$key" in
      COOLIFY_DEPLOY_URL)
        [[ -n "$COOLIFY_DEPLOY_URL" ]] || COOLIFY_DEPLOY_URL="$value"
        ;;
      COOLIFY_AUTH_TOKEN)
        [[ -n "$COOLIFY_AUTH_TOKEN" ]] || COOLIFY_AUTH_TOKEN="$value"
        ;;
    esac
  done < "$env_file"
}

if [[ -z "${COOLIFY_DEPLOY_URL}" || -z "${COOLIFY_AUTH_TOKEN}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
  ENV_FILE_CANDIDATES=(
    "${ENV_FILE:-${REPO_ROOT}/.env.production}"
    "${REPO_ROOT}/.env"
  )

  for env_file in "${ENV_FILE_CANDIDATES[@]}"; do
    load_coolify_env_from_file "${env_file}"
  done

  COOLIFY_DEPLOY_URL="${COOLIFY_DEPLOY_URL:-}"
  COOLIFY_AUTH_TOKEN="${COOLIFY_AUTH_TOKEN:-}"
fi

if [[ -z "${COOLIFY_DEPLOY_URL}" || -z "${COOLIFY_AUTH_TOKEN}" ]]; then
  echo "Usage:"
  echo "  COOLIFY_DEPLOY_URL=... COOLIFY_AUTH_TOKEN=... ./scripts/deploy_main_to_prod.sh"
  echo "  ./scripts/deploy_main_to_prod.sh <COOLIFY_DEPLOY_URL> <COOLIFY_AUTH_TOKEN>"
  echo "  ENV_FILE=./path/to/.env.production ./scripts/deploy_main_to_prod.sh"
  exit 1
fi

curl --silent --show-error \
  -H "Authorization: Bearer ${COOLIFY_AUTH_TOKEN}" \
  "${COOLIFY_DEPLOY_URL}"

echo "Coolify deploy trigger requested."
