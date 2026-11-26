# Requirements Document

## Introduction

This specification covers Module 1 of Ledger Mortis: the transaction model and the text parsers. The module turns text that a user pastes into typed, validated data: a list of transactions plus a list of issues for every part of the text that could not be understood. It is the "Summon" step of the product flow, without any user interface.

The module delivers five things. First, a model in `src/core/model`: Money, calendar-checked date and time helpers, Transaction, ImportResult, Issue, number masking and deterministic ids. Second, parsers in `src/core/parsers`: a generic CSV parser, a Mobile-money SMS parser, a format detector and one entry point, `importText`. Third, two fictional sample texts in `src/samples`. Fourth, lint rules and permanent tests that enforce "no randomness, no clock, no float parsing" in `src/core`. Fifth, a barrel file `src/core/index.ts` and README updates.

The binding rules are in `.kiro/steering/parsing.md` (money, dates, errors, privacy, identity, naming, tests). This document also follows `tech.md`, `privacy.md` and `product.md`. Where this document adds a rule that `parsing.md` does not state, the rule fills a gap and does not override `parsing.md`.

Module 0 is finished and stays untouched except for the three files that this module must extend by design: `eslint.config.js`, `tests/eslint-purity.test.ts` and `README.md`. The `.gitkeep` files in `src/core/model`, `src/core/parsers` and `src/samples` stay, because `tests/repo-conformance.test.ts` requires them.

## Glossary

- **Module_1**: The scope defined by this specification.
- **Core_Library**: The pure TypeScript code in `src/core`, with no React, DOM, network, storage, randomness or clock.
- **Money**: A value `{ minor, currency }` where `minor` is a safe integer count of minor units (negative is money out, positive is money in) and `currency` is a code of exactly three uppercase letters A to Z.
- **Money_Module**: The code in `src/core/model` that creates, adds, formats and parses Money.
- **Currency_Exponent**: The number of decimal digits of a currency: 0 for JPY, KRW, UGX and RWF; 2 for every other code.
- **Amount_Limit**: The value 100,000,000,000 minor units, the largest absolute value that amount-text parsing accepts.
- **Amount_Text**: A text that represents an amount and follows the Amount_Grammar.
- **Amount_Grammar**: The grammar of Amount_Text defined in Requirement 2.
- **Calendar_Module**: The code in `src/core/model` that validates and parses dates and times.
- **Iso_Date**: A date stored as "YYYY-MM-DD" with a year from 0001 to 9999 that exists in the Gregorian calendar.
- **Time_Of_Day**: A time stored as "HH:MM" in 24-hour form, zero-padded.
- **Date_Order**: The option value "dmy" (day first, default) or "mdy" (month first) that decides how slash dates are read.
- **Slash_Date**: A date written as `D/M/Y` where D and M have 1 or 2 digits and Y has exactly 2 or exactly 4 digits.
- **Parse_Outcome**: The value returned by date, time and amount parsing: either a success carrying the value or a failure. A failure of amount parsing carries a reason, either "invalid" or "too-large". These functions return a Parse_Outcome and never throw on text.
- **Digit_Group**: A maximal sequence of ASCII digits 0 to 9 in which consecutive digit runs are joined by exactly one space or exactly one hyphen. A Digit_Group starts and ends with a digit, and its length is its digit count.
- **Masking_Module**: The code in `src/core/model` that replaces Digit_Groups of 7 or more digits.
- **Mask_Token**: The text "[number]".
- **Free_Text**: A description, a counterparty or an issue excerpt.
- **Id_Module**: The code in `src/core/model` that builds transaction ids.
- **Base_Hash**: The text "tx-" followed by 8 lowercase hexadecimal digits that encode the 32-bit FNV-1a hash of the Hash_Input.
- **Hash_Input**: The UTF-8 bytes of the source format id, the date, the decimal text of `minor`, the currency and the stored (already masked) description, joined by the character U+001F.
- **Transaction**: A record with `id`, `occurredOn` (Iso_Date), optional `time` (Time_Of_Day), `amount` (Money), `description`, optional `counterparty`, `source` ("csv" or "mobile-money-sms") and optional `reference`.
- **Format_Id**: One of "csv" or "mobile-money-sms".
- **Issue**: A record with `line` (1-based integer), `message` and `excerpt` (at most 60 characters, masked).
- **ImportResult**: A record with `format` ("csv", "mobile-money-sms" or "unknown"), `transactions` and `issues`.
- **Import_Options**: The record `{ format?, defaultCurrency?, dateOrder? }` accepted by Importer, where `format` is "auto", "csv" or "mobile-money-sms" (default "auto"), `defaultCurrency` is a Currency code (default "USD") and `dateOrder` is a Date_Order (default "dmy").
- **Importer**: The function `importText(text, options)` in `src/core/parsers`.
- **Format_Detector**: The function `detectFormat(text)` in `src/core/parsers`. It checks in this order: first for a recognised CSV Header_Line, then for a Message_Start, and otherwise returns "unknown", as Requirement 15 states.
- **Csv_Parser**: The code in `src/core/parsers` that turns CSV text into transactions and issues.
- **Sms_Parser**: The code in `src/core/parsers` that turns Mobile-money SMS text into transactions and issues.
- **Mobile_Money_SMS**: The user-facing label of the Format_Id "mobile-money-sms". The label carries no brand name.
- **Header_Line**: The first line of the CSV text that is not blank (empty or whitespace only), after removal of a leading byte-order mark.
- **Delimiter**: The comma, semicolon or tab that separates CSV fields, chosen by Requirement 9.
- **Record**: One CSV row, which may span several physical lines when a quoted field contains a line break.
- **Date_Column_Names**: The names "date", "posted", "post date", "posting date", "transaction date" and "timestamp".
- **Description_Column_Names**: The names "description", "details", "narration", "memo", "payee", "particulars", "transaction details" and "narrative".
- **Amount_Column_Name**: The name "amount".
- **Debit_Column_Names**: The names "debit", "debit amount", "withdrawal", "withdrawals", "paid out" and "money out".
- **Credit_Column_Names**: The names "credit", "credit amount", "deposit", "deposits", "paid in" and "money in".
- **Message_Code**: A string of exactly 10 characters, each an uppercase letter A to Z or a digit 0 to 9. A string with a lowercase letter is not a Message_Code.
- **Message_Start**: An occurrence of a Message_Code that is not preceded by a letter A-Z, a-z or a digit, followed by one or more whitespace characters (line breaks allowed) and then the text "Confirmed." in any letter case.
- **Sms_Message**: The text from one Message_Start up to, but not including, the next Message_Start, or to the end of the text, with trailing whitespace removed and every run of whitespace (including line breaks) replaced by one space.
- **Sms_Amount**: The text "Ksh" or "KES" (case-insensitive prefix), then an optional single space, then a digits text: digits with optional thousands commas (first group 1 to 3 digits, later groups exactly 3 digits), then an optional "." followed by 1 or 2 digits. Its currency is KES. Any "." that follows the longest match is not part of the amount. The Sms_Parser removes the prefix and parses the digits text with the Amount_Grammar using the currency KES, so that the prefix is never treated as a currency code by the Amount_Grammar.
- **Sms_Date**: The pattern `D/M/YY` with 1 or 2 digit day, 1 or 2 digit month and exactly 2 digit year, always read day first.
- **Sms_Time**: The pattern `H:MM AM` or `H:MM PM` with hour 1 to 12 (1 or 2 digits), 2 digit minutes and AM or PM in any letter case.
- **Date_Marker**: The text " on " followed by an Sms_Date, then " at ", then an Sms_Time, where "on" and "at" match in any letter case.
- **Sms_Name**: The text between the verb phrase of an Sms_Message and its Date_Marker, which may end with a single "." immediately before the Date_Marker. The Sms_Parser strips that one ".", then drops the Phone_Token together with the one space before it, and then trims the text, as Requirement 13 states. A digit group that is glued to a name without a space is not dropped and is masked by the Masking_Module.
- **Phone_Token**: The last Digit_Group at the end of an Sms_Name that has 7 or more digits, optionally preceded by "+", and that is separated from the rest of the Sms_Name by exactly one space. The whole Digit_Group is the Phone_Token, including any shorter digit runs that a single space or hyphen joins to it (for example, in "Agent 12 0711000222" the Phone_Token is "12 0711000222"). A digit group that is glued to the name with no space is not a Phone_Token.
- **Samples_Module**: The code in `src/samples` that exports the sample texts.
- **Linter**: ESLint as configured in `eslint.config.js`.
- **Lint_Script**: The command "npm run lint".
- **Purity_Test_File**: `tests/eslint-purity.test.ts`.
- **Barrel**: The file `src/core/index.ts`.
- **README_File**: The `README.md` file in the repository root.
- **Conformance_Test_File**: `tests/repo-conformance.test.ts`.
- **Test_Suite**: The Vitest tests of Module_1, including fast-check property tests.
- **Test_Only_Helper**: A function that exists only in test files, such as a CSV writer or a data generator.
- **Task_List**: The file `.kiro/specs/01-parsers/tasks.md`.

## Requirements

### Requirement 1: Money Value and Arithmetic

**User Story:** As a developer, I want a Money type with integer minor units and an explicit currency, so that no amount is ever a floating-point number.

#### Acceptance Criteria

1. THE Money_Module SHALL represent a Money as `minor` (a safe integer) and `currency` (three uppercase letters A to Z).
2. WHEN the Money_Module creates a Money with a `minor` that is not a safe integer, THEN THE Money_Module SHALL throw an error, because the call is a programmer error.
3. WHEN the Money_Module creates a Money with a `currency` that is not exactly three uppercase letters A to Z, THEN THE Money_Module SHALL throw an error.
4. WHEN the Money_Module creates a Money with a `minor` equal to negative zero, THE Money_Module SHALL store `minor` as positive zero, so that `Object.is(minor, 0)` is true.
5. THE Money_Module SHALL use a Currency_Exponent of 0 for the currencies JPY, KRW, UGX and RWF.
6. THE Money_Module SHALL use a Currency_Exponent of 2 for every currency other than JPY, KRW, UGX and RWF.
7. WHEN the Money_Module adds two Money values with the same currency, THE Money_Module SHALL return a Money with that currency and the sum of the two `minor` values.
8. WHEN the Money_Module adds two Money values with different currencies, THEN THE Money_Module SHALL throw an error, because the call is a programmer error.
9. IF the sum of two Money values is not a safe integer, THEN THE Money_Module SHALL throw an error.
10. THE Money_Module SHALL compute the sum of two Money values as a commutative and associative operation, with a Money of `minor` 0 as the neutral element.
11. WHEN the Money_Module creates a Money with a `minor` that is any safe integer, THE Money_Module SHALL accept it, because amount-text parsing (Requirement 2) enforces the Amount_Limit and the Money constructor does not.

### Requirement 2: Amount Text Grammar

**User Story:** As a developer, I want an exact grammar for amounts in text, so that every parser reads amounts the same way and never uses floating-point parsing.

#### Acceptance Criteria

1. WHEN the Money_Module parses an Amount_Text, THE Money_Module SHALL accept optional whitespace before and after the Amount_Text.
2. WHEN an Amount_Text contains a currency code of three letters A to Z or a to z, THE Money_Module SHALL convert the code to uppercase and use it as the currency instead of the default currency.
3. WHEN an Amount_Text contains one of the symbols "$", "€", "£" or "¥", THE Money_Module SHALL accept the symbol, ignore it, and take the currency from the currency code or the default currency.
4. IF an Amount_Text contains both a currency code and a symbol, THEN THE Money_Module SHALL return a failure.
5. WHEN an Amount_Text has one minus sign "-" before the currency code or symbol, between the currency code or symbol and the digits, or directly before the digits, THE Money_Module SHALL return a negative amount.
6. WHEN an Amount_Text is surrounded by parentheses and has no minus sign and no plus sign, THE Money_Module SHALL return a negative amount.
7. IF an Amount_Text contains more than one sign marker (a sign marker is a minus sign, a plus sign or a pair of surrounding parentheses; for example two minus signs, two plus signs, a minus sign with a plus sign, or a minus sign or a plus sign together with parentheses), THEN THE Money_Module SHALL return a failure.
8. WHEN an Amount_Text has one leading plus sign "+" in a position where criterion 5 allows a minus sign, THE Money_Module SHALL accept the plus sign and return a positive amount.
9. THE Money_Module SHALL accept optional whitespace between the currency code or symbol and the digits.
10. THE Money_Module SHALL accept integer digits either as an unbroken run of digits or with thousands commas, where the first group has 1 to 3 digits and every later group has exactly 3 digits.
11. WHEN an Amount_Text has a decimal part, THE Money_Module SHALL require a point followed by at least 1 digit and at most as many digits as the Currency_Exponent of the resolved currency.
12. IF an Amount_Text for a currency with Currency_Exponent 0 contains a point, THEN THE Money_Module SHALL return a failure.
13. IF an Amount_Text has more decimal digits than the Currency_Exponent, THEN THE Money_Module SHALL return a failure and SHALL NOT round the value.
14. IF an Amount_Text has no integer digits (for example ".50") or ends with a point (for example "5."), THEN THE Money_Module SHALL return a failure.
15. IF an Amount_Text uses a decimal comma (for example "1.234,56" or "12,5"), THEN THE Money_Module SHALL return a failure.
16. IF the absolute value of an Amount_Text, after scaling to minor units, exceeds the Amount_Limit (this includes a value that is not a safe integer), THEN THE Money_Module SHALL return a failure with the reason "too-large" and SHALL NOT throw.
17. WHEN an Amount_Text represents zero with a minus sign or parentheses (for example "-0.00"), THE Money_Module SHALL return a Money with `minor` equal to positive zero.
18. THE Money_Module SHALL build `minor` from the digits of the Amount_Text one digit at a time and SHALL NOT apply `parseFloat`, `Number.parseFloat` or `Number` to a decimal string.
19. WHEN parsing an Amount_Text of any content, THE Money_Module SHALL return a Parse_Outcome and SHALL NOT throw.
20. WHEN the absolute value of an Amount_Text, after scaling to minor units, is exactly equal to the Amount_Limit, THE Money_Module SHALL accept the amount.
21. IF an Amount_Text is rejected for any cause other than the one in criterion 16, THEN THE Money_Module SHALL return a failure with the reason "invalid".

### Requirement 3: Money Formatting and Round Trip

**User Story:** As a developer, I want Money to print to text and parse back to the same value, so that the parser can be checked with a round-trip property.

#### Acceptance Criteria

1. THE Money_Module SHALL format a Money with exactly Currency_Exponent decimal digits and no decimal point when the Currency_Exponent is 0.
2. WHEN a Money is negative, THE Money_Module SHALL format it with a leading "-".
3. THE Money_Module SHALL format a Money without thousands commas, without a symbol and without a currency code.
4. FOR ALL Money values whose absolute `minor` value is at most the Amount_Limit, parsing the formatted text with the currency of the Money as the default currency SHALL produce a Money equal to the original (round-trip property).
5. WHEN the Money_Module formats a Money with `minor` 0, THE Money_Module SHALL produce the text "0.00" for Currency_Exponent 2 and "0" for Currency_Exponent 0.

### Requirement 4: Calendar-Checked Dates and Times

**User Story:** As a developer, I want dates and times validated against the real calendar without Date objects, so that impossible dates become issues and results do not depend on time zones.

#### Acceptance Criteria

1. THE Calendar_Module SHALL accept an Iso_Date only when the year is 0001 to 9999, the month is 01 to 12 and the day exists in that month of the Gregorian calendar.
2. THE Calendar_Module SHALL treat a year as a leap year when the year is divisible by 4 and is not divisible by 100, or is divisible by 400.
3. WHEN the Calendar_Module parses a date written as "YYYY-MM-DD" with exactly 4, 2 and 2 digits, THE Calendar_Module SHALL accept the date in every Date_Order.
4. WHEN the Calendar_Module parses a Slash_Date with Date_Order "dmy", THE Calendar_Module SHALL read the first number as the day and the second number as the month.
5. WHEN the Calendar_Module parses a Slash_Date with Date_Order "mdy", THE Calendar_Module SHALL read the first number as the month and the second number as the day.
6. WHEN the Calendar_Module is not given a Date_Order, THE Calendar_Module SHALL use "dmy".
7. WHEN a Slash_Date has a 2-digit year, THE Calendar_Module SHALL use the year 2000 plus the value of the two digits.
8. WHEN a Slash_Date has a 4-digit year, THE Calendar_Module SHALL use the year as written, and SHALL return a failure for the year 0000.
9. IF a date text uses a separator other than "-" or "/", contains a month name, or has a different digit layout than the layouts in this requirement, THEN THE Calendar_Module SHALL return a failure.
10. WHEN the Calendar_Module parses a 24-hour time written as "H:MM" or "HH:MM" with hour 0 to 23 and minute 00 to 59, THE Calendar_Module SHALL return the Time_Of_Day zero-padded to "HH:MM".
11. WHEN the Calendar_Module parses a 12-hour time written as "h:MM" or "hh:MM" followed by "AM" or "PM" in any letter case (hour 1 to 12, minute 00 to 59, optionally separated from AM or PM by one space), THE Calendar_Module SHALL convert the time to 24-hour form.
12. WHEN a 12-hour time has the hour 12 and AM, THE Calendar_Module SHALL return hour "00"; WHEN a 12-hour time has the hour 12 and PM, THE Calendar_Module SHALL return hour "12".
13. WHEN a 12-hour time has an hour from 1 to 11 and PM, THE Calendar_Module SHALL return the hour plus 12.
14. WHEN the Calendar_Module is given text of any content, THE Calendar_Module SHALL return a Parse_Outcome and SHALL NOT throw.
15. THE Calendar_Module SHALL be implemented without the `Date` global, without time zones and without any clock.

### Requirement 5: Number Masking

**User Story:** As a privacy-minded user, I want long digit groups removed from stored text, so that phone numbers and account numbers are never kept.

#### Acceptance Criteria

1. WHEN the Masking_Module masks a text, THE Masking_Module SHALL replace every Digit_Group of 7 or more digits, including its separators, with the Mask_Token and SHALL keep every Digit_Group of 6 or fewer digits unchanged.
2. THE Masking_Module SHALL join digit runs into one Digit_Group only when exactly one space or exactly one hyphen separates them, so that digits separated by anything else (two spaces, dots, slashes) are not joined, and SHALL mask a date-like group such as "2026-11-05" in free text. Both are accepted known limits and SHALL be documented in the README_File.
3. FOR ALL texts, masking the masked text SHALL produce the masked text (idempotence).
4. FOR ALL texts, THE Masking_Module SHALL return a text that contains no Digit_Group of 7 or more digits.
5. THE Masking_Module SHALL apply masking to the `description` of every Transaction, the `counterparty` of every Transaction and the `excerpt` of every Issue.
6. THE Masking_Module SHALL NOT apply masking to the `id` or the `reference` of a Transaction, because a Message_Code may consist of 10 digits.
7. WHEN the Importer builds an Issue excerpt, THE Importer SHALL mask the source text first and then cut the masked text to at most 60 characters.

### Requirement 6: Deterministic Transaction Ids

**User Story:** As a developer, I want ids that depend only on the content, so that the same text always gives the same ids.

#### Acceptance Criteria

1. THE Id_Module SHALL compute the Base_Hash with the standard 32-bit FNV-1a algorithm (offset basis 2166136261, prime 16777619, arithmetic modulo 2 to the power 32) over the Hash_Input.
2. THE Id_Module SHALL write the hash as exactly 8 lowercase hexadecimal digits, with leading zeros kept.
3. THE Id_Module SHALL build the Hash_Input from the source Format_Id, the Iso_Date, the decimal text of `minor`, the currency and the stored masked description, joined by U+001F, and SHALL NOT include the time, the counterparty or the reference.
4. WHEN a Base_Hash occurs for the first time within one ImportResult, THE Id_Module SHALL use the Base_Hash as the id.
5. WHEN a Base_Hash occurs for the n-th time within one ImportResult and n is 2 or more, THE Id_Module SHALL use the Base_Hash followed by "-" and n as the id.
6. THE Id_Module SHALL count occurrences in the order of the transactions in the ImportResult.
7. THE Id_Module SHALL give every Transaction in one ImportResult a different id.
8. WHEN the Importer parses the same text with the same Import_Options twice, THE Importer SHALL produce identical ids.
9. THE Id_Module SHALL be implemented without randomness, without a clock and without the `crypto` global.

### Requirement 7: Core Types and Format Label

**User Story:** As a developer, I want one set of record types shared by all parsers, so that later modules can rely on one shape.

#### Acceptance Criteria

1. THE Core_Library SHALL define the Transaction type with `id`, `occurredOn`, optional `time`, `amount`, `description`, optional `counterparty`, `source` and optional `reference`.
2. THE Core_Library SHALL define `source` as one of "csv" or "mobile-money-sms".
3. THE Core_Library SHALL define the ImportResult type with `format` (one of "csv", "mobile-money-sms" or "unknown"), `transactions` and `issues`.
4. THE Core_Library SHALL define the Issue type with `line`, `message` and `excerpt`.
5. THE Core_Library SHALL produce `line` as a 1-based integer greater than or equal to 1.
6. THE Core_Library SHALL produce an Issue `excerpt` with at most 60 characters.
7. THE Core_Library SHALL expose the user-facing label "Mobile-money SMS" for the Format_Id "mobile-money-sms" and the label "CSV" for the Format_Id "csv".
8. THE Core_Library SHALL contain no brand name in any code identifier, label, message or comment that Module_1 adds.
9. THE Core_Library SHALL produce an Issue `message` only from this complete list of exact strings: "Empty input", "Unrecognised text", "Unrecognised header", "Malformed quoted field", "Unterminated quote", "Wrong number of fields: expected N, found M" (where N and M are the decimal numbers of fields), "Invalid date", "Invalid amount", "Amount too large", "Currency mismatch", "Invalid debit or credit", "Missing description", "Unexpected text before first message", "Unrecognised message" and "Invalid transaction cost".

### Requirement 8: Import Entry Point and Options

**User Story:** As a developer, I want one entry point that accepts text and options, so that the user interface needs one call to import anything.

#### Acceptance Criteria

1. THE Importer SHALL accept a text and optional Import_Options and SHALL return an ImportResult with the fields `format`, `transactions` and `issues` for every call.
2. WHEN Import_Options omit `format`, THE Importer SHALL use "auto".
3. WHEN Import_Options omit `defaultCurrency`, THE Importer SHALL use "USD".
4. WHEN Import_Options omit `dateOrder`, THE Importer SHALL use "dmy".
5. WHEN `format` is "csv" or "mobile-money-sms", THE Importer SHALL skip format detection and SHALL parse the text with that parser.
6. WHEN `format` is "auto", THE Importer SHALL call the Format_Detector (which checks in the order of Requirement 15.1 to 15.3) and parse the text with the parser that matches the detected format.
7. IF Import_Options contain a `defaultCurrency` that is not exactly three uppercase letters A to Z, THEN THE Importer SHALL throw an error, because the call is a programmer error.
8. IF Import_Options contain a `format` other than "auto", "csv" or "mobile-money-sms", THEN THE Importer SHALL throw an error.
9. IF Import_Options contain a `dateOrder` other than "dmy" or "mdy", THEN THE Importer SHALL throw an error.
10. THE Importer SHALL apply `defaultCurrency` and `dateOrder` to the Csv_Parser only and SHALL ignore both for the Sms_Parser.
11. WHEN the Importer receives text that starts with the byte-order mark U+FEFF, THE Importer SHALL remove that one character before any other processing, and Issue line numbers SHALL count from the text after the removal.
12. WHEN the text is empty or contains only whitespace, THE Importer SHALL return the format "unknown", no transactions and one Issue with line 1, message "Empty input" and an empty excerpt, whatever the value of `format`.
13. THE Importer SHALL return transactions in input order and issues in input order, and SHALL NOT remove duplicate rows or messages.

### Requirement 9: CSV Structure

**User Story:** As a user, I want the CSV parser to handle the usual quirks of exported files, so that my file imports without manual cleanup.

#### Acceptance Criteria

1. THE Csv_Parser SHALL accept line breaks written as LF or as CRLF in any mix, and SHALL treat a CR that is not followed by LF as an ordinary character.
2. THE Csv_Parser SHALL use the first line that is not blank as the Header_Line.
3. THE Csv_Parser SHALL choose as the Delimiter the character among comma, semicolon and tab that occurs most often outside double quotes in the Header_Line, and SHALL break a tie in the order comma, semicolon, tab.
4. WHEN a field starts with a double quote, THE Csv_Parser SHALL read the field up to the closing double quote and SHALL read two consecutive double quotes inside the field as one double quote character.
5. THE Csv_Parser SHALL accept a Delimiter and a line break inside a quoted field as part of the field value.
6. WHEN a double quote appears inside an unquoted field, THE Csv_Parser SHALL keep the quote as an ordinary character.
7. IF text other than whitespace follows a closing double quote before the next Delimiter or line break, THEN THE Csv_Parser SHALL create one Issue with the message "Malformed quoted field" for the Record and SHALL skip the Record.
8. IF a quoted field has no closing double quote, THEN THE Csv_Parser SHALL treat the rest of the text as the content of that Record, SHALL create one Issue with the message "Unterminated quote" and SHALL parse no further Records.
9. THE Csv_Parser SHALL skip every blank line outside a quoted field without creating an Issue.
10. THE Csv_Parser SHALL set the `line` of an Issue to the 1-based physical line, after removal of the byte-order mark, on which the Record starts.
11. THE Csv_Parser SHALL set the `excerpt` of an Issue to the text of the Record with each line break replaced by one space, masked and cut to 60 characters.
12. WHEN a Record has a different number of fields than the Header_Line, THE Csv_Parser SHALL create one Issue with the message "Wrong number of fields: expected N, found M", where N and M are the numbers of fields, and SHALL parse the remaining Records.

### Requirement 10: CSV Header and Columns

**User Story:** As a user, I want the parser to find my columns by name, so that exports from different banks work.

#### Acceptance Criteria

1. THE Csv_Parser SHALL match header names after trimming whitespace, ignoring letter case and requiring the exact name.
2. THE Csv_Parser SHALL select the date column as the first column whose name is in the Date_Column_Names.
3. THE Csv_Parser SHALL select the description column as the first column whose name is in the Description_Column_Names.
4. THE Csv_Parser SHALL select the amount column as the first column whose name equals the Amount_Column_Name.
5. THE Csv_Parser SHALL select the debit column as the first column whose name is in the Debit_Column_Names, and the credit column as the first column whose name is in the Credit_Column_Names.
6. WHERE the Header_Line contains an amount column together with a debit or credit column, THE Csv_Parser SHALL use the amount column and SHALL ignore the debit and credit columns.
7. IF the Csv_Parser runs (that is, `format` is forced to "csv") and the Header_Line has no date column, no description column, or neither an amount column nor both a debit column and a credit column, THEN THE Csv_Parser SHALL return no transactions and one Issue with the message "Unrecognised header" on the line of the Header_Line.
8. WHEN the Header_Line is unrecognised and `format` is "csv", THE Importer SHALL return the format "csv" with the result of criterion 7.
9. WHEN the Header_Line is unrecognised, the text contains no Message_Start and `format` is "auto", THE Importer SHALL follow Requirement 15.6: the format "unknown", no transactions and one Issue with the message "Unrecognised text", and SHALL NOT produce the message "Unrecognised header".
10. WHEN the Header_Line is valid and no Record follows it, THE Csv_Parser SHALL return the format "csv", no transactions and no issues.
11. THE Csv_Parser SHALL ignore every column that is not selected by criteria 2 to 5, and SHALL NOT treat a column named only "time" as a date column.

### Requirement 11: CSV Rows

**User Story:** As a user, I want each CSV row converted to a transaction or reported as an issue, so that one bad row does not stop the import.

#### Acceptance Criteria

1. WHEN a date cell holds an Iso_Date or a Slash_Date, THE Csv_Parser SHALL read the date with the `dateOrder` option and SHALL store it as `occurredOn`.
2. WHERE a date cell holds a date followed by a single space or the letter "T" and then a time in the form "H:MM" or "HH:MM" with an optional ":SS" part and an optional AM or PM, THE Csv_Parser SHALL store the time as `time` and SHALL discard the seconds.
3. IF a date cell has any other trailing text (for example "Z" or a time zone offset), THEN THE Csv_Parser SHALL create one Issue with the message "Invalid date" and SHALL skip the Record.
4. IF a date cell is not a valid date by Requirement 4, THEN THE Csv_Parser SHALL create one Issue with the message "Invalid date" and SHALL skip the Record.
5. WHEN a Record has an amount column, THE Csv_Parser SHALL parse the amount cell with the Amount_Grammar, SHALL use the sign of the amount as written (negative is money out), SHALL use `defaultCurrency` as the currency of every CSV amount, SHALL accept and ignore a currency code in the cell that equals `defaultCurrency` in any letter case, and SHALL ignore currency symbols.
6. WHEN a Record has debit and credit columns and the debit cell alone is not empty, THE Csv_Parser SHALL store the debit amount as a negative amount, with the currency rule of criterion 5.
7. WHEN a Record has debit and credit columns and the credit cell alone is not empty, THE Csv_Parser SHALL store the credit amount as a positive amount, with the currency rule of criterion 5.
8. IF both the debit cell and the credit cell are empty or both are not empty, THEN THE Csv_Parser SHALL create one Issue with the message "Invalid debit or credit" and SHALL skip the Record.
9. IF a debit or credit cell holds a minus sign, a plus sign or parentheses, THEN THE Csv_Parser SHALL create one Issue with the message "Invalid debit or credit" and SHALL skip the Record.
10. IF an amount cell, or the one non-empty debit or credit cell, is rejected by the Amount_Grammar, THEN THE Csv_Parser SHALL create one Issue with the message "Amount too large" when the reason is "too-large" and one Issue with the message "Invalid amount" when the reason is "invalid", and SHALL skip the Record.
11. WHEN the description cell holds text after trimming, THE Csv_Parser SHALL store the trimmed and masked text as `description`.
12. IF the description cell is empty after trimming, THEN THE Csv_Parser SHALL create one Issue with the message "Missing description" and SHALL skip the Record.
13. THE Csv_Parser SHALL set `source` to "csv" and SHALL leave `counterparty` and `reference` absent.
14. WHEN a Record is skipped because of an Issue, THE Csv_Parser SHALL still parse every other Record.
15. THE Csv_Parser SHALL return the format "csv" when it parses a recognised header.
16. IF an amount cell, or the one non-empty debit or credit cell, is accepted by the Amount_Grammar and holds a currency code that differs from `defaultCurrency`, THEN THE Csv_Parser SHALL create one Issue with the message "Currency mismatch" and SHALL skip the Record.

### Requirement 12: SMS Message Segmentation

**User Story:** As a user, I want to paste many messages in one block, so that I do not have to separate them by hand.

#### Acceptance Criteria

1. THE Sms_Parser SHALL start a new Sms_Message at every Message_Start.
2. THE Sms_Parser SHALL accept any separator between messages, including blank lines, single line breaks, a space or no separator.
3. WHEN the text before the first Message_Start contains a character other than whitespace, THE Sms_Parser SHALL create one Issue with the message "Unexpected text before first message" on the 1-based line of the first such character, with the masked excerpt of that text.
4. WHEN the Sms_Parser parses an Sms_Message, THE Sms_Parser SHALL treat every run of whitespace, including line breaks, as one space.
5. WHEN the Sms_Parser creates an Issue for an Sms_Message, THE Sms_Parser SHALL set `line` to the 1-based line on which the Message_Code of the message starts and SHALL set `excerpt` to the masked first 60 characters of the Sms_Message.
6. IF an Sms_Message matches none of the kinds in Requirement 13, THEN THE Sms_Parser SHALL create one Issue with the message "Unrecognised message" and SHALL parse every other Sms_Message.
7. THE Sms_Parser SHALL match the keywords "Confirmed.", "paid to", "sent to", "received", "withdrawn from", "bought", "airtime", "Reversal of", "completed.", "credited to your account", "New", "balance is", "Transaction cost,", "You have", "You bought", "from", "of", " on " and " at " case-insensitively, and SHALL keep every name in the case in which it was written.
8. THE Sms_Parser SHALL accept the prefixes "Ksh" and "KES" of every Sms_Amount in any letter case.
9. THE Sms_Parser SHALL return the format "mobile-money-sms".

### Requirement 13: SMS Message Kinds

**User Story:** As a user, I want each kind of message turned into the right transaction, so that money in and money out are correct.

#### Acceptance Criteria

1. WHEN an Sms_Message is "<Message_Code> Confirmed. <Sms_Amount> paid to <Sms_Name><Date_Marker>", THE Sms_Parser SHALL create one Transaction with a negative amount, `counterparty` and `description` equal to the masked Sms_Name.
2. WHEN an Sms_Message is "<Message_Code> Confirmed. <Sms_Amount> sent to <Sms_Name><Date_Marker>", THE Sms_Parser SHALL create one Transaction with a negative amount, `counterparty` and `description` equal to the masked Sms_Name.
3. WHEN an Sms_Message is "<Message_Code> Confirmed. You have received <Sms_Amount> from <Sms_Name><Date_Marker>", THE Sms_Parser SHALL create one Transaction with a positive amount, `counterparty` and `description` equal to the masked Sms_Name.
4. WHEN an Sms_Message is "<Message_Code> Confirmed. You bought <Sms_Amount> of airtime<Date_Marker>", THE Sms_Parser SHALL create one Transaction with a negative amount, the `description` "Airtime" and no `counterparty`.
5. WHEN an Sms_Message is "<Message_Code> Confirmed. <Sms_Amount> withdrawn from <Sms_Name><Date_Marker>", THE Sms_Parser SHALL create one Transaction with a negative amount, `counterparty` and `description` equal to the masked Sms_Name.
6. WHEN an Sms_Message is "<Message_Code> Confirmed. Reversal of <Code> completed. <Sms_Amount> credited to your account<Date_Marker>", where <Code> is a Message_Code, THE Sms_Parser SHALL create one Transaction with a positive amount, the masked `description` "Reversal of <Code>" and no `counterparty`.
7. THE Sms_Parser SHALL match the text after the "Confirmed." of the Message_Start from its start, so that the kind phrase is the first text of the body, and SHALL match the keywords of criteria 1 to 6 as Requirement 12.7 states.
8. THE Sms_Parser SHALL end the Sms_Name at the first Date_Marker that follows the verb phrase, so that a name that contains the text " on " but not a complete Date_Marker is kept whole.
9. THE Sms_Parser SHALL build the Sms_Name in this order: first strip one trailing "." that stands immediately before the Date_Marker, then drop the Phone_Token together with the one space before it (the whole Digit_Group is dropped, so "Agent 12 0711000222" becomes "Agent"), then trim the text, so that a digit group glued to a name with no space stays in the text and the Masking_Module masks it.
10. IF the Sms_Name is empty after the steps of criterion 9, THEN THE Sms_Parser SHALL create one Issue with the message "Unrecognised message" for the Sms_Message.
11. THE Sms_Parser SHALL set `source` to "mobile-money-sms", `reference` to the Message_Code of the Sms_Message (for a reversal, the Message_Code that starts the message, not the code after "Reversal of"), and the currency to KES for every Transaction.
12. THE Sms_Parser SHALL convert the Sms_Date to `occurredOn`, always reading the day first whatever the `dateOrder` option, and SHALL convert the Sms_Time to `time` in 24-hour form.
13. IF the Sms_Date is not a valid date by Requirement 4 or the Sms_Time is not a valid time, THEN THE Sms_Parser SHALL create one Issue with the message "Invalid date" for the Sms_Message. A date or time that does not match the Date_Marker layout makes the message unrecognised (Issue "Unrecognised message"); only a correct layout with an impossible value gives "Invalid date".
14. THE Sms_Parser SHALL remove the "Ksh" or "KES" prefix of an Sms_Amount first, extract the digits text (thousands commas, an optional "." plus 1 or 2 digits, and no trailing sentence "."), and parse the digits text with the Amount_Grammar using the currency KES.
15. THE Sms_Parser SHALL accept the six fictional example messages "QA12BC34DE Confirmed. Ksh1,250.00 paid to Moonlight Grocers on 5/11/26 at 6:42 PM. New balance is Ksh8,420.50. Transaction cost, Ksh0.00.", "QA12BC34DF Confirmed. Ksh500.00 sent to Ada Wanjiru 0700123456 on 6/11/26 at 9:05 AM. New balance is Ksh7,915.50. Transaction cost, Ksh5.00.", "QA12BC34DG Confirmed. You have received Ksh3,000.00 from Kofi Mensah 0711000222 on 7/11/26 at 2:30 PM. New balance is Ksh10,915.50.", "QA12BC34DH Confirmed. You bought Ksh100.00 of airtime on 7/11/26 at 2:35 PM. New balance is Ksh10,815.50.", "QA12BC34DJ Confirmed. Ksh2,000.00 withdrawn from Agent Lakeside Shop on 8/11/26 at 10:15 AM. New balance is Ksh8,815.50. Transaction cost, Ksh29.00." and "QA12BC34DK Confirmed. Reversal of QA12BC34DE completed. Ksh1,250.00 credited to your account on 9/11/26 at 8:00 AM. New balance is Ksh10,065.50." and SHALL parse them, in this order and in one text, to these amounts in minor units: -125000, -50000, -500 (cost of the second message), 300000, -10000, -200000, -2900 (cost of the fifth message) and 125000.
16. IF the digits text of an Sms_Amount is rejected by the Amount_Grammar, THEN THE Sms_Parser SHALL create one Issue with the message "Amount too large" for the Sms_Message when the reason is "too-large" and one Issue with the message "Invalid amount" for the Sms_Message when the reason is "invalid".

### Requirement 14: SMS Optional Sentences and Cost Transactions

**User Story:** As a user, I want transaction costs counted as their own spending, so that the fees on my payments are visible.

#### Acceptance Criteria

1. WHERE an Sms_Message contains the sentence "New balance is <Sms_Amount>." or "New <word> balance is <Sms_Amount>." after the Date_Marker, with <word> an optional single word of one or more characters other than whitespace, THE Sms_Parser SHALL accept the sentence, matching the keywords "New" and "balance is" in any letter case as Requirement 12.7 states, and SHALL NOT store its value.
2. WHEN an Sms_Message has no balance sentence, THE Sms_Parser SHALL parse the message in the same way as a message with a balance sentence.
3. WHERE an Sms_Message contains the sentence "Transaction cost, <Sms_Amount>." after the Date_Marker and the amount is greater than zero, THE Sms_Parser SHALL create a second Transaction with the negative cost as amount, the `description` "Transaction cost", no `counterparty`, and the same `reference`, `occurredOn` and `time` as the parent Transaction.
4. WHERE an Sms_Message contains the sentence "Transaction cost, <Sms_Amount>." and the amount is zero, THE Sms_Parser SHALL create no cost Transaction.
5. THE Sms_Parser SHALL place a cost Transaction immediately after its parent Transaction in the result.
6. IF an Sms_Message contains the text "Transaction cost," and no valid Sms_Amount follows it (including an amount rejected with the reason "too-large"), THEN THE Sms_Parser SHALL keep the parent Transaction, SHALL create no cost Transaction and SHALL create one Issue with the message "Invalid transaction cost", with `line` set to the line where the Message_Code starts.
7. WHEN an Sms_Message produces an Issue, THE Sms_Parser SHALL still parse every other Sms_Message.
8. THE Sms_Parser SHALL create the ids of all SMS Transactions, including cost Transactions, with the rules of Requirement 6, and SHALL mask all SMS Free_Text with the Digit_Group rules of Requirement 5.

### Requirement 15: Format Detection

**User Story:** As a user, I want the app to recognise what I pasted, so that I do not have to choose a format.

#### Acceptance Criteria

1. WHEN the Header_Line, split by the Delimiter chosen by Requirement 9, contains a date column, a description column and either an amount column or both a debit column and a credit column by the names in Requirement 10, THE Format_Detector SHALL return "csv" whatever the rest of the text contains. This is the first check of the Format_Detector.
2. WHEN the Header_Line is not recognised by criterion 1 and the text contains at least one Message_Start anywhere (a Message_Code, whitespace and "Confirmed." in any letter case), THE Format_Detector SHALL return "mobile-money-sms". This is the second check of the Format_Detector.
3. WHEN neither the condition of criterion 1 nor the condition of criterion 2 holds, THE Format_Detector SHALL return "unknown".
4. WHEN the text is empty or contains only whitespace, THE Format_Detector SHALL return "unknown".
5. WHEN the Format_Detector is given text of any content, THE Format_Detector SHALL return one of the three values and SHALL NOT throw.
6. WHEN `format` is "auto" and the detected format is "unknown" for a text that is not empty, THE Importer SHALL return the format "unknown", no transactions and one Issue with the message "Unrecognised text", the line of the first line that is not blank, and the masked excerpt of that line.
7. WHEN the text has a recognised CSV Header_Line and at least one Record whose description contains a Message_Code-like word followed by the word "confirmed." in any letter case (for example "ABCDEFGHIJ confirmed."), THE Format_Detector SHALL return "csv".

### Requirement 16: Never Throw and Determinism

**User Story:** As a user, I want the import to survive any pasted text, so that the app never crashes on my data.

#### Acceptance Criteria

1. WHEN the Importer receives any string and valid Import_Options, THE Importer SHALL return an ImportResult and SHALL NOT throw.
2. WHEN the Importer receives the same text and the same Import_Options twice, THE Importer SHALL return deeply equal results.
3. THE Importer SHALL produce an output that depends only on the text and the Import_Options.
4. THE Importer SHALL return every Money in a Transaction as a Money that satisfies Requirement 1.
5. THE Importer SHALL return only Transactions whose `occurredOn` is an Iso_Date and whose `time`, when present, is a Time_Of_Day.
6. FOR ALL generated rows that the Csv_Parser reads without Issues, the sum of `minor` per currency over the Transactions SHALL equal the sum of the `minor` values of the generated rows (totals preserved).
7. FOR ALL generated messages that the Sms_Parser reads without Issues, the sum of `minor` over the Transactions SHALL equal the sum of the signed amounts of the generated messages, including cost Transactions (totals preserved).

### Requirement 17: Sample Data

**User Story:** As a visitor, I want demo data one click away, so that I can see the app without my own data.

#### Acceptance Criteria

1. THE Samples_Module SHALL export one CSV sample text and one Mobile-money SMS sample text as string constants, with no file loading and no network access.
2. WHEN the CSV sample text is imported with `format` "auto", THE Importer SHALL return the format "csv", zero issues and between 30 and 40 Transactions in the currency USD.
3. WHEN the SMS sample text is imported with `format` "auto", THE Importer SHALL return the format "mobile-money-sms", zero issues and between 30 and 40 Transactions (cost Transactions included) in the currency KES.
4. THE Samples_Module SHALL make each sample span about three months, with Iso_Dates over a range of 80 to 100 days.
5. THE Samples_Module SHALL include in each sample three recurring monthly charges, each with an identical description and an identical amount in each of three consecutive months.
6. THE Samples_Module SHALL include in each sample irregular spending, one inflow that resembles a salary, and one refund or reversal.
7. THE Samples_Module SHALL use merchants such as Spectral Streaming, Gloom Gym, Moonlight Cloud Storage, Hollow Hill Grocers, Crypt Cafe and Raven Rides, and fictional person names.
8. THE Samples_Module SHALL contain no real name, no real phone number and no third-party brand name.
9. THE Samples_Module SHALL leave the `.gitkeep` file in `src/samples` in place.

### Requirement 18: Lint Enforcement of Purity

**User Story:** As a maintainer, I want lint rules that forbid randomness, the clock and float parsing in the core, so that the purity rules of parsing.md hold in every later module.

#### Acceptance Criteria

1. WITHIN `src/core`, THE Linter SHALL report as an error (severity 2) every use of `Math.random`, using the rule `no-restricted-properties`.
2. WITHIN `src/core`, THE Linter SHALL report as an error every use of `Number.parseFloat`, using the rule `no-restricted-properties`.
3. WITHIN `src/core`, THE Linter SHALL report as an error every use of the globals `Date`, `crypto`, `performance` and `parseFloat`, using the rule `no-restricted-globals`.
4. THE Linter SHALL keep every restricted global that Module 0 defined for `src/core` (fetch, XMLHttpRequest, WebSocket, EventSource, window, document, localStorage, sessionStorage, navigator) in the same `no-restricted-globals` list as the four new names.
5. THE Linter SHALL keep the Module 0 rules for React imports, network member expressions and the other `src` rules working unchanged.
6. THE Linter SHALL apply the new rules to test files under `src/core` as well, and SHALL NOT exempt them, so that every Test_Only_Helper avoids the forbidden names.
7. THE Purity_Test_File SHALL contain one permanent case for each of the six names `Math.random`, `Number.parseFloat`, `Date`, `crypto`, `performance` and `parseFloat`, in the style of the existing per-name cases.
8. WHEN a case of the Purity_Test_File lints a snippet with a forbidden name in a virtual path under `src/core`, THE case SHALL assert the rule id, the severity 2 and that the message contains the forbidden name.
9. THE Purity_Test_File SHALL contain one case that lints a forbidden name in a virtual test-file path under `src/core` (a path ending in ".test.ts") and asserts an error.
10. THE Purity_Test_File SHALL contain a negative-control case that lints a snippet using `Math.imul` and `Number.isSafeInteger` in `src/core` and asserts zero messages.
11. THE Purity_Test_File SHALL contain a case that reads the effective configuration for a path under `src/core` and asserts that `no-restricted-globals` contains all thirteen names, and that `no-restricted-properties` contains `Math.random` and `Number.parseFloat`.
12. WHEN any use of the six forbidden names exists in `src/core`, THE Lint_Script SHALL fail.
13. WHERE a call such as `Number(text)` is applied to a decimal string, THE Test_Suite SHALL NOT rely on the Linter to catch it, and Requirement 2 SHALL remain the rule for it, because the Linter cannot tell a decimal string from an integer string.

### Requirement 19: Code Quality and Layout

**User Story:** As a maintainer, I want the code to follow the project standards, so that later modules can build on it.

#### Acceptance Criteria

1. THE Core_Library SHALL be written in strict TypeScript, without the type `any`, without dead code and with named exports only.
2. THE Core_Library SHALL import neither React nor any browser, network or storage API.
3. THE Module_1 SHALL add no new package dependency to `package.json`.
4. THE Module_1 SHALL place model code in `src/core/model`, parser code in `src/core/parsers` and sample texts in `src/samples`.
5. THE Module_1 SHALL place each test file next to the source file that it tests, with a name that ends in ".test.ts".
6. THE Module_1 SHALL keep the `.gitkeep` files in `src/core/model`, `src/core/parsers` and `src/samples`.
7. THE Module_1 SHALL add, change or delete no file outside `src/core/model`, `src/core/parsers`, `src/core/index.ts`, `src/core/index.test.ts`, `src/samples`, `eslint.config.js`, `tests/eslint-purity.test.ts`, `README.md`, `.kiro/specs/01-parsers`, `.kiro/hooks` and `.kiro/steering/parsing.md`.
8. THE Module_1 SHALL store no data in localStorage, sessionStorage or any other storage and SHALL send no data over any network.

### Requirement 20: Property-Based Test Coverage

**User Story:** As a maintainer, I want properties that cover the risky parts of parsing, so that edge cases are found by generation.

#### Acceptance Criteria

1. THE Test_Suite SHALL contain fast-check properties, each run with at least 100 generated cases, and a few example tests for every parser and every model function of Module_1.
2. THE Test_Suite SHALL contain a property that formats then parses a generated Money whose absolute `minor` value is at most the Amount_Limit and compares the result with the original (round trip).
3. THE Test_Suite SHALL contain properties for addition: commutativity, associativity, a Money of `minor` 0 as neutral element, and an error for different currencies.
4. THE Test_Suite SHALL contain a property that compares the calendar validity of generated year, month and day values with a Test_Only_Helper reference table of month lengths and with the known leap years 1900 (no), 2000 (yes), 2024 (yes) and 2100 (no).
5. THE Test_Suite SHALL contain a CSV round-trip property: generate rows, write them with a Test_Only_Helper CSV writer, parse them with the Csv_Parser and compare the Transactions with the generated rows.
6. THE Test_Suite SHALL contain an SMS round-trip property: generate messages, write them with a Test_Only_Helper SMS writer, parse them with the Sms_Parser and compare the Transactions with the generated messages.
7. THE Test_Suite SHALL contain a property that calls the Importer with arbitrary strings in each `format` value and asserts that the call never throws and returns the ImportResult shape.
8. THE Test_Suite SHALL contain a property that imports the same text twice and asserts deep equality, including ids.
9. THE Test_Suite SHALL contain a property that asserts unique ids within one ImportResult, including results with repeated identical rows.
10. THE Test_Suite SHALL contain a property that asserts that no `description`, `counterparty` or issue `excerpt` in any ImportResult contains a Digit_Group of 7 or more digits, and the generator of that property SHALL produce descriptions that use spaces and hyphens as digit separators.
11. THE Test_Suite SHALL contain the totals-preserved properties of Requirement 16.
12. THE Test_Suite SHALL contain example tests for the six fictional example messages of Requirement 13, for the Base_Hash of at least one known Hash_Input, for the ".50", "5.", "1.234,56" and "-0.00" Amount_Text cases, and for a CSV text with a recognised header and a Record whose description is "ABCDEFGHIJ confirmed." (which the Format_Detector SHALL return as "csv", Requirement 15.7).
13. THE Test_Suite SHALL write every Test_Only_Helper and generator without the names that Requirement 18 forbids.

### Requirement 21: Barrel and README Updates

**User Story:** As a newcomer, I want the public API in one place and the README up to date, so that I can find and understand the module.

#### Acceptance Criteria

1. THE Barrel SHALL export `importText`, `detectFormat`, the Money, Transaction, ImportResult and Issue types, and the Money, date, time, masking and id functions through named exports.
2. THE Barrel SHALL NOT export any Test_Only_Helper.
3. THE README_File SHALL list in its "Project structure" block every non-test source file that Module_1 adds, every test file that Module_1 adds, and `src/core/index.ts`, with a short description for each.
4. THE README_File SHALL replace the "empty, reserved for a later module" text of `src/core/model`, `src/core/parsers` and `src/samples` in the "Project structure" block.
5. THE README_File SHALL list only paths that exist, and the Conformance_Test_File SHALL check that every path in the "Project structure" block exists.
6. THE README_File SHALL update the "Money convention" section so that it describes the Money type of Module_1, the Currency_Exponent rule and the rule against floating-point numbers, and SHALL no longer state that no money type exists.
7. THE README_File SHALL update the status sentence in "What it is" so that it states that import parsing exists and that the graveyard and banishing features do not.
8. THE README_File SHALL document the known digit-grouping limits of Requirement 5.2 (digits separated by anything other than a single space or hyphen are not joined, and date-like groups in free text are masked), the Phone_Token limit of Requirement 13.9 (a digit group glued to a name with no space is masked, not dropped, and the whole trailing group, including small numbers joined to it by a single space or hyphen, is dropped), the Amount_Limit, the supported import formats ("CSV" and "Mobile-money SMS") and the Import_Options with their defaults.
9. THE README_File SHALL state in its "Built with Kiro" section the spec `.kiro/specs/01-parsers` and the steering file `parsing.md`, and SHALL list each hook file that exists in `.kiro/hooks` or state that none exists.
10. THE README_File SHALL contain no absolute URL and no brand name.
11. THE README_File SHALL keep the words "integer" and "minor units", the Node range line and every heading that already exists, because a repository test checks them.
12. WHEN Module_1 adds a file to the "Project structure" block, THE README_File SHALL use the indentation format of the existing block (two spaces per level, folder names ending in "/"), because the Conformance_Test_File parses that block.
13. THE README_File SHALL document that the CSV header must be the first non-blank line, that a debit and credit pair must have exactly one filled cell, and the digit-grouping limit of Requirement 5.2.

### Requirement 22: Requirement Coverage by Tests

**User Story:** As a maintainer, I want every acceptance criterion covered by a test, so that no requirement is left unproven.

#### Acceptance Criteria

1. THE Test_Suite SHALL cover every acceptance criterion of this document with at least one test.
2. THE Test_Suite SHALL name the covered criterion in a comment or test title in the form "Req N.M" next to each test.
3. WHEN a test covers a criterion that states a property over all inputs, THE Test_Suite SHALL use a fast-check property for that criterion.
4. WHEN a criterion states a lint rule or a repository fact, THE Test_Suite SHALL cover it with the Purity_Test_File or the Conformance_Test_File.
5. THE Task_List SHALL list every criterion that no automated test can decide (for example "no dead code") and SHALL assign its check to the final verification task.

### Requirement 23: Limit Module 1 Scope

**User Story:** As a project maintainer, I want Module 1 limited to the model and the parsers, so that later-module behaviour waits for its own specification.

#### Acceptance Criteria

1. THE Module_1 SHALL contain no analysis, no recurring-charge detection and no budget calculation, which belong to Module 2.
2. THE Module_1 SHALL contain no user interface and no React code, which belong to Module 3 and later.
3. THE Module_1 SHALL contain no persistence of any kind.
4. THE Module_1 SHALL support no input format other than CSV and Mobile-money SMS, and SHALL not read PDF files, spreadsheets or bank APIs.
5. WHEN an Amount_Text uses a decimal comma, THE Module_1 SHALL report an Issue and SHALL NOT convert the value.
6. THE Module_1 SHALL contain no currency conversion.
