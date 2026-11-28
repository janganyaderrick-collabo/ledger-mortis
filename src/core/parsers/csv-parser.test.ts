import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseDate, parseTime } from '../model/calendar';
import { anyPartsArb, isoText, numberText, validPartsArb } from '../model/calendar.testkit';
import { ISSUES } from '../model/issues';
import { buildExcerpt } from '../model/masking';
import { createMoney, formatMoney, parseAmountText } from '../model/money';
import {
  amountLikeTextArb,
  boundaryCaseArb,
  renderAmount,
  validSpecArb,
} from '../model/money.testkit';
import type { DateOrder, Transaction } from '../model/types';
import { hasRecognisedCsvHeader, parseCsv } from './csv-parser';
import {
  delimiterArb,
  lineBreakArb,
  recordSeparatorArb,
  writeCsv,
  writeCsvRow,
} from './csv-reader.testkit';

const RUNS = { numRuns: 200 };
const LIMIT = 100_000_000_000;

function parse(lines: readonly string[], currency = 'USD', order: DateOrder = 'dmy') {
  return parseCsv(lines.join('\n'), currency, order);
}

function asPairs(result: ReturnType<typeof parseCsv>): [number, string][] {
  return result.issues.map((issue): [number, string] => [issue.line, issue.message]);
}

function withoutId(tx: Transaction): Transaction {
  return { ...tx, id: '' };
}

describe('parseCsv header and columns', () => {
  it('Req 10.10: a valid header with no Record gives no transactions and no issues', () => {
    expect(parse(['Date,Description,Amount'])).toEqual({ transactions: [], issues: [] });
    expect(parseCsv('Date,Description,Amount\r\n', 'USD', 'dmy')).toEqual({
      transactions: [],
      issues: [],
    });
  });

  it('Req 9.2: blank text has no Header_Line and gives nothing', () => {
    expect(parseCsv('', 'USD', 'dmy')).toEqual({ transactions: [], issues: [] });
    expect(parseCsv('  \n\n \t\n', 'USD', 'dmy')).toEqual({ transactions: [], issues: [] });
  });

  it('Req 9.2, 10.7: the first non-blank line is the header; an unrecognised one gives one issue on its line', () => {
    const result = parse(['', '  ', 'Date,Memo', '2026-01-01,x']);
    expect(result.transactions).toEqual([]);
    expect(result.issues).toEqual([
      { line: 3, message: ISSUES.unrecognisedHeader, excerpt: 'Date,Memo' },
    ]);
  });

  it('Req 10.7: a header with a bad quote has no fields and is unrecognised (Decisions D5(a))', () => {
    const result = parse(['"Date"x,Description,Amount', '2026-01-01,x,1.00']);
    expect(result.transactions).toEqual([]);
    expect(asPairs(result)).toEqual([[1, ISSUES.unrecognisedHeader]]);
  });

  it('Req 10.7: a header missing the date, the description or the amount columns is unrecognised', () => {
    for (const header of [
      'Description,Amount',
      'Date,Amount',
      'Date,Description',
      'Date,Description,Debit',
      'Date,Description,Credit',
    ]) {
      expect(asPairs(parse([header, '2026-01-01,x,1.00']))).toEqual([
        [1, ISSUES.unrecognisedHeader],
      ]);
    }
  });

  it('Req 10.1, 10.2, 10.3, 10.4: names match after trimming, ignoring case, by exact name', () => {
    const result = parse([' POSTED ,Narrative,aMoUnT', '2026-01-02,Rent,-5.00']);
    expect(result.issues).toEqual([]);
    expect(result.transactions.map(withoutId)).toEqual([
      {
        id: '',
        occurredOn: '2026-01-02',
        amount: { minor: -500, currency: 'USD' },
        description: 'Rent',
        source: 'csv',
      },
    ]);
    expect(asPairs(parse(['Dates,Description,Amount', '2026-01-02,Rent,-5.00']))).toEqual([
      [1, ISSUES.unrecognisedHeader],
    ]);
  });

  it('Req 10.2, 10.3: the first matching column is selected for each role', () => {
    const result = parse(['Date,Posted,Memo,Details,Amount', '2026-01-01,2026-02-02,m,d,1.00']);
    expect(result.transactions.map((t) => [t.occurredOn, t.description])).toEqual([
      ['2026-01-01', 'm'],
    ]);
  });

  it('Req 10.5: the debit and credit columns are found by every listed name', () => {
    const result = parse(['Transaction Date,Details,Withdrawals,Deposits', '2026-01-01,x,2.00,']);
    expect(result.transactions.map((t) => t.amount.minor)).toEqual([-200]);
  });

  it('Req 10.6: the amount column wins over debit and credit columns', () => {
    const result = parse(['Date,Description,Debit,Credit,Amount', '2026-01-01,x,,,5.00']);
    expect(result.issues).toEqual([]);
    expect(result.transactions.map((t) => t.amount.minor)).toEqual([500]);
  });

  it('Req 10.11: a column named only "time" is ignored and is not a date column', () => {
    const ok = parse(['Time,Date,Description,Amount', '10:00,2026-11-05,Cafe,-1.00']);
    expect(ok.issues).toEqual([]);
    expect(ok.transactions.map((t) => [t.occurredOn, t.time])).toEqual([['2026-11-05', undefined]]);
    expect(asPairs(parse(['Time,Description,Amount', '10:00,Cafe,-1.00']))).toEqual([
      [1, ISSUES.unrecognisedHeader],
    ]);
  });

  it('Req 10.1 to 10.6: hasRecognisedCsvHeader follows the same recognition rule', () => {
    expect(hasRecognisedCsvHeader('Date,Description,Amount')).toBe(true);
    expect(hasRecognisedCsvHeader('\n\ndate;payee;debit;credit\n1;2;3;4')).toBe(true);
    expect(hasRecognisedCsvHeader('Date,Description,Debit')).toBe(false);
    expect(hasRecognisedCsvHeader('Date,Memo')).toBe(false);
    expect(hasRecognisedCsvHeader('')).toBe(false);
  });
});

describe('parseCsv dates', () => {
  const cases: readonly [string, DateOrder, string | null, string | undefined][] = [
    ['2026-11-05', 'dmy', '2026-11-05', undefined],
    ['2026-11-05', 'mdy', '2026-11-05', undefined],
    ['5/11/26', 'dmy', '2026-11-05', undefined],
    ['5/11/26', 'mdy', '2026-05-11', undefined],
    ['  2026-11-05  ', 'dmy', '2026-11-05', undefined],
    ['2026-11-05 14:30', 'dmy', '2026-11-05', '14:30'],
    ['2026-11-05T9:05', 'dmy', '2026-11-05', '09:05'],
    ['2026-11-05T09:05:59', 'dmy', '2026-11-05', '09:05'],
    ['2026-11-05 2:30 PM', 'dmy', '2026-11-05', '14:30'],
    ['2026-11-05 2:30pm', 'dmy', '2026-11-05', '14:30'],
    ['5/11/2026 12:05 AM', 'dmy', '2026-11-05', '00:05'],
    ['2026-11-05 11:59:59 PM', 'dmy', '2026-11-05', '23:59'],
    ['2026-11-05T09:05:00Z', 'dmy', null, undefined],
    ['2026-11-05 09:05:00+03:00', 'dmy', null, undefined],
    ['2026-11-05 13:00 PM', 'dmy', null, undefined],
    ['2026-11-05 09:05:60', 'dmy', null, undefined],
    ['2026-11-05  09:05', 'dmy', null, undefined],
    ['2026-11-05t09:05', 'dmy', null, undefined],
    ['2026-02-30', 'dmy', null, undefined],
    ['2026-13-01', 'dmy', null, undefined],
    ['November 5, 2026', 'dmy', null, undefined],
    ['', 'dmy', null, undefined],
  ];

  it.each(cases)(
    'Req 11.1, 11.2, 11.3, 11.4: date cell %j under %s',
    (cell, order, expectedDate, expectedTime) => {
      const result = parseCsv('Date,Description,Amount\n"' + cell + '",Cafe,-1.00', 'USD', order);
      if (expectedDate === null) {
        expect(result.transactions).toEqual([]);
        expect(asPairs(result)).toEqual([[2, ISSUES.invalidDate]]);
      } else {
        expect(result.issues).toEqual([]);
        expect(result.transactions.map((t) => [t.occurredOn, t.time])).toEqual([
          [expectedDate, expectedTime],
        ]);
      }
    },
  );

  it('Req 11.2: a transaction without a time has no time property', () => {
    const [tx] = parse(['Date,Description,Amount', '2026-11-05,Cafe,-1.00']).transactions;
    expect(tx).toBeDefined();
    expect(tx !== undefined && 'time' in tx).toBe(false);
  });
});

describe('parseCsv amounts', () => {
  const header = 'Date,Description,Amount';

  function amountOf(cell: string, currency = 'USD') {
    return parse([header, '2026-01-01,x,"' + cell + '"'], currency);
  }

  it('Req 11.5: the sign is kept, symbols and a default-currency code in any case are ignored', () => {
    const cases: readonly [string, number][] = [
      ['-12.34', -1234],
      ['+5', 500],
      ['(5.00)', -500],
      ['$1.50', 150],
      ['usd 1.25', 125],
      ['1,250.00', 125000],
    ];
    for (const [cell, minor] of cases) {
      const result = amountOf(cell);
      expect(result.issues).toEqual([]);
      expect(result.transactions.map((t) => t.amount)).toEqual([{ minor, currency: 'USD' }]);
    }
  });

  it('Req 11.5: defaultCurrency decides the currency and the exponent of every amount', () => {
    expect(amountOf('1500', 'JPY').transactions.map((t) => t.amount)).toEqual([
      { minor: 1500, currency: 'JPY' },
    ]);
    expect(asPairs(amountOf('1500.00', 'JPY'))).toEqual([[2, ISSUES.invalidAmount]]);
  });

  it('Req 11.10: a rejected amount gives Invalid amount or Amount too large and skips the Record', () => {
    const invalid = amountOf('abc');
    expect(invalid.transactions).toEqual([]);
    expect(asPairs(invalid)).toEqual([[2, ISSUES.invalidAmount]]);
    expect(asPairs(amountOf(''))).toEqual([[2, ISSUES.invalidAmount]]);
    expect(asPairs(amountOf('1000000000.01'))).toEqual([[2, ISSUES.amountTooLarge]]);
    expect(amountOf('1000000000.00').transactions.map((t) => t.amount.minor)).toEqual([LIMIT]);
  });

  it('Req 11.16: a different currency code gives Currency mismatch', () => {
    const result = amountOf('EUR 5.00');
    expect(result.transactions).toEqual([]);
    expect(asPairs(result)).toEqual([[2, ISSUES.currencyMismatch]]);
  });

  it('Req 11.10, 11.16: an amount error wins over a currency mismatch (Decisions D5(c))', () => {
    expect(asPairs(amountOf('EUR 5.123'))).toEqual([[2, ISSUES.invalidAmount]]);
    expect(asPairs(amountOf('EUR 1000000000.01'))).toEqual([[2, ISSUES.amountTooLarge]]);
  });

  it('Req 11.6, 11.7: a debit alone is negative and a credit alone is positive', () => {
    const result = parse([
      'Date,Description,Debit,Credit',
      '2026-01-01,a,2.50,',
      '2026-01-02,b,,4.00',
      '2026-01-03,c,0.00,',
    ]);
    expect(result.issues).toEqual([]);
    expect(result.transactions.map((t) => t.amount.minor)).toEqual([-250, 400, 0]);
    expect(Object.is(result.transactions[2]?.amount.minor, 0)).toBe(true);
  });

  it('Req 11.8: both cells filled, or neither, gives Invalid debit or credit', () => {
    const result = parse([
      'Date,Description,Debit,Credit',
      '2026-01-01,a,1.00,1.00',
      '2026-01-02,b,,',
      '2026-01-03,c,  ,  ',
    ]);
    expect(result.transactions).toEqual([]);
    expect(asPairs(result)).toEqual([
      [2, ISSUES.invalidDebitOrCredit],
      [3, ISSUES.invalidDebitOrCredit],
      [4, ISSUES.invalidDebitOrCredit],
    ]);
  });

  it('Req 11.9: a sign or parentheses in a debit or credit cell gives Invalid debit or credit', () => {
    const result = parse([
      'Date,Description,Debit,Credit',
      '2026-01-01,a,-1.00,',
      '2026-01-02,b,,+1.00',
      '2026-01-03,c,(1.00),',
    ]);
    expect(result.transactions).toEqual([]);
    expect(asPairs(result)).toEqual([
      [2, ISSUES.invalidDebitOrCredit],
      [3, ISSUES.invalidDebitOrCredit],
      [4, ISSUES.invalidDebitOrCredit],
    ]);
  });

  it('Req 11.10, 11.16: debit and credit cells use the same amount rules', () => {
    const result = parse([
      'Date,Description,Debit,Credit',
      '2026-01-01,a,abc,',
      '2026-01-02,b,,EUR 1.00',
      '2026-01-03,c,1000000000.01,',
    ]);
    expect(asPairs(result)).toEqual([
      [2, ISSUES.invalidAmount],
      [3, ISSUES.currencyMismatch],
      [4, ISSUES.amountTooLarge],
    ]);
  });
});

describe('parseCsv descriptions, identity and recovery', () => {
  const header = 'Date,Description,Amount';

  it('Req 11.11, 5.5: the description is trimmed and long digit groups are masked', () => {
    const result = parse([header, '2026-01-01,  Pay 0711 000 222 now  ,-1.00']);
    expect(result.transactions.map((t) => t.description)).toEqual(['Pay [number] now']);
  });

  it('Req 5.5: a short digit group is kept', () => {
    const result = parse([header, '2026-01-01,Shop 123456,-1.00']);
    expect(result.transactions.map((t) => t.description)).toEqual(['Shop 123456']);
  });

  it('Req 11.12: an empty or blank description gives Missing description and skips the Record', () => {
    const result = parse([
      header,
      '2026-01-01,,-1.00',
      '2026-01-02,   ,-1.00',
      '2026-01-03,x,-1.00',
    ]);
    expect(asPairs(result)).toEqual([
      [2, ISSUES.missingDescription],
      [3, ISSUES.missingDescription],
    ]);
    expect(result.transactions.map((t) => t.description)).toEqual(['x']);
  });

  it('Req 11.13: source is csv and counterparty and reference are absent', () => {
    const [tx] = parse([header, '2026-01-01,x,-1.00']).transactions;
    expect(tx?.source).toBe('csv');
    expect(tx !== undefined && 'counterparty' in tx).toBe(false);
    expect(tx !== undefined && 'reference' in tx).toBe(false);
  });

  it('Req 20.12: a description like "ABCDEFGHIJ confirmed." is a normal row', () => {
    const result = parse([header, '2026-01-01,ABCDEFGHIJ confirmed.,-1.00']);
    expect(result.issues).toEqual([]);
    expect(result.transactions.map((t) => t.description)).toEqual(['ABCDEFGHIJ confirmed.']);
  });

  it('Req 6.7, 6.8: ids are deterministic and identical rows get a counter suffix', () => {
    const lines = [header, '2026-01-01,x,-1.00', '2026-01-01,x,-1.00', '2026-01-02,x,-1.00'];
    const first = parse(lines).transactions.map((t) => t.id);
    expect(parse(lines).transactions.map((t) => t.id)).toEqual(first);
    expect(first).toHaveLength(3);
    expect(new Set(first).size).toBe(3);
    expect(first[0]).toMatch(/^tx-[0-9a-f]{8}$/);
    expect(first[1]).toBe(`${first[0] ?? ''}-2`);
  });

  it('Req 9.12, 11.14: a field-count mismatch is reported and the other Records still parse', () => {
    const result = parse([
      header,
      '2026-01-01,a,-1.00,extra',
      '2026-01-02,b,-2.00',
      '2026-01-03,c',
    ]);
    expect(result.issues).toEqual([
      {
        line: 2,
        message: ISSUES.wrongNumberOfFields(3, 4),
        excerpt: '[number],a,-1.00,extra',
      },
      { line: 4, message: ISSUES.wrongNumberOfFields(3, 2), excerpt: '[number],c' },
    ]);
    expect(result.transactions.map((t) => t.description)).toEqual(['b']);
  });

  it('Req 9.7: text after a closing quote gives Malformed quoted field and later Records parse', () => {
    const result = parse([header, '2026-01-01,"Raven" Rides,-6.00', '2026-01-02,ok,-1.00']);
    expect(result.issues).toEqual([
      {
        line: 2,
        message: ISSUES.malformedQuotedField,
        excerpt: '[number],"Raven" Rides,-6.00',
      },
    ]);
    expect(result.transactions.map((t) => t.description)).toEqual(['ok']);
  });

  it('Req 9.8: an unterminated quote consumes the rest of the text and ends the parse', () => {
    const result = parse([
      header,
      '2026-01-01,a,-1.00',
      '2026-01-02,"open,-5.00',
      '2026-01-03,b,-2.00',
    ]);
    expect(result.transactions.map((t) => t.description)).toEqual(['a']);
    expect(result.issues).toEqual([
      {
        line: 3,
        message: ISSUES.unterminatedQuote,
        excerpt: buildExcerpt('2026-01-02,"open,-5.00 2026-01-03,b,-2.00'),
      },
    ]);
  });

  it('Req 9.10, 9.11, 5.6: line is the start line, the excerpt joins lines with a space and masks digits', () => {
    const result = parse([header, '2026-01-01,a,-1.00', '"line one', 'line 12345678",x']);
    expect(result.issues).toEqual([
      {
        line: 3,
        message: ISSUES.wrongNumberOfFields(3, 2),
        excerpt: '"line one line [number]",x',
      },
    ]);
  });

  it('Req 9.5, 9.9: a quoted line break stays in the field and blank lines make no issue', () => {
    const result = parseCsv(
      '\r\n\r\nDate,Description,Amount\r\n\r\n2026-01-01,"Crypt Cafe\r\nNight Shift",-4.50\n   \n\n',
      'USD',
      'dmy',
    );
    expect(result.issues).toEqual([]);
    expect(result.transactions.map((t) => t.description)).toEqual(['Crypt Cafe\r\nNight Shift']);
  });

  it('Req 9.1, 8.13: a CR alone is ordinary text and issues keep input order across reader and parser', () => {
    const text = [
      'Date,Description,Amount',
      '2026-11-01,"Moonlight Cloud Storage",-9.99',
      '',
      '2026-11-02,"Crypt Cafe',
      'Night Shift",-4.50',
      '2026-11-03,Hollow Hill Grocers,-23.10',
      '2026-11-04,"Raven" Rides,-6.00',
      '2026-11-05,Gloom Gym,-30.00,extra',
      'not-a-date,Spectral Streaming,-12.99',
      '2026-11-08,"Unfinished,-5.00',
    ].join('\n');
    const result = parseCsv(text, 'USD', 'dmy');
    expect(result.transactions.map((t) => [t.amount.minor, t.description])).toEqual([
      [-999, 'Moonlight Cloud Storage'],
      [-450, 'Crypt Cafe\nNight Shift'],
      [-2310, 'Hollow Hill Grocers'],
    ]);
    expect(asPairs(result)).toEqual([
      [7, ISSUES.malformedQuotedField],
      [8, ISSUES.wrongNumberOfFields(3, 4)],
      [9, ISSUES.invalidDate],
      [10, ISSUES.unterminatedQuote],
    ]);
    const lone = parse(['Date,Description,Amount', '2026-01-01,"a\rb",-1.00']);
    expect(lone.transactions.map((t) => t.description)).toEqual(['a\rb']);
  });
});

// ---- generators for the property tests ----

interface GenRow {
  readonly date: string;
  readonly description: string;
  readonly minor: number;
}

interface Table {
  readonly delimiter: ',' | ';' | '\t';
  readonly currency: string;
  readonly mode: 'amount' | 'dc';
  readonly rows: readonly GenRow[];
}

const letterArb = fc.constantFrom('a', 'b', 'Z', 'x');

// First and last characters are letters, so trimming and masking leave the text unchanged.
function descriptionArb(extras: readonly string[]): fc.Arbitrary<string> {
  return fc
    .tuple(
      letterArb,
      fc.array(fc.constantFrom('a', 'B', ' ', ...extras), { maxLength: 8 }),
      letterArb,
    )
    .map(([first, middle, last]) => first + middle.join('') + last);
}

const minorArb = fc
  .oneof(
    fc.integer({ min: -LIMIT, max: LIMIT }),
    fc.integer({ min: -100_000, max: 100_000 }),
    fc.constantFrom(0, LIMIT, -LIMIT),
  )
  .map((m) => m + 0);

function tableArb(extras: readonly string[]): fc.Arbitrary<Table> {
  return fc.record({
    delimiter: delimiterArb,
    currency: fc.constantFrom('USD', 'JPY', 'KES'),
    mode: fc.constantFrom<'amount' | 'dc'>('amount', 'dc'),
    rows: fc.array(
      fc.record({
        date: validPartsArb.map(isoText),
        description: descriptionArb(extras),
        minor: minorArb,
      }),
      { maxLength: 6 },
    ),
  });
}

function csvRowsOf(table: Table): { header: string[]; body: string[][] } {
  const money = (minor: number): string => formatMoney(createMoney(minor, table.currency));
  if (table.mode === 'amount') {
    return {
      header: ['Date', 'Description', 'Amount'],
      body: table.rows.map((r) => [r.date, r.description, money(r.minor)]),
    };
  }
  return {
    header: ['Date', 'Description', 'Debit', 'Credit'],
    body: table.rows.map((r) =>
      r.minor < 0
        ? [r.date, r.description, money(-r.minor), '']
        : [r.date, r.description, '', money(r.minor)],
    ),
  };
}

function expectedOf(table: Table): Transaction[] {
  return table.rows.map((r) => ({
    id: '',
    occurredOn: r.date,
    amount: { minor: r.minor, currency: table.currency },
    description: r.description,
    source: 'csv',
  }));
}

function sumMinor(items: readonly { readonly minor: number }[]): number {
  return items.reduce((total, item) => total + item.minor, 0);
}

describe('parseCsv properties', () => {
  // Feature: 01-parsers, Property 30: CSV round trip preserves rows, order and totals
  it('Req 11.1, 11.5, 11.6, 11.7, 11.11, 11.13, 16.6, 20.5, 20.11: P30 written rows parse back unchanged', () => {
    fc.assert(
      fc.property(
        tableArb([',', ';', '"', '\t']),
        fc.array(lineBreakArb, { minLength: 1, maxLength: 3 }),
        fc.boolean(),
        fc.constantFrom<DateOrder>('dmy', 'mdy'),
        (table, breaks, trailing, order) => {
          const { header, body } = csvRowsOf(table);
          const written = writeCsv([header, ...body], table.delimiter, breaks, trailing);
          const result = parseCsv(written.text, table.currency, order);
          expect(result.issues).toEqual([]);
          expect(result.transactions.map(withoutId)).toEqual(expectedOf(table));
          expect(sumMinor(result.transactions.map((t) => t.amount))).toBe(sumMinor(table.rows));
          const ids = result.transactions.map((t) => t.id);
          expect(new Set(ids).size).toBe(ids.length);
          expect(parseCsv(written.text, table.currency, order)).toEqual(result);
        },
      ),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 31: CSV structural quirks round-trip correctly
  it('Req 9.1, 9.2, 9.5, 9.9: P31 quirks give the same transactions as the plain text', () => {
    const quirkTableArb = tableArb([',', ';', '"', '\t', '\n', '\r', '\r\n']);
    fc.assert(
      fc.property(
        quirkTableArb,
        fc.array(recordSeparatorArb, { minLength: 8, maxLength: 8 }),
        fc.constantFrom('', '\n', '\r\n', '  \n', '\n\n \r\n'),
        fc.boolean(),
        (table, separators, leading, trailing) => {
          const { header, body } = csvRowsOf(table);
          const all = [header, ...body].map((row) => writeCsvRow(row, table.delimiter));
          let text = leading;
          all.forEach((row, index) => {
            text += row;
            if (index < all.length - 1 || trailing) {
              text += separators[index] ?? '\n';
            }
          });
          const plain = writeCsv([header, ...body], table.delimiter, ['\n'], false).text;
          const result = parseCsv(text, table.currency, 'dmy');
          expect(result.issues).toEqual([]);
          expect(result.transactions.map(withoutId)).toEqual(expectedOf(table));
          expect(result).toEqual(parseCsv(plain, table.currency, 'dmy'));
        },
      ),
      RUNS,
    );
  });

  const goodRow = (index: number): string => '2026-01-01,Row ' + String(index) + ',1.00';
  const HEADER = 'Date,Description,Amount';

  // Feature: 01-parsers, Property 33: Malformed and unterminated quotes are reported precisely
  it('Req 9.7: P33 text after a closing quote gives one Malformed quoted field issue and the rest parses', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        fc.integer({ min: 0, max: 4 }),
        fc.constantFrom('', ' ', '  ', '\t'),
        fc.array(fc.constantFrom('x', 'Z', '7', '-', '!'), { minLength: 1, maxLength: 4 }),
        fc.array(lineBreakArb, { minLength: 1, maxLength: 3 }),
        (before, after, gap, junk, breaks) => {
          const bad = '"ab"' + gap + junk.join('') + ',2026-01-01,1.00';
          const lines = [
            HEADER,
            ...Array.from({ length: before }, (_, i) => goodRow(i)),
            bad,
            ...Array.from({ length: after }, (_, i) => goodRow(before + i)),
          ];
          const text = lines
            .map((line, i) =>
              i < lines.length - 1 ? line + (breaks[i % breaks.length] ?? '\n') : line,
            )
            .join('');
          const result = parseCsv(text, 'USD', 'dmy');
          expect(result.issues).toEqual([
            { line: before + 2, message: ISSUES.malformedQuotedField, excerpt: buildExcerpt(bad) },
          ]);
          expect(result.transactions).toHaveLength(before + after);
        },
      ),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 33: Malformed and unterminated quotes are reported precisely
  it('Req 9.8: P33 an unterminated quote gives one issue, takes the rest as content and ends the parse', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        fc.array(fc.constantFrom('2026-01-01', 'x'), { maxLength: 2 }),
        fc.array(fc.constantFrom('a', ',', ';', '\n', '\r\n', '\r', ' ', '2026-01-01,b,1.00'), {
          maxLength: 8,
        }),
        fc.array(lineBreakArb, { minLength: 1, maxLength: 3 }),
        (before, prefix, tail, breaks) => {
          const lines = [HEADER, ...Array.from({ length: before }, (_, i) => goodRow(i))];
          const head = lines.map((line, i) => line + (breaks[i % breaks.length] ?? '\n')).join('');
          const record = prefix.map((p) => p + ',').join('') + '"' + tail.join('');
          const result = parseCsv(head + record, 'USD', 'dmy');
          const raw = record.split('\r\n').join(' ').split('\n').join(' ');
          expect(result.issues).toEqual([
            { line: before + 2, message: ISSUES.unterminatedQuote, excerpt: buildExcerpt(raw) },
          ]);
          expect(result.transactions).toHaveLength(before);
        },
      ),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 38: Date and amount cells follow the Calendar_Module and Amount_Grammar outcomes
  it('Req 11.2, 11.3, 11.4: P38 date cells follow parseDate and parseTime', () => {
    const clockArb = fc.record({
      hour: fc.integer({ min: 0, max: 30 }),
      padHour: fc.boolean(),
      minute: fc.integer({ min: 0, max: 59 }),
      seconds: fc.option(fc.integer({ min: 0, max: 99 }), { nil: undefined }),
      marker: fc.constantFrom('', 'am', 'PM', 'Pm', 'aM'),
      space: fc.constantFrom('', ' '),
    });
    const cellArb = fc.record({
      parts: fc.oneof(anyPartsArb, validPartsArb),
      style: fc.constantFrom<'iso' | 'slash'>('iso', 'slash'),
      order: fc.constantFrom<DateOrder>('dmy', 'mdy'),
      padFirst: fc.boolean(),
      padSecond: fc.boolean(),
      shortYear: fc.boolean(),
      separator: fc.constantFrom(' ', 'T'),
      tail: fc.oneof(
        fc.constant<null>(null),
        clockArb,
        fc.constantFrom('Z', ' 10:00Z', ' 10:00 +03:00', '  10:00', ' 10', ' 10:5', ' 25:00:00:00'),
      ),
    });
    fc.assert(
      fc.property(cellArb, (spec) => {
        const { parts, order } = spec;
        const first = order === 'dmy' ? parts.day : parts.month;
        const second = order === 'dmy' ? parts.month : parts.day;
        const dateText =
          spec.style === 'iso'
            ? isoText(parts)
            : numberText(first, spec.padFirst) +
              '/' +
              numberText(second, spec.padSecond) +
              '/' +
              (spec.shortYear
                ? numberText(parts.year % 100, true)
                : String(parts.year).padStart(4, '0'));

        let cell = dateText;
        let expectedTime: string | undefined;
        let timeOk = true;
        const tail = spec.tail;
        if (typeof tail === 'string') {
          cell += tail.startsWith(' ') || tail.startsWith('Z') ? tail : spec.separator + tail;
          timeOk = false;
        } else if (tail !== null) {
          const hourText = numberText(tail.hour, tail.padHour);
          const minuteText = numberText(tail.minute, true);
          const secondsText =
            tail.seconds === undefined ? '' : ':' + numberText(tail.seconds, true);
          const markerText = tail.marker === '' ? '' : tail.space + tail.marker;
          cell += spec.separator + hourText + ':' + minuteText + secondsText + markerText;
          const time = parseTime(hourText + ':' + minuteText + markerText);
          timeOk = time.ok && (tail.seconds === undefined || tail.seconds <= 59);
          expectedTime = time.ok ? time.value : undefined;
        }
        const date = parseDate(dateText, order);
        const text = 'Date,Description,Amount\n' + writeCsvRow([cell, 'Cafe', '1.00'], ',');
        const result = parseCsv(text, 'USD', order);
        if (date.ok && timeOk) {
          expect(result.issues).toEqual([]);
          expect(result.transactions).toHaveLength(1);
          expect(result.transactions[0]?.occurredOn).toBe(date.value);
          expect(result.transactions[0]?.time).toBe(expectedTime);
        } else {
          expect(result.transactions).toEqual([]);
          expect(asPairs(result)).toEqual([[2, ISSUES.invalidDate]]);
        }
      }),
      RUNS,
    );
  });

  const amountCellArb = fc.oneof(
    validSpecArb.map((spec) => ({ text: renderAmount(spec), currency: spec.defaultCurrency })),
    boundaryCaseArb.map((c) => ({ text: renderAmount(c.spec), currency: c.spec.defaultCurrency })),
    fc
      .tuple(amountLikeTextArb, fc.constantFrom('USD', 'KES', 'JPY'))
      .map(([text, currency]) => ({ text, currency })),
  );

  function expectedFor(
    text: string,
    currency: string,
    negate: boolean,
  ): { minor: number; currency: string } | string {
    const parsed = parseAmountText(text, currency);
    if (!parsed.ok) {
      return parsed.reason === 'too-large' ? ISSUES.amountTooLarge : ISSUES.invalidAmount;
    }
    if (parsed.value.currency !== currency) {
      return ISSUES.currencyMismatch;
    }
    return { minor: negate ? 0 - parsed.value.minor : parsed.value.minor, currency };
  }

  function checkOutcome(
    result: ReturnType<typeof parseCsv>,
    expected: { minor: number; currency: string } | string,
  ): void {
    if (typeof expected === 'string') {
      expect(result.transactions).toEqual([]);
      expect(asPairs(result)).toEqual([[2, expected]]);
    } else {
      expect(result.issues).toEqual([]);
      expect(result.transactions.map((t) => t.amount)).toEqual([expected]);
    }
  }

  // Feature: 01-parsers, Property 38: Date and amount cells follow the Calendar_Module and Amount_Grammar outcomes
  it('Req 11.10, 11.16: P38 amount cells follow parseAmountText', () => {
    fc.assert(
      fc.property(amountCellArb, ({ text, currency }) => {
        const csv = 'Date,Description,Amount\n' + writeCsvRow(['2026-01-01', 'x', text], ',');
        checkOutcome(parseCsv(csv, currency, 'dmy'), expectedFor(text, currency, false));
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 38: Date and amount cells follow the Calendar_Module and Amount_Grammar outcomes
  it('Req 11.10, 11.16: P38 debit and credit cells follow parseAmountText', () => {
    fc.assert(
      fc.property(amountCellArb, fc.boolean(), ({ text, currency }, isDebit) => {
        const cells = isDebit ? [text, ''] : ['', text];
        const csv =
          'Date,Description,Debit,Credit\n' + writeCsvRow(['2026-01-01', 'x', ...cells], ',');
        const signed = /[-+()]/.test(text);
        const expected =
          text.trim() === '' || signed
            ? ISSUES.invalidDebitOrCredit
            : expectedFor(text, currency, isDebit);
        checkOutcome(parseCsv(csv, currency, 'dmy'), expected);
      }),
      RUNS,
    );
  });
});
