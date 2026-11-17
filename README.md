# Ledger Mortis

Paste your transactions. Summon the ghosts of your money. Banish the ones that haunt you.

## What it is

Ledger Mortis is a browser app for seeing where your money goes, built for the Kiroween 2026 hackathon, Costume Contest category. This repository currently contains the Module 0 foundation: the project scaffold, tooling, design tokens, and an accessible landing screen with a Lights-On toggle. Status: the graveyard, import and banishing features are planned for later modules and do not exist yet.

## Privacy

User transaction data never leaves the browser. There is no backend, no analytics and no third-party script. This is enforced mechanically by lint rules and tests: no network APIs are allowed anywhere in `src`, and `src/core` may not import React or touch the DOM.

## Requirements

- Node.js ^22.12.0 || ^24.0.0 || >=26.0.0
- npm

## How to run

```sh
npm install     # install dependencies
npm run dev     # start the dev server; it prints a local address to open in a browser
npm run build   # type-check and build the static site
npm test        # run the test suite once
npm run lint    # run ESLint with zero warnings allowed
npm run format  # format the repository with Prettier
```

## Project structure

```text
index.html                     HTML entry point
package.json                   scripts, dependencies, Node engines
tsconfig.json                  TypeScript project references
tsconfig.app.json              TypeScript config for the app
tsconfig.node.json             TypeScript config for tooling files
vite.config.ts                 Vite and Vitest config
vitest.setup.ts                test setup
eslint.config.js               lint rules, including the privacy and purity boundaries
src/
  main.tsx                     app entry point
  App.tsx                      root component
  vite-env.d.ts                Vite type declarations
  styles/
    tokens.css                 design tokens, Lights-On theme, reduced-motion rule
  core/
    model/                     empty, reserved for a later module
    parsers/                   empty, reserved for a later module
    analysis/                  empty, reserved for a later module
    placeholder.property.test.ts   placeholder property-based test
  ui/
    graveyard/                 empty, reserved for a later module
    exorcism/                  empty, reserved for a later module
    import/                    empty, reserved for a later module
    a11y/
      contrast.ts              WCAG contrast calculation
      contrast.example.test.ts     example tests for contrast
      contrast.property.test.ts    property-based tests for contrast
    LandingScreen.tsx          landing screen with the Lights-On toggle
    LandingScreen.css          landing screen styles
    LandingScreen.test.tsx     landing screen tests
    theme.ts                   theme helpers
    theme.example.test.ts      theme tests
  samples/                     empty, reserved for a later module
tests/
  eslint-purity.test.ts        tests that enforce the lint boundaries
  repo-conformance.test.ts     tests that check the repository against the spec
.kiro/
  steering/                    project rules (tech, product, privacy, design language)
  specs/                       module specs
```

## Design tokens

| Token        | Value     | Role                                          |
| ------------ | --------- | --------------------------------------------- |
| `ink`        | `#0b0b14` | background                                    |
| `fog`        | `#1b1b2e` | surfaces                                      |
| `bone`       | `#e8e2d0` | text                                          |
| `ember`      | `#ff7a1a` | accent and warnings                           |
| `ghost`      | `#7fe3d0` | recurring charges                             |
| `blood`      | `#c0392b` | debt and overspend (fills, borders, graphics) |
| `blood-text` | `#ff6b5b` | red for normal-size text                      |

`blood` is for fills, borders, graphics and large text only; `blood-text` is for normal-size red text; normal-text pairs are verified at WCAG AA (4.5:1) by tests.

## Money convention

Money is stored as an integer number of minor units (for example cents) together with an explicit currency code, never as a floating-point number. No money type exists yet; this is the rule every later module follows.

## Built with Kiro

- Steering documents in `.kiro/steering` define the tech standards, product, privacy rules and design language.
- A spec in `.kiro/specs/00-foundation` holds the requirements, design and tasks for the foundation module.
- Property-based tests use fast-check.
- A test suite enforces the lint boundary (no network APIs in `src`, no React or DOM in `src/core`).

## Disclosures

- This project was newly created during the Kiroween 2026 submission period (starting 30 October 2026).
- It uses these starter tools and libraries: Vite, React, TypeScript, Vitest, fast-check, React Testing Library, ESLint, Prettier.
- No pre-existing code from other projects is included.

## License

MIT. See the [LICENSE](LICENSE) file.
