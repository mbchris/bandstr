#!/usr/bin/env bash

set -uo pipefail

exit_code=0
pnpm_bin="pnpm"

if [[ "${OS:-}" == "Windows_NT" ]] && command -v pnpm.cmd >/dev/null 2>&1; then
  pnpm_bin="pnpm.cmd"
fi

echo "Running web security scan..."
if ! "$pnpm_bin" --dir packages/web audit --audit-level=high; then
  exit_code=1
fi

echo "Running backend security scan..."
if ! "$pnpm_bin" --dir packages/api audit --audit-level=high; then
  exit_code=1
fi

exit "$exit_code"
