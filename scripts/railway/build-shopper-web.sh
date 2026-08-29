#!/usr/bin/env bash
set -eu
# See scripts/railway/build-api.sh for why pipefail is enabled defensively.
(set -o pipefail) 2>/dev/null && set -o pipefail || true

echo "==> [shopper-web] Installing workspace dependencies…"
npm install --no-audit --no-fund

echo "==> [shopper-web] Building Vite bundle…"
npm run build --workspace=apps/shopper-web

echo "==> [shopper-web] Build complete → apps/shopper-web/dist"
