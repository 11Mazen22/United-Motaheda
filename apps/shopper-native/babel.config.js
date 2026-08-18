const path = require("path");

// Railway/Railpack detects the monorepo root as the Metro process root. Expo
// Router still needs the actual shopper-native app root so its generated
// context points at apps/shopper-native/app rather than /app/app.
const appRoot = path.resolve(__dirname);
process.env.EXPO_PROJECT_ROOT = appRoot;
process.env.EXPO_ROUTER_ABS_APP_ROOT = path.resolve(appRoot, "app");

// expo-router computes EXPO_ROUTER_APP_ROOT relative to the directory that
// contains expo-router/entry. Calculate it from the installed package so this
// remains correct whether dependencies are hoisted to the monorepo root or
// installed inside shopper-native/node_modules.
try {
  const routerEntry = require.resolve("expo-router/entry");
  process.env.EXPO_ROUTER_APP_ROOT = path.relative(
    path.dirname(routerEntry),
    path.resolve(appRoot, "app"),
  );
} catch {
  process.env.EXPO_ROUTER_APP_ROOT = path.relative(
    path.resolve(appRoot, "node_modules/expo-router"),
    path.resolve(appRoot, "app"),
  );
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-reanimated/plugin",
    ],
  };
};
