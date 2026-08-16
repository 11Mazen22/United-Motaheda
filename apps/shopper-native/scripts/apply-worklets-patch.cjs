const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');
const repoDir = path.resolve(appDir, '../..');
const localWorklets = path.join(appDir, 'node_modules', 'react-native-worklets');
const hoistedWorklets = path.join(repoDir, 'node_modules', 'react-native-worklets');

const workletsPath = fs.existsSync(localWorklets)
  ? localWorklets
  : fs.existsSync(hoistedWorklets)
    ? hoistedWorklets
    : null;

if (!workletsPath) {
  console.log('[shopper-native] react-native-worklets is not installed; skipping patch.');
  process.exit(0);
}

let patchPackageEntry;
try {
  patchPackageEntry = require.resolve('patch-package', { paths: [repoDir, appDir] });
} catch {
  console.log('[shopper-native] patch-package is not installed; skipping patch.');
  process.exit(0);
}

const patchDir = path.join(appDir, 'patches');
const result = spawnSync(process.execPath, [patchPackageEntry, '--patch-dir', patchDir], {
  cwd: appDir,
  stdio: 'inherit',
  shell: false,
  env: process.env,
});

if (result.error) {
  console.error('[shopper-native] Failed to run patch-package:', result.error.message);
  process.exit(result.status ?? 1);
}

process.exit(result.status ?? 0);
