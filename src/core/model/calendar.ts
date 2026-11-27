import { asciiLowerCode, isAsciiDigit } from './chars';
import type { DateOrder, ParseOutcome } from './types';

const DAYS_IN_MONTH: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const INVALID: { readonly ok: false; readonly reason: 'invalid' } = {
  ok: false,
  reason: 'invalid',
};

function success(value: string): ParseOutcome<string> {
  return { ok: true, value };
}

function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

function pad4(n: number): string {
  let text = String(n);
  while (text.length < 4) {
    text = '0' + text;
  }
  return text;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : (DAYS_IN_MONTH[month - 1] ?? 0);
}

export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1 || year > 9999 || month < 1 || month > 12) {
    return false;
  }
  return day >= 1 && day <= daysInMonth(year, month);
}

// Reads text[from, to) as digits only; returns -1 when it is empty or holds a non-digit.
function readDigits(text: string, from: number, to: number): number {
  if (to <= from) {
    return -1;
  }
  let value = 0;
  for (let i = from; i < to; i += 1) {
    const code = text.charCodeAt(i);
    if (!isAsciiDigit(code)) {
      return -1;
    }
    value = value * 10 + (code - 48);
  }
  return value;
}

function buildDate(year: number, month: number, day: number): ParseOutcome<string> {
  if (!isValidCalendarDate(year, month, day)) {
    return INVALID;
  }
  return success(pad4(year) + '-' + pad2(month) + '-' + pad2(day));
}

export function parseIsoDate(text: string): ParseOutcome<string> {
  if (text.length !== 10 || text.charAt(4) !== '-' || text.charAt(7) !== '-') {
    return INVALID;
  }
  const year = readDigits(text, 0, 4);
  const month = readDigits(text, 5, 7);
  const day = readDigits(text, 8, 10);
  if (year < 0 || month < 0 || day < 0) {
    return INVALID;
  }
  return buildDate(year, month, day);
}

export function parseSlashDate(text: string, dateOrder: DateOrder = 'dmy'): ParseOutcome<string> {
  const p1 = text.indexOf('/');
  if (p1 < 0) {
    return INVALID;
  }
  const p2 = text.indexOf('/', p1 + 1);
  if (p2 < 0 || text.indexOf('/', p2 + 1) >= 0) {
    return INVALID;
  }
  const lengthA = p1;
  const lengthB = p2 - p1 - 1;
  const lengthC = text.length - p2 - 1;
  if (lengthA < 1 || lengthA > 2 || lengthB < 1 || lengthB > 2) {
    return INVALID;
  }
  if (lengthC !== 2 && lengthC !== 4) {
    return INVALID;
  }
  const first = readDigits(text, 0, p1);
  const second = readDigits(text, p1 + 1, p2);
  const yearNumber = readDigits(text, p2 + 1, text.length);
  if (first < 0 || second < 0 || yearNumber < 0) {
    return INVALID;
  }
  const year = lengthC === 2 ? 2000 + yearNumber : yearNumber;
  return dateOrder === 'mdy' ? buildDate(year, first, second) : buildDate(year, second, first);
}

export function parseDate(text: string, dateOrder: DateOrder = 'dmy'): ParseOutcome<string> {
  if (text.length === 10 && text.charAt(4) === '-') {
    return parseIsoDate(text);
  }
  return parseSlashDate(text, dateOrder);
}

interface ClockParts {
  readonly hour: number;
  readonly minute: number;
  readonly end: number;
}

// Reads "H:MM" or "HH:MM" at the start of text; end is the index after the minutes.
function readClock(text: string): ClockParts | null {
  const colon = text.charAt(1) === ':' ? 1 : text.charAt(2) === ':' ? 2 : -1;
  if (colon < 0) {
    return null;
  }
  const hour = readDigits(text, 0, colon);
  const minute = readDigits(text, colon + 1, colon + 3);
  if (hour < 0 || minute < 0 || minute > 59 || text.length < colon + 3) {
    return null;
  }
  return { hour, minute, end: colon + 3 };
}

export function parseTime24(text: string): ParseOutcome<string> {
  const clock = readClock(text);
  if (clock === null || clock.end !== text.length || clock.hour > 23) {
    return INVALID;
  }
  return success(pad2(clock.hour) + ':' + pad2(clock.minute));
}

export function parseTime12(text: string): ParseOutcome<string> {
  const clock = readClock(text);
  if (clock === null || clock.hour < 1 || clock.hour > 12) {
    return INVALID;
  }
  let index = clock.end;
  if (text.charAt(index) === ' ') {
    index += 1;
  }
  if (text.length !== index + 2 || asciiLowerCode(text.charCodeAt(index + 1)) !== 109) {
    return INVALID;
  }
  const marker = asciiLowerCode(text.charCodeAt(index));
  if (marker !== 97 && marker !== 112) {
    return INVALID;
  }
  const isPm = marker === 112;
  const base = clock.hour === 12 ? 0 : clock.hour;
  return success(pad2(isPm ? base + 12 : base) + ':' + pad2(clock.minute));
}

export function parseTime(text: string): ParseOutcome<string> {
  if (text.length >= 2) {
    const last = asciiLowerCode(text.charCodeAt(text.length - 1));
    const before = asciiLowerCode(text.charCodeAt(text.length - 2));
    if (last === 109 && (before === 97 || before === 112)) {
      return parseTime12(text);
    }
  }
  return parseTime24(text);
}
