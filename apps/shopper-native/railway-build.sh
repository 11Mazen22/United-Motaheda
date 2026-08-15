#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
app_root="$repo_root/apps/shopper-native"
packages_root="$repo_root/packages"
cd "$app_root"

echo "==> [shopper-native] Installing dependencies…"
npm install --include=dev --production=false --no-audit --no-fund

# Link the shared monorepo packages explicitly because shopper-native owns its
# own Expo dependency graph while consuming source packages from /packages.
for package_name in ui-native design-tokens; do
  package_dir="$packages_root/$package_name"
  if [[ ! -f "$package_dir/package.json" ]]; then
    echo "ERROR: packages/$package_name/package.json is missing" >&2
    exit 1
  fi
  mkdir -p "$app_root/node_modules/@pharmacy"
  ln -sfn "$package_dir" "$app_root/node_modules/@pharmacy/$package_name"
done

# Keep the shared package source compatible with the Expo Web resolver. Babel
# may intentionally rewrite `react-native` imports to react-native-web export
# modules, so those modules must resolve from the app's dependency graph.
# This guard only removes genuinely stale internal imports that may appear in
# a staged/shared-package snapshot. It does not rewrite valid public imports.
node <<'NODE'
const fs = require('fs');
const path = require('path');
const root = path.resolve(process.cwd(), '../../packages/ui-native/src');
const replacements = [
  ['react-native-web/dist/exports/Platform', 'react-native'],
  ['react-native-web/dist/exports/I18nManager', 'react-native'],
];
let changed = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      const before = fs.readFileSync(file, 'utf8');
      let after = before;
      for (const [from, to] of replacements) after = after.split(from).join(to);
      if (after !== before) {
        fs.writeFileSync(file, after);
        changed++;
        console.log(`==> [shopper-native] Normalized stale native-web import: ${path.relative(root, file)}`);
      }
    }
  }
}
walk(root);
console.log(`==> [shopper-native] Native-web import normalization complete (${changed} file(s) changed)`);
NODE

echo "==> [shopper-native] Verifying React runtime dependency…"
node -e "console.log('react:', require.resolve('react')); console.log('react-dom:', require.resolve('react-dom')); console.log('react-native-web:', require.resolve('react-native-web/package.json'))"
node -e "const react=require('react/package.json'); const reactDom=require('react-dom/package.json'); const web=require('react-native-web/package.json'); console.log('react version:', react.version); console.log('react-dom version:', reactDom.version); console.log('react-native-web version:', web.version)"

echo "==> [shopper-native] Verifying shared native packages…"
node -e "console.log('@pharmacy/ui-native:', require.resolve('@pharmacy/ui-native'))"
node -e "console.log('@pharmacy/design-tokens:', require.resolve('@pharmacy/design-tokens'))"

# Metro resolves the real path of symlinked packages. Explicitly map every web
# runtime dependency back to the shopper-native dependency graph so imports
# originating under /packages/ui-native cannot accidentally search a separate
# /packages/ui-native/node_modules tree.
cat > metro.config.js <<EOF
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');
const appNodeModules = path.resolve(projectRoot, 'node_modules');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  path.resolve(repoRoot, 'packages/ui-native'),
  path.resolve(repoRoot, 'packages/design-tokens'),
];

config.resolver.nodeModulesPaths = [appNodeModules];
config.resolver.disableHierarchicalLookup = true;

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  react: path.resolve(appNodeModules, 'react'),
  'react-dom': path.resolve(appNodeModules, 'react-dom'),
  'react-native': path.resolve(appNodeModules, 'react-native'),
  'react-native-web': path.resolve(appNodeModules, 'react-native-web'),
  '@pharmacy/ui-native': path.resolve(repoRoot, 'packages/ui-native'),
  '@pharmacy/design-tokens': path.resolve(repoRoot, 'packages/design-tokens'),
};

module.exports = config;
EOF

echo "==> [shopper-native] Exporting Expo web bundle…"
npx expo export --platform web --output-dir dist

echo "==> [shopper-native] Build complete → apps/shopper-native/dist"
