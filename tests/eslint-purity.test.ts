// @vitest-environment node
//
// Feature: 00-foundation, Task 3.2 — permanent purity-boundary proof.
//
// Drives ESLint through its Node API (the `ESLint` class + `lintText`) over
// in-memory snippets with virtual file paths, so we can prove the purity and
// network rules in eslint.config.js actually produce errors. No fixture files
// are written to disk.

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

/**
 * Assert the messages include `ruleId` AND that every message carrying that
 * ruleId is an error (severity === 2).
 */
function expectRuleError(messages: LintMessage[], ruleId: string): void {
  const matching = messages.filter((m) => m.ruleId === ruleId);
  expect(
    matching.length,
    `expected at least one '${ruleId}' message, got: ${JSON.stringify(
      messages.map((m) => ({ ruleId: m.ruleId, severity: m.severity })),
    )}`,
  ).toBeGreaterThan(0);
  for (const m of matching) {
    expect(m.severity, `'${ruleId}' must be an error (severity 2)`).toBe(2);
  }
  // Req 4.4: a violating snippet must produce at least one error so that
  // `eslint . --max-warnings 0` exits non-zero.
  expect(errorCount(messages)).toBeGreaterThan(0);
}

describe('ESLint purity boundary (Node API)', () => {
  // --- Case 1: React imports banned in src/core (Req 4.1) ---
  it.each([
    ["import React from 'react';", 'react'],
    ["import ReactDOM from 'react-dom';", 'react-dom'],
  ])(
    'bans %s in src/core via no-restricted-imports (Req 4.1)',
    async (code) => {
      const messages = await lintSnippet(code, 'src/core/x.ts');
      expectRuleError(messages, 'no-restricted-imports');
    },
    LINT_TIMEOUT,
  );

  // --- Case 2: DOM / storage globals banned in src/core (Req 4.2) ---
  it('bans document/window/localStorage in src/core via no-restricted-globals (Req 4.2)', async () => {
    const code =
      'export const a = document; export const b = window; export const c = localStorage;';
    const messages = await lintSnippet(code, 'src/core/x.ts');
    expectRuleError(messages, 'no-restricted-globals');
  }, LINT_TIMEOUT);

  // --- Case 3: network globals banned in src/ui (Req 4.3) ---
  it('bans fetch/XMLHttpRequest/WebSocket/EventSource in src/ui via no-restricted-globals (Req 4.3)', async () => {
    const code = [
      'export const a = fetch;',
      'export const b = new XMLHttpRequest();',
      'export const c = new WebSocket();',
      'export const d = new EventSource();',
    ].join('\n');
    const messages = await lintSnippet(code, 'src/ui/x.tsx');
    expectRuleError(messages, 'no-restricted-globals');
  }, LINT_TIMEOUT);

  // --- Case 4: member-expression network forms in src/ui (Req 4.3) ---
  it('bans window.fetch/globalThis.fetch/navigator.sendBeacon in src/ui via no-restricted-syntax (Req 4.3)', async () => {
    const code = [
      "export const a = window.fetch('x');",
      "export const b = globalThis.fetch('x');",
      "export const c = navigator.sendBeacon('x');",
    ].join('\n');
    const messages = await lintSnippet(code, 'src/ui/x.tsx');
    expectRuleError(messages, 'no-restricted-syntax');
  }, LINT_TIMEOUT);

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
        `expected no messages, got: ${JSON.stringify(
          messages.map((m) => ({ ruleId: m.ruleId, severity: m.severity })),
        )}`,
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

describe('effective config for src/core (overlap guard)', () => {
  const hasCalculateConfig =
    typeof (ESLint.prototype as { calculateConfigForFile?: unknown })
      .calculateConfigForFile === 'function';

  const maybeIt = hasCalculateConfig ? it : it.skip;

  maybeIt(
    'no-restricted-globals for src/core carries BOTH network and DOM/storage names',
    async () => {
      const config = (await eslint.calculateConfigForFile(
        resolve(repoRoot, 'src/core/x.ts'),
      )) as {
        rules?: Record<string, unknown[]>;
      };
      const rule = config.rules?.['no-restricted-globals'] ?? [];
      // Options are everything after the severity (index 0). Collect the
      // restricted names, whether given as bare strings or { name } objects.
      const names = rule.slice(1).map((opt) => {
        if (typeof opt === 'string') return opt;
        if (opt && typeof opt === 'object' && 'name' in opt) {
          return (opt as { name: string }).name;
        }
        return '';
      });

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
});
