const path = require("path");

// Custom webpack config for NestJS API
// Forces @pharmacy/* workspace packages to be bundled (not externalized)
// so the runtime doesn't try to load raw TypeScript source files.
module.exports = (options) => {
  const defaultExternals = options.externals || [];

  return {
    ...options,
    resolveLoader: {
      ...options.resolveLoader,
      modules: [path.resolve(__dirname, "node_modules"), "node_modules"],
    },
    externals: [
      (data, callback) => {
        const { request } = data;

        // Always bundle workspace packages — they ship as .ts source,
        // not compiled JS, so they must be inlined into the bundle.
        if (request && request.startsWith("@pharmacy/")) {
          return callback();
        }

        // For everything else use NestJS defaults (keep node_modules external)
        if (Array.isArray(defaultExternals)) {
          for (const ext of defaultExternals) {
            if (typeof ext === "function") {
              return ext(data, callback);
            }
          }
        } else if (typeof defaultExternals === "function") {
          return defaultExternals(data, callback);
        }

        callback();
      },
    ],
  };
};
