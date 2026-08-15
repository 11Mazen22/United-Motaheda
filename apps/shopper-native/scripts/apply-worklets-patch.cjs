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

const patchPackageBin = path.join(appDir, 'node_modules', '.bin', process.platform === 'win32' ? 'patch-package.cmd' : 'patch-package');
if (!fs.existsSync(patchPackageBin)) {
  console.log('[shopper-native] patch-package is not installed; skipping patch.');
  process.exit(0);
}

const result = spawnSync(patchPackageBin, ['--patch-dir', 'apps/shopper-native/patches'], {
  cwd: repoDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error('[shopper-native] Failed to run patch-package:', result.error.message);
  process.exit(result.status ?? 1);
}

process.exit(result.status ?? 1);
