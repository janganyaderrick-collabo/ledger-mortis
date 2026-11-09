// Ledger Mortis — ESLint flat config (ESM).
//
// Enforces the architectural boundaries from the steering docs:
//   * src/core is pure TypeScript — no React, no DOM, no browser storage.
//   * No network APIs anywhere under src — user transaction data never leaves
//     the browser.
//
// Severity policy: the `lint` script runs `eslint . --max-warnings 0`, so no
// rule here is ever set to "warn" — only "error" or "off".

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

// The network globals forbidden everywhere under src (Req 4.3).
const networkGlobals = [
  {
    name: 'fetch',
    message: 'No network in Ledger Mortis — your data never leaves the browser.',
  },
  {
    name: 'XMLHttpRequest',
    message: 'No network in Ledger Mortis — your data never leaves the browser.',
  },
  {
    name: 'WebSocket',
    message: 'No network in Ledger Mortis — your data never leaves the browser.',
  },
  {
    name: 'EventSource',
    message: 'No network in Ledger Mortis — your data never leaves the browser.',
  },
];

// Member-expression forms of the network ban that no-restricted-globals cannot
// catch (Req 4.3). Applies to all of src.
const networkSyntax = [
  {
    selector: "MemberExpression[property.name='sendBeacon']",
    message:
      'navigator.sendBeacon is forbidden — your data never leaves the browser.',
  },
  {
    selector:
      "MemberExpression[object.name=/^(window|globalThis|self)$/][property.name=/^(fetch|XMLHttpRequest|WebSocket|EventSource)$/]",
    message:
      'No network in Ledger Mortis — window/globalThis/self network APIs are forbidden.',
  },
];

export default defineConfig([
  // 1. Global ignores — generated output, deps, and spec tooling.
  globalIgnores(['dist', 'coverage', 'node_modules', '.kiro']),

  // 2. Base presets for every linted source file. NOT type-aware:
  //    parserOptions.project is intentionally unset.
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },

  // 3. React Hooks recommended flat config, scoped to the UI source. The
  //    plugin's recommended preset leaves a few rules at "warn"; restate them
  //    as "error" so nothing trips --max-warnings 0.
  {
    ...reactHooks.configs.flat.recommended,
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/incompatible-library': 'error',
      'react-hooks/unsupported-syntax': 'error',
    },
  },

  // 4a. Browser globals for UI source.
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // 4b. Node globals for tooling/config and node-environment tests.
  {
    files: [
      'vite.config.ts',
      'vitest.setup.ts',
      'eslint.config.js',
      'tests/**/*.ts',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // 5. Network ban across all of src (Req 4.3).
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', ...networkGlobals],
      'no-restricted-syntax': ['error', ...networkSyntax],
    },
  },

  // 6. src/core is pure TypeScript — no React, no DOM, no browser storage
  //    (Req 4.1, 4.2). This block REPLACES the src-wide no-restricted-globals
  //    for core files, so the full forbidden set is restated here. The
  //    no-restricted-syntax network selectors from block 5 still apply.
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/core is pure TypeScript: no React' },
            {
              name: 'react-dom',
              message: 'src/core is pure TypeScript: no React',
            },
          ],
          patterns: [
            {
              group: ['react/*', 'react-dom/*'],
              message: 'src/core is pure TypeScript: no React',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...networkGlobals,
        { name: 'window', message: 'src/core must not touch the DOM.' },
        { name: 'document', message: 'src/core must not touch the DOM.' },
        {
          name: 'localStorage',
          message: 'src/core must not touch browser storage.',
        },
        {
          name: 'sessionStorage',
          message: 'src/core must not touch browser storage.',
        },
        { name: 'navigator', message: 'src/core must not touch the DOM.' },
      ],
    },
  },

  // 7. Prettier LAST — turn off formatting rules that would conflict.
  prettier,
]);
