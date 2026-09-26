#!/usr/bin/env bash
# Shared Vaultwarden (Bitwarden CLI) helpers. Source this file; it expects
# REPO_ROOT to be set and reads credentials from $REPO_ROOT/.creds.config.

VW_ASC_ITEM="bandstr iOS — App Store Connect"
VW_SIGNING_ITEM="bandstr iOS — Distribution Signing"

vw_require_tools() {
  local tool
  for tool in bw jq; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo "Error: '$tool' is required but not installed."
      [[ "$tool" == "bw" ]] && echo "  Install with: brew install bitwarden-cli"
      [[ "$tool" == "jq" ]] && echo "  Install with: brew install jq"
      exit 1
    fi
  done
}

vw_creds_value() {
  local line
  line="$(grep -E "^$1=" "$REPO_ROOT/.creds.config" | tail -n 1 || true)"
  local value="${line#*=}"
  value="${value%$'\r'}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s' "$value"
}

# Logs in / unlocks and exports BW_SESSION.
vw_login() {
  vw_require_tools
  if [[ ! -f "$REPO_ROOT/.creds.config" ]]; then
    echo "Error: $REPO_ROOT/.creds.config not found (needs VAULTWARDEN_SERVER/USER/MASTER_PASSWORD)."
    exit 1
  fi
  local server user password status
  server="$(vw_creds_value VAULTWARDEN_SERVER)"
  [[ -z "$server" ]] && server="$(vw_creds_value VAULTWARDEN_API_BASE)"
  user="$(vw_creds_value VAULTWARDEN_USER)"
  password="$(vw_creds_value VAULTWARDEN_MASTER_PASSWORD)"
  if [[ -z "$server" || -z "$user" || -z "$password" ]]; then
    echo "Error: VAULTWARDEN_SERVER (or VAULTWARDEN_API_BASE), VAULTWARDEN_USER and VAULTWARDEN_MASTER_PASSWORD must be set in .creds.config."
    exit 1
  fi

  export BW_PASSWORD="$password"
  status="$(bw status | jq -r '.status')"
  if [[ "$status" == "unauthenticated" ]]; then
    bw config server "$server" >/dev/null
    echo "Logging in to Vaultwarden as $user ..."
    BW_SESSION="$(bw login "$user" --passwordenv BW_PASSWORD --raw)"
  else
    echo "Unlocking Vaultwarden ..."
    BW_SESSION="$(bw unlock --passwordenv BW_PASSWORD --raw)"
  fi
  unset BW_PASSWORD
  export BW_SESSION
  bw sync >/dev/null
}

vw_lock() {
  bw lock >/dev/null 2>&1 || true
}

# vw_item_id <name> — prints the id of the item with exactly this name (or "").
vw_item_id() {
  bw list items --search "$1" | jq -r --arg n "$1" 'map(select(.name==$n)) | (.[0].id // "")'
}

# vw_field <item-id> <field-name>
vw_field() {
  bw get item "$1" | jq -r --arg f "$2" '(.fields // []) | map(select(.name==$f)) | (.[0].value // "")'
}

# vw_attachment_by_suffix <item-id> <suffix> <output-path>
vw_attachment_by_suffix() {
  local item_id="$1" suffix="$2" out="$3" attachment_id
  attachment_id="$(bw get item "$item_id" | jq -r --arg s "$suffix" \
    '(.attachments // []) | map(select(.fileName | endswith($s))) | (.[0].id // "")')"
  if [[ -z "$attachment_id" ]]; then
    echo "Error: no '*$suffix' attachment on vault item $item_id."
    exit 1
  fi
  bw get attachment "$attachment_id" --itemid "$item_id" --output "$out" >/dev/null
}

# vw_replace_attachment <item-id> <file> — removes same-named attachments, then attaches.
vw_replace_attachment() {
  local item_id="$1" file="$2" fname aid
  fname="$(basename "$file")"
  while IFS= read -r aid; do
    [[ -n "$aid" ]] || continue
    bw delete attachment "$aid" --itemid "$item_id" >/dev/null
  done < <(bw get item "$item_id" | jq -r --arg f "$fname" '(.attachments // []) | map(select(.fileName==$f)) | .[].id')
  bw create attachment --file "$file" --itemid "$item_id" >/dev/null
}
