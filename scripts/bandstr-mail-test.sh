#!/bin/sh
set -e

node /app/packages/api/dist/cli/mail-test.js "$@"
