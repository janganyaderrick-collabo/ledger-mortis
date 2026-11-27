\# Ledger Mortis: project status

Living document. After each commit, tick the box by hand and update the Snapshot lines. Keep it short.

\## Snapshot

\- Updated: 27 Nov 2026. Branch: module/1-parsers. Last commit: 2ff42b2. Tests passing: 398.

\- Goal: Kiroween 2026 hackathon, Costume Contest category.

\- Deadline: 4 Dec 2026, 2:00 PM PT (5 Dec, 01:00 EAT). Aim to submit on 3 Dec.

\- Repo: janganyaderrick-collabo/ledger-mortis (public, MIT). Local folder: C:\\Users\\ADMIN\\ledger-mortis.

\- Kiro credits: 313 of 4000 used on 26 Nov. The chat allowance is the limited resource, so keep replies and pastes short.

\- Next action: run task 4 of Module 1 with the standard prompt below (after the owner approves).

\## Product idea

\- Paste transactions, then see a graveyard: tombstone size is the amount, ghosts are recurring charges, fog is budget used.

\- Banish a ghost and see the yearly savings. Lights-On mode shows the same data as a plain, accessible view.

\- Data never leaves the browser. No backend, no analytics, no network calls.

\## Rules that never change

\- src/core is pure TypeScript. Lint bans React, DOM, network, Math.random, Date, crypto, performance and parseFloat there. Network APIs are banned in all of src.

\- Money is signed integer minor units plus a currency code. Parsers never throw on user text. Details: .kiro/steering/parsing.md.

\- Never ignore .kiro in .gitignore. Run Prettier only on explicit paths, never with a dot. The .kiro folder is in .prettierignore.

\- Line endings are LF (.gitattributes). A push sometimes needs one retry (SSL eof). Pull requests merge with "Create a merge commit".

\- No third-party trademarks or copyrighted music in the demo video. Sample data is fictional.

\- Do not trust an agent report alone: check the files and the command output.

\## Done

\- \[x] Module 0 foundation merged (PR 1): landing screen, Lights-On toggle, design tokens, contrast functions, theme reducer, README, conformance and lint-purity tests.

\- \[x] CI workflow, PR template, actions v6 (PRs 2 to 4). CI is green.

\- \[x] Module 1 steering (parsing.md), requirements, design and task list approved. Two Kiro hooks created.

\- \[x] Module 1 task 1: lint enforcement.

\- \[x] Module 1 task 2: model types, issues and char helpers.

\## Module 1 tasks (.kiro/specs/01-parsers/tasks.md)

\- \[x] 1. Lint enforcement

\- \[x] 2. Model foundation: types, issues, chars

\- \[x] 3. money.ts and P1 properties. Mutation check on the Amount\_Grammar (bring it to Claude)

\- \[ ] 4. calendar.ts and P1 properties

\- \[ ] 5. masking.ts and ids.ts

\- \[ ] 6. csv-reader.ts. Mutation check on the CSV tokenizer (bring it to Claude)

\- \[ ] 7. csv-parser.ts

\- \[ ] 8. sms-parser.ts. Mutation check on the SMS parser (bring it to Claude)

\- \[ ] 9. detect.ts, import-text.ts, barrel index.ts

\- \[ ] 10. src/samples (fictional CSV and SMS samples)

\- \[ ] 11. Remaining P2 properties (first to drop if time runs short)

\- \[ ] 12. README updates (Requirement 21) and the hooks mention

\- \[ ] 13. Final verification (docs/PROJECT\_STATUS.md is an allowed extra file in the scope check)

\- \[ ] Open the PR module/1-parsers into main, wait for green CI, merge

\## After Module 1

\- \[ ] Spec 02, one vertical slice: analysis (recurring charges, totals, budget fog), graveyard screen (SVG), banish action with yearly savings, Lights-On table view. Same process: steering, requirements, design, coarse tasks.

\- \[ ] Deploy as a static site. Free and public until 29 Jan 2027. GitHub Pages needs the Vite base setting.

\- \[ ] Demo video under 3 minutes, public on YouTube, working end to end on the sample data.

\- \[ ] Kiro usage write-up (docs/KIRO\_USAGE.md) and the Devpost form: category, repo URL, app URL, video, description.

\- \[ ] Bonus posts: blog post that says it is for Kiroween 2026, social post that starts with #KiroweenHackathon26.

\- \[ ] Tag v1.0-submission and stop pushing to main.

\## Targets (adjust as needed)

\- 29 Nov: Module 1 merged.

\- 1 Dec: vertical slice working.

\- 2 Dec: deployed and polished.

\- 3 Dec: video, write-up, submit.

\## Standard Kiro task prompt

Replace N with the task number. Send it to the Kiro Spec chat, Autopilot off.

```

Run task N only from .kiro/specs/01-parsers/tasks.md, then stop. Do not start another task.

Follow the task's bullets, requirements.md, design.md and .kiro/steering/parsing.md. Create or edit only the files the task names, plus the progress tick. Never edit eslint.config.js, package.json, tsconfig files, vite.config.ts, README.md, tests/\*, or anything under .kiro/steering unless the task names it.

Every test title or adjacent comment names the criteria it covers as "Req N.M" (Requirement 22.2). Property tests also carry "// Feature: 01-parsers, Property n: ..." and run at least 100 cases. Avoid Math.random, Date, crypto, performance, parseFloat and Number.parseFloat in all files, including testkits.

Commands you may run, once each: npx prettier --write (the files of this task, explicit paths only); npx prettier --check .; npm test; npx tsc -b; npm run lint. No installs, no git commands that change state, no dev server. If a command fails, fix only this task's files and re-run once; if it still fails, STOP and report the exact output. Never weaken a test or a rule to make it pass.

Report in at most 20 lines: files created or modified; deviations from the task or design; the final lines of npm test (with the count), tsc, lint and prettier; open issues.

```

After Kiro finishes: click Accept, run powershell -ExecutionPolicy Bypass -File C:\\Users\\ADMIN\\verify.ps1, check that git status lists only the files of the task, tick the box above, then commit with git add src .kiro docs and a message such as feat(core): task N, short title.

\## Decisions log

\- Amounts are signed: negative is money out. Currency defaults to USD for CSV and is KES for the SMS format.

\- Digit groups of 7 or more digits are masked as \[number]. A phone number after a name is dropped.

\- A bad line becomes an issue and the rest still parses. Ids are deterministic (FNV-1a hash plus an occurrence counter).

\- Fees in SMS messages become separate transactions. Format detection checks a CSV header first, then SMS.

\- Mutation checks only for the Amount\_Grammar, the CSV tokenizer and the SMS parser.

\## Watch list

\- \[ ] README "Built with Kiro" must mention the hooks and parsing.md (Requirement 21.9).

\- \[ ] Before submitting, run npm audit --omit=dev. Last result: 0 vulnerabilities. Nine moderate findings are in dev tools only.

\- \[ ] blood on fog contrast is 3.11, so blood is for fills and large text only. Red text uses blood-text.

\- \[ ] Hooks: file-save hooks only fire on edits made by the agent, not on manual saves.

\- \[ ] Each pull request fills in the PR template.

\## Notes for the Kiro write-up

\- Used: steering documents, specs (requirements, design, tasks) for two modules, property-based tests, two hooks (a command hook and an agent hook), CI, spec versus plain chat (the CI change was a plain-chat task).

\- Mutation experiments caught real gaps: dropping EventSource from a lint rule passed all tests until the tests were tightened; nudging luminance weights was caught only after adding reference ratios.

\- The "unrequested changes" line in every agent report caught problems early: a requirements revision that never saved, and a Req-number collision found by the coverage hook.

\- The coverage hook found that old purity tests used tags that clashed with new requirement numbers.

\- Mutation check on the Amount\_Grammar (task 3): 5 mutants, 3 caught, 2 survived as equivalent mutants. One accepted a point for a zero-exponent currency (that guard is redundant with the decimal-count check). One kept adding digits after the too-large flag was set (the flag is never reset, so the result is the same). No test gap.

\## Resume in a new chat

Send the raw link to this file and the word continue. Link while on the module branch:

https://raw.githubusercontent.com/janganyaderrick-collabo/ledger-mortis/refs/heads/module/1-parsers/docs/PROJECT\_STATUS.md

After the Module 1 merge, replace module/1-parsers with main in that link.
