#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

safe_rm() {
  local target="$1"
  if [[ ! -e "$target" ]]; then
    return 0
  fi
  case "$target" in
    "$ROOT_DIR"/*) ;;
    *)
      echo "Error: Refusing to remove path outside repository: $target"
      exit 1
      ;;
  esac
  rm -rf "$target"
  echo "Removed: $target"
}

echo "Cleaning unneeded generated resources..."

# node_modules cleanup
safe_rm "$ROOT_DIR/node_modules/.cache"

# packages cleanup
safe_rm "$ROOT_DIR/packages/api/dist"
safe_rm "$ROOT_DIR/packages/web/dist"
safe_rm "$ROOT_DIR/packages/web/.quasar"
safe_rm "$ROOT_DIR/packages/web/src-capacitor/android/app/build"

# Remove obsolete media file variant if present.
safe_rm "$ROOT_DIR/packages/web/public/assets/rehearsal_dyn_v.mp4"

# Rebuild mirrored asset targets from canonical ./assets.
bash "$SCRIPT_DIR/sync-assets.sh"

echo "Cleanup complete."
