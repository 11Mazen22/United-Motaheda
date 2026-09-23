/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // Only run test files under src/ and stores/ — not the Expo app/ router files,
  // which require a full native runtime.
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.{ts,tsx}",
    "<rootDir>/src/**/*.test.{ts,tsx}",
  ],
  // Path aliases that mirror tsconfig.json "paths"
  moduleNameMapper: {
    "^react-native$": require.resolve("react-native"),
    // react-native-reanimated is hoisted to the workspace root node_modules
    // (npm workspaces), not present locally under apps/shopper-native --
    // jest-expo's preset computes an app-local path for this package rather
    // than doing a normal upward require() resolution walk, so it needs the
    // same explicit require.resolve() treatment react-native already gets
    // above (confirmed: without this, every test importing anything that
    // pulls in react-native-reanimated fails with "Could not locate module
    // react-native-reanimated" pointing at the nonexistent local path).
    "^react-native-reanimated$": require.resolve("react-native-reanimated"),
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Transform everything except pre-compiled node_modules. react-native-reanimated
  // and react-native-worklets ship ESM source that needs the same babel-jest
  // transform as react-native itself (their jest mock imports fail with a raw
  // SyntaxError otherwise).
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated|react-native-worklets|@tanstack))",
  ],
  // react-native-worklets/mock sets the JS-only globals (globalThis._WORKLET,
  // requestAnimationFrame, etc.) that Reanimated 4's separated Worklets
  // runtime expects. This does NOT fully resolve every test that imports
  // react-native-reanimated -- ActiveOrderBanner.test.tsx still fails with
  // "Native part of Worklets doesn't seem to be initialized" because
  // NativeWorklets.native.ts performs its own native-module presence check
  // at import time, which mock.js's side-effect-only design (it exports
  // nothing, just sets globals) doesn't intercept. That needs either a
  // jest.mock()-level replacement of the native module binding or a
  // jest-expo version that ships first-class Worklets-v4 support -- neither
  // attempted here (no blind dependency upgrades). Left in place because it
  // is still correct and harmless for any test that DOES need these globals.
  setupFiles: [require.resolve("react-native-worklets/lib/module/mock")],
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
  // Ensure the test environment matches React Native
  testEnvironment: "node",
  // Module file extensions (RN-first ordering)
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  // Coverage reporting
  collectCoverageFrom: [
    "src/features/loyalty/**/*.{ts,tsx}",
    "src/stores/**/*.{ts,tsx}",
    "!src/**/__tests__/**",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/index.ts",
  ],
};
