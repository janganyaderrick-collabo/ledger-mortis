# Implementation Plan: Module 1 — Parsers

## Overview

This plan builds Module 1 in dependency order. It starts with the lint rules that keep `src/core` free of randomness, clocks and float parsing. Next come the model files (types, issues, chars, money, calendar, masking, ids), then the CSV reader and parser, the SMS parser, the format detector, `importText` and the barrel, then the two sample texts. After that come the remaining P2 property tests, the README updates and a final verification task. Tests sit next to their source files and use the file names of the design's File layout: one example test file per source file, plus at most one `.property.test.ts` file (only `money`, `calendar` and `masking` have one), and `.testkit.ts` helper files that only tests import and the barrel never exports. Every task is one prompt-sized unit of work. No analysis, UI, React or persistence code is created.

## Tasks

- [ ] 1. Lint enforcement of purity (eslint.config.js and tests/eslint-purity.test.ts)
  - Edit only `eslint.config.js` and `tests/eslint-purity.test.ts`. Keep every existing rule, block and test case unchanged.
  - In `eslint.config.js`, add a new block scoped to `files: ['src/core/**/*.{ts,tsx}']` that sets `no-restricted-properties` to `['error', { object: 'Math', property: 'random', message }, { object: 'Number', property: 'parseFloat', message }]`.
  - In the existing `src/core` block, restate the full `no-restricted-globals` list with 13 names: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` (from `networkGlobals`), `window`, `document`, `localStorage`, `sessionStorage`, `navigator`, and the four new names `Date`, `crypto`, `performance`, `parseFloat`. A later block replaces an earlier value of the same rule, so the whole list must be restated.
  - In `tests/eslint-purity.test.ts`, add six per-name cases in the existing `it.each` style, one per name `Math.random`, `Number.parseFloat`, `Date`, `crypto`, `performance`, `parseFloat`. Each lints a one-line snippet in the virtual path `src/core/x.ts` and asserts the rule id (`no-restricted-properties` for the first two, `no-restricted-globals` for the other four), severity 2, and that the message contains the forbidden name.
  - Add one case that lints a forbidden-name snippet in the virtual path `src/core/x.test.ts` and asserts an error, so test files are not exempt.
  - Add a negative-control case: `export const a = Math.imul(1, 2); export const b = Number.isSafeInteger(3);` in `src/core/x.ts` must give zero messages.
  - Add an effective-config case (next to the two existing ones) that reads the config for `src/core/x.ts` and asserts `no-restricted-globals` contains all 13 names and `no-restricted-properties` contains `Math.random` and `Number.parseFloat`.
  - Tag each test with Req N.M (Req 18.1 to 18.13 as listed below). Req 18.13 needs no test: it states that the linter is not relied on for `Number(text)`.
  - After the edit, `npm run lint` and `npm test` must still pass for the existing files.
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.10, 18.11, 18.12, 18.13, 19.7, 22.4_

- [ ] 2. Model foundation: types.ts, issues.ts and chars.ts with their example tests (src/core/model)
  - Create `src/core/model/types.ts` with the types of the design's Interfaces section: `Currency`, `Money`, `Source`, `Transaction`, `Issue`, `FormatId`, `ImportResult`, `DateOrder`, `ImportOptions`, `AmountFailureReason`, `ParseOutcome<T>`. Add one constant `FORMAT_LABELS` with the labels "CSV" for "csv" and "Mobile-money SMS" for "mobile-money-sms" (Req 7.7). The design names no home for the labels; keep them in `types.ts`.
  - Create `src/core/model/issues.ts` with the `ISSUES` constant: 14 literal strings and the function `wrongNumberOfFields(expected, found)`, giving exactly the 15 messages of Req 7.9.
  - Create `src/core/model/chars.ts` with `isAsciiDigit`, `isAsciiLetter`, `isAsciiUpperOrDigit`, `isWhitespaceCode`, `asciiLowerCode` and `startsWithKeywordAt`. Named exports, module-internal, no regular expressions. `isWhitespaceCode` covers exactly the set that `String.prototype.trim` removes.
  - Keep `src/core/model/.gitkeep` in place. Use no `any`, no enums and no brand name.
  - Write `chars.test.ts` (example tests): digit, letter and upper-or-digit boundaries, every whitespace code of the trim set including U+FEFF and U+00A0, ASCII-only case folding, `startsWithKeywordAt` hits and misses at the text edges.
  - Write `types.test.ts` (compile-time shape smoke checks and the two labels) and `issues.test.ts` (exactly 15 messages, each equal to the string in Req 7.9, and the text of `wrongNumberOfFields(3, 5)`).
  - Tag each test with Req N.M. Note: the design's Interfaces list names no exported `FORMAT_LABELS`; the barrel in task 9 does not re-export it.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.7, 7.8, 7.9, 19.1, 19.2, 19.4, 19.5, 19.6, 19.7_

- [ ] 3. money.ts with money.testkit.ts, money.test.ts and the P1 money properties
  - Create `src/core/model/money.ts` with `createMoney`, `addMoney`, `formatMoney`, `parseAmountText`, `currencyExponent` and `AMOUNT_LIMIT` (100_000_000_000), following Algorithm A: one left-to-right scan, `value = value * 10 + digit`, the `over` flag, no `BigInt`, no `parseFloat`, no `Number(...)` on decimal text. Syntax is checked in full before the size decision, so "invalid" wins over "too-large".
  - Create `src/core/model/money.testkit.ts`: a compositional Amount_Text generator (sign, code or symbol, digit body, decimal part) so that a mutation breaks exactly one axis, a bounded Money generator, and generators for single-rule mutations. Avoid `Math.random`, `Date`, `crypto`, `performance`, `parseFloat` and `Number.parseFloat` (task 1 lints test files and testkits).
  - Create `src/core/model/money.test.ts` (examples): the 13 worked examples of Algorithm A as 13 separate tests (`1,250.00`, `(500)`, `-0.00`, `.50`, `5.`, `1.234,56`, `+5`, `USD -5` with default KES, `$5 USD`, `JPY 1500.00`, the exact limit, limit plus one minor unit, 200 nines then `x`). Add at least one example per criterion of Requirements 1, 2 and 3, including `Object.is(minor, 0)` for negative zero, `formatMoney` of zero ("0.00" and "0"), and the decimal-comma case of Req 23.5. These examples keep the P2 criteria of Requirement 1 covered even if task 11 is dropped.
  - Create `src/core/model/money.property.test.ts` with these P1 properties, each with at least 100 runs and a comment `// Feature: 01-parsers, Property n: ...`:
    - P7 Amount_Grammar accept/reject table (Req 2.1 to 2.15, 2.21)
    - P8 The Amount_Limit boundary is exact (Req 2.16, 2.20)
    - P10 Amount parsing never throws (Req 2.19)
    - P11 Money formatting is round-trippable, sign-correct and bare, for both exponent values (Req 3.1 to 3.4, 20.2)
  - Tag each test with Req N.M.
  - _Requirements: 1, 2, 3, 20.1, 20.2, 20.3, 20.12, 20.13, 22.2, 22.3, 23.5_

- [ ] 4. calendar.ts with calendar.testkit.ts, calendar.test.ts and the P1 date and time properties
  - Create `src/core/model/calendar.ts` with `isLeapYear`, `isValidCalendarDate`, `parseIsoDate`, `parseSlashDate`, `parseDate`, `parseTime24`, `parseTime12` and `parseTime`, following Algorithm B. Use no `Date`, no time zones and no regular expressions; all results are `ParseOutcome` values with reason "invalid".
  - Create `src/core/model/calendar.testkit.ts`: the independent month-length and leap-year reference table (plain data, not derived from `Date`), generators for valid and malformed date and time texts.
  - Create `src/core/model/calendar.test.ts` (examples): leap years 1900 (no), 2000 (yes), 2024 (yes), 2100 (no); 29 February cases; year 0000 and 0001; "dmy" versus "mdy" on `5/11/26`; 2-digit and 4-digit years; the 12 AM, 12 PM, 1 PM and 11 PM conversions; separators, month names and layouts that must fail; two spaces before AM. Cover every criterion of Requirement 4, including Req 4.9 and Req 4.15 (the source has no `Date`, checked by lint).
  - Create `src/core/model/calendar.property.test.ts` with these P1 properties (at least 100 runs each):
    - P12 Calendar validity matches the reference table (Req 4.1, 4.2)
    - P13 ISO dates parse regardless of Date_Order, slash dates respect it (Req 4.3 to 4.6)
    - P14 Slash-date year rules (Req 4.7, 4.8)
    - P16 Time parsing and the 12-to-24-hour conversion table (Req 4.10 to 4.13)
    - P17 Date and time parsing never throw (Req 4.14)
  - Tag each test with Req N.M.
  - _Requirements: 4, 20.1, 20.4, 20.13_

- [ ] 5. masking.ts and ids.ts with their testkits, example tests and P1 properties
  - Create `src/core/model/masking.ts` with `MASK_TOKEN`, `maskText` and `buildExcerpt` (Algorithm C): one scan, single space or single hyphen joins digit runs, 7 or more digits become "[number]", mask first and then cut to 60 UTF-16 code units, one unit earlier when a surrogate pair would be split.
  - Create `src/core/model/ids.ts` with `fnv1a32Hex`, `buildHashInput` and `assignTransactionIds` (Algorithm D): hand-written UTF-8 encoder with U+FFFD for a lone surrogate, `Math.imul` and `>>> 0`, hex digits built from nibbles, ids "tx-" plus 8 hex digits, then "-n" from the second occurrence. The caller passes `String(minor)`, never `formatMoney`.
  - Create `src/core/model/masking.testkit.ts` (digit runs of controlled length joined by single spaces, single hyphens or non-joining separators) and `src/core/model/ids.testkit.ts` (an independent reference FNV-1a written with `TextEncoder`, a Hash_Input field-set generator). No forbidden names.
  - Create `src/core/model/masking.test.ts` (examples): the 8 worked examples of Algorithm C, date-like groups masked (Req 5.2), a group straddling character 60, a surrogate pair at the cut (59 characters). Create `src/core/model/ids.test.ts` (examples and the properties below, one file): vectors `""` = 811c9dc5, `"a"` = e40c292c, `"foobar"` = bf9cf968, UTF-8 vectors for `€`, U+1F600 and a lone U+D800, one known Hash_Input with its Base_Hash (Req 20.12), first, second and third occurrence ids (Req 6.4 to 6.7).
  - Create `src/core/model/masking.property.test.ts` with P18 and P19; add P20 and P21 to `ids.test.ts` (at least 100 runs each):
    - P18 Masking removes long digit groups and leaves short ones, idempotently (Req 5.1, 5.3, 5.4)
    - P19 Excerpts are masked before being cut to 60 characters (Req 5.7)
    - P20 Hash computation matches an independent reference and ignores excluded fields (Req 6.1 to 6.3)
    - P21 Id assignment is deterministic, ordered and collision-safe (Req 6.4 to 6.8; here at the level of `assignTransactionIds`)
  - Tag each test with Req N.M.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.9, 20.1, 20.12, 20.13_

- [ ] 6. csv-reader.ts with csv-reader.testkit.ts and example tests
  - Create `src/core/parsers/csv-reader.ts` with `CsvRecord` (fields, startLine, rawText), `CsvReadOutcome`, `chooseDelimiter` and `readCsv` (Algorithm E): LF, CRLF and a lone CR as an ordinary character, header line is the first non-blank line, delimiter by count outside quotes with the tie order comma, semicolon, tab, doubled quotes, delimiters and line breaks inside quotes, quote kept as a character in an unquoted field, blank lines skipped, the "Malformed quoted field" and "Unterminated quote" issues with `startLine` and `buildExcerpt(rawText)`. A bad quote in the header line gives a header with no fields (Decisions D5(a)); delimiters of a header cell that spans lines are counted on the first physical line (D5(b)).
  - Create `src/core/parsers/csv-reader.testkit.ts`: the Test_Only_Helper CSV writer (quotes a field exactly when it holds the delimiter, a quote or a line break; doubles inner quotes), malformed-record generators and line-break and blank-line mix generators. Task 7 reuses this file. No forbidden names.
  - Create `src/core/parsers/csv-reader.test.ts` (examples): every criterion of Req 9.1 to 9.11 at reader level (CRLF/LF mix, quoted delimiter, quoted line break, `""`, quote inside an unquoted field, text after a closing quote, unterminated quote consuming the rest, blank lines, BOM-free line numbers, excerpt of a multi-line record).
  - Also add one reader-level property in the same file (not one of the 58 numbered properties, so no "Property n" number): the writer then `readCsv` recovers the same fields and start lines for generated rows with any delimiter and quoting mix. It lets the mutation check on the tokenizer bite before task 7 exists. The numbered tokenizer properties P30, P31 and P33 need `parseCsv` and are in task 7.
  - Do not call `parseCsv` or `importText` in this task. Tag each test with Req N.M.
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 20.1, 20.13_

- [ ] 7. csv-parser.ts with example tests and the P1 CSV properties
  - Create `src/core/parsers/csv-parser.ts` with `parseCsv(text, defaultCurrency, dateOrder)` and `hasRecognisedCsvHeader(text)` (Algorithm E): column selection by trimmed, case-insensitive exact names, the amount column wins over debit and credit, "Unrecognised header" on the header line, the private `parseDateCell` (Algorithm B), amount, debit and credit cells through `parseAmountText` with `defaultCurrency`, the issue order of Decisions D5(c) (amount error before "Currency mismatch"), masked and trimmed `description`, `source` "csv", no counterparty or reference. Ids are assigned inside `parseCsv` as its last step with `assignTransactionIds` (Decisions D1). Every issue message comes from `ISSUES`.
  - Create `src/core/parsers/csv-parser.test.ts` (examples and the properties below, one file). Examples cover every criterion of Requirements 10 and 11 and Req 9.12 and Req 9.7, 9.8, 9.10, 9.11 at parser level: header-only text, "time" column ignored, debit and credit with both or neither filled, signs in debit or credit, "Currency mismatch", "Amount too large", "Missing description", trailing "Z" in a date cell, seconds discarded, the 12-hour marker in a date cell, and a Record whose description is "ABCDEFGHIJ confirmed." that still parses as a normal row (Req 20.12). Descriptions are masked (Req 5.5).
  - Add these P1 properties (at least 100 runs each), reusing `csv-reader.testkit.ts`:
    - P30 CSV round trip preserves rows, order and totals (Req 11.1, 11.5 to 11.7, 11.11, 11.13, 16.6, 20.5, 20.11)
    - P31 CSV structural quirks round-trip correctly (Req 9.1, 9.2, 9.5, 9.9)
    - P33 Malformed and unterminated quotes are reported precisely (Req 9.7, 9.8)
    - P38 Date and amount cells follow the Calendar_Module and Amount_Grammar outcomes (Req 11.2 to 11.4, 11.10, 11.16)
  - Do not call `importText` in this task. Tag each test with Req N.M.
  - _Requirements: 5.5, 5.6, 9.2, 9.7, 9.8, 9.10, 9.11, 9.12, 10, 11, 16.6, 20.1, 20.5, 20.11, 20.12, 20.13_

- [ ] 8. sms-parser.ts with sms-parser.testkit.ts, the six example messages and the P1 SMS properties
  - Create `src/core/parsers/sms-parser.ts` with `parseSms(text)` and `hasMessageStart(text)` (Algorithm F): a hand-written Message_Start finder, whitespace-normalised message body for matching while line numbers come from offsets in the original text, the six kinds (paid to, sent to, received from, airtime, withdrawn from, reversal), Sms_Name cleanup in the order strip one ".", drop the Phone_Token with its one space, trim, then mask; Date_Marker read by layout, ranges checked with `parseSlashDate` and `parseTime12`; optional balance sentence; cost sentence creating a cost Transaction right after its parent when the amount is greater than zero; the issues "Unexpected text before first message", "Unrecognised message", "Invalid date", "Invalid amount", "Amount too large", "Invalid transaction cost". Currency KES, `reference` is the message's own Message_Code, `defaultCurrency` and `dateOrder` are not read. Ids are assigned inside `parseSms` as its last step (Decisions D1).
  - Create `src/core/parsers/sms-parser.testkit.ts`: the Test_Only_Helper SMS writer (one function per kind, with optional balance and cost sentences) and a separator-mix generator. No forbidden names.
  - Create `src/core/parsers/sms-parser.test.ts` (examples and the properties below, one file). Examples: the six fictional example messages of Req 13.15 parsed in one text to the eight amounts -125000, -50000, -500, 300000, -10000, -200000, -2900, 125000 in that order, with `reference`, `counterparty` and cost transactions checked (Req 20.12); at least one example per criterion of Requirements 12, 13 and 14 (for example "Agent 12 0711000222" becomes "Agent", a digit group glued to a name is masked, `31/2/26` and `13:00 PM` give "Invalid date", a 4-digit year gives "Unrecognised message", `Ksh5.123` gives "Unrecognised message", an empty name gives "Unrecognised message", a zero cost creates no transaction, a bad cost sentence gives "Invalid transaction cost").
  - Add these P1 properties (at least 100 runs each):
    - P41 SMS message round trip preserves messages across any separator mix (Req 12.1, 12.2, 13.1 to 13.6, 16.7, 20.6, 20.11)
    - P53 Sms_Amount extraction matches the Amount_Grammar under KES (Req 13.14, 13.16)
    - P55 Transaction cost sentences create a cost transaction exactly when positive (Req 14.3 to 14.5)
  - Do not call `importText` in this task. Tag each test with Req N.M.
  - _Requirements: 5.5, 5.6, 12, 13, 14, 16.7, 20.1, 20.6, 20.11, 20.12, 20.13_

- [ ] 9. detect.ts, import-text.ts, the barrel src/core/index.ts and index.test.ts, with the P1 Importer properties
  - Create `src/core/parsers/detect.ts` with `detectFormat(text)`: first a recognised CSV header (`hasRecognisedCsvHeader`), then `hasMessageStart`, otherwise "unknown"; empty or whitespace-only text gives "unknown".
  - Create `src/core/parsers/import-text.ts` with `importText(text, options)` (Algorithm G): validate the options first (Decisions D2: invalid options throw even for blank text), strip one leading U+FEFF, the "Empty input" result (line 1, empty excerpt, format "unknown") for blank text whatever the `format`, forced "csv" or "mobile-money-sms" skips detection, "auto" calls `detectFormat`, "Unrecognised text" for unknown non-empty text with the first non-blank line and its masked excerpt, `defaultCurrency` and `dateOrder` passed to the CSV parser only. It does not run the id pass again (Decisions D1).
  - Create `src/core/index.ts` (the barrel) with exactly the exports listed in the design's Interfaces section (types, `ISSUES`, the money, calendar, masking and id functions named there, `importText`, `detectFormat`). Export no helper, no testkit, no `chars.ts` function and no internal parser function.
  - Create `src/core/parsers/detect.test.ts` (examples and the P1 property below): every criterion of Req 15, including the CSV text with a Record whose description is "ABCDEFGHIJ confirmed." that returns "csv" (Req 15.7, 20.12), the header check winning over a Message_Start later in the text, and blank input.
  - Create `src/core/parsers/import-text.test.ts` (examples and the P1 properties below): defaults (Req 8.2 to 8.4), forced and auto routing, option errors, BOM, empty input, input order, no duplicate removal, `unknown` with "Unrecognised text", forced "csv" with an unrecognised header giving "Unrecognised header" (Req 10.8, 10.9). Tests in this file call `importText`; earlier tasks did not.
  - Create `src/core/index.test.ts` (examples): the barrel exports exactly the names of Req 21.1 and no Test_Only_Helper (Req 21.2). The numbered property P58 is in task 11.
  - Add these P1 properties (at least 100 runs each):
    - P57 Format detection follows its three-check order and never throws (Req 15.1 to 15.5)
    - P28 The Importer never throws and always returns a well-formed result (Req 16.1, 16.4, 16.5, 20.7)
    - P29 Importing the same text and options twice is deterministic (Req 16.2, 16.3, 20.8)
  - In the P28 test also assert, on the same generated runs: every `line` is an integer of at least 1 and every `excerpt` has at most 60 characters (Req 7.5, 7.6); ids are unique within one result, including inputs with repeated identical rows (Req 6.7, 20.9); and no `description`, `counterparty` or `excerpt` contains a Digit_Group of 7 or more digits, with a generator that uses spaces and hyphens as digit separators (Req 20.10, 5.5, 5.6). The design has no numbered property for Req 20.9 and 20.10; these assertions are the place for them.
  - Tag each test with Req N.M.
  - _Requirements: 5.5, 5.6, 6.7, 6.8, 7.5, 7.6, 8, 10.8, 10.9, 15, 16, 20.1, 20.7, 20.8, 20.9, 20.10, 20.12, 20.13, 21.1, 21.2_

- [ ] 10. src/samples: csv-sample.ts, sms-sample.ts and samples.test.ts
  - Create `src/samples/csv-sample.ts` exporting the string constant `CSV_SAMPLE`, and `src/samples/sms-sample.ts` exporting `SMS_SAMPLE`. Plain constants: no file loading, no network, no brand name, no real name, no real phone number (a message code is 10 uppercase letters or digits and a fictional person name carries no digit group of 7 or more digits).
  - The CSV sample has a recognised header (for example Date, Description, Amount), uses USD amounts, 30 to 40 rows, ISO dates over 80 to 100 days. The SMS sample uses the Message_Code layout of Req 13.15 with fictional codes, KES amounts, day-first `D/M/YY` dates, 30 to 40 Transactions including cost Transactions.
  - Each sample has three recurring monthly charges (identical description and amount in three consecutive months, for example Spectral Streaming, Gloom Gym, Moonlight Cloud Storage), irregular spending (for example Hollow Hill Grocers, Crypt Cafe, Raven Rides), one inflow that looks like a salary, and one refund or reversal.
  - Create `src/samples/samples.test.ts` (example tests): `importText(CSV_SAMPLE)` with `format` "auto" returns format "csv", zero issues, 30 to 40 Transactions, all in USD; `importText(SMS_SAMPLE)` returns "mobile-money-sms", zero issues, 30 to 40 Transactions, all in KES; each sample spans 80 to 100 days (compute day numbers with integer arithmetic, no `Date`); each sample has exactly the three recurring (description, amount) groups in three consecutive months; each has one refund or reversal and one salary-like inflow; the sample text has no digit group of 7 or more digits outside message codes; both exports are strings. Import `importText` from `../core/index.ts`.
  - Keep `src/samples/.gitkeep` in place. Tag each test with Req N.M.
  - _Requirements: 17_

- [ ] 11. All remaining P2 properties, one bullet per test file
  - This is the FIRST task to drop if time runs short. Dropping it leaves some criteria covered only by the example tests of tasks 3 to 9 (tasks 3 to 9 already contain an example for every criterion of their requirements). Each property below is added to the test file named in its bullet, with at least 100 runs and a comment `// Feature: 01-parsers, Property n: ...`. Tag each test with Req N.M.
  - `src/core/model/money.property.test.ts` (7 properties):
    - P1 Money construction rejects unsafe integers (Req 1.2)
    - P2 Money construction rejects malformed currency codes (Req 1.3)
    - P3 Currency exponent is 2 outside the zero-exponent set (Req 1.5, 1.6)
    - P4 Addition sums same-currency amounts and rejects mixed currencies (Req 1.7, 1.8)
    - P5 Addition is commutative, associative, with zero as identity, and rejects overflow (Req 1.9, 1.10)
    - P6 Any safe-integer minor is accepted by the constructor (Req 1.11)
    - P9 Signed zero normalises to positive zero (Req 2.17)
  - `src/core/model/calendar.property.test.ts` (1 property):
    - P15 Malformed date texts are rejected (Req 4.9)
  - `src/core/parsers/csv-reader.test.ts` (1 property):
    - P32 Delimiter selection follows frequency and the comma/semicolon/tab tie order (Req 9.3)
  - `src/core/parsers/csv-parser.test.ts` (5 properties):
    - P34 Issue line number and excerpt follow the documented construction (Req 9.10, 9.11, 5.7)
    - P35 Field-count mismatches are reported with the exact counts (Req 9.12, 11.14)
    - P36 Header column selection follows name matching and precedence rules (Req 10.1 to 10.6, 10.11)
    - P39 Debit/credit cells follow the exactly-one-filled rule (Req 11.6 to 11.9)
    - P40 Missing descriptions are reported and the row is skipped (Req 11.11, 11.12)
  - `src/core/parsers/sms-parser.test.ts` (13 properties):
    - P42 Text before the first Message_Start is reported precisely (Req 12.3)
    - P43 Internal whitespace runs do not affect parsed fields (Req 12.4)
    - P44 Issue line and excerpt for a message follow the documented rule (Req 12.5)
    - P45 One unrecognised message does not stop the others (Req 12.6, 14.7)
    - P46 Keyword matching is case-insensitive; names keep their written case (Req 12.7, 12.8)
    - P47 A Sms_Name containing " on " without a full Date_Marker is kept whole (Req 13.8)
    - P48 Name cleanup strips the trailing period, drops the Phone_Token, then trims (Req 13.9)
    - P49 An empty name after cleanup is unrecognised (Req 13.10)
    - P50 Fixed SMS fields are set correctly on every kind (Req 13.11)
    - P51 Sms_Date/Sms_Time conversion is dateOrder-independent and day-first (Req 13.12)
    - P52 Impossible Sms_Date or Sms_Time values are Invalid date, wrong layouts are unrecognised (Req 13.13, 12.6)
    - P54 Optional balance and cost sentences do not change the parent transaction (Req 14.1, 14.2)
    - P56 A malformed transaction-cost sentence is reported without losing the parent (Req 14.6)
  - `src/core/parsers/import-text.test.ts` (7 properties):
    - P22 Issue messages are always drawn from the fixed list (Req 7.9)
    - P23 Forced format skips detection; auto format matches the detector (Req 8.5, 8.6)
    - P24 Invalid Import_Options throw (Req 8.7 to 8.9)
    - P25 SMS parsing ignores defaultCurrency and dateOrder (Req 8.10)
    - P26 A leading byte-order mark never changes line numbers or content (Req 8.11)
    - P27 Whitespace-only input yields the single Empty-input issue (Req 8.12)
    - P37 An unrecognised or header-only CSV header behaves per the forced/auto rules (Req 10.7 to 10.10, 11.15, 15.6)
  - `src/core/index.test.ts` (1 property):
    - P58 Barrel exports contain the public API and no Test_Only_Helper (Req 21.1, 21.2)
  - _Requirements: 1.2, 1.3, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 2.17, 4.9, 5.7, 7.9, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 9.3, 9.10, 9.11, 9.12, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 11.6, 11.7, 11.8, 11.9, 11.11, 11.12, 11.14, 11.15, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 13.8, 13.9, 13.10, 13.11, 13.12, 13.13, 14.1, 14.2, 14.6, 14.7, 15.6, 20.1, 21.1, 21.2, 22.3_

- [ ] 12. README updates (Requirement 21) and the .kiro/hooks mention in "Built with Kiro"
  - Edit only `README.md`.
  - "Project structure" block: replace the three "empty, reserved for a later module" lines of `src/core/model/`, `src/core/parsers/` and `src/samples/` with nested entries for every file Module 1 adds (source files, testkits, test files), plus `src/core/index.ts` and `src/core/index.test.ts`, each with a short description. Leave the `analysis/` line unchanged. Never list `.gitkeep` files that the block does not already list. Optionally add a `hooks/` line under `.kiro/`.
  - `tests/repo-conformance.test.ts` parses this block: two spaces per level, folder names end in "/", the first word of each line is the name, and every listed path must exist. Check every path against the real tree before finishing. Do not edit that test.
  - "What it is": state that import parsing (Summon) exists and that the graveyard and banishing features do not (Req 21.7).
  - "Money convention": describe the `Money` type, the Currency_Exponent rule (0 for JPY, KRW, UGX and RWF, 2 otherwise) and the rule against floating-point numbers, and drop the sentence "No money type exists yet". The README must keep the words "integer" and "minor units".
  - Add a short section of known limits and usage: the digit-grouping limits of Req 5.2 (a single space or hyphen joins digit runs; two spaces, dots or slashes do not; date-like groups such as 2026-11-05 are masked), the Phone_Token limit of Req 13.9, the Amount_Limit of 100,000,000,000 minor units, the supported formats "CSV" and "Mobile-money SMS", the Import_Options with defaults (`format` "auto", `defaultCurrency` "USD", `dateOrder` "dmy"), the CSV header being the first non-blank line, and a debit and credit pair needing exactly one filled cell (Req 21.8, 21.13).
  - "Built with Kiro": name `.kiro/specs/01-parsers` and the steering file `parsing.md`, and list both hook files by name, `core-tests-on-save.json` and `requirement-coverage-after-task.json`, with one line each describing what they do (Req 21.9).
  - Keep the Node range line (`^22.12.0 || ^24.0.0 || >=26.0.0`), every existing `##` heading and the Disclosures wording. No absolute URL and no brand name anywhere. Keep the file Prettier-clean (tables and lists as the existing file formats them).
  - Verify with `npx vitest run tests/repo-conformance.test.ts` that the conformance test still passes. The existing checks cover Req 21.5, 21.10, 21.11 and 21.12.
  - _Requirements: 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10, 21.11, 21.12, 21.13, 22.4_

- [ ] 13. Final verification (gates, scope checks and requirement coverage)
  - Run `npm run lint`, `npm test`, `npx tsc -b`, `npm run build` and `npx prettier --check .`. All must pass with zero warnings. Report the results.
  - Folder checks: `src/core/model`, `src/core/parsers` and `src/samples` still contain `.gitkeep` (Req 19.6, 17.9); no file in `src/core` imports React or a browser, network or storage API (Req 19.2, 19.8); `package.json` and the lock file are unchanged (Req 19.3).
  - Scope check: run `git diff --stat main` (read-only) and confirm that no file outside the Req 19.7 list changed. The list is `src/core/model`, `src/core/parsers`, `src/core/index.ts`, `src/core/index.test.ts`, `src/samples`, `eslint.config.js`, `tests/eslint-purity.test.ts`, `README.md`, `.kiro/specs/01-parsers`, `.kiro/hooks` and `.kiro/steering/parsing.md`.
  - Coverage script: run one read-only Node script supplied on standard input (it creates no file). It reads `.kiro/specs/01-parsers/requirements.md`, builds the list of every acceptance criterion (N.M), reads every `*.test.ts` file under `src` and `tests`, collects every "Req N.M" and "Req N" mention, and prints (a) every criterion with no mention in any test, and (b) every mention of a criterion that does not exist. Fix every gap in (a) that a test can decide and every typo in (b).
  - Inspection (Requirement 22.5): the criteria that no automated test can decide are listed below. Check each by reading the code and report the result.
    - Req 2.18, 4.15 and 6.9: no `parseFloat`, `Number(...)` on decimal text, `Date`, clock or `crypto` (lint decides the banned globals; 18.13 says lint cannot decide `Number(text)`).
    - Req 7.8, 17.8 and 21.10: no brand name, real name or real phone number in code, labels, messages, comments, samples or README.
    - Req 19.1: strict TypeScript, no `any`, no dead code, named exports only. Req 19.3, 19.4, 19.7 and 19.8: no new dependency, the layout, the file list, no storage and no network.
    - Req 20.1 and 20.13: every property runs at least 100 cases and no helper or testkit uses a forbidden name.
    - Req 21.3, 21.4, 21.6, 21.7, 21.8, 21.9 and 21.13: the README prose is right (the conformance test checks only paths, headings, "integer", "minor units" and no URL).
    - Req 22.2: each test names its criterion as "Req N.M". Req 22.1 is checked by the script above.
    - Req 23.1 to 23.6 (scope exclusion): the module contains no analysis, recurring-charge detection or budget code, no UI or React code, no persistence, no input format besides CSV and Mobile-money SMS, no currency conversion, and a decimal comma gives an Issue without conversion.
  - _Requirements: 7.8, 17.8, 17.9, 18.12, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 22.1, 22.5, 23.1, 23.2, 23.3, 23.4, 23.5, 23.6_

## Notes

- Tasks run one at a time, in numeric order. The owner verifies each task with `npm test`, `npx tsc -b`, `npm run lint` and `git status` before it is committed. No task runs git commit or push.
- The owner will run a mutation check in three places: the Amount_Grammar (task 3), the CSV tokenizer (task 6) and the SMS parser (task 8).
- The hook core-tests-on-save runs after files the agent writes under src/core and src/samples. The hook requirement-coverage-after-task runs after each task.
- Req N.M naming rule (Requirement 22.2): every test title or an adjacent comment names each criterion it covers in the literal form "Req N.M" (for a whole requirement, "Req N"). Property tests also carry `// Feature: 01-parsers, Property n: ...`. The hook searches for these strings. A bare number in a `_Requirements:` line, such as `5`, means all criteria of that requirement.
- No task pulls later work forward. Until task 9 exists, `importText` is not available, so tests of earlier tasks call the functions of their own module directly. Tasks 3 to 5 do not import parsers, and task 7 does not import `sms-parser.ts` or `import-text.ts`.
- Ids are assigned inside `parseCsv` and `parseSms` as their last step (Decisions D1). `importText` does not assign ids again.
- `chars.ts` lives in `src/core/model` because Requirement 19.7 allows new files only there and in `src/core/parsers`. It is module-internal and is not exported by the barrel (Decisions D3).
- Requirement 19.7 limits which files may change. A task that needs a change outside the list stops and asks the owner.
- The lint rules of task 1 apply to test files and testkits under `src/core`. Test helpers must avoid `Math.random`, `Date`, `crypto`, `performance`, `parseFloat` and `Number.parseFloat`. fast-check supplies the randomness.
- Tests sit next to their source file. Use the file names of the design's File layout: one example file and at most one `.property.test.ts` per source file (only `money`, `calendar` and `masking` have one). Testkits end in `.testkit.ts`, are imported only by tests, and are never exported by the barrel.
- Every P1 property appears in exactly one of tasks 3 to 9, in the task whose source file it exercises. Every P2 property appears in task 11. The CSV tokenizer properties P30, P31 and P33 need `parseCsv`, so they sit in task 7 and task 6 has no numbered property of its own.
- Requirement 22.2 is enforced by this naming rule and checked by the task 13 script. Requirement 22.5 is answered by the inspection list in task 13.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3", "4", "5"] },
    { "id": 3, "tasks": ["6", "8"] },
    { "id": 4, "tasks": ["7"] },
    { "id": 5, "tasks": ["9"] },
    { "id": 6, "tasks": ["10", "11"] },
    { "id": 7, "tasks": ["12"] },
    { "id": 8, "tasks": ["13"] }
  ]
}
```

The owner runs the tasks one at a time in numeric order, so the graph is informational.
