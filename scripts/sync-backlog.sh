#!/usr/bin/env bash
# ──────────────────────────────────────────────────
#  sync-backlog.sh — Sync backlog tasks to GitHub
#  Issues & GitHub Projects v2 board.
#
#  Usage:
#    bash scripts/sync-backlog.sh --dry-run          # preview
#    bash scripts/sync-backlog.sh --apply             # create/update issues
#    bash scripts/sync-backlog.sh --apply --project   # + sync to project board
#
#  Requires: gh CLI (authenticated), jq
#  Config:   reads from .env (GH_TOKEN, GH_REPO, GH_PROJECT_NUMBER, GH_PROJECT_OWNER)
# ──────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Load .env ──────────────────────────────────────
ENV_FILE="$ROOT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

# ── Defaults from env ─────────────────────────────
REPO="${GH_REPO:-}"
PROJECT_NUMBER="${GH_PROJECT_NUMBER:-}"
PROJECT_OWNER="${GH_PROJECT_OWNER:-}"

# ── Parse flags ───────────────────────────────────
DRY_RUN=true
SYNC_PROJECT=false

for arg in "$@"; do
  case "$arg" in
    --apply)   DRY_RUN=false ;;
    --dry-run) DRY_RUN=true ;;
    --project) SYNC_PROJECT=true ;;
    *)         echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

# ── Validation ────────────────────────────────────
if [[ -z "$REPO" ]]; then
  echo "ERROR: GH_REPO not set. Configure in .env or export GH_REPO=owner/repo"
  exit 1
fi

if $SYNC_PROJECT && [[ -z "$PROJECT_NUMBER" || -z "$PROJECT_OWNER" ]]; then
  echo "ERROR: GH_PROJECT_NUMBER and GH_PROJECT_OWNER required for --project"
  exit 1
fi

BACKLOG_DIR="$ROOT_DIR/docs/backlog"
if [[ ! -d "$BACKLOG_DIR" ]]; then
  echo "ERROR: $BACKLOG_DIR not found"
  exit 1
fi

# ── Helpers ───────────────────────────────────────
created=0
updated=0
skipped=0
failed=0

status_to_column() {
  case "${1,,}" in
    todo)         echo "Todo" ;;
    "in progress") echo "In Progress" ;;
    done)         echo "Done" ;;
    *)            echo "Todo" ;;
  esac
}

# ── Parse & sync ──────────────────────────────────
for file in "$BACKLOG_DIR"/iter-*.md; do
  [[ -f "$file" ]] || continue
  filename="$(basename "$file")"
  echo ""
  echo "━━━ Parsing $filename ━━━"

  # Extract iteration from <!-- iteration: ... -->
  iteration=""
  if grep -qP '<!--\s*iteration:\s*' "$file"; then
    iteration="$(grep -oP '(?<=<!--\s{0,5}iteration:\s{0,5}).*?(?=\s*-->)' "$file" | head -1)"
  fi
  [[ -n "$iteration" ]] && echo "  Iteration: $iteration"

  # Parse task blocks: ## TASK-XXXX: Title
  current_task_id=""
  current_title=""
  current_status="todo"
  current_labels=""
  current_body=""
  current_gh_issue=""
  in_task=false

  process_task() {
    [[ -z "$current_task_id" ]] && return

    local full_title="[$current_task_id] $current_title"
    local column
    column="$(status_to_column "$current_status")"

    # Parse labels into array
    IFS=',' read -ra label_arr <<< "$current_labels"
    local label_args=()
    for lbl in "${label_arr[@]}"; do
      lbl="$(echo "$lbl" | xargs)" # trim
      [[ -n "$lbl" ]] && label_args+=(--label "$lbl")
    done

    # Check if issue already exists (by <!-- gh:#N --> in file)
    if [[ -n "$current_gh_issue" ]]; then
      echo "  📝 $full_title → update #$current_gh_issue (status: $column)"
      if ! $DRY_RUN; then
        if ! gh issue edit "$current_gh_issue" -R "$REPO" \
            --title "$full_title" \
            --body "$current_body" \
            "${label_args[@]}" 2>/dev/null; then
          echo "    ⚠️  Failed to update #$current_gh_issue"
          ((failed++))
          return
        fi
        ((updated++))
      fi
    else
      echo "  ✨ $full_title → create issue (status: $column)"
      if ! $DRY_RUN; then
        issue_url="$(gh issue create -R "$REPO" \
            --title "$full_title" \
            --body "$current_body" \
            "${label_args[@]}" 2>/dev/null)" || {
          echo "    ⚠️  Failed to create issue"
          ((failed++))
          return
        }
        issue_num="$(echo "$issue_url" | grep -oP '\d+$')"
        echo "    → Created #$issue_num"

        # Write issue number back into backlog file
        sed -i "s/## $current_task_id:/<!-- gh:#$issue_num --> \n## $current_task_id:/" "$file"
        ((created++))

        current_gh_issue="$issue_num"
      fi
    fi

    # Sync to project board
    if $SYNC_PROJECT && ! $DRY_RUN && [[ -n "$current_gh_issue" ]]; then
      echo "    📋 Adding to project board..."

      # Get project ID
      project_id="$(gh project list --owner "$PROJECT_OWNER" --format json \
        | jq -r ".projects[] | select(.number == $PROJECT_NUMBER) | .id")"

      if [[ -z "$project_id" ]]; then
        echo "    ⚠️  Project #$PROJECT_NUMBER not found"
        return
      fi

      # Add item to project
      item_id="$(gh project item-add "$PROJECT_NUMBER" \
        --owner "$PROJECT_OWNER" \
        --url "https://github.com/$REPO/issues/$current_gh_issue" \
        --format json 2>/dev/null | jq -r '.id')" || {
        echo "    ⚠️  Failed to add to project"
        return
      }

      # Set Status field
      status_field_id="$(gh project field-list "$PROJECT_NUMBER" \
        --owner "$PROJECT_OWNER" --format json \
        | jq -r '.fields[] | select(.name == "Status") | .id')"

      if [[ -n "$status_field_id" ]]; then
        status_option_id="$(gh project field-list "$PROJECT_NUMBER" \
          --owner "$PROJECT_OWNER" --format json \
          | jq -r ".fields[] | select(.name == \"Status\") | .options[]? | select(.name == \"$column\") | .id")"

        if [[ -n "$status_option_id" ]]; then
          gh project item-edit \
            --project-id "$project_id" \
            --id "$item_id" \
            --field-id "$status_field_id" \
            --single-select-option-id "$status_option_id" 2>/dev/null || true
        fi
      fi

      # Set Iteration field (if exists)
      if [[ -n "$iteration" ]]; then
        iter_field_id="$(gh project field-list "$PROJECT_NUMBER" \
          --owner "$PROJECT_OWNER" --format json \
          | jq -r '.fields[] | select(.name == "Iteration") | .id')"

        if [[ -n "$iter_field_id" ]]; then
          iter_option_id="$(gh project field-list "$PROJECT_NUMBER" \
            --owner "$PROJECT_OWNER" --format json \
            | jq -r ".fields[] | select(.name == \"Iteration\") | .options[]? | select(.name == \"$iteration\") | .id")"

          if [[ -n "$iter_option_id" ]]; then
            gh project item-edit \
              --project-id "$project_id" \
              --id "$item_id" \
              --field-id "$iter_field_id" \
              --single-select-option-id "$iter_option_id" 2>/dev/null || true
          else
            echo "    ⚠️  Iteration option '$iteration' not found on board"
          fi
        fi
      fi
    elif $SYNC_PROJECT && $DRY_RUN; then
      echo "    📋 Would add to project #$PROJECT_NUMBER (iteration: $iteration, status: $column)"
    fi
  }

  while IFS= read -r line || [[ -n "$line" ]]; do
    # Detect task header: ## TASK-XXXX: Title
    if [[ "$line" =~ ^##[[:space:]]+TASK-([0-9]+):[[:space:]]*(.*) ]]; then
      # Process previous task first
      process_task

      # Reset for new task
      current_task_id="TASK-${BASH_REMATCH[1]}"
      current_title="${BASH_REMATCH[2]}"
      current_status="todo"
      current_labels=""
      current_body=""
      current_gh_issue=""
      in_task=true
      continue
    fi

    # Detect <!-- gh:#N --> before a task header
    if [[ "$line" =~ \<!--[[:space:]]*gh:#([0-9]+) ]]; then
      current_gh_issue="${BASH_REMATCH[1]}"
      continue
    fi

    if $in_task; then
      # Parse metadata lines
      if [[ "$line" =~ ^\-[[:space:]]+\*\*Status:\*\*[[:space:]]*(.*) ]]; then
        current_status="${BASH_REMATCH[1]}"
      elif [[ "$line" =~ ^\-[[:space:]]+\*\*Labels:\*\*[[:space:]]*(.*) ]]; then
        current_labels="${BASH_REMATCH[1]}"
      else
        current_body+="$line"$'\n'
      fi
    fi
  done < "$file"

  # Process last task in file
  process_task
done

# ── Summary ───────────────────────────────────────
echo ""
echo "━━━ Summary ━━━"
if $DRY_RUN; then
  echo "  Mode: DRY RUN (no changes made)"
else
  echo "  Created: $created"
  echo "  Updated: $updated"
  echo "  Failed:  $failed"
fi
echo "  Skipped: $skipped"
echo ""
