import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      'react-hooks': reactHooks,
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn',
      // defaultTheme is a static snapshot frozen to light mode at import
      // time — importing it instead of calling useTheme() is what made dark
      // mode render as a broken half-light/half-dark UI across ~103 files
      // before the Phase 1 theme-reactivity migration. It is intentionally
      // not exported from packages/ui-native/src/theme.tsx; this rule stops
      // that import path from being reintroduced by mistake or muscle memory.
      'no-restricted-imports': ['error', {
        paths: [{
          name: '@pharmacy/ui-native',
          importNames: ['defaultTheme'],
          message: 'defaultTheme is not exported — it was a static, non-reactive theme snapshot that broke dark mode. Call useTheme() inside a component/hook instead.',
        }],
      }],
    },
  },
  {
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
