import fc from 'fast-check';

// Independent reference data. Plain tables, no Date object anywhere.
export const COMMON_YEAR_MONTH_LENGTHS: readonly number[] = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
];
export const LEAP_YEAR_MONTH_LENGTHS: readonly number[] = [
  31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
];

// Leap years by the written rule, phrased differently from the source under test.
export function referenceIsLeap(year: number): boolean {
  if (year % 400 === 0) {
    return true;
  }
  if (year % 100 === 0) {
    return false;
  }
  return year % 4 === 0;
}

export function referenceMonthLength(year: number, month: number): number {
  const table = referenceIsLeap(year) ? LEAP_YEAR_MONTH_LENGTHS : COMMON_YEAR_MONTH_LENGTHS;
  return table[month - 1] ?? 0;
}

export function referenceIsValid(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9999 || month < 1 || month > 12) {
    return false;
  }
  return day >= 1 && day <= referenceMonthLength(year, month);
}

export function padTo(n: number, width: number): string {
  let text = String(n);
  while (text.length < width) {
    text = '0' + text;
  }
  return text;
}

export interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export const yearArb = fc.integer({ min: 1, max: 9999 });
export const monthArb = fc.integer({ min: 1, max: 12 });

// Any (year, month, day) with day 0..40, valid or not.
export const anyPartsArb: fc.Arbitrary<DateParts> = fc.record({
  year: fc.oneof(yearArb, fc.constantFrom(1900, 2000, 2024, 2100, 1, 9999)),
  month: fc.integer({ min: 0, max: 13 }),
  day: fc.integer({ min: 0, max: 40 }),
});

// A calendar-valid date, built from the reference table.
export const validPartsArb: fc.Arbitrary<DateParts> = fc
  .tuple(fc.oneof(yearArb, fc.constantFrom(1900, 2000, 2024, 2100)), monthArb, fc.nat())
  .map(([year, month, pick]) => ({
    year,
    month,
    day: (pick % referenceMonthLength(year, month)) + 1,
  }));

// A valid date whose day-of-month is at most 12, so both date orders read it.
export const ambiguousPartsArb: fc.Arbitrary<DateParts> = fc.record({
  year: yearArb,
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 12 }),
});

export function isoText(parts: DateParts): string {
  return padTo(parts.year, 4) + '-' + padTo(parts.month, 2) + '-' + padTo(parts.day, 2);
}

// Number text with optional zero padding to 1 or 2 digits.
export function numberText(n: number, padded: boolean): string {
  return padded ? padTo(n, 2) : String(n);
}

export interface ClockParts {
  readonly hour: number;
  readonly minute: number;
}

export const clock24Arb: fc.Arbitrary<ClockParts> = fc.record({
  hour: fc.integer({ min: 0, max: 23 }),
  minute: fc.integer({ min: 0, max: 59 }),
});

export const clock12Arb: fc.Arbitrary<ClockParts> = fc.record({
  hour: fc.integer({ min: 1, max: 12 }),
  minute: fc.integer({ min: 0, max: 59 }),
});

// Expected 24-hour hour for a 12-hour clock reading (the conversion table).
export function expectedHour24(hour12: number, isPm: boolean): number {
  if (hour12 === 12) {
    return isPm ? 12 : 0;
  }
  return isPm ? hour12 + 12 : hour12;
}

// "AM" or "PM" with every letter independently upper or lower case.
export function markerText(isPm: boolean, upperFirst: boolean, upperSecond: boolean): string {
  const first = isPm ? 'p' : 'a';
  return (upperFirst ? first.toUpperCase() : first) + (upperSecond ? 'M' : 'm');
}

export const arbitraryTextArb: fc.Arbitrary<string> = fc.oneof(
  fc.string({ maxLength: 40 }),
  fc.string({ unit: 'binary', maxLength: 40 }),
  fc.stringMatching(/^[0-9/:\- APMapm.T]{0,24}$/),
);
