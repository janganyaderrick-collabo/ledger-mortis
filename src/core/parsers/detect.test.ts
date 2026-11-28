import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { anyUnitsTextArb } from '../model/masking.testkit';
import { detectFormat } from './detect';
import { delimiterArb, writeCsv } from './csv-reader.testkit';
import { separatorArb, writePaidSms, writeReceivedSms } from './sms-parser.testkit';

const RUNS = { numRuns: 200 };

const SMS_ONE =
  'QWERTY1234 Confirmed. Ksh500.00 paid to Raven Rides on 5/11/26 at 6:42 PM. New balance is Ksh1.00.';
const SMS_FIELDS = {
  code: 'QWERTY1234',
  amount: 'Ksh500.00',
  date: '5/11/26',
  time: '6:42 PM',
  name: 'Raven Rides',
};

describe('detectFormat examples', () => {
  it('Req 15.4: empty and whitespace-only text is unknown', () => {
    expect(detectFormat('')).toBe('unknown');
    expect(detectFormat(' \n\t\r\n\u00a0')).toBe('unknown');
  });

  it('Req 15.1: a recognised CSV header gives csv', () => {
    expect(detectFormat('Date,Description,Amount\n2026-01-05,Gym,-9.99')).toBe('csv');
    expect(detectFormat('date;description;debit;credit\n')).toBe('csv');
  });

  it('Req 15.1, 15.7: the header check wins over a Message_Start later in the text', () => {
    expect(detectFormat('Date,Description,Amount\n' + SMS_ONE)).toBe('csv');
  });

  it('Req 15.7, 20.12: a record described "ABCDEFGHIJ confirmed." is still csv', () => {
    const text = 'Date,Description,Amount\n2026-01-05,ABCDEFGHIJ confirmed.,10.00\n';
    expect(detectFormat(text)).toBe('csv');
  });

  it('Req 15.2: a Message_Start without a recognised header gives mobile-money-sms', () => {
    expect(detectFormat(SMS_ONE)).toBe('mobile-money-sms');
    expect(detectFormat('some notes\n' + SMS_ONE)).toBe('mobile-money-sms');
  });

  it('Req 15.3: text with neither a header nor a Message_Start is unknown', () => {
    expect(detectFormat('hello world')).toBe('unknown');
    expect(detectFormat('Date,Amount\n2026-01-05,1.00')).toBe('unknown');
  });

  it('Req 15.5: odd text never throws and gives one of three values', () => {
    for (const text of ['"', '\uD800', '\r', ',,,,', 'Confirmed.']) {
      expect(['csv', 'mobile-money-sms', 'unknown']).toContain(detectFormat(text));
    }
  });
});

const headerArb = fc.constantFrom(
  ['Date', 'Description', 'Amount'],
  ['date', 'DESCRIPTION', 'amount'],
  ['Date', 'Description', 'Debit', 'Credit'],
);

const codeArb = fc
  .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), {
    minLength: 10,
    maxLength: 10,
  })
  .map((chars) => chars.join(''));

const smsTextArb = fc
  .tuple(fc.array(codeArb, { minLength: 1, maxLength: 3 }), separatorArb)
  .map(([codes, sep]) =>
    codes
      .map((code, index) =>
        index % 2 === 0
          ? writePaidSms({ ...SMS_FIELDS, code })
          : writeReceivedSms({ ...SMS_FIELDS, code }),
      )
      .join(' ' + sep + ' '),
  );

const junkArb = fc
  .array(fc.constantFrom('hello', 'world', 'notes', '12', '-', 'paid', 'to'), {
    minLength: 1,
    maxLength: 5,
  })
  .map((words) => words.join(' '));

const junkLinesArb = fc
  .array(fc.oneof(junkArb, fc.constantFrom('', '  ')), { minLength: 0, maxLength: 3 })
  .map((lines) => lines.join('\n'));

interface Expectation {
  readonly text: string;
  readonly expected: 'csv' | 'mobile-money-sms' | 'unknown';
}

const expectationArb: fc.Arbitrary<Expectation> = fc.oneof(
  fc
    .array(fc.constantFrom(' ', '\t', '\n', '\r', '\u00a0'), { maxLength: 8 })
    .map((chars) => ({ text: chars.join(''), expected: 'unknown' as const })),
  fc
    .tuple(delimiterArb, headerArb, fc.option(smsTextArb, { nil: undefined }), junkLinesArb)
    .map(([delimiter, header, sms, junk]) => ({
      text:
        writeCsv([header, ['2026-01-05', 'ABCDEFGHIJ confirmed.', '1.00']], delimiter, ['\n'], true)
          .text +
        (sms ?? '') +
        junk,
      expected: 'csv' as const,
    })),
  fc.tuple(junkLinesArb, smsTextArb).map(([junk, sms]) => ({
    text: junk + '\n' + sms,
    expected: 'mobile-money-sms' as const,
  })),
  junkLinesArb.map((junk) => ({ text: junk, expected: 'unknown' as const })),
);

describe('detectFormat properties', () => {
  // Feature: 01-parsers, Property 57: Format detection follows its three-check order and never throws
  it('Req 15.1, 15.2, 15.3, 15.4, 15.5: P57 detection follows header, then Message_Start, else unknown', () => {
    fc.assert(
      fc.property(expectationArb, ({ text, expected }) => {
        expect(detectFormat(text)).toBe(expected);
      }),
      RUNS,
    );
    fc.assert(
      fc.property(anyUnitsTextArb, (text) => {
        expect(['csv', 'mobile-money-sms', 'unknown']).toContain(detectFormat(text));
      }),
      RUNS,
    );
  });
});
