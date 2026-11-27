import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  isLeapYear,
  isValidCalendarDate,
  parseDate,
  parseIsoDate,
  parseSlashDate,
  parseTime,
  parseTime12,
  parseTime24,
} from './calendar';
import {
  ambiguousPartsArb,
  anyPartsArb,
  arbitraryTextArb,
  clock12Arb,
  clock24Arb,
  expectedHour24,
  isoText,
  markerText,
  numberText,
  padTo,
  referenceIsLeap,
  referenceIsValid,
  validPartsArb,
  yearArb,
} from './calendar.testkit';

const RUNS = { numRuns: 300 };

describe('calendar properties', () => {
  // Feature: 01-parsers, Property 12: Calendar validity matches the reference table
  it('Req 4.1, 4.2: P12 validity and leap years match the reference table', () => {
    fc.assert(
      fc.property(anyPartsArb, ({ year, month, day }) => {
        expect(isValidCalendarDate(year, month, day)).toBe(referenceIsValid(year, month, day));
        expect(isLeapYear(year)).toBe(referenceIsLeap(year));
        const result = parseIsoDate(`${padTo(year, 4)}-${padTo(month, 2)}-${padTo(day, 2)}`);
        expect(result.ok).toBe(referenceIsValid(year, month, day));
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 13: ISO dates parse regardless of Date_Order, slash dates respect it
  it('Req 4.3: P13 ISO dates parse the same under both date orders', () => {
    fc.assert(
      fc.property(validPartsArb, (parts) => {
        const text = isoText(parts);
        const expected = { ok: true, value: text };
        expect(parseDate(text, 'dmy')).toEqual(expected);
        expect(parseDate(text, 'mdy')).toEqual(expected);
        expect(parseIsoDate(text)).toEqual(expected);
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 13: ISO dates parse regardless of Date_Order, slash dates respect it
  it('Req 4.4, 4.5, 4.6: P13 slash dates read day or month first by Date_Order', () => {
    fc.assert(
      fc.property(validPartsArb, fc.boolean(), fc.boolean(), (parts, padDay, padMonth) => {
        const day = numberText(parts.day, padDay);
        const month = numberText(parts.month, padMonth);
        const year = padTo(parts.year, 4);
        const expected = { ok: true, value: isoText(parts) };
        expect(parseSlashDate(`${day}/${month}/${year}`, 'dmy')).toEqual(expected);
        expect(parseSlashDate(`${month}/${day}/${year}`, 'mdy')).toEqual(expected);
        expect(parseDate(`${day}/${month}/${year}`, 'dmy')).toEqual(expected);
        expect(parseSlashDate(`${day}/${month}/${year}`)).toEqual(expected);
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 13: ISO dates parse regardless of Date_Order, slash dates respect it
  it('Req 4.4, 4.5: P13 the two orders disagree on swapped day and month', () => {
    fc.assert(
      fc.property(ambiguousPartsArb, (parts) => {
        const text = `${parts.day}/${parts.month}/${padTo(parts.year, 4)}`;
        const dmy = parseSlashDate(text, 'dmy');
        const mdy = parseSlashDate(text, 'mdy');
        expect(dmy).toEqual(
          parseDate(`${parts.month}/${parts.day}/${padTo(parts.year, 4)}`, 'mdy'),
        );
        if (parts.day !== parts.month && dmy.ok && mdy.ok) {
          expect(dmy.value).not.toBe(mdy.value);
        }
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 14: Slash-date year rules
  it('Req 4.7: P14 a 2-digit year means 2000 plus its value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.constantFrom<'dmy' | 'mdy'>('dmy', 'mdy'),
        (yy, month, day, order) => {
          const first = order === 'dmy' ? day : month;
          const second = order === 'dmy' ? month : day;
          const text = `${first}/${second}/${padTo(yy, 2)}`;
          expect(parseSlashDate(text, order)).toEqual({
            ok: true,
            value: `${padTo(2000 + yy, 4)}-${padTo(month, 2)}-${padTo(day, 2)}`,
          });
        },
      ),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 14: Slash-date year rules
  it('Req 4.8: P14 a 4-digit year is used as written and 0000 fails', () => {
    fc.assert(
      fc.property(
        yearArb,
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (year, month, day) => {
          expect(parseSlashDate(`${day}/${month}/${padTo(year, 4)}`, 'dmy')).toEqual({
            ok: true,
            value: `${padTo(year, 4)}-${padTo(month, 2)}-${padTo(day, 2)}`,
          });
          expect(parseSlashDate(`${day}/${month}/0000`, 'dmy')).toEqual({
            ok: false,
            reason: 'invalid',
          });
        },
      ),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 16: Time parsing and the 12-to-24-hour conversion table
  it('Req 4.10: P16 24-hour times are zero-padded to HH:MM', () => {
    fc.assert(
      fc.property(clock24Arb, fc.boolean(), ({ hour, minute }, padHour) => {
        const expected = { ok: true, value: `${padTo(hour, 2)}:${padTo(minute, 2)}` };
        const text = `${numberText(hour, padHour)}:${padTo(minute, 2)}`;
        expect(parseTime24(text)).toEqual(expected);
        expect(parseTime(text)).toEqual(expected);
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 16: Time parsing and the 12-to-24-hour conversion table
  it('Req 4.10: P16 out-of-range hours and minutes fail', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 24, max: 99 }),
        fc.integer({ min: 60, max: 99 }),
        clock24Arb,
        (badHour, badMinute, ok) => {
          const failure = { ok: false, reason: 'invalid' };
          expect(parseTime24(`${badHour}:${padTo(ok.minute, 2)}`)).toEqual(failure);
          expect(parseTime24(`${padTo(ok.hour, 2)}:${badMinute}`)).toEqual(failure);
        },
      ),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 16: Time parsing and the 12-to-24-hour conversion table
  it('Req 4.11, 4.12, 4.13: P16 12-hour times convert by the table, in any case', () => {
    fc.assert(
      fc.property(
        clock12Arb,
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        ({ hour, minute }, isPm, withSpace, padHour, upperFirst, upperSecond) => {
          const marker = markerText(isPm, upperFirst, upperSecond);
          const text = `${numberText(hour, padHour)}:${padTo(minute, 2)}${withSpace ? ' ' : ''}${marker}`;
          const expected = {
            ok: true,
            value: `${padTo(expectedHour24(hour, isPm), 2)}:${padTo(minute, 2)}`,
          };
          expect(parseTime12(text)).toEqual(expected);
          expect(parseTime(text)).toEqual(expected);
        },
      ),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 16: Time parsing and the 12-to-24-hour conversion table
  it('Req 4.11: P16 12-hour times with hour 0 or above 12, or two spaces, fail', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(0), fc.integer({ min: 13, max: 23 })),
        clock12Arb,
        fc.boolean(),
        (badHour, ok, isPm) => {
          const marker = isPm ? 'PM' : 'AM';
          const failure = { ok: false, reason: 'invalid' };
          expect(parseTime12(`${badHour}:${padTo(ok.minute, 2)} ${marker}`)).toEqual(failure);
          expect(parseTime12(`${ok.hour}:${padTo(ok.minute, 2)}  ${marker}`)).toEqual(failure);
        },
      ),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 17: Date and time parsing never throw
  it('Req 4.14: P17 any text gives an outcome and never throws', () => {
    fc.assert(
      fc.property(arbitraryTextArb, (text) => {
        const outcomes = [
          parseIsoDate(text),
          parseSlashDate(text, 'dmy'),
          parseSlashDate(text, 'mdy'),
          parseDate(text, 'dmy'),
          parseDate(text, 'mdy'),
          parseTime24(text),
          parseTime12(text),
          parseTime(text),
        ];
        for (const outcome of outcomes) {
          if (outcome.ok) {
            expect(typeof outcome.value).toBe('string');
          } else {
            expect(outcome.reason).toBe('invalid');
          }
        }
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 17: Date and time parsing never throw
  it('Req 4.14: P17 any integers give a boolean from isValidCalendarDate', () => {
    fc.assert(
      fc.property(fc.double(), fc.double(), fc.double(), (y, m, d) => {
        expect(typeof isValidCalendarDate(y, m, d)).toBe('boolean');
      }),
      RUNS,
    );
  });
});
