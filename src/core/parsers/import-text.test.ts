import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseIsoDate, parseTime24 } from '../model/calendar';
import { ISSUES } from '../model/issues';
import { anyUnitsTextArb, groupArb, groupText, longestDigitGroup } from '../model/masking.testkit';
import { AMOUNT_LIMIT } from '../model/money';
import type { ImportOptions, ImportResult } from '../model/types';
import { delimiterArb, writeCsv } from './csv-reader.testkit';
import { importText } from './import-text';
import {
  costSentence,
  formatKsh,
  separatorArb,
  writePaidSms,
  writeReceivedSms,
  writeSentSms,
} from './sms-parser.testkit';

const RUNS = { numRuns: 200 };

const CSV_TEXT = 'Date,Description,Amount\n5/11/26,Gym,-9.99\n2026-01-02,Pay,100\n';
const SMS_TEXT =
  'QWERTY1234 Confirmed. Ksh500.00 paid to Raven Rides on 5/11/26 at 6:42 PM. New balance is Ksh1.00.';

describe('importText examples', () => {
  it('Req 8.1: every call returns format, transactions and issues', () => {
    const result = importText(CSV_TEXT);
    expect(Object.keys(result).sort()).toEqual(['format', 'issues', 'transactions']);
  });

  it('Req 8.2, 8.3, 8.4: defaults are auto, USD and day-first', () => {
    const result = importText(CSV_TEXT);
    expect(result.format).toBe('csv');
    expect(result.transactions.map((t) => t.occurredOn)).toEqual(['2026-11-05', '2026-01-02']);
    expect(result.transactions.map((t) => t.amount)).toEqual([
      { minor: -999, currency: 'USD' },
      { minor: 10000, currency: 'USD' },
    ]);
  });

  it('Req 8.3, 8.4, 8.10: defaultCurrency and dateOrder reach the CSV parser', () => {
    const result = importText(CSV_TEXT, { defaultCurrency: 'EUR', dateOrder: 'mdy' });
    expect(result.transactions[0]?.occurredOn).toBe('2026-05-11');
    expect(result.transactions[0]?.amount.currency).toBe('EUR');
  });

  it('Req 8.10: the SMS parser ignores defaultCurrency and dateOrder', () => {
    const plain = importText(SMS_TEXT);
    const other = importText(SMS_TEXT, { defaultCurrency: 'EUR', dateOrder: 'mdy' });
    expect(other).toEqual(plain);
    expect(plain.transactions[0]?.amount).toEqual({ minor: -50000, currency: 'KES' });
    expect(plain.transactions[0]?.occurredOn).toBe('2026-11-05');
  });

  it('Req 8.5: forced formats skip detection', () => {
    const forcedSms = importText(CSV_TEXT, { format: 'mobile-money-sms' });
    expect(forcedSms.format).toBe('mobile-money-sms');
    expect(forcedSms.issues.map((i) => i.message)).toEqual([
      ISSUES.unexpectedTextBeforeFirstMessage,
    ]);
    const forcedCsv = importText(SMS_TEXT, { format: 'csv' });
    expect(forcedCsv.format).toBe('csv');
    expect(forcedCsv.issues.map((i) => i.message)).toEqual([ISSUES.unrecognisedHeader]);
  });

  it('Req 8.6: auto routes by the detected format', () => {
    expect(importText(CSV_TEXT, { format: 'auto' }).format).toBe('csv');
    expect(importText(SMS_TEXT, { format: 'auto' }).format).toBe('mobile-money-sms');
  });

  it('Req 8.7, 8.8, 8.9: invalid options throw, even for blank text', () => {
    expect(() => importText(CSV_TEXT, { defaultCurrency: 'usd' })).toThrow();
    expect(() => importText(CSV_TEXT, { defaultCurrency: 'US' })).toThrow();
    expect(() => importText('', { defaultCurrency: 'EURO' })).toThrow();
    expect(() => importText('  ', { format: 'xml' as unknown as 'csv' })).toThrow();
    expect(() => importText(CSV_TEXT, { dateOrder: 'ymd' as unknown as 'dmy' })).toThrow();
  });

  it('Req 8.11: one leading byte-order mark is removed and line numbers count after it', () => {
    expect(importText('\uFEFF' + CSV_TEXT)).toEqual(importText(CSV_TEXT));
    const result = importText('\uFEFFDate,Description,Amount\nbad,Gym,5');
    expect(result.issues[0]?.line).toBe(2);
    expect(importText('\uFEFF')).toEqual(importText(''));
  });

  it('Req 8.12: blank text gives the single Empty input issue whatever the format', () => {
    for (const format of ['auto', 'csv', 'mobile-money-sms'] as const) {
      expect(importText(' \n\t ', { format })).toEqual({
        format: 'unknown',
        transactions: [],
        issues: [{ line: 1, message: ISSUES.emptyInput, excerpt: '' }],
      });
    }
  });

  it('Req 8.13: input order is kept and duplicates are not removed', () => {
    const text =
      'Date,Description,Amount\n2026-01-02,Gym,-5\n2026-01-01,Pay,9\n2026-01-02,Gym,-5\n';
    const result = importText(text);
    expect(result.transactions.map((t) => t.description)).toEqual(['Gym', 'Pay', 'Gym']);
    expect(new Set(result.transactions.map((t) => t.id)).size).toBe(3);
  });

  it('Req 15.6: unknown non-blank text gives Unrecognised text on the first non-blank line', () => {
    const result = importText('\n  \r\nhello 1234 5678 9012\r\nmore');
    expect(result).toEqual({
      format: 'unknown',
      transactions: [],
      issues: [{ line: 3, message: ISSUES.unrecognisedText, excerpt: 'hello [number]' }],
    });
  });

  it('Req 10.8: forced csv with an unrecognised header gives csv and Unrecognised header', () => {
    const result = importText('foo,bar\n1,2', { format: 'csv' });
    expect(result.format).toBe('csv');
    expect(result.transactions).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.message).toBe(ISSUES.unrecognisedHeader);
  });

  it('Req 10.9: auto with an unrecognised header and no Message_Start gives unknown', () => {
    const result = importText('foo,bar\n1,2');
    expect(result.format).toBe('unknown');
    expect(result.issues).toEqual([
      { line: 1, message: ISSUES.unrecognisedText, excerpt: 'foo,bar' },
    ]);
  });

  it('Req 11.15: a recognised header with no rows is csv', () => {
    const result = importText('Date,Description,Amount\n');
    expect(result.format).toBe('csv');
    expect(result.transactions).toEqual([]);
  });
});

// ---- generators for P28 and P29 ----

const wordArb = fc.constantFrom('Gym', 'Raven', 'Crypt', 'Cafe', 'Moon', 'paid', 'to', 'on', 'a1');
const digitGroupArb = groupArb(7, 14).map(groupText);

// Words mixed with long digit groups whose runs are joined by single spaces or hyphens.
const freeTextArb = fc
  .array(fc.oneof(wordArb, digitGroupArb, groupArb(1, 6).map(groupText)), {
    minLength: 1,
    maxLength: 4,
  })
  .map((parts) => parts.join(' '));

const dateCellArb = fc.constantFrom('2026-01-05', '2026-02-28', '5/1/26', '31/2/26', 'x', '');
const amountCellArb = fc.constantFrom('10.00', '-5.50', '(3)', 'abc', '1,000.00', '99999999999999');

const csvRowArb = fc.tuple(dateCellArb, freeTextArb, amountCellArb).map((r) => [...r]);

// Each generated row is repeated one to four times so that identical rows occur.
const csvRowsArb = fc
  .array(fc.tuple(csvRowArb, fc.integer({ min: 1, max: 4 })), { minLength: 0, maxLength: 5 })
  .map((pairs) => pairs.flatMap(([row, count]) => Array.from({ length: count }, () => row)));

const csvTextArb = fc
  .tuple(delimiterArb, csvRowsArb, fc.boolean())
  .map(([delimiter, rows, trailing]) => {
    const all = [['Date', 'Description', 'Amount'], ...rows];
    return writeCsv(all, delimiter, ['\n', '\r\n'], trailing).text;
  });

const codeArb = fc
  .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), {
    minLength: 10,
    maxLength: 10,
  })
  .map((chars) => chars.join(''));

const smsMessageArb = fc
  .tuple(
    codeArb,
    fc.integer({ min: 1, max: 100_000_000 }),
    freeTextArb,
    fc.constantFrom('paid', 'sent', 'received'),
    fc.option(fc.integer({ min: 0, max: 5000 }), { nil: undefined }),
    fc.integer({ min: 1, max: 3 }),
  )
  .map(([code, minor, name, kind, cost, count]) => {
    const fields = {
      code,
      amount: formatKsh(minor),
      date: '5/11/26',
      time: '6:42 PM',
      name,
      cost: cost === undefined ? undefined : costSentence(formatKsh(cost)),
    };
    const message =
      kind === 'paid'
        ? writePaidSms(fields)
        : kind === 'sent'
          ? writeSentSms(fields)
          : writeReceivedSms(fields);
    return Array.from({ length: count }, () => message);
  });

const smsTextArb = fc
  .tuple(fc.array(smsMessageArb, { minLength: 0, maxLength: 4 }), separatorArb, freeTextArb)
  .map(([groups, sep, lead]) => lead + sep + groups.flat().join(sep === '' ? ' ' : sep));

const textArb: fc.Arbitrary<string> = fc.oneof(
  csvTextArb,
  smsTextArb,
  anyUnitsTextArb,
  fc.string({ maxLength: 120 }),
  freeTextArb,
  csvTextArb.map((t) => '\uFEFF' + t),
);

const optionsArb: fc.Arbitrary<ImportOptions> = fc.record(
  {
    format: fc.constantFrom('auto', 'csv', 'mobile-money-sms'),
    defaultCurrency: fc.constantFrom('USD', 'KES', 'JPY', 'EUR'),
    dateOrder: fc.constantFrom('dmy', 'mdy'),
  },
  { requiredKeys: [] },
);

function checkWellFormed(result: ImportResult): void {
  expect(['csv', 'mobile-money-sms', 'unknown']).toContain(result.format);
  for (const t of result.transactions) {
    expect(parseIsoDate(t.occurredOn).ok).toBe(true);
    if (t.time !== undefined) {
      expect(parseTime24(t.time).ok).toBe(true);
    }
    expect(Number.isSafeInteger(t.amount.minor)).toBe(true);
    expect(Math.abs(t.amount.minor)).toBeLessThanOrEqual(AMOUNT_LIMIT);
    expect(t.amount.currency).toHaveLength(3);
    expect(t.amount.currency).toBe(t.amount.currency.toUpperCase());
    expect(longestDigitGroup(t.description)).toBeLessThan(7);
    if (t.counterparty !== undefined) {
      expect(longestDigitGroup(t.counterparty)).toBeLessThan(7);
    }
  }
  for (const issue of result.issues) {
    expect(Number.isInteger(issue.line)).toBe(true);
    expect(issue.line).toBeGreaterThanOrEqual(1);
    expect(issue.excerpt.length).toBeLessThanOrEqual(60);
    expect(longestDigitGroup(issue.excerpt)).toBeLessThan(7);
  }
  const ids = result.transactions.map((t) => t.id);
  expect(new Set(ids).size).toBe(ids.length);
}

describe('importText properties', () => {
  // Feature: 01-parsers, Property 28: The Importer never throws and always returns a well-formed result
  it('Req 16.1, 16.4, 16.5, 20.7, 7.5, 7.6, 6.7, 20.9, 20.10, 5.5, 5.6: P28 never throws, well-formed, unique ids, no long digit groups', () => {
    fc.assert(
      fc.property(textArb, optionsArb, (text, options) => {
        checkWellFormed(importText(text, options));
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 29: Importing the same text and options twice is deterministic
  it('Req 16.2, 16.3, 20.8: P29 the same text and options give deeply equal results', () => {
    fc.assert(
      fc.property(textArb, optionsArb, (text, options) => {
        const first = importText(text, options);
        const second = importText(text.slice(0), { ...options });
        expect(second).toEqual(first);
      }),
      RUNS,
    );
  });
});
