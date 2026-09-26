#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# upload-env-to-gh-secrets.sh
# Syncs key-value pairs from a local .env file to GitHub Actions Secrets / Variables.
#
# Usage:
#   ./scripts/upload-env-to-gh-secrets.sh [options] [env_file] [owner/repo]
#
# Options:
#   --secrets-only    Upload only sensitive keys to GitHub Secrets
#   --variables-only  Upload only non-sensitive keys to GitHub Variables
#   --all             Upload both secrets and variables (default)
#   --dry-run         Print actions without uploading anything
#   --env <env_name>  Target a specific GitHub Environment (e.g. production)
#   --force-secret    Treat ALL non-empty keys as Secrets
#   -h, --help        Show usage help
# ==============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET_FILE=""
TARGET_REPO=""
TARGET_GH_ENV=""
MODE="all" # all | secrets-only | variables-only | force-secret
DRY_RUN=0

print_usage() {
  cat <<'EOF'
Usage:
  ./scripts/upload-env-to-gh-secrets.sh [options] [env_file] [owner/repo]

Options:
  --secrets-only    Upload only sensitive keys to GitHub Secrets
  --variables-only  Upload only non-sensitive keys to GitHub Variables
  --all             Upload both secrets and variables (default)
  --dry-run         Simulate run without writing to GitHub
  --env <name>      Target a specific GitHub Environment
  --force-secret    Force all keys to be uploaded as GitHub Secrets
  -h, --help        Show this help message

Examples:
  ./scripts/upload-env-to-gh-secrets.sh
  ./scripts/upload-env-to-gh-secrets.sh --dry-run
  ./scripts/upload-env-to-gh-secrets.sh --secrets-only .env prj120/bandstr
EOF
}

# Parse options
while [[ $# -gt 0 ]]; do
  case "$1" in
    --secrets-only)
      MODE="secrets-only"
      shift
      ;;
    --variables-only)
      MODE="variables-only"
      shift
      ;;
    --all)
      MODE="all"
      shift
      ;;
    --force-secret)
      MODE="force-secret"
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --env)
      TARGET_GH_ENV="$2"
      shift 2
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    -*)
      echo -e "${RED}[ERROR] Unknown option: $1${NC}"
      print_usage
      exit 1
      ;;
    *)
      if [[ -z "$TARGET_FILE" ]]; then
        TARGET_FILE="$1"
      elif [[ -z "$TARGET_REPO" ]]; then
        TARGET_REPO="$1"
      fi
      shift
      ;;
  esac
done

if [[ -z "$TARGET_FILE" ]]; then
  TARGET_FILE="$REPO_ROOT/.env"
elif [[ ! -f "$TARGET_FILE" && -f "$REPO_ROOT/$TARGET_FILE" ]]; then
  TARGET_FILE="$REPO_ROOT/$TARGET_FILE"
fi

if [[ ! -f "$TARGET_FILE" ]]; then
  echo -e "${RED}[ERROR] Environment file not found: $TARGET_FILE${NC}"
  exit 1
fi

# Detect repository
if [[ -z "$TARGET_REPO" ]]; then
  remote_url="$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || true)"
  if [[ -n "$remote_url" ]]; then
    TARGET_REPO="$(echo "$remote_url" | sed -E 's#^git@github\.com:##; s#^https://github\.com/##; s#\.git$##')"
  fi
fi

if [[ -z "$TARGET_REPO" ]]; then
  echo -e "${RED}[ERROR] Could not auto-detect GitHub repository. Specify as second argument: owner/repo${NC}"
  exit 1
fi

# Prerequisites check
if ! command -v gh >/dev/null 2>&1; then
  echo -e "${RED}[ERROR] GitHub CLI ('gh') is not installed.${NC}"
  echo "Install: https://cli.github.com"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo -e "${RED}[ERROR] GitHub CLI is not authenticated.${NC}"
  echo "Run 'gh auth login' to authenticate."
  exit 1
fi

echo -e "${BOLD}${CYAN}=== Syncing Environment to GitHub Actions ===${NC}"
echo -e "Source File: ${BOLD}$TARGET_FILE${NC}"
echo -e "Target Repo: ${BOLD}$TARGET_REPO${NC}"
if [[ -n "$TARGET_GH_ENV" ]]; then
  echo -e "Environment: ${BOLD}$TARGET_GH_ENV${NC}"
fi
echo -e "Mode:        ${BOLD}$MODE${NC}"
if [[ "$DRY_RUN" == "1" ]]; then
  echo -e "${YELLOW}Mode: DRY-RUN (no changes will be applied)${NC}"
fi
echo "------------------------------------------------------------"

# Function to determine if a key is a Secret
is_secret_key() {
  local k="$1"
  if [[ "$MODE" == "force-secret" ]]; then
    return 0
  fi
  if [[ "$k" =~ (SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|DATABASE_URL|CONNECTION_STRING|CLIENT_SECRET|API_KEY|SIGNING_KEY|CERT|KEYSTORE|WEBHOOK_SECRET|INTERNAL_ADMIN_TOKEN|APPLICATION_CREDENTIALS|SERVICE_ACCOUNT|PROVISIONING_PROFILE) ]]; then
    return 0
  fi
  return 1
}

# Python helper to reliably parse .env (including multiline values)
PYTHON_CMD="
import sys, os

filepath = sys.argv[1]
with open(filepath, 'rb') as f:
    raw = f.read().decode('utf-8', errors='replace')

current_key = None
current_val = []
in_quotes = None

for line in raw.splitlines():
    stripped = line.strip()
    if not current_key:
        if not stripped or stripped.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        k = k.strip()
        v = v.strip()
        if (v.startswith('\"') and not v.endswith('\"')) or (v.startswith(\"'\") and not v.endswith(\"'\")):
            in_quotes = v[0]
            current_key = k
            current_val = [v[1:]]
        elif (v.startswith('\"') and v.endswith('\"')) or (v.startswith(\"'\") and v.endswith(\"'\")):
            print(f'{k}\x1f{v[1:-1]}')
        else:
            print(f'{k}\x1f{v}')
    else:
        if in_quotes and line.endswith(in_quotes):
            current_val.append(line[:-1])
            val = '\n'.join(current_val)
            print(f'{current_key}\x1f{val}')
            current_key = None
            in_quotes = None
        else:
            current_val.append(line)
"

count_secrets=0
count_vars=0
count_skipped=0
count_failed=0

while IFS=$'\x1f' read -r key val || [[ -n "$key" ]]; do
  [[ -z "$key" ]] && continue

  val_len=${#val}

  # Last 8 bytes calculation
  val_tail=""
  if (( val_len <= 8 )); then
    val_tail="$val"
  else
    val_tail="...${val: -8}"
  fi

  if [[ -z "$val" ]]; then
    echo -e "${YELLOW}[SKIP EMPTY]${NC} $key"
    ((count_skipped++)) || true
    continue
  fi

  if is_secret_key "$key"; then
    if [[ "$MODE" == "variables-only" ]]; then
      continue
    fi

    if [[ "$DRY_RUN" == "1" ]]; then
      echo -e "${CYAN}[DRY-RUN SECRET]${NC} $key (len=$val_len, tail=$val_tail)"
      ((count_secrets++)) || true
      continue
    fi

    echo -ne "${BLUE}[SETTING SECRET]${NC} $key (len=$val_len)... "
    local_cmd=(gh secret set "$key" --repo "$TARGET_REPO")
    if [[ -n "$TARGET_GH_ENV" ]]; then
      local_cmd+=(--env "$TARGET_GH_ENV")
    fi

    if printf '%s' "$val" | "${local_cmd[@]}" 2>/dev/null; then
      echo -e "${GREEN}OK${NC}"
      ((count_secrets++)) || true
    else
      echo -e "${RED}FAILED${NC}"
      ((count_failed++)) || true
    fi
  else
    if [[ "$MODE" == "secrets-only" ]]; then
      continue
    fi

    if [[ "$DRY_RUN" == "1" ]]; then
      echo -e "${CYAN}[DRY-RUN VAR]   ${NC} $key (len=$val_len, tail=$val_tail)"
      ((count_vars++)) || true
      continue
    fi

    echo -ne "${BLUE}[SETTING VAR]   ${NC} $key (len=$val_len)... "
    local_cmd=(gh variable set "$key" --repo "$TARGET_REPO")
    if [[ -n "$TARGET_GH_ENV" ]]; then
      local_cmd+=(--env "$TARGET_GH_ENV")
    fi

    if printf '%s' "$val" | "${local_cmd[@]}" 2>/dev/null; then
      echo -e "${GREEN}OK${NC}"
      ((count_vars++)) || true
    else
      echo -e "${RED}FAILED${NC}"
      ((count_failed++)) || true
    fi
  fi
done < <(python3 -c "$PYTHON_CMD" "$TARGET_FILE")

echo "------------------------------------------------------------"
echo -e "${BOLD}Summary:${NC}"
echo -e "  Secrets updated:   ${GREEN}$count_secrets${NC}"
echo -e "  Variables updated: ${GREEN}$count_vars${NC}"
echo -e "  Skipped (empty):   ${YELLOW}$count_skipped${NC}"
if (( count_failed > 0 )); then
  echo -e "  Failed:            ${RED}$count_failed${NC}"
fi
echo "============================================================"
