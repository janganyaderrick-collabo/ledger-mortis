// @vitest-environment node
//
// Feature: 00-foundation, Task 3.2 — permanent purity-boundary proof.
//
// Drives ESLint through its Node API (the `ESLint` class + `lintText`) over
// in-memory snippets with virtual file paths, so we can prove the purity and
// network rules in eslint.config.js actually produce errors. No fixture files
// are written to disk.
//
// The cases are table-driven and NAME-SPECIFIC: every banned global, import,
// and member form gets its own snippet, and for `no-restricted-globals` /
// `no-restricted-imports` we assert the reported message text contains the
// exact name token. This means removing a single banned name from
// eslint.config.js would make exactly one case fail. The real message formats
// (verified against live lintText output) are:
//   * no-restricted-globals: "Unexpected use of 'NAME'. <custom message>"
//   * no-restricted-imports (path):    "'NAME' import is restricted from being used. <custom>"
//   * no-restricted-imports (pattern): "'NAME' import is restricted from being used by a pattern. <custom>"
//   * no-restricted-syntax: fully custom message that does NOT include the name,
//     so syntax cases assert only ruleId + severity.

import { describe, it, expect, beforeAll } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// ESLint's first lint call on a cold instance is slow (config discovery +
// plugin load), so each lint-driven case gets a generous timeout.
const LINT_TIMEOUT = 30_000;

// Repo root is the parent of this `tests/` directory.
const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testsDir, '..');

// One shared ESLint instance, created once with cwd pinned to the repo root so
// that eslint.config.js is discovered and loaded.
let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: repoRoot });
}, 30_000);

/** A single lint message as returned by ESLint's Node API (narrowed subset). */
type LintMessage = ESLint.LintResult['messages'][number];

/**
 * Lint a snippet of code against the repo's eslint.config.js using a VIRTUAL
 * file path (nothing is written to disk) and return the messages array.
 */
async function lintSnippet(
  code: string,
  filePath: string,
): Promise<LintMessage[]> {
  const results = await eslint.lintText(code, {
    filePath: resolve(repoRoot, filePath),
  });
  return results[0]?.messages ?? [];
}

/** Count messages reported as errors (severity 2). */
function errorCount(messages: LintMessage[]): number {
  return messages.filter((m) => m.severity === 2).length;
}

/** Render messages compactly for assertion failure diagnostics. */
function describeMessages(messages: LintMessage[]): string {
  return JSON.stringify(
    messages.map((m) => ({
      ruleId: m.ruleId,
      severity: m.severity,
      message: m.message,
    })),
  );
}

/**
 * Return the messages carrying `ruleId`, asserting at least one exists and
 * that each such message is an error (severity === 2). Also asserts the
 * snippet produced at least one error overall (Req 4.4 — so that
 * `eslint . --max-warnings 0` exits non-zero).
 */
function expectRuleError(
  messages: LintMessage[],
  ruleId: string,
): LintMessage[] {
  const matching = messages.filter((m) => m.ruleId === ruleId);
  expect(
    matching.length,
    `expected at least one '${ruleId}' message, got: ${describeMessages(messages)}`,
  ).toBeGreaterThan(0);
  for (const m of matching) {
    expect(m.severity, `'${ruleId}' must be an error (severity 2)`).toBe(2);
  }
  expect(errorCount(messages)).toBeGreaterThan(0);
  return matching;
}

/**
 * Assert that some message with `ruleId` is an error AND mentions the exact
 * `name` token (quoted, e.g. `'EventSource'`) in its text. The quoted form is
 * specific to a single banned name, so dropping that name from the config
 * fails exactly this case.
 */
function expectRuleErrorNamingToken(
  messages: LintMessage[],
  ruleId: string,
  name: string,
): void {
  const matching = expectRuleError(messages, ruleId);
  const token = `'${name}'`;
  const naming = matching.filter((m) => m.message.includes(token));
  expect(
    naming.length,
    `expected a '${ruleId}' message mentioning ${token}, got: ${describeMessages(messages)}`,
  ).toBeGreaterThan(0);
  for (const m of naming) {
    expect(m.severity, `'${ruleId}' message for ${token} must be an error`).toBe(
      2,
    );
  }
}

describe('ESLint purity boundary (Node API)', () => {
  // --- Network globals in src/ui — one case per name (Req 4.3) ---
  it.each([
    ['fetch', "export const a = fetch('x');"],
    ['XMLHttpRequest', 'export const a = new XMLHttpRequest();'],
    ['WebSocket', "export const a = new WebSocket('x');"],
    ['EventSource', "export const a = new EventSource('x');"],
  ])(
    'bans network global %s in src/ui via no-restricted-globals (Req 4.3)',
    async (name, code) => {
      const messages = await lintSnippet(code, 'src/ui/x.tsx');
      expectRuleErrorNamingToken(messages, 'no-restricted-globals', name);
    },
    LINT_TIMEOUT,
  );

  // --- Same four network globals in src/core — one case per name (Req 4.3) ---
  it.each([
    ['fetch', "export const a = fetch('x');"],
    ['XMLHttpRequest', 'export const a = new XMLHttpRequest();'],
    ['WebSocket', "export const a = new WebSocket('x');"],
    ['EventSource', "export const a = new EventSource('x');"],
  ])(
    'bans network global %s in src/core via no-restricted-globals (Req 4.3)',
    async (name, code) => {
      const messages = await lintSnippet(code, 'src/core/x.ts');
      expectRuleErrorNamingToken(messages, 'no-restricted-globals', name);
    },
    LINT_TIMEOUT,
  );

  // --- DOM / storage globals in src/core — one case per name (Req 4.2) ---
  it.each([
    ['window', 'export const a = window;'],
    ['document', 'export const a = document;'],
    ['localStorage', 'export const a = localStorage;'],
    ['sessionStorage', 'export const a = sessionStorage;'],
    ['navigator', 'export const a = navigator;'],
  ])(
    'bans DOM/storage global %s in src/core via no-restricted-globals (Req 4.2)',
    async (name, code) => {
      const messages = await lintSnippet(code, 'src/core/x.ts');
      expectRuleErrorNamingToken(messages, 'no-restricted-globals', name);
    },
    LINT_TIMEOUT,
  );

  // --- React imports in src/core — one case per name (Req 4.1) ---
  // The last two exercise the react/* and react-dom/* pattern bans.
  it.each([
    ['react', "import React from 'react';"],
    ['react-dom', "import ReactDOM from 'react-dom';"],
    ['react/jsx-runtime', "import x from 'react/jsx-runtime';"],
    ['react-dom/client', "import x from 'react-dom/client';"],
  ])(
    'bans import %s in src/core via no-restricted-imports (Req 4.1)',
    async (name, code) => {
      const messages = await lintSnippet(code, 'src/core/x.ts');
      expectRuleErrorNamingToken(messages, 'no-restricted-imports', name);
    },
    LINT_TIMEOUT,
  );

  // --- Member-expression network forms in src/ui (Req 4.3) ---
  // One case per (object × property) of the window/globalThis/self network
  // selector, plus navigator.sendBeacon. no-restricted-syntax uses a fully
  // custom message that does not name the member, so these assert only the
  // ruleId + error severity.
  const memberObjects = ['window', 'globalThis', 'self'] as const;
  const memberProps = [
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
  ] as const;
  const memberCases: ReadonlyArray<readonly [string, string]> = [
    ...memberObjects.flatMap((obj) =>
      memberProps.map(
        (prop): readonly [string, string] => [
          `${obj}.${prop}`,
          `export const a = ${obj}.${prop};`,
        ],
      ),
    ),
    ['navigator.sendBeacon', "export const a = navigator.sendBeacon('x');"],
  ];

  it.each(memberCases)(
    'bans member form %s in src/ui via no-restricted-syntax (Req 4.3)',
    async (_label, code) => {
      const messages = await lintSnippet(code, 'src/ui/x.tsx');
      expectRuleError(messages, 'no-restricted-syntax');
    },
    LINT_TIMEOUT,
  );

  // --- Case 5: network ban also applies inside src/core (Req 4.3) ---
  it('bans fetch in src/core too (network ban applies everywhere under src)', async () => {
    const code = 'export const a = fetch;';
    const messages = await lintSnippet(code, 'src/core/x.ts');
    expectRuleError(messages, 'no-restricted-globals');
  }, LINT_TIMEOUT);

  // --- Case 6: negative controls — clean snippets produce zero messages ---
  it.each([
    ['src/core/x.ts', 'export const answer = 42;'],
    [
      'src/ui/x.tsx',
      "import { useState } from 'react'; export const u = useState;",
    ],
    ['src/ui/x.tsx', 'export const d = document;'],
  ])(
    'clean snippet %s produces zero messages',
    async (filePath, code) => {
      const messages = await lintSnippet(code, filePath);
      expect(
        messages,
        `expected no messages, got: ${describeMessages(messages)}`,
      ).toHaveLength(0);
    },
    LINT_TIMEOUT,
  );

  // --- Case 7: warning-free — clean snippets carry no warnings (severity 1) ---
  it.each([
    ['src/core/x.ts', 'export const answer = 42;'],
    [
      'src/ui/x.tsx',
      "import { useState } from 'react'; export const u = useState;",
    ],
    ['src/ui/x.tsx', 'export const d = document;'],
  ])(
    'clean snippet %s has no warnings (--max-warnings 0)',
    async (filePath, code) => {
      const messages = await lintSnippet(code, filePath);
      expect(messages.filter((m) => m.severity === 1)).toHaveLength(0);
    },
    LINT_TIMEOUT,
  );

  // --- Case 8: Req 4.4 — violating snippets yield errorCount > 0 so lint exits non-zero ---
  it.each([
    ['src/core/x.ts', "import React from 'react';"],
    ['src/core/x.ts', 'export const a = document;'],
    ['src/ui/x.tsx', 'export const a = fetch;'],
    ['src/ui/x.tsx', "export const a = window.fetch('x');"],
  ])(
    'violating snippet %s produces errorCount > 0 (Req 4.4)',
    async (filePath, code) => {
      const results = await eslint.lintText(code, {
        filePath: resolve(repoRoot, filePath),
      });
      const result = results[0];
      expect(result).toBeDefined();
      expect(result?.errorCount ?? 0).toBeGreaterThan(0);
    },
    LINT_TIMEOUT,
  );
});

describe('effective config (overlap guard)', () => {
  const hasCalculateConfig =
    typeof (ESLint.prototype as { calculateConfigForFile?: unknown })
      .calculateConfigForFile === 'function';

  const maybeIt = hasCalculateConfig ? it : it.skip;

  /** Collect the restricted-global names from an effective rule option list. */
  function restrictedGlobalNames(rule: unknown[]): string[] {
    // Options are everything after the severity (index 0). Collect the
    // restricted names, whether given as bare strings or { name } objects.
    return rule.slice(1).map((opt) => {
      if (typeof opt === 'string') return opt;
      if (opt && typeof opt === 'object' && 'name' in opt) {
        return (opt as { name: string }).name;
      }
      return '';
    });
  }

  maybeIt(
    'no-restricted-globals for src/core carries BOTH network and DOM/storage names',
    async () => {
      const config = (await eslint.calculateConfigForFile(
        resolve(repoRoot, 'src/core/x.ts'),
      )) as {
        rules?: Record<string, unknown[]>;
      };
      const names = restrictedGlobalNames(
        config.rules?.['no-restricted-globals'] ?? [],
      );

      const expected = [
        // network names
        'fetch',
        'XMLHttpRequest',
        'WebSocket',
        'EventSource',
        // DOM / storage names
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'navigator',
      ];
      for (const name of expected) {
        expect(names, `expected '${name}' in effective core config`).toContain(
          name,
        );
      }
    },
    LINT_TIMEOUT,
  );

  maybeIt(
    'no-restricted-globals for src/ui carries all four network names',
    async () => {
      const config = (await eslint.calculateConfigForFile(
        resolve(repoRoot, 'src/ui/x.tsx'),
      )) as {
        rules?: Record<string, unknown[]>;
      };
      const names = restrictedGlobalNames(
        config.rules?.['no-restricted-globals'] ?? [],
      );

      const expected = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'];
      for (const name of expected) {
        expect(names, `expected '${name}' in effective ui config`).toContain(
          name,
        );
      }
    },
    LINT_TIMEOUT,
  );
});
