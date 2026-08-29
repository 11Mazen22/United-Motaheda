#!/usr/bin/env bash
set -eu
# See scripts/railway/build-api.sh for why pipefail is enabled defensively.
(set -o pipefail) 2>/dev/null && set -o pipefail || true

exec bash apps/shopper-native/railway-build.sh
