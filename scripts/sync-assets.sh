#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SOURCE_DIR="$ROOT_DIR/assets"
WEB_SRC_ASSETS_DIR="$ROOT_DIR/packages/web/src/assets"
WEB_PUBLIC_DIR="$ROOT_DIR/packages/web/public"
ROOT_PUBLIC_DIR="$ROOT_DIR/public"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Error: Source assets directory not found: $SOURCE_DIR"
  exit 1
fi

safe_reset_dir() {
  local target="$1"
  case "$target" in
    "$ROOT_DIR"/*) ;;
    *)
      echo "Error: Refusing to modify path outside repository: $target"
      exit 1
      ;;
  esac
  rm -rf "$target"
  mkdir -p "$target"
}

copy_if_exists() {
  local src="$1"
  local dst="$2"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp -f "$src" "$dst"
  fi
}

echo "Syncing assets from: $SOURCE_DIR"

# 1) Sync icons and logo files imported from packages/web/src/assets/*
mkdir -p "$WEB_SRC_ASSETS_DIR"
safe_reset_dir "$WEB_SRC_ASSETS_DIR/icons"
if [[ -d "$SOURCE_DIR/icons" ]]; then
  cp -a "$SOURCE_DIR/icons/." "$WEB_SRC_ASSETS_DIR/icons/"
fi

# Keep expected import names used by existing Vue source.
# Canonical (new): bandstr_*
copy_if_exists "$SOURCE_DIR/bandstr_rect_bl.webp" "$WEB_SRC_ASSETS_DIR/bandstr_rect_bl.webp"
copy_if_exists "$SOURCE_DIR/bandstr_rect_wh.webp" "$WEB_SRC_ASSETS_DIR/bandstr_rect_wh.webp"
# Compatibility alias (legacy): bndstr_*
copy_if_exists "$SOURCE_DIR/bandstr_rect_bl.webp" "$WEB_SRC_ASSETS_DIR/bndstr_rect_bl.webp"
copy_if_exists "$SOURCE_DIR/bandstr_rect_wh.webp" "$WEB_SRC_ASSETS_DIR/bndstr_rect_wh.webp"

# 2) Sync public runtime assets to /assets/*
safe_reset_dir "$WEB_PUBLIC_DIR/assets"
cp -a "$SOURCE_DIR/." "$WEB_PUBLIC_DIR/assets/"
rm -rf "$WEB_PUBLIC_DIR/assets/icons" "$WEB_PUBLIC_DIR/assets/favicons"

# 3) Sync favicons to both public roots used in this repository.
safe_reset_dir "$WEB_PUBLIC_DIR/favicons"
safe_reset_dir "$ROOT_PUBLIC_DIR/favicons"
if [[ -d "$SOURCE_DIR/favicons" ]]; then
  cp -a "$SOURCE_DIR/favicons/." "$WEB_PUBLIC_DIR/favicons/"
  cp -a "$SOURCE_DIR/favicons/." "$ROOT_PUBLIC_DIR/favicons/"
fi

echo "Asset sync complete."
