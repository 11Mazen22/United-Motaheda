const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, "../..");

// Shared design-system packages live outside this app's independent install root.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// ─── Web bundle: avoid ESM variants that ship `import.meta` ──────────────────
//
// Zustand (and similar libs with dual exports) publish:
//   { "import": "./esm/*.mjs",  "default": "./*.js" }
// Metro's web target prefers the "import" condition, pulling the .mjs build
// which contains `import.meta.env` — invalid outside <script type="module">.
//
// Two-layer defense:
//   1. Tell the resolver to skip the "import" condition on web so it falls
//      through to "default" (CommonJS).
//   2. As a hard backstop, intercept any resolution of `zustand/*` paths
//      ending in `.mjs` and rewrite to the matching `.js` file. This catches
//      cases where condition-based resolution is bypassed (e.g., deep
//      requires that resolve via internal paths).
//
// Native is unaffected — it resolves via the "react-native" condition which
// already points at the CJS build, and the resolveRequest branch checks for
// platform === "web" before rewriting.

config.resolver.unstable_conditionsByPlatform = {
  ...(config.resolver.unstable_conditionsByPlatform ?? {}),
  web: ["browser"],
};

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // ─── Fix: @expo/metro-runtime 4.0.1 + React Native 0.81 ESM/CJS mismatch ──
  //
  // messageSocket.native.ts uses require() to load RN modules that RN 0.81
  // switched to ESM exports. A bare require() on an ESM module returns the
  // namespace object { default: X } instead of X directly, crashing with:
  //   TypeError: getDevServer is not a function (it is Object)
  //   TypeError: constructor is not callable
  //
  // Each shim exports the value directly as module.exports = X (CJS) so
  // require() returns it directly, and also sets .default for import stmts.
  if (platform !== "web") {
    // Stub out @expo/metro-runtime's messageSocket.native — it's only needed
    // for RSC dev reloading (which this project doesn't use) and crashes on
    // RN 0.81 due to ESM/CJS interop issues with getDevServer + WebSocket.
    //
    // NOTE: effects.native.ts imports this as a RELATIVE path ("./messageSocket"),
    // so we match on moduleName + originModulePath, not the full package path.
    // Normalize to forward slashes so the check works on Windows (backslash paths).
    const originNorm = (context.originModulePath || "").replace(/\\/g, "/");
    if (
      (moduleName === "./messageSocket" || moduleName === "./messageSocket.native") &&
      originNorm.includes("@expo/metro-runtime")
    ) {
      return {
        filePath: path.resolve(__dirname, "src/shims/messageSocketStub.js"),
        type: "sourceFile",
      };
    }
  }

  if (platform === "web") {
    // ─── React 19 + react-native-web@0.18 compat ────────────────────────────
    // react-native-web@0.18.x imports `render`, `hydrate`, and `createRoot`
    // from 'react-dom'.  React 19 removed the first two and moved createRoot
    // to 'react-dom/client'.  The shim re-exports the full react-dom surface
    // and back-fills the three missing APIs so the web bundle boots correctly.
    if (moduleName === "react-dom") {
      return {
        filePath: path.resolve(__dirname, "src/shims/reactDomR19Web.js"),
        type: "sourceFile",
      };
    }

    // Force zustand to its CJS build on web regardless of condition matching.
    if (moduleName === "zustand")              moduleName = "zustand/index.js";
    else if (moduleName === "zustand/middleware") moduleName = "zustand/middleware.js";
    else if (moduleName === "zustand/shallow")    moduleName = "zustand/shallow.js";
    else if (moduleName === "zustand/vanilla")    moduleName = "zustand/vanilla.js";
    else if (moduleName === "zustand/traditional") moduleName = "zustand/traditional.js";
  }
  return upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
