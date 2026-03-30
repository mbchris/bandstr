#!/usr/bin/env bash
set -euo pipefail

# GitHub Actions env uploader
# - Uploads keys from .env* files to GitHub Actions Secrets and Variables.
# - Defaults to auto mode (sensitive keys => secret, others => variable).
#
# Usage:
#   ./gh-secrets-upload.sh [envfile|all] [owner/repo] [environment] [--debug]
#   ./gh-secrets-upload.sh --all [owner/repo] [environment] [--debug]
#   ./gh-secrets-upload.sh --mode secret|variable|auto [envfile|all] [owner/repo] [environment] [--debug]

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DEBUG=0
MODE="auto"

TOTAL_ITEMS=0
SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILES=()

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERR]${NC} $1"; }
log_debug() {
  if [[ "$DEBUG" == "1" ]]; then
    echo -e "${BLUE}[DEBUG]${NC} $1"
  fi
}

show_usage() {
  cat <<'EOF'
GitHub Actions env uploader (.env* -> secrets/variables)

Usage:
  gh-secrets-upload.sh [envfile|all] [owner/repo] [environment] [--debug]
  gh-secrets-upload.sh --all [owner/repo] [environment] [--debug]
  gh-secrets-upload.sh --mode auto|secret|variable [envfile|all] [owner/repo] [environment] [--debug]

Modes:
  auto      Sensitive keys -> secret, non-sensitive keys -> variable (default)
  secret    Force all keys as GitHub Actions secrets
  variable  Force all keys as GitHub Actions variables

Defaults:
  envfile   all .env* files in repo root (except *.template), in this order:
            .env.properties
  repo      auto-detected from git remote origin
  env       repository-level (no GitHub Environment)
EOF
}

mask_value() {
  local value="$1"
  local len=${#value}
  if ((len <= 4)); then
    printf '****'
  else
    printf '%s' "${value:0:2}"
    local stars=$((len - 4))
    local i
    for ((i = 0; i < stars; i++)); do printf '*'; done
    printf '%s' "${value: -2}"
  fi
}

validate_name() {
  local name="$1"
  [[ "$name" =~ ^[A-Z][A-Z0-9_]*$ ]] || return 1
  [[ "$name" =~ ^GITHUB_ ]] && return 1
  return 0
}

check_prerequisites() {
  if ! command -v gh >/dev/null 2>&1; then
    log_error "GitHub CLI (gh) not found."
    log_info "Install gh: https://cli.github.com/manual/installation"
    exit 1
  fi

  if ! gh auth status >/dev/null 2>&1; then
    log_error "GitHub CLI is not authenticated."
    log_info "Run: gh auth login"
    exit 1
  fi
}

get_current_repo() {
  local url
  url="$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || true)"
  if [[ -z "$url" ]]; then
    return 1
  fi

  # ssh: git@github.com:owner/repo.git
  # https: https://github.com/owner/repo.git
  local repo
  repo="$(echo "$url" | sed -E 's#^git@github\.com:##; s#^https://github\.com/##; s#\.git$##')"
  if [[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    printf '%s\n' "$repo"
    return 0
  fi
  return 1
}

discover_env_files() {
  ENV_FILES=()
  local ordered=(
    ".env.production"
  )

  local file
  for file in "${ordered[@]}"; do
    if [[ -f "$REPO_ROOT/$file" ]]; then
      ENV_FILES+=("$REPO_ROOT/$file")
    fi
  done

  # Add any remaining .env* files except templates and backups.
  while IFS= read -r file; do
    local base
    base="$(basename "$file")"
    case "$base" in
      *.template|*.example|*.sample|*.bak|*.backup) continue ;;
    esac
    local exists=0
    local existing
    for existing in "${ENV_FILES[@]}"; do
      if [[ "$existing" == "$file" ]]; then
        exists=1
        break
      fi
    done
    if [[ "$exists" == "0" ]]; then
      ENV_FILES+=("$file")
    fi
  done < <(find "$REPO_ROOT" -maxdepth 1 -type f -name ".env.properties" | sort)

  if ((${#ENV_FILES[@]} == 0)); then
    log_error "No .env* files found in repo root: $REPO_ROOT"
    exit 1
  fi
}

strip_wrapping_quotes() {
  local v="$1"
  if [[ "$v" =~ ^\"(.*)\"$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return
  fi
  if [[ "$v" =~ ^\'(.*)\'$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return
  fi
  printf '%s\n' "$v"
}

should_be_secret() {
  local key="$1"
  # Sensitive by default.
  if [[ "$key" =~ (SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|DATABASE_URL|CONNECTION_STRING|CLIENT_SECRET|API_KEY|SIGNING_KEY|CERT|KEYSTORE|WEBHOOK_SECRET|INTERNAL_ADMIN_TOKEN) ]]; then
    return 0
  fi
  return 1
}

classify_target() {
  local key="$1"
  case "$MODE" in
    secret) printf 'secret\n' ;;
    variable) printf 'variable\n' ;;
    auto)
      if should_be_secret "$key"; then
        printf 'secret\n'
      else
        printf 'variable\n'
      fi
      ;;
    *)
      log_error "Invalid mode: $MODE"
      exit 1
      ;;
  esac
}

set_secret() {
  local repo="$1"
  local environment="$2"
  local key="$3"
  local value="$4"

  local masked
  masked="$(mask_value "$value")"

  local -a cmd=(gh secret set "$key" -b "$value" --repo "$repo")
  if [[ -n "$environment" ]]; then
    cmd+=(--env "$environment")
  fi

  local -a debug_cmd=(gh secret set "$key" -b "[REDACTED]" --repo "$repo")
  if [[ -n "$environment" ]]; then
    debug_cmd+=(--env "$environment")
  fi
  log_debug "CMD: ${debug_cmd[*]}"

  local output
  if output="$("${cmd[@]}" 2>&1)"; then
    log_success "secret:$key value:$masked"
    return 0
  fi

  log_warn "Retrying secret:$key"
  if output="$("${cmd[@]}" 2>&1)"; then
    log_success "secret:$key value:$masked [retry]"
    return 0
  fi

  log_error "secret:$key failed: $output"
  return 1
}

set_variable() {
  local repo="$1"
  local environment="$2"
  local key="$3"
  local value="$4"

  local masked
  masked="$(mask_value "$value")"

  local -a cmd=(gh variable set "$key" -b "$value" --repo "$repo")
  if [[ -n "$environment" ]]; then
    cmd+=(--env "$environment")
  fi

  local -a debug_cmd=(gh variable set "$key" -b "[REDACTED]" --repo "$repo")
  if [[ -n "$environment" ]]; then
    debug_cmd+=(--env "$environment")
  fi
  log_debug "CMD: ${debug_cmd[*]}"

  local output
  if output="$("${cmd[@]}" 2>&1)"; then
    log_success "variable:$key value:$masked"
    return 0
  fi

  log_warn "Retrying variable:$key"
  if output="$("${cmd[@]}" 2>&1)"; then
    log_success "variable:$key value:$masked [retry]"
    return 0
  fi

  log_error "variable:$key failed: $output"
  return 1
}

upload_key_value() {
  local repo="$1"
  local environment="$2"
  local key="$3"
  local value="$4"
  local source_file="$5"
  local source_line="$6"

  local target
  target="$(classify_target "$key")"
  log_debug "Parsed $key from $(basename "$source_file"):$source_line -> $target"

  if [[ "$target" == "secret" ]]; then
    set_secret "$repo" "$environment" "$key" "$value"
  else
    set_variable "$repo" "$environment" "$key" "$value"
  fi
}

process_env_file() {
  local env_file="$1"
  local repo="$2"
  local environment="$3"

  log_info "Reading $(basename "$env_file")"

  local line line_no=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line_no=$((line_no + 1))
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue

    if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key raw value
      key="${BASH_REMATCH[1]}"
      raw="${BASH_REMATCH[2]}"
      key="$(echo "$key" | tr '[:lower:]' '[:upper:]')"
      value="$(strip_wrapping_quotes "$raw")"

      if ! validate_name "$key"; then
        log_warn "Skip invalid name '$key' in $(basename "$env_file"):$line_no"
        SKIP_COUNT=$((SKIP_COUNT + 1))
        continue
      fi

      TOTAL_ITEMS=$((TOTAL_ITEMS + 1))
      if upload_key_value "$repo" "$environment" "$key" "$value" "$env_file" "$line_no"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
      else
        FAIL_COUNT=$((FAIL_COUNT + 1))
      fi
    else
      log_warn "Skip unparsable line in $(basename "$env_file"):$line_no"
      SKIP_COUNT=$((SKIP_COUNT + 1))
    fi
  done < "$env_file"
}

print_summary() {
  echo
  log_info "Summary"
  echo "  Mode:                 $MODE"
  echo "  Processed entries:    $TOTAL_ITEMS"
  echo "  Uploaded successfully:$SUCCESS_COUNT"
  echo "  Failed uploads:       $FAIL_COUNT"
  echo "  Skipped lines/keys:   $SKIP_COUNT"
}

main() {
  local upload_all=1
  local env_selector=""
  local repo=""
  local environment=""

  while (($# > 0)); do
    case "$1" in
      -h|--help)
        show_usage
        exit 0
        ;;
      --debug)
        DEBUG=1
        shift
        ;;
      --all)
        upload_all=1
        shift
        ;;
      --mode)
        if (($# < 2)); then
          log_error "--mode requires one of: auto|secret|variable"
          exit 1
        fi
        MODE="$2"
        shift 2
        ;;
      *)
        if [[ -z "$env_selector" ]]; then
          # Backward-compatible argument disambiguation:
          # - existing file path / "all" => env selector
          # - owner/repo pattern => repo
          if [[ "$1" == "all" || -f "$1" || -f "$REPO_ROOT/$1" ]]; then
            env_selector="$1"
          elif [[ "$1" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
            repo="$1"
          else
            env_selector="$1"
          fi
        elif [[ -z "$repo" ]]; then
          repo="$1"
        elif [[ -z "$environment" ]]; then
          environment="$1"
        else
          log_error "Unexpected argument: $1"
          show_usage
          exit 1
        fi
        shift
        ;;
    esac
  done

  check_prerequisites

  if [[ -z "$repo" ]]; then
    if ! repo="$(get_current_repo)"; then
      log_error "Could not auto-detect owner/repo from git remote."
      log_info "Pass it explicitly, e.g.: mbchris/bandster"
      exit 1
    fi
  fi

  # Validate repo access early.
  if ! gh repo view "$repo" >/dev/null 2>&1; then
    log_error "Repository not accessible via gh: $repo"
    log_info "Check repo name and permissions."
    exit 1
  fi

  if [[ -n "$env_selector" && "$env_selector" != "all" ]]; then
    upload_all=0
    local explicit="$env_selector"
    if [[ "$explicit" != /* ]]; then
      explicit="$REPO_ROOT/$explicit"
    fi
    if [[ ! -f "$explicit" ]]; then
      log_error "Env file not found: $explicit"
      exit 1
    fi
    ENV_FILES=("$explicit")
  else
    discover_env_files
  fi

  log_info "Repo: $repo"
  if [[ -n "$environment" ]]; then
    log_info "GitHub Environment: $environment"
  else
    log_info "GitHub Environment: <repository-level>"
  fi
  log_info "Mode: $MODE"
  log_info "Files (${#ENV_FILES[@]}):"
  local f
  for f in "${ENV_FILES[@]}"; do
    echo "  - $(basename "$f")"
  done
  echo

  for f in "${ENV_FILES[@]}"; do
    process_env_file "$f" "$repo" "$environment"
  done

  print_summary
  if ((FAIL_COUNT > 0)); then
    exit 1
  fi
}

main "$@"
