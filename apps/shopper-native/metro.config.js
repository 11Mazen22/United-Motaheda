import { getDefaultConfig } from "expo/metro-config.js";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch only the hoisted root node_modules plus the specific workspace
// packages this app imports from — NOT the whole monorepo root. Watching
// every sibling app's own node_modules tree (shopper-web, api, admin, ...)
// made Metro's file watcher time out on this machine (no Watchman, Windows
// fs.watch fallback) before it ever started serving.
config.watchFolders = [
  ...config.watchFolders,
  path.resolve(workspaceRoot, "node_modules"),
  path.resolve(workspaceRoot, "packages/ui-native"),
  path.resolve(workspaceRoot, "packages/design-tokens"),
];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Fallback resolution for monorepo packages
config.resolver.extraNodeModules = {
  "@pharmacy/ui-native": path.resolve(workspaceRoot, "packages/ui-native"),
  "@pharmacy/design-tokens": path.resolve(workspaceRoot, "packages/design-tokens"),
};

// 4. Deprioritize .mjs so we use CommonJS modules that do not contain import.meta.env
const mjsIdx = config.resolver.sourceExts.indexOf('mjs');
if (mjsIdx > -1) {
  config.resolver.sourceExts.splice(mjsIdx, 1);
  config.resolver.sourceExts.push('mjs');
}

config.resolver.platforms = [
  ...(config.resolver.platforms ?? []),
  "web",
];

// 5. Some deps (e.g. zustand's devtools middleware) publish an ESM "import"
// export containing `import.meta`, which Metro's web bundle can't execute
// (it isn't loaded as a module). Their "react-native" export condition
// points at the safe CJS build instead, so make it match on web too —
// Metro checks each package's own exports keys against this set, in the
// package's key order, so this only changes outcomes for packages that
// don't already have a working "browser" build.
config.resolver.unstable_conditionsByPlatform = {
  ...config.resolver.unstable_conditionsByPlatform,
  web: [...(config.resolver.unstable_conditionsByPlatform?.web ?? []), "react-native"],
};

export default config;
