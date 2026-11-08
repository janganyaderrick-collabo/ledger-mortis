# Tech standards
- React + Vite + TypeScript (strict mode). Static build only.
- src/core is pure TypeScript: no React, no DOM, no network.
- Money is stored as integer minor units, never floats. Currency is explicit.
- Every parser and analysis function has property-based tests (fast-check) plus a few example tests.
- Small modules, named exports, no `any`, no dead code. Each module ships with its own spec in .kiro/specs.
- Do not modify files outside the current module's scope.
