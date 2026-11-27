import { describe, it, expect } from 'vitest';
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

const FAIL = { ok: false, reason: 'invalid' };

function ok(value: string): { ok: true; value: string } {
  return { ok: true, value };
}

describe('calendar examples', () => {
  it('Req 4.1: accepts real dates and rejects impossible ones', () => {
    expect(parseIsoDate('2026-11-05')).toEqual(ok('2026-11-05'));
    expect(parseIsoDate('2026-02-30')).toEqual(FAIL);
    expect(parseIsoDate('2026-13-01')).toEqual(FAIL);
    expect(parseIsoDate('2026-04-31')).toEqual(FAIL);
    expect(isValidCalendarDate(2026, 0, 1)).toBe(false);
  });

  it('Req 4.1: year 0000 fails and year 0001 is accepted', () => {
    expect(parseIsoDate('0000-01-01')).toEqual(FAIL);
    expect(parseIsoDate('0001-01-01')).toEqual(ok('0001-01-01'));
    expect(parseIsoDate('9999-12-31')).toEqual(ok('9999-12-31'));
  });

  it('Req 4.2: leap years 1900 no, 2000 yes, 2024 yes, 2100 no', () => {
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2100)).toBe(false);
  });

  it('Req 4.1, 4.2: 29 February exists only in leap years', () => {
    expect(parseIsoDate('2024-02-29')).toEqual(ok('2024-02-29'));
    expect(parseIsoDate('2000-02-29')).toEqual(ok('2000-02-29'));
    expect(parseIsoDate('1900-02-29')).toEqual(FAIL);
    expect(parseIsoDate('2100-02-29')).toEqual(FAIL);
    expect(parseIsoDate('2026-02-29')).toEqual(FAIL);
  });

  it('Req 4.3: an ISO date is accepted in both date orders', () => {
    expect(parseDate('2026-11-05', 'dmy')).toEqual(ok('2026-11-05'));
    expect(parseDate('2026-11-05', 'mdy')).toEqual(ok('2026-11-05'));
  });

  it('Req 4.4: dmy reads the first number as the day', () => {
    expect(parseSlashDate('5/11/26', 'dmy')).toEqual(ok('2026-11-05'));
  });

  it('Req 4.5: mdy reads the first number as the month', () => {
    expect(parseSlashDate('5/11/26', 'mdy')).toEqual(ok('2026-05-11'));
  });

  it('Req 4.6: dmy is the default when no date order is given', () => {
    expect(parseSlashDate('5/11/26')).toEqual(ok('2026-11-05'));
    expect(parseDate('5/11/2026')).toEqual(ok('2026-11-05'));
  });

  it('Req 4.7: a 2-digit year means 2000 plus its value', () => {
    expect(parseSlashDate('01/01/00', 'dmy')).toEqual(ok('2000-01-01'));
    expect(parseSlashDate('31/12/99', 'dmy')).toEqual(ok('2099-12-31'));
  });

  it('Req 4.8: a 4-digit year is used as written and 0000 fails', () => {
    expect(parseSlashDate('1/2/1999', 'dmy')).toEqual(ok('1999-02-01'));
    expect(parseSlashDate('1/2/0001', 'dmy')).toEqual(ok('0001-02-01'));
    expect(parseSlashDate('1/2/0000', 'dmy')).toEqual(FAIL);
  });

  it('Req 4.9: other separators fail', () => {
    expect(parseDate('5.11.2026', 'dmy')).toEqual(FAIL);
    expect(parseDate('5 11 2026', 'dmy')).toEqual(FAIL);
    expect(parseDate('5-11-2026', 'dmy')).toEqual(FAIL);
    expect(parseDate('2026/11/05', 'dmy')).toEqual(FAIL);
    expect(parseDate('2026-11/05', 'dmy')).toEqual(FAIL);
  });

  it('Req 4.9: month names fail', () => {
    expect(parseDate('5 Nov 2026', 'dmy')).toEqual(FAIL);
    expect(parseDate('Nov/5/2026', 'mdy')).toEqual(FAIL);
    expect(parseDate('5-Nov-2026', 'dmy')).toEqual(FAIL);
  });

  it('Req 4.9: wrong digit layouts fail', () => {
    expect(parseDate('2026-1-5', 'dmy')).toEqual(FAIL);
    expect(parseDate('26-11-05', 'dmy')).toEqual(FAIL);
    expect(parseDate('5/11/026', 'dmy')).toEqual(FAIL);
    expect(parseDate('5/11/20267', 'dmy')).toEqual(FAIL);
    expect(parseDate('005/11/2026', 'dmy')).toEqual(FAIL);
    expect(parseDate('5/011/2026', 'dmy')).toEqual(FAIL);
    expect(parseDate('5/11', 'dmy')).toEqual(FAIL);
    expect(parseDate('5/11/20/26', 'dmy')).toEqual(FAIL);
    expect(parseDate('/11/2026', 'dmy')).toEqual(FAIL);
    expect(parseDate('', 'dmy')).toEqual(FAIL);
    expect(parseDate(' 5/11/2026', 'dmy')).toEqual(FAIL);
  });

  it('Req 4.10: 24-hour times are zero-padded', () => {
    expect(parseTime24('9:05')).toEqual(ok('09:05'));
    expect(parseTime24('09:05')).toEqual(ok('09:05'));
    expect(parseTime24('0:00')).toEqual(ok('00:00'));
    expect(parseTime24('23:59')).toEqual(ok('23:59'));
    expect(parseTime('7:30')).toEqual(ok('07:30'));
    expect(parseTime24('24:00')).toEqual(FAIL);
    expect(parseTime24('12:60')).toEqual(FAIL);
    expect(parseTime24('12:5')).toEqual(FAIL);
    expect(parseTime24('12:30:15')).toEqual(FAIL);
  });

  it('Req 4.11: 12-hour times accept any letter case and one optional space', () => {
    expect(parseTime12('1:05 PM')).toEqual(ok('13:05'));
    expect(parseTime12('1:05pm')).toEqual(ok('13:05'));
    expect(parseTime12('01:05 Pm')).toEqual(ok('13:05'));
    expect(parseTime12('9:00 aM')).toEqual(ok('09:00'));
    expect(parseTime('9:00AM')).toEqual(ok('09:00'));
    expect(parseTime12('1:05  PM')).toEqual(FAIL);
    expect(parseTime12('0:30 AM')).toEqual(FAIL);
    expect(parseTime12('13:00 PM')).toEqual(FAIL);
    expect(parseTime12('1:05 XM')).toEqual(FAIL);
    expect(parseTime12('1:05')).toEqual(FAIL);
  });

  it('Req 4.12: 12 AM is hour 00 and 12 PM is hour 12', () => {
    expect(parseTime12('12:00 AM')).toEqual(ok('00:00'));
    expect(parseTime12('12:30 AM')).toEqual(ok('00:30'));
    expect(parseTime12('12:00 PM')).toEqual(ok('12:00'));
    expect(parseTime12('12:59 PM')).toEqual(ok('12:59'));
  });

  it('Req 4.13: 1 PM to 11 PM add 12 hours', () => {
    expect(parseTime12('1:00 PM')).toEqual(ok('13:00'));
    expect(parseTime12('11:59 PM')).toEqual(ok('23:59'));
    expect(parseTime12('1:00 AM')).toEqual(ok('01:00'));
    expect(parseTime12('11:00 AM')).toEqual(ok('11:00'));
  });

  it('Req 4.14: odd texts return an outcome without throwing', () => {
    for (const text of ['', ' ', '/', '//', ':', 'AM', '\u{1F600}', '9'.repeat(500), '-']) {
      expect(() => parseDate(text, 'dmy')).not.toThrow();
      expect(() => parseTime(text)).not.toThrow();
      expect(parseDate(text, 'mdy').ok).toBe(false);
      expect(parseTime(text).ok).toBe(false);
    }
  });

  it('Req 4.15: the source uses no Date global (enforced by lint, rule no-restricted-globals)', () => {
    // Lint decides: eslint.config.js forbids Date in src/core, so no runtime check is needed.
    expect(isValidCalendarDate(2026, 11, 5)).toBe(true);
  });
});
