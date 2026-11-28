\# Claude guide: deferred items (Claude reads this first in every chat)

Rule: no task skipped. Replies short. When an item is done, tick it and tell Derrick the line to change.

\## Before Module 1 merges

\- \[ ] Task 9 also covers Req 10.8, 10.9, 11.15 (importText tests).

\- \[ ] Decide: SMS cost with 3+ decimals ("Ksh5.123") should be "Invalid transaction cost" (Req 14.6). Fix with a small Kiro prompt.

\- \[ ] Task 11 (P2 properties) is NOT skipped.

\- \[ ] Task 12 README: mention hooks, parsing.md, spec 01-parsers; keep words "integer" and "minor units"; no brands; list new files in the structure block (conformance test parses it).

\- \[ ] Task 13: run the coverage script; add "Req 20.1/20.4/20.13" tags where missing; check 18.5, 18.12, 18.13 by inspection.

\- \[ ] Notes for write-up: mutants that survived (money line 166 and line 126) are equivalent.

\- \[ ] PR module/1-parsers: fill the PR template, wait for green CI, merge commit.

\- \[ ] After merge: change the status-doc raw link from module/1-parsers to main.

\## Vertical slice (next spec)

\- \[ ] Analysis (recurring charges, totals, budget fog), graveyard SVG screen, Banish with yearly savings, Lights-On table view, import screen with "Try sample data".

\- \[ ] Design, from Kiro's UX judge: "Scare me, then make it easy." Add mischief: a ghost guide with short funny microcopy, funny empty/error states, always clear next action.

\- \[ ] Every visual element carries data; text equivalent for each; keyboard use; reduced motion.

\- \[ ] Death Certificate export with exact amounts hidden.

\## Kiro write-up (judges check this, Stage 1 pass/fail)

\- \[ ] docs/KIRO\_USAGE.md: specs, steering, hooks (command and agent), PBT, mutation checks, spec vs plain chat, CI.

\- \[ ] Features not yet used: custom agent, MCP, powers, Kiro Web, Kiro CLI. Try only the ones that truly help; one small honest session each; note what differed.

\- \[ ] Correct the hook wording: file-save hooks fire only on agent edits.

\- \[ ] Name Kiro features in the Devpost description and add Kiro to "Built With".

\## Submission checklist

\- \[ ] Deploy static site (free, public until 29 Jan 2027). GitHub Pages needs the Vite base setting.

\- \[ ] npm audit --omit=dev (last: 0). Check repo for API keys (none expected).

\- \[ ] Demo video <3 min, public YouTube, no music, no trademarks. Working app in first 10-15 s, start logged in (no login exists), no live typing, jump cuts, on-screen text. Show a spec, a hook and steering docs on screen. One strong example.

\- \[ ] 30-second test: a stranger understands what, who for, why from the Devpost description.

\- \[ ] Blog post (says it is for Kiroween 2026) and social post (starts with #KiroweenHackathon26, own words, account matches Devpost).

\- \[ ] Ask Derrick: registered for Kiroween 2025 (tick Ghost prize)? Founder of a startup (Startup prize)? Student prize likely not applicable (graduated).

\- \[ ] README Disclosures accurate; no pre-existing code.

\- \[ ] Tag v1.0-submission, then stop pushing to main.
