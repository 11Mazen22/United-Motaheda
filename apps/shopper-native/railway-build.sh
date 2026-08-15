#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
app_root="$repo_root/apps/shopper-native"
packages_root="$repo_root/packages"
cd "$app_root"

echo "==> [shopper-native] Installing dependencies…"
npm ci --include=dev --production=false --no-audit --no-fund

# The native app is intentionally not a root npm workspace because it has a
# different React/Expo dependency graph. Its local file dependencies therefore
# need explicit Metro aliases when Railway performs the Expo web export.
if [[ ! -f "$packages_root/ui-native/package.json" ]]; then
  echo "ERROR: packages/ui-native/package.json is missing" >&2
  exit 1
fi
if [[ ! -f "$packages_root/design-tokens/package.json" ]]; then
  echo "ERROR: packages/design-tokens/package.json is missing" >&2
  exit 1
fi

echo "==> [shopper-native] Verifying React runtime dependency…"
node -e "console.log('react:', require.resolve('react')); console.log('react-dom:', require.resolve('react-dom'))"
node -e "const react=require('react/package.json'); const reactDom=require('react-dom/package.json'); console.log('react version:', react.version); console.log('react-dom version:', reactDom.version)"

echo "==> [shopper-native] Verifying shared native packages…"
node -e "console.log('@pharmacy/ui-native:', require.resolve('@pharmacy/ui-native'))"
node -e "console.log('@pharmacy/design-tokens:', require.resolve('@pharmacy/design-tokens'))"

cat > metro.config.js <<EOF
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  path.resolve(repoRoot, 'packages/ui-native'),
  path.resolve(repoRoot, 'packages/design-tokens'),
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
  '@pharmacy/ui-native': path.resolve(repoRoot, 'packages/ui-native'),
  '@pharmacy/design-tokens': path.resolve(repoRoot, 'packages/design-tokens'),
};

module.exports = config;
EOF

echo "==> [shopper-native] Exporting Expo web bundle…"
npx expo export --platform web --output-dir dist

echo "==> [shopper-native] Build complete → apps/shopper-native/dist"
