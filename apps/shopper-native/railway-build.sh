#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root/apps/shopper-native"

echo "==> [shopper-native] Installing dependencies…"
npm ci --include=dev --production=false --no-audit --no-fund

echo "==> [shopper-native] Verifying React runtime dependency…"
node -e "console.log('react:', require.resolve('react')); console.log('react-dom:', require.resolve('react-dom'))"
node -e "const react=require('react/package.json'); const reactDom=require('react-dom/package.json'); console.log('react version:', react.version); console.log('react-dom version:', reactDom.version)"

# Railway serves the Expo web export. Keep Metro resolution local to this
# app so the monorepo's web React installation cannot be selected.
cat > metro.config.js <<'EOF'
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
};

module.exports = config;
EOF

echo "==> [shopper-native] Exporting Expo web bundle…"
npx expo export --platform web --output-dir dist

echo "==> [shopper-native] Build complete → apps/shopper-native/dist"
