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
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Transform everything except pre-compiled node_modules
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@tanstack))",
  ],
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
