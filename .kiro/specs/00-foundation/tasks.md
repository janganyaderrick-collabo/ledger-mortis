# Implementation Plan: Module 0 — Foundation

## Overview

This plan builds the Ledger Mortis Module 0 Foundation incrementally: scaffold and tooling
first, then the canonical folder layout, then the mechanically enforced purity boundary (with
its permanent test), then the pure accessibility/contrast and theme logic, then the token
stylesheet and landing screen with its component test, then the README, and finally a single
verification task that runs lint/test/build and the asset-preservation checks. Each task builds
on the previous one; the fast-check toolchain proof (Property 1) is wired in with the scaffold so
the testing stack is proven as early as possible. No parsers, analysis, graveyard, import, or
exorcism code is created — those folders exist empty with `.gitkeep` only.

## Tasks

- [x] 1. Scaffold the Vite + React + TypeScript project and wire the toolchain in the repo root
  - [x] 1.1 Create the base scaffold and `package.json` with scripts and engines
    - Do NOT run the Vite scaffolder in place in the repository root. Instead, either write the scaffold files manually, OR scaffold into a temporary folder and copy across everything EXCEPT `README.md`, `.gitignore`, and `LICENSE` (to avoid clobbering the existing ones); never overwrite `.kiro/`.
    - Delete the Vite template leftovers after copying: `App.css`, `index.css`, `src/assets/react.svg`, `public/vite.svg`, and any template-provided ESLint config.
    - Write `package.json` with scripts: `dev` → `vite`, `build` → `tsc -b && vite build`, `test` → `vitest run`, `lint` → `eslint . --max-warnings 0`, `format` → `prettier --write .`.
    - Add `"engines": { "node": "^22.12.0 || ^24.0.0 || >=26.0.0" }`.
    - _Requirements: 2.1, 2.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 1.2 Configure TypeScript (strict), Vite, and Vitest
    - Write `tsconfig.json` with `"strict": true` plus standard Vite React settings, and `tsconfig.node.json` for the Vite config.
    - Write `vite.config.ts` with the React plugin and a Vitest `test` block using `environment: 'jsdom'` and a setup file that imports `@testing-library/jest-dom`; do NOT enable `globals` (tests import `describe`/`it`/`expect` from `vitest`).
    - Ensure the `tsc` type-check covers test files as well as application sources.
    - _Requirements: 2.2, 5.1, 5.3, 5.4, 7.3_

  - [x] 1.3 Install testing, lint, and format dependencies and add the Prettier config
    - Install dev dependencies: `vitest`, `fast-check`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `eslint` and the TypeScript/React ESLint plugins, `prettier`, `eslint-config-prettier`.
    - Write `.prettierrc.json` with the project formatting config.
    - Confirm the pinned Node engine range matches the installed Vite and Vitest versions.
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2_

  - [x] 1.4 Create `index.html` with language, viewport, title, and no third-party scripts
    - Set `lang="en"` on `<html>`, include a viewport meta tag, set the title to "Ledger Mortis".
    - Reference only the local module entry `/src/main.tsx`; add no third-party `<script>` tags and self-host all assets.
    - _Requirements: 2.4, 9.6_

  - [x] 1.5 Append-only edit to `.gitignore`
    - Only append entries; preserve every existing entry and do not reorder.
    - Ensure no entry ignores the `.kiro/` directory; ensure `node_modules` and the build output directory (`dist`) are ignored (append only if not already covered).
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 1.6 Add the placeholder property-based test proving fast-check runs (Property 1)
    - Create `src/core/placeholder.property.test.ts` using fast-check; assert `reverse(reverse(xs)) === xs` for arbitrary integer arrays with at least 100 generated inputs.
    - Import `describe`/`it`/`expect` from `vitest`; tag with `// Feature: 00-foundation, Property 1: ...`.
    - **Property 1: The property-based testing toolchain executes end to end**
    - **Validates: Requirements 8.1, 8.2, 8.3**
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 2. Create the canonical folder layout with `.gitkeep` files
  - Create `src/core/model`, `src/core/parsers`, `src/core/analysis`, `src/ui/graveyard`, `src/ui/exorcism`, `src/ui/import`, `src/ui/a11y`, and `src/samples`.
  - Place a `.gitkeep` file in each of these eight folders so git tracks each directory.
  - Create no implementation code in these folders.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 13.1, 13.2_

- [x] 3. Enforce the purity boundary with ESLint and prove it with a permanent test
  - [x] 3.1 Write the ESLint flat config enforcing the purity and network bans
    - Add a top-level `ignores` block for `dist` and `coverage`.
    - For all of `src/**/*.{ts,tsx}`: forbid the network globals `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, and forbid `navigator.sendBeacon` plus `window`/`globalThis`/`self`.fetch via `no-restricted-syntax`.
    - For `src/core/**/*.{ts,tsx}`: additionally forbid imports of `react`/`react-dom` and use of `window`, `document`, `localStorage` (restating the network globals so core carries the full set).
    - Configure the lint script to run with `--max-warnings 0`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.1, 6.3, 6.4, 12.1_

  - [x] 3.2 Write the permanent node-environment test driving ESLint via its Node API
    - Create `tests/eslint-purity.test.ts` that uses the ESLint `ESLint` class / `lintText` over in-memory snippets with virtual file paths.
    - The test file MUST start with the directive comment `// @vitest-environment node`.
    - Install `@types/node`; ensure both Vitest's `include` pattern and the `tsc -b` type-check cover the `tests/` folder.
    - Assert lint errors are produced for: a `react` import in `src/core` (4.1), `document` used in `src/core` (4.2), a `fetch` call in `src/ui` (4.3), and `window.fetch` in `src/ui` (4.3).
    - Import `describe`/`it`/`expect` from `vitest`; add no violating fixture files to the repo.
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4. Implement the pure WCAG contrast function and its tests
  - [x] 4.1 Implement `src/ui/a11y/contrast.ts` (pure TypeScript)
    - Implement `parseHex` (validating `#RRGGBB` and throwing a descriptive `Error` on malformed input), `relativeLuminance`, and symmetric `contrastRatio` returning values in `[1, 21]`.
    - Export `AA_NORMAL = 4.5` and `AA_LARGE_UI = 3.0`; use no React, DOM, or network.
    - _Requirements: 10.5_

  - [x] 4.2 Write the contrast property-based test (Property 3)
    - Create `src/ui/a11y/contrast.property.test.ts` using fast-check (min 100 inputs).
    - Assert known reference ratios within tolerance (black/white = 21:1, color vs itself = 1:1), symmetry `contrastRatio(a,b) === contrastRatio(b,a)`, and bounds `[1, 21]` for generated colors; include the malformed-input error condition.
    - **Property 3: The contrast function matches known reference ratios (verify, do not assume)**
    - **Validates: Requirements 10.5**
    - _Requirements: 10.5_

  - [x] 4.3 Write the contrast table-driven example tests (Properties 4 and 5)
    - Create `src/ui/a11y/contrast.example.test.ts` iterating the fixed token/background tables.
    - Property 4: every normal-text token `{ bone, ember, ghost, blood-text }` on both `{ ink, fog }` backgrounds clears 4.5:1 (the 4×2 grid).
    - Property 5: `blood` on both `{ ink, fog }` backgrounds clears 3.0:1 only.
    - **Property 4: All normal-text tokens meet AA on both backgrounds**
    - **Validates: Requirements 10.2, 10.4, 10.5**
    - **Property 5: Blood meets only the large-text/UI threshold**
    - **Validates: Requirements 10.4**
    - _Requirements: 10.2, 10.4, 10.5_

- [x] 5. Implement the pure theme reducer and its test
  - [x] 5.1 Implement `src/ui/theme.ts`
    - Define `type Theme = 'dark' | 'lights-on'`; implement pure `nextTheme(current)` and `isLightsOn(theme)`; no DOM, no network.
    - _Requirements: 9.5_

  - [x] 5.2 Write the theme table-driven example test (Property 2)
    - Create `src/ui/theme.example.test.ts` iterating both `Theme` values.
    - Assert `nextTheme(t)` differs from `t` and `nextTheme(nextTheme(t)) === t` (involution).
    - **Property 2: The Lights-On toggle transition is an involution**
    - **Validates: Requirements 9.5**
    - _Requirements: 9.5_

- [ ] 6. Build the token stylesheet, landing screen, and app entry, with the component test
  - [x] 6.1 Author `src/styles/tokens.css` design tokens and theme/motion blocks
    - Define CSS variables: `--ink #0B0B14`, `--fog #1B1B2E`, `--bone #E8E2D0`, `--ember #FF7A1A`, `--ghost #7FE3D0`, `--blood #C0392B`, `--blood-text #FF6B5B`.
    - Add the default `--surface-bg`/`--surface-text` (ink/bone) and the `[data-theme='lights-on']` swap block (bone/ink).
    - Add a `@media (prefers-reduced-motion: reduce)` block that disables non-essential motion.
    - _Requirements: 9.2, 9.3, 10.1, 10.4_

  - [ ] 6.2 Implement `src/ui/LandingScreen.tsx`, `src/App.tsx`, and `src/main.tsx`
    - `LandingScreen` returns a `ReactElement`, displays the heading "Ledger Mortis", applies ink background / bone text via the token variables.
    - Render the Lights-On toggle as a real `<button>` with `aria-pressed` reflecting state, a visible text label, a visible focus indicator, and keyboard operability; on activation call `nextTheme` and write the result to `data-theme` on `document.documentElement`.
    - Wire `App.tsx` to render `LandingScreen` and `main.tsx` to mount `App` and import `tokens.css`.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4_

  - [ ] 6.3 Write the React Testing Library component test
    - Create `src/ui/LandingScreen.test.tsx` importing `describe`/`it`/`expect` from `vitest`.
    - Assert the text "Ledger Mortis" is present; assert the toggle is a `button` with an accessible name and initial `aria-pressed="false"`.
    - Activate the toggle (click and keyboard) and assert `aria-pressed` flips `false → true → false`; assert activation updates `data-theme` on `document.documentElement`.
    - _Requirements: 9.1, 9.7, 9.8, 10.3_

- [ ] 7. Write the README skeleton and the repo-conformance test
  - [ ] 7.1 Write the README skeleton
    - Update the root `README.md` with: a section on what Ledger Mortis is; a "how to run" section covering the `dev`/`build`/`test`/`lint`/`format` scripts; a project-structure section; a privacy statement that user transaction data never leaves the browser.
    - Document the Node engine version matching `package.json` (`^22.12.0 || ^24.0.0 || >=26.0.0`) and the integer-minor-units-with-explicit-currency money convention.
    - Add a "Disclosures" section stating the project was newly created during the submission period, listing the starter template and libraries used, and stating that no pre-existing code is included.
    - _Requirements: 2.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ] 7.2 Write the repo-conformance test that reads files from disk
    - Create `tests/repo-conformance.test.ts` starting with the directive comment `// @vitest-environment node`; read files from disk and assert the following.
    - `index.html` has `lang="en"`, a viewport meta tag, the title "Ledger Mortis", and NO external `<script>` tags.
    - `tokens.css` declares all seven tokens with the exact hex values from the design (`ink #0B0B14`, `fog #1B1B2E`, `bone #E8E2D0`, `ember #FF7A1A`, `ghost #7FE3D0`, `blood #C0392B`, `blood-text #FF6B5B`), contains the `[data-theme='lights-on']` block, and a `prefers-reduced-motion` block.
    - `README.md` contains the required sections including Disclosures, the Node engine range, and the integer-minor-units convention.
    - `package.json` has all five scripts (`dev`/`build`/`test`/`lint`/`format`) and the `engines` field.
    - Each of the eight folders contains a `.gitkeep`.
    - `.gitignore` ignores `node_modules` and `dist` and has no entry that ignores `.kiro`.
    - Import `describe`/`it`/`expect` from `vitest`.
    - _Requirements: 1.5, 1.6, 2.3, 2.4, 2.5, 3.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 9.2, 9.6, 10.1, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ] 8. Final verification — run the gates and asset-preservation checks
  - Run `npm run lint` (expect zero errors and zero warnings), `npm test` (expect all tests passing, including Properties 1–5, the ESLint purity test, and the repo-conformance test `tests/repo-conformance.test.ts` which runs as part of `npm test`), and `npm run build` (expect a static build with zero errors); report results, including the conformance test result.
  - Confirm the folder layout: all eight named folders exist, each with a `.gitkeep`, and no parser/analysis/graveyard/import/exorcism implementation files exist.
  - Confirm the `.gitignore` edit is append-only, never ignores `.kiro/`, and ignores `node_modules` and the build output directory.
  - Confirm the LICENSE file and `.kiro/steering` are byte-unchanged.
  - _Requirements: 1.1, 1.2, 1.3, 4.4, 6.3, 6.4, 12.1, 12.2, 12.3, 12.4, 13.1, 13.2_

## Notes

- No task is marked optional: every test (the ESLint Node-API purity test, the property-based tests for Properties 1 and 3, the table-driven example tests for Properties 2, 4, and 5, and the RTL component test) is a required task.
- Each task references the specific requirement clauses it satisfies for traceability; Requirements 1 through 13 are all covered.
- Property 1 is wired in with the scaffold (task 1.6) so the fast-check toolchain is proven end to end as early as possible.
- The folders for parsers, analysis, graveyard, import, and exorcism are created empty with `.gitkeep` only; no Module 1+ code is written.
- Req 12.4 (`npm run dev` serves the landing screen) is validated by the build/component-test gates plus the working Vite dev configuration; no manual run step is scripted.
- Until task 3.1 exists, npm run lint has no ESLint config; until task 6.2 exists, npm run build has no entry file. Both commands are first required to pass at those tasks. Do not pull later-task work forward to make them pass earlier.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5", "1.6", "2", "4.1", "5.1"] },
    { "id": 3, "tasks": ["3.1", "4.2", "4.3", "5.2", "6.1"] },
    { "id": 4, "tasks": ["3.2", "6.2"] },
    { "id": 5, "tasks": ["6.3", "7.1"] },
    { "id": 6, "tasks": ["7.2"] },
    { "id": 7, "tasks": ["8"] }
  ]
}
```
