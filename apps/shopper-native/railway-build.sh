#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
app_root="$repo_root/apps/shopper-native"
packages_root="$repo_root/packages"
cd "$app_root"

echo "==> [shopper-native] Installing dependencies…"
# Use npm install rather than npm ci here because this app is intentionally
# maintained as a standalone Expo dependency graph with local monorepo file
# dependencies. This also reconciles the app lockfile when Expo/RN web
# versions change, instead of failing before Metro can run.
npm install --include=dev --production=false --no-audit --no-fund

# shopper-native deliberately has its own React/Expo dependency graph and
# its local shared packages are linked explicitly for the Railway web export.
for package_name in ui-native design-tokens; do
  package_dir="$packages_root/$package_name"
  if [[ ! -f "$package_dir/package.json" ]]; then
    echo "ERROR: packages/$package_name/package.json is missing" >&2
    exit 1
  fi
  mkdir -p "$app_root/node_modules/@pharmacy"
  ln -sfn "$package_dir" "$app_root/node_modules/@pharmacy/$package_name"
done

# Railway has previously produced snapshots containing an older internal
# react-native-web import even though main contains the public React Native
# import. Normalize these imports before Metro starts so the build is
# deterministic even if an old snapshot or staged file is supplied.
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

if grep -R -nE 'react-native-web/dist/exports/(Platform|I18nManager)' "$packages_root/ui-native/src"; then
  echo "ERROR: internal react-native-web imports remain in ui-native" >&2
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
