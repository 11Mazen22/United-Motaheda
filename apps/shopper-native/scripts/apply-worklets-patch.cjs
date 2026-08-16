const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const repoDir = path.resolve(appDir, '../..');

const candidates = [
  path.join(appDir, 'node_modules', 'react-native-worklets'),
  path.join(repoDir, 'node_modules', 'react-native-worklets'),
];

const workletsDir = candidates.find((candidate) => fs.existsSync(candidate));

if (!workletsDir) {
  console.log('[shopper-native] react-native-worklets not installed; skipping native patch.');
  process.exit(0);
}

const replacements = [
  {
    file: path.join(workletsDir, 'android', 'CMakeLists.txt'),
    from: 'file(GLOB_RECURSE WORKLETS_COMMON_CPP_SOURCES CONFIGURE_DEPENDS',
    to: 'file(GLOB_RECURSE WORKLETS_COMMON_CPP_SOURCES',
  },
  {
    file: path.join(workletsDir, 'android', 'CMakeLists.txt'),
    from: 'file(GLOB_RECURSE WORKLETS_ANDROID_CPP_SOURCES CONFIGURE_DEPENDS',
    to: 'file(GLOB_RECURSE WORKLETS_ANDROID_CPP_SOURCES',
  },
  {
    file: path.join(workletsDir, 'android', 'build.gradle'),
    from: 'version = System.getenv("CMAKE_VERSION") ?: "3.22.1"',
    to: 'version = System.getenv("CMAKE_VERSION") ?: "3.31.6"',
  },
];

let changed = false;

for (const { file, from, to } of replacements) {
  if (!fs.existsSync(file)) continue;

  const original = fs.readFileSync(file, 'utf8');
  if (!original.includes(from)) continue;

  const updated = original.replaceAll(from, to);
  if (updated !== original) {
    fs.writeFileSync(file, updated, 'utf8');
    changed = true;
  }
}

console.log(
  changed
    ? `[shopper-native] Applied react-native-worklets native build patch at ${workletsDir}`
    : '[shopper-native] react-native-worklets patch already applied or not applicable.'
);
