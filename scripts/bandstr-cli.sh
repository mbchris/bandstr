#!/bin/sh
set -e

if [ "${1:-}" = "push-test" ]; then
  shift
  exec node /app/packages/api/dist/cli/admin.js send-band-push "$@"
fi

exec node /app/packages/api/dist/cli/admin.js "$@"
