#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root/apps/shopper-native"

echo "==> [shopper-native] Installing dependencies…"
npm ci --include=dev --production=false --no-audit --no-fund

echo "==> [shopper-native] Verifying React runtime dependency…"
node -e "require.resolve('react'); require.resolve('react-dom')"

echo "==> [shopper-native] Exporting Expo web bundle…"
npx expo export --platform web --output-dir dist

echo "==> [shopper-native] Build complete → apps/shopper-native/dist"
