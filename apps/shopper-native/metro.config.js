const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo while preserving Expo defaults
config.watchFolders = [...config.watchFolders, workspaceRoot];

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

module.exports = withNativeWind(config, { input: "./global.css" });
