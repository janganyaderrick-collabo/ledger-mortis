# Parsing and data rules (Module 1 onward)

These rules apply to everything that turns user text into data. Requirements, designs and code must follow them.

## Money

- Amounts are integer minor units, signed: negative is money out, positive is money in. The currency is an uppercase three-letter code.
- No floating-point numbers anywhere in src/core. Decimal text is parsed digit by digit, never with parseFloat or Number on a decimal string.
- Minor-unit exponent: 0 for JPY, KRW, UGX and RWF; 2 for every other currency.
- An amount that is not a safe integer, or whose absolute value exceeds 100,000,000,000 minor units, is an import issue, never a crash.

## Dates

- Dates are stored as "YYYY-MM-DD" strings, validated against the real calendar (including leap years). An optional time is stored as "HH:MM" in 24-hour form.
- No Date objects and no time zones in src/core.
- ISO dates are always accepted. Slash dates are day first (D/M/Y) by default.

## Errors

- Parsers never throw on user text. A line that cannot be understood becomes an issue with a line number, a message and a short excerpt, and the rest of the input is still parsed.
- Every parser returns the same shape: the detected format, the transactions and the issues.
- Exceptions are only for programmer errors, such as an invalid option passed by our own code.

## Privacy

- Any group of 7 or more digits in free text (descriptions, counterparties, issue excerpts) is replaced with "[number]". Digits separated only by single spaces or hyphens count as one group. Phone numbers and account numbers are never stored.
- src/core uses no network, no storage, no randomness and no clock. The same input always gives the same output, including transaction ids.
- Sample data is fictional. No real names, numbers or third-party brand names appear in samples, UI text or the demo.

## Identity

- A transaction id is deterministic: a hash of the source format, date, amount, currency and description, plus a counter for identical rows. Ids are unique within one import result and identical when the same text is parsed twice.

## Naming

- Format ids are "csv" and "mobile-money-sms". The user-facing label for the second is "Mobile-money SMS", with no brand names.

## Tests

- Every parser has property-based tests: round trips, never-throws on arbitrary text, determinism, and totals preserved.
- Every acceptance criterion in a requirements document is covered by at least one test.