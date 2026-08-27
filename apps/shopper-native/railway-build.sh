#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
app_root="$repo_root/apps/shopper-native"
packages_root="$repo_root/packages"
cd "$app_root"

# Railpack executes the root workspace command from the monorepo root. Pin the
# Expo/Expo Router project roots to this app so Metro never resolves the entry
# point against /app/node_modules.
export EXPO_PROJECT_ROOT="$app_root"
export EXPO_ROUTER_ABS_APP_ROOT="$app_root/app"

if router_entry="$(node -p "require.resolve('expo-router/entry')" 2>/dev/null)"; then
  export EXPO_ROUTER_APP_ROOT="$(node -e "const path=require('path'); console.log(path.relative(path.dirname(process.argv[1]), process.argv[2]))" "$router_entry" "$app_root/app")"
else
  echo "ERROR: expo-router/entry could not be resolved from shopper-native" >&2
  exit 1
fi

echo "==> [shopper-native] Expo project root: $EXPO_PROJECT_ROOT"
echo "==> [shopper-native] Expo Router app root: $EXPO_ROUTER_ABS_APP_ROOT"
echo "==> [shopper-native] Expo Router relative app root: $EXPO_ROUTER_APP_ROOT"

echo "==> [shopper-native] Installing dependencies…"
npm install --include=dev --production=false --no-audit --no-fund

for package_name in ui-native design-tokens; do
  package_dir="$packages_root/$package_name"
  if [[ ! -f "$package_dir/package.json" ]]; then
    echo "ERROR: packages/$package_name/package.json is missing" >&2
    exit 1
  fi
  mkdir -p "$app_root/node_modules/@pharmacy"
  ln -sfn "$package_dir" "$app_root/node_modules/@pharmacy/$package_name"
done

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

cat > metro.config.js <<EOF
import { getDefaultConfig } from 'expo/metro-config.js';
const config = getDefaultConfig(process.cwd());

// Deprioritize .mjs so Metro prefers CommonJS builds that don't contain
// import.meta — the web bundle loads via a classic <script>, not as a
// module, so any import.meta reaching it is a runtime crash (blank page).
const mjsIdx = config.resolver.sourceExts.indexOf('mjs');
if (mjsIdx > -1) {
  config.resolver.sourceExts.splice(mjsIdx, 1);
  config.resolver.sourceExts.push('mjs');
}

// Some deps (e.g. zustand's devtools middleware) publish an ESM "import"
// export containing import.meta. Their "react-native" export condition
// points at the safe CJS build instead, so match it on web too.
config.resolver.unstable_conditionsByPlatform = {
  ...config.resolver.unstable_conditionsByPlatform,
  web: [...(config.resolver.unstable_conditionsByPlatform?.web ?? []), 'react-native'],
};

export default config;
EOF

echo "==> [shopper-native] Exporting Expo web bundle…"
npx expo export --platform web --output-dir dist

echo "==> [shopper-native] Build complete → apps/shopper-native/dist"
