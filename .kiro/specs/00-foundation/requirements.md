# Requirements Document

## Introduction

Ledger Mortis is a client-side-only React + Vite + TypeScript application that lets users paste transactions and visualize where their money goes through a "moonlit graveyard" metaphor. This specification covers Module 0: Foundation only. The Foundation module establishes the project scaffold, folder layout, tooling (testing, linting, formatting), a minimal landing screen built from the design tokens, and a skeleton README. It deliberately excludes all later-module behavior such as parsing, analysis, graveyard visuals, import, and exorcism.

The Foundation module must preserve the existing repository assets (LICENSE, `.kiro/`, and the existing `.gitignore`), enforce the architectural boundaries defined in the steering documents, and prove that the property-based testing toolchain runs. Completion is verified when the lint, test, and build scripts all pass, the development server renders the landing screen, and the folder layout matches the steering documents.

## Glossary

- **Foundation_Module**: The Module 0 scope defined by this specification, comprising scaffold, folder layout, tooling, landing screen, and README.
- **Scaffold**: The Vite + React + TypeScript project base, including `package.json`, TypeScript configuration, Vite configuration, and entry files, located in the repository root.
- **Repo_Root**: The repository root directory `ledger-mortis` that already contains LICENSE, README.md, `.gitignore`, and `.kiro/`.
- **Steering_Docs**: The existing steering documents located in the `.kiro/steering` directory.
- **Core_Layer**: The `src/core` directory tree, a pure TypeScript layer containing `model`, `parsers`, and `analysis` subfolders, with no React, no DOM, and no network access.
- **UI_Layer**: The `src/ui` directory tree containing `graveyard`, `exorcism`, `import`, and `a11y` subfolders.
- **Samples_Folder**: The `src/samples` directory intended for fictional sample data.
- **Folder_Layout**: The complete set of directories `src/core/{model,parsers,analysis}`, `src/ui/{graveyard,exorcism,import,a11y}`, and `src/samples`.
- **Test_Runner**: Vitest, configured to execute unit and property-based tests.
- **Property_Testing_Library**: fast-check, used to express property-based tests.
- **Component_Test_Library**: React Testing Library, used to render and assert on React components in tests.
- **Linter**: ESLint, configured for TypeScript and React, including rules that forbid React imports, DOM globals, and network globals within `src/core`, and rules that forbid network APIs across all of `src`.
- **Formatter**: Prettier, configured to format source files.
- **Placeholder_Property_Test**: A single property-based test located under `src/core` that proves fast-check executes successfully.
- **Landing_Screen**: The minimal "Ledger Mortis" screen rendered by the app, styled with the design tokens as CSS variables and containing a Lights-On toggle stub.
- **Design_Tokens**: The CSS variables ink (#0B0B14, background), fog (#1B1B2E, surfaces), bone (#E8E2D0, text), ember (#FF7A1A, accent), ghost (#7FE3D0, recurring charges), blood (#C0392B, debt/overspend), and blood-text (#FF6B5B, normal-size red text).
- **Lights_On_Toggle**: A stub control on the Landing_Screen representing the future Lights-On plain-data mode.
- **Root_Element**: The root HTML element of the document that carries the `data-theme` attribute toggled by the Lights_On_Toggle.
- **Component_Test**: A React Testing Library test that renders the Landing_Screen and asserts on its content and behavior.
- **Dev_Script**: The `dev` npm script that starts the Vite development server.
- **Build_Script**: The `build` npm script that produces a static production build, including a TypeScript type-check.
- **Type_Check**: The TypeScript type-checking step executed as part of the Build_Script.
- **Test_Script**: The `test` npm script that runs the Test_Runner once (non-watch).
- **Lint_Script**: The `lint` npm script that runs the Linter.
- **Format_Script**: The `format` npm script that runs the Formatter.
- **README_File**: The repository root `README.md` describing what the app is, how to run it, the project structure, and the privacy statement.
- **WCAG_AA_Contrast**: The WCAG 2.1 AA contrast threshold of at least 4.5:1 for normal text and at least 3:1 for large text and user-interface components.
- **Node_Engine**: The supported Node.js version declared in the `engines` field of `package.json` and documented in the README_File.

## Requirements

### Requirement 1: Preserve Existing Repository Assets

**User Story:** As a project maintainer, I want the existing repository assets preserved during scaffolding, so that licensing, specs, and ignore rules are not lost.

#### Acceptance Criteria

1. THE Foundation_Module SHALL retain the existing LICENSE file in the Repo_Root unchanged.
2. THE Foundation_Module SHALL preserve the existing Steering_Docs in the `.kiro/steering` directory unchanged.
3. THE Foundation_Module SHALL permit adding the `.kiro/specs` and `.kiro/hooks` directories.
4. WHEN the Foundation_Module modifies the existing `.gitignore` file, THE Foundation_Module SHALL only append entries and SHALL preserve all existing entries.
5. THE Foundation_Module SHALL exclude any entry that ignores the `.kiro/` directory from the `.gitignore` file.
6. THE Foundation_Module SHALL add entries to the `.gitignore` file that ignore the `node_modules` directory and the build output directory.

### Requirement 2: Scaffold the Vite React TypeScript Project

**User Story:** As a developer, I want a Vite + React + TypeScript scaffold in the repo root, so that I can build the application on a standard client-side stack.

#### Acceptance Criteria

1. THE Scaffold SHALL place the project `package.json`, TypeScript configuration, and Vite configuration in the Repo_Root.
2. THE Scaffold SHALL configure TypeScript with strict mode enabled.
3. THE Scaffold SHALL produce a static build with no server-side runtime component.
4. THE Scaffold SHALL configure the build to use self-hosted assets with no third-party script references.
5. WHERE a value represents money, THE Scaffold SHALL document the convention that money is stored as integer minor units with an explicit currency.

### Requirement 3: Create the Folder Layout

**User Story:** As a developer, I want the standard folder layout created, so that later modules have defined locations for their code.

#### Acceptance Criteria

1. THE Folder_Layout SHALL include the directories `src/core/model`, `src/core/parsers`, and `src/core/analysis`.
2. THE Folder_Layout SHALL include the directories `src/ui/graveyard`, `src/ui/exorcism`, `src/ui/import`, and `src/ui/a11y`.
3. THE Folder_Layout SHALL include the directory `src/samples`.
4. THE Foundation_Module SHALL place a `.gitkeep` file in every folder of the Folder_Layout so that git tracks each directory.

### Requirement 4: Enforce the Core Layer Purity Boundary

**User Story:** As a developer, I want the core layer to stay pure TypeScript, so that business logic remains portable and testable without a browser.

#### Acceptance Criteria

1. WITHIN `src/core`, THE Linter SHALL forbid imports of `react` and `react-dom`.
2. WITHIN `src/core`, THE Linter SHALL forbid use of the DOM and network globals `window`, `document`, `localStorage`, `fetch`, `XMLHttpRequest`, `WebSocket`, and `navigator.sendBeacon`.
3. ACROSS all of `src`, THE Linter SHALL forbid use of the network APIs `fetch`, `XMLHttpRequest`, `WebSocket`, and `navigator.sendBeacon`.
4. WHEN any violation of the Core_Layer purity rules or the network API rules exists, THE Lint_Script SHALL fail.

### Requirement 5: Configure the Testing Toolchain

**User Story:** As a developer, I want Vitest, fast-check, and React Testing Library configured, so that I can write property-based and component tests.

#### Acceptance Criteria

1. THE Scaffold SHALL install and configure the Test_Runner to discover and execute test files.
2. THE Scaffold SHALL install the Property_Testing_Library for use in test files.
3. THE Scaffold SHALL install and configure the Component_Test_Library for rendering React components in tests.
4. WHEN the Test_Script is run, THE Test_Runner SHALL execute all discovered tests in a single non-watch run.

### Requirement 6: Configure Linting and Formatting

**User Story:** As a developer, I want ESLint and Prettier configured, so that code style is consistent and common errors are caught.

#### Acceptance Criteria

1. THE Scaffold SHALL install and configure the Linter for TypeScript and React source files.
2. THE Scaffold SHALL install and configure the Formatter for source files.
3. THE Lint_Script SHALL run the Linter with the `--max-warnings 0` option so that zero warnings are tolerated.
4. WHEN the Lint_Script is run against the Foundation_Module source files and any error or warning exists, THE Lint_Script SHALL fail.

### Requirement 7: Provide npm Scripts

**User Story:** As a developer, I want standard npm scripts, so that I can run, build, test, lint, and format the project with consistent commands.

#### Acceptance Criteria

1. THE Scaffold SHALL define the Dev_Script that starts the Vite development server.
2. THE Scaffold SHALL define the Build_Script that produces a static production build.
3. THE Build_Script SHALL include a TypeScript Type_Check as part of the build.
4. THE Scaffold SHALL define the Test_Script that runs the Test_Runner in a single non-watch run.
5. THE Scaffold SHALL define the Lint_Script that runs the Linter.
6. THE Scaffold SHALL define the Format_Script that runs the Formatter.
7. THE `package.json` SHALL declare the supported Node_Engine via the `engines` field.

### Requirement 8: Provide a Placeholder Property-Based Test

**User Story:** As a developer, I want a placeholder property-based test in the core layer, so that I have proof the fast-check toolchain runs end to end.

#### Acceptance Criteria

1. THE Placeholder_Property_Test SHALL reside within the `src/core` directory tree.
2. THE Placeholder_Property_Test SHALL express at least one property using the Property_Testing_Library.
3. WHEN the Test_Script is run, THE Test_Runner SHALL execute the Placeholder_Property_Test and report it as passing.

### Requirement 9: Render the Landing Screen

**User Story:** As a user, I want a minimal Ledger Mortis landing screen, so that I can confirm the application loads and see its visual identity.

#### Acceptance Criteria

1. WHEN the application loads in a browser, THE Landing_Screen SHALL display the text "Ledger Mortis".
2. THE Landing_Screen SHALL define the Design_Tokens as CSS variables with the values ink #0B0B14, fog #1B1B2E, bone #E8E2D0, ember #FF7A1A, ghost #7FE3D0, blood #C0392B, and blood-text #FF6B5B.
3. THE Landing_Screen SHALL apply ink as the background color and bone as the primary text color.
4. THE Landing_Screen SHALL render the Lights_On_Toggle as a `button` element that carries an `aria-pressed` attribute reflecting its current state, displays a visible text label, and presents a visible focus indicator.
5. WHEN the user activates the Lights_On_Toggle, THE Landing_Screen SHALL toggle a `data-theme` attribute on the Root_Element.
6. THE `index.html` SHALL set `lang="en"` on the html element, include a viewport meta tag, and set the document title to "Ledger Mortis".
7. WHEN a Component_Test renders the Landing_Screen, THE Landing_Screen SHALL present the text "Ledger Mortis".
8. WHEN a Component_Test activates the Lights_On_Toggle, THE Lights_On_Toggle SHALL flip the value of its `aria-pressed` attribute.

### Requirement 10: Respect Reduced Motion and Contrast Accessibility

**User Story:** As a user with accessibility needs, I want the landing screen to respect my motion and contrast preferences, so that the interface remains comfortable and readable.

#### Acceptance Criteria

1. WHILE the user's system requests reduced motion through the prefers-reduced-motion setting, THE Landing_Screen SHALL present content without non-essential motion.
2. THE Landing_Screen SHALL render bone text on ink and fog surfaces at a contrast ratio that meets WCAG_AA_Contrast.
3. THE Landing_Screen SHALL render the Lights_On_Toggle so that the control is operable with the keyboard.
4. THE Landing_Screen SHALL use blood #C0392B only for fills, borders, graphics, and large text, and SHALL use the blood-text token #FF6B5B for any normal-size red text.
5. THE Landing_Screen SHALL render every text-and-background Design_Tokens pair at a contrast ratio of at least 4.5:1 for normal text, verified on both the ink background and the fog background, and the implementation SHALL verify the contrast ratio it reports rather than assuming the contrast ratio.

### Requirement 11: Provide the README Skeleton

**User Story:** As a newcomer to the project, I want a README skeleton, so that I understand what the app is, how to run it, how it is structured, and how it handles privacy.

#### Acceptance Criteria

1. THE README_File SHALL include a section describing what Ledger Mortis is.
2. THE README_File SHALL include a section describing how to run the project using the npm scripts.
3. THE README_File SHALL include a section describing the project structure.
4. THE README_File SHALL include a privacy statement that user transaction data never leaves the browser.
5. THE README_File SHALL document the same Node_Engine version declared in the `engines` field of `package.json`.
6. THE README_File SHALL document that money is stored as integer minor units with an explicit currency.
7. THE README_File SHALL include a "Disclosures" section that states the project was newly created during the submission period, lists the starter template and libraries used, and states that no pre-existing code is included.

### Requirement 12: Pass the Completion Checks

**User Story:** As a project maintainer, I want all foundation checks to pass, so that the module is verifiably complete before later modules begin.

#### Acceptance Criteria

1. WHEN the Lint_Script is run, THE Foundation_Module SHALL complete the Linter run with zero errors and zero warnings.
2. WHEN the Test_Script is run, THE Foundation_Module SHALL complete the Test_Runner run with all tests passing.
3. WHEN the Build_Script is run, THE Foundation_Module SHALL complete the static build with zero errors.
4. WHEN the Dev_Script is run, THE Foundation_Module SHALL serve the Landing_Screen in a browser.

### Requirement 13: Limit Module 0 Scope

**User Story:** As a project maintainer, I want Module 0 limited to foundation scope, so that later-module behavior is deferred until its own specification.

#### Acceptance Criteria

1. THE Foundation_Module SHALL contain no parser, analysis, graveyard, import, or exorcism implementation code.
2. THE Foundation_Module SHALL be limited to the Scaffold, Folder_Layout, tooling, Landing_Screen, and README_File.
