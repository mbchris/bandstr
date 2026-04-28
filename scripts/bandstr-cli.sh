#!/bin/sh
set -e

node /app/packages/api/dist/cli/admin.js "$@"
