#!/usr/bin/env bash
set -eu
# See scripts/railway/build-api.sh for why pipefail is enabled defensively.
(set -o pipefail) 2>/dev/null && set -o pipefail || true
npm install -g serve --no-audit --no-fund --silent
exec serve apps/shopper-native/dist -l "${PORT:-3000}" --no-clipboard
