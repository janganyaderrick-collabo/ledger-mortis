import { asciiLowerCode, isAsciiDigit } from '../model/chars';
import { parseDate, parseTime12, parseTime24 } from '../model/calendar';
import { assignTransactionIds, buildHashInput } from '../model/ids';
import { ISSUES } from '../model/issues';
import { buildExcerpt, maskText } from '../model/masking';
import { createMoney, parseAmountText } from '../model/money';
import type { DateOrder, Issue, Money, ParseOutcome, Transaction } from '../model/types';
import { readCsv } from './csv-reader';
import type { CsvRecord } from './csv-reader';

const DATE_NAMES: readonly string[] = [
  'date',
  'posted',
  'post date',
  'posting date',
  'transaction date',
  'timestamp',
];
const DESCRIPTION_NAMES: readonly string[] = [
  'description',
  'details',
  'narration',
  'memo',
  'payee',
  'particulars',
  'transaction details',
  'narrative',
];
const AMOUNT_NAMES: readonly string[] = ['amount'];
const DEBIT_NAMES: readonly string[] = [
  'debit',
  'debit amount',
  'withdrawal',
  'withdrawals',
  'paid out',
  'money out',
];
const CREDIT_NAMES: readonly string[] = [
  'credit',
  'credit amount',
  'deposit',
  'deposits',
  'paid in',
  'money in',
];

interface Columns {
  readonly date: number;
  readonly description: number;
  readonly amount: number; // -1 when the debit and credit pair is used
  readonly debit: number;
  readonly credit: number;
}

export interface CsvParseResult {
  readonly transactions: readonly Transaction[];
  readonly issues: readonly Issue[];
}

function foldHeaderCell(cell: string): string {
  const out: string[] = [];
  const trimmed = cell.trim();
  for (let k = 0; k < trimmed.length; k += 1) {
    out.push(String.fromCharCode(asciiLowerCode(trimmed.charCodeAt(k))));
  }
  return out.join('');
}

function recogniseHeader(cells: readonly string[]): Columns | null {
  const folded = cells.map(foldHeaderCell);
  const date = folded.findIndex((c) => DATE_NAMES.includes(c));
  const description = folded.findIndex((c) => DESCRIPTION_NAMES.includes(c));
  const amount = folded.findIndex((c) => AMOUNT_NAMES.includes(c));
  const debit = folded.findIndex((c) => DEBIT_NAMES.includes(c));
  const credit = folded.findIndex((c) => CREDIT_NAMES.includes(c));
  if (date < 0 || description < 0) {
    return null;
  }
  if (amount < 0 && (debit < 0 || credit < 0)) {
    return null;
  }
  return { date, description, amount, debit, credit };
}

export function hasRecognisedCsvHeader(text: string): boolean {
  const { headerLine } = readCsv(text);
  return headerLine !== null && recogniseHeader(headerLine.fields) !== null;
}

interface DateCell {
  readonly date: string;
  readonly time?: string;
}

const FAILED: ParseOutcome<DateCell> = { ok: false, reason: 'invalid' };

// Reads 1 or 2 digits at start; returns the digit count or 0.
function digitRun(text: string, start: number, max: number): number {
  let count = 0;
  while (count < max && isAsciiDigit(text.charCodeAt(start + count))) {
    count += 1;
  }
  return count;
}

function parseDateCell(cell: string, dateOrder: DateOrder): ParseOutcome<DateCell> {
  const s = cell.trim();
  let k = 0;
  while (k < s.length && s.charAt(k) !== ' ' && s.charAt(k) !== 'T') {
    k += 1;
  }
  const date = parseDate(s.slice(0, k), dateOrder);
  if (!date.ok) {
    return FAILED;
  }
  if (k === s.length) {
    return { ok: true, value: { date: date.value } };
  }
  const rest = s.slice(k + 1);
  const hourLength = digitRun(rest, 0, 2);
  if (hourLength === 0 || rest.charAt(hourLength) !== ':') {
    return FAILED;
  }
  const minuteStart = hourLength + 1;
  if (digitRun(rest, minuteStart, 2) !== 2) {
    return FAILED;
  }
  let position = minuteStart + 2;
  const clock = rest.slice(0, position);
  if (rest.charAt(position) === ':') {
    if (digitRun(rest, position + 1, 2) !== 2) {
      return FAILED;
    }
    const seconds =
      (rest.charCodeAt(position + 1) - 48) * 10 + (rest.charCodeAt(position + 2) - 48);
    if (seconds > 59) {
      return FAILED;
    }
    position += 3;
  }
  const tail = rest.slice(position);
  let time: ParseOutcome<string>;
  if (tail === '') {
    time = parseTime24(clock);
  } else {
    const marker = tail.charAt(0) === ' ' ? tail.slice(1) : tail;
    const first = asciiLowerCode(marker.charCodeAt(0));
    if (
      marker.length !== 2 ||
      (first !== 97 && first !== 112) ||
      asciiLowerCode(marker.charCodeAt(1)) !== 109
    ) {
      return FAILED;
    }
    time = parseTime12(clock + ' ' + marker);
  }
  if (!time.ok) {
    return FAILED;
  }
  return { ok: true, value: { date: date.value, time: time.value } };
}

type CellOutcome =
  { readonly ok: true; readonly money: Money } | { readonly ok: false; readonly message: string };

function amountOutcome(record: CsvRecord, columns: Columns, defaultCurrency: string): CellOutcome {
  let cell: string;
  let negate = false;
  if (columns.amount >= 0) {
    cell = record.fields[columns.amount] ?? '';
  } else {
    const debit = record.fields[columns.debit] ?? '';
    const credit = record.fields[columns.credit] ?? '';
    const debitFilled = debit.trim() !== '';
    const creditFilled = credit.trim() !== '';
    cell = debitFilled ? debit : credit;
    negate = debitFilled;
    const signed =
      cell.includes('-') || cell.includes('+') || cell.includes('(') || cell.includes(')');
    if (debitFilled === creditFilled || signed) {
      return { ok: false, message: ISSUES.invalidDebitOrCredit };
    }
  }
  const parsed = parseAmountText(cell, defaultCurrency);
  if (!parsed.ok) {
    return {
      ok: false,
      message: parsed.reason === 'too-large' ? ISSUES.amountTooLarge : ISSUES.invalidAmount,
    };
  }
  if (parsed.value.currency !== defaultCurrency) {
    return { ok: false, message: ISSUES.currencyMismatch };
  }
  const money = negate ? createMoney(0 - parsed.value.minor, parsed.value.currency) : parsed.value;
  return { ok: true, money };
}

type Row = Omit<Transaction, 'id'> & { readonly hashInput: string };

function mergeByLine(a: readonly Issue[], b: readonly Issue[]): Issue[] {
  const merged: Issue[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const left = a[i];
    const right = b[j];
    if (left !== undefined && (right === undefined || left.line <= right.line)) {
      merged.push(left);
      i += 1;
    } else if (right !== undefined) {
      merged.push(right);
      j += 1;
    }
  }
  return merged;
}

export function parseCsv(
  text: string,
  defaultCurrency: string,
  dateOrder: DateOrder,
): CsvParseResult {
  const read = readCsv(text);
  const { headerLine } = read;
  if (headerLine === null) {
    return { transactions: [], issues: [] };
  }
  const columns = recogniseHeader(headerLine.fields);
  if (columns === null) {
    return {
      transactions: [],
      issues: [
        {
          line: headerLine.startLine,
          message: ISSUES.unrecognisedHeader,
          excerpt: buildExcerpt(headerLine.rawText),
        },
      ],
    };
  }

  const rows: Row[] = [];
  const parserIssues: Issue[] = [];
  const reject = (record: CsvRecord, message: string): void => {
    parserIssues.push({
      line: record.startLine,
      message,
      excerpt: buildExcerpt(record.rawText),
    });
  };

  for (const record of read.records) {
    if (record.fields.length !== headerLine.fields.length) {
      reject(record, ISSUES.wrongNumberOfFields(headerLine.fields.length, record.fields.length));
      continue;
    }
    const dateCell = parseDateCell(record.fields[columns.date] ?? '', dateOrder);
    if (!dateCell.ok) {
      reject(record, ISSUES.invalidDate);
      continue;
    }
    const amount = amountOutcome(record, columns, defaultCurrency);
    if (!amount.ok) {
      reject(record, amount.message);
      continue;
    }
    const trimmed = (record.fields[columns.description] ?? '').trim();
    if (trimmed === '') {
      reject(record, ISSUES.missingDescription);
      continue;
    }
    const description = maskText(trimmed);
    const { date, time } = dateCell.value;
    rows.push({
      occurredOn: date,
      ...(time === undefined ? {} : { time }),
      amount: amount.money,
      description,
      source: 'csv',
      hashInput: buildHashInput(
        'csv',
        date,
        String(amount.money.minor),
        amount.money.currency,
        description,
      ),
    });
  }

  return {
    transactions: assignTransactionIds<Transaction>(rows),
    issues: mergeByLine(read.issues, parserIssues),
  };
}
