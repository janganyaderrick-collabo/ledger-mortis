import {
  isAsciiDigit,
  isAsciiLetter,
  isAsciiUpperOrDigit,
  isWhitespaceCode,
  startsWithKeywordAt,
} from '../model/chars';
import { parseSlashDate, parseTime12 } from '../model/calendar';
import { assignTransactionIds, buildHashInput } from '../model/ids';
import { ISSUES } from '../model/issues';
import { buildExcerpt, maskText } from '../model/masking';
import { createMoney, parseAmountText } from '../model/money';
import type { Issue, Transaction } from '../model/types';

export interface SmsParseResult {
  readonly transactions: readonly Transaction[];
  readonly issues: readonly Issue[];
}

const CODE_LENGTH = 10;
const CONFIRMED = 'confirmed.';
const CURRENCY = 'KES';

interface MessageStart {
  readonly codeOffset: number;
  readonly bodyOffset: number;
}

function isLetterOrDigit(code: number): boolean {
  return isAsciiLetter(code) || isAsciiDigit(code);
}

function nextMessageStart(text: string, from: number): MessageStart | null {
  const n = text.length;
  let i = from;
  while (i < n) {
    if (!isLetterOrDigit(text.charCodeAt(i))) {
      i += 1;
      continue;
    }
    let r = i;
    while (r < n && isLetterOrDigit(text.charCodeAt(r))) {
      r += 1;
    }
    if (r - i === CODE_LENGTH) {
      let allUpper = true;
      for (let k = i; k < r; k += 1) {
        if (!isAsciiUpperOrDigit(text.charCodeAt(k))) {
          allUpper = false;
        }
      }
      if (allUpper) {
        let w = r;
        while (w < n && isWhitespaceCode(text.charCodeAt(w))) {
          w += 1;
        }
        if (w > r && startsWithKeywordAt(text, w, CONFIRMED)) {
          return { codeOffset: i, bodyOffset: w + CONFIRMED.length };
        }
      }
    }
    i = r;
  }
  return null;
}

export function hasMessageStart(text: string): boolean {
  return nextMessageStart(text, 0) !== null;
}

// Replaces every whitespace run with one space and drops trailing whitespace.
function collapseWhitespace(text: string): string {
  const out: string[] = [];
  let pendingSpace = false;
  for (let k = 0; k < text.length; k += 1) {
    if (isWhitespaceCode(text.charCodeAt(k))) {
      pendingSpace = true;
    } else {
      if (pendingSpace) {
        out.push(' ');
        pendingSpace = false;
      }
      out.push(text.charAt(k));
    }
  }
  return out.join('');
}

interface SmsAmount {
  readonly digitsText: string;
  readonly end: number;
}

function digitRunEnd(text: string, from: number): number {
  let p = from;
  while (p < text.length && isAsciiDigit(text.charCodeAt(p))) {
    p += 1;
  }
  return p;
}

function extractSmsAmount(copy: string, start: number): SmsAmount | null {
  if (!startsWithKeywordAt(copy, start, 'ksh') && !startsWithKeywordAt(copy, start, 'kes')) {
    return null;
  }
  let p = start + 3;
  if (copy.charAt(p) === ' ') {
    p += 1;
  }
  const digitsStart = p;
  p = digitRunEnd(copy, p);
  if (p === digitsStart) {
    return null;
  }
  while (copy.charAt(p) === ',' && digitRunEnd(copy, p + 1) === p + 4) {
    p += 4;
  }
  if (copy.charAt(p) === '.' && isAsciiDigit(copy.charCodeAt(p + 1))) {
    p += 2;
    if (isAsciiDigit(copy.charCodeAt(p))) {
      p += 1;
    }
  }
  return { digitsText: copy.slice(digitsStart, p), end: p };
}

interface DateMarker {
  readonly dateText: string;
  readonly timeText: string;
  readonly end: number;
}

// Counts digits at p, at most max.
function digitsAt(text: string, p: number, max: number): number {
  let count = 0;
  while (count < max && isAsciiDigit(text.charCodeAt(p + count))) {
    count += 1;
  }
  return count;
}

// Reads " on D/M/YY at H:MM AM" at q; the layout only, not the values.
function readDateMarker(copy: string, q: number): DateMarker | null {
  if (!startsWithKeywordAt(copy, q, ' on ')) {
    return null;
  }
  const dateStart = q + 4;
  let p = dateStart;
  for (let part = 0; part < 2; part += 1) {
    const count = digitsAt(copy, p, 2);
    if (count === 0 || copy.charAt(p + count) !== '/') {
      return null;
    }
    p += count + 1;
  }
  if (digitsAt(copy, p, 2) !== 2 || isAsciiDigit(copy.charCodeAt(p + 2))) {
    return null;
  }
  p += 2;
  const dateText = copy.slice(dateStart, p);
  if (!startsWithKeywordAt(copy, p, ' at ')) {
    return null;
  }
  p += 4;
  const timeStart = p;
  const hourCount = digitsAt(copy, p, 2);
  if (hourCount === 0 || copy.charAt(p + hourCount) !== ':') {
    return null;
  }
  p += hourCount + 1;
  if (digitsAt(copy, p, 2) !== 2 || copy.charAt(p + 2) !== ' ') {
    return null;
  }
  p += 3;
  if (
    !(startsWithKeywordAt(copy, p, 'am') || startsWithKeywordAt(copy, p, 'pm')) ||
    isLetterOrDigit(copy.charCodeAt(p + 2))
  ) {
    return null;
  }
  p += 2;
  return { dateText, timeText: copy.slice(timeStart, p), end: p };
}

function findDateMarker(copy: string, from: number): { marker: DateMarker; at: number } | null {
  for (let q = from; q < copy.length; q += 1) {
    if (copy.charAt(q) === ' ') {
      const marker = readDateMarker(copy, q);
      if (marker !== null) {
        return { marker, at: q };
      }
    }
  }
  return null;
}

function cleanName(raw: string): string {
  let name = raw;
  if (name.endsWith('.')) {
    name = name.slice(0, name.length - 1);
  }
  if (name.length > 0 && isAsciiDigit(name.charCodeAt(name.length - 1))) {
    let g = name.length;
    let digits = 0;
    for (;;) {
      while (g > 0 && isAsciiDigit(name.charCodeAt(g - 1))) {
        g -= 1;
        digits += 1;
      }
      const sep = name.charAt(g - 1);
      if ((sep === ' ' || sep === '-') && g >= 2 && isAsciiDigit(name.charCodeAt(g - 2))) {
        g -= 1;
        continue;
      }
      break;
    }
    if (digits >= 7) {
      let h = g;
      if (name.charAt(h - 1) === '+') {
        h -= 1;
      }
      if (h >= 1 && name.charAt(h - 1) === ' ') {
        name = name.slice(0, h - 1);
      }
    }
  }
  return name.trim();
}

type MessageKind = 'paid' | 'received' | 'airtime' | 'reversal';

interface Structure {
  readonly kind: MessageKind;
  readonly negative: boolean;
  readonly amount: SmsAmount;
  readonly rawName: string | null;
  readonly marker: DateMarker;
}

const OUTFLOW_VERBS: readonly string[] = [' paid to ', ' sent to ', ' withdrawn from '];

function matchStructure(copy: string): Structure | null {
  if (copy.length <= 22 || copy.charAt(21) !== ' ') {
    return null;
  }
  const b = 22;
  if (startsWithKeywordAt(copy, b, 'you have received ')) {
    const amount = extractSmsAmount(copy, b + 18);
    if (amount === null || !startsWithKeywordAt(copy, amount.end, ' from ')) {
      return null;
    }
    const nameStart = amount.end + 6;
    const found = findDateMarker(copy, nameStart);
    if (found === null) {
      return null;
    }
    return {
      kind: 'received',
      negative: false,
      amount,
      rawName: copy.slice(nameStart, found.at),
      marker: found.marker,
    };
  }
  if (startsWithKeywordAt(copy, b, 'you bought ')) {
    const amount = extractSmsAmount(copy, b + 11);
    if (amount === null || !startsWithKeywordAt(copy, amount.end, ' of airtime')) {
      return null;
    }
    const marker = readDateMarker(copy, amount.end + 11);
    if (marker === null) {
      return null;
    }
    return { kind: 'airtime', negative: true, amount, rawName: null, marker };
  }
  if (startsWithKeywordAt(copy, b, 'reversal of ')) {
    return matchReversal(copy, b + 12);
  }
  const amount = extractSmsAmount(copy, b);
  if (amount === null) {
    return null;
  }
  for (const verb of OUTFLOW_VERBS) {
    if (startsWithKeywordAt(copy, amount.end, verb)) {
      const nameStart = amount.end + verb.length;
      const found = findDateMarker(copy, nameStart);
      if (found === null) {
        return null;
      }
      return {
        kind: 'paid',
        negative: true,
        amount,
        rawName: copy.slice(nameStart, found.at),
        marker: found.marker,
      };
    }
  }
  return null;
}

function matchReversal(copy: string, codeStart: number): Structure | null {
  const codeEnd = codeStart + CODE_LENGTH;
  if (codeEnd > copy.length) {
    return null;
  }
  for (let k = codeStart; k < codeEnd; k += 1) {
    if (!isAsciiUpperOrDigit(copy.charCodeAt(k))) {
      return null;
    }
  }
  const lead = ' completed. ';
  if (!startsWithKeywordAt(copy, codeEnd, lead)) {
    return null;
  }
  const amount = extractSmsAmount(copy, codeEnd + lead.length);
  const tailKeyword = ' credited to your account';
  if (amount === null || !startsWithKeywordAt(copy, amount.end, tailKeyword)) {
    return null;
  }
  const marker = readDateMarker(copy, amount.end + tailKeyword.length);
  if (marker === null) {
    return null;
  }
  return {
    kind: 'reversal',
    negative: false,
    amount,
    rawName: copy.slice(codeStart, codeEnd),
    marker,
  };
}

type Row = Omit<Transaction, 'id'> & { readonly hashInput: string };

function buildRow(
  occurredOn: string,
  time: string,
  minor: number,
  description: string,
  counterparty: string | null,
  reference: string,
): Row {
  return {
    occurredOn,
    time,
    amount: createMoney(minor, CURRENCY),
    description,
    ...(counterparty === null ? {} : { counterparty }),
    source: 'mobile-money-sms',
    reference,
    hashInput: buildHashInput('mobile-money-sms', occurredOn, String(minor), CURRENCY, description),
  };
}

// Returns the rows of one message, or the message of its one Issue.
function parseMessage(
  copy: string,
): { readonly rows: Row[]; readonly costIssue: boolean } | { readonly failure: string } {
  const structure = matchStructure(copy);
  if (structure === null) {
    return { failure: ISSUES.unrecognisedMessage };
  }
  const amount = parseAmountText(structure.amount.digitsText, CURRENCY);
  if (!amount.ok) {
    return {
      failure: amount.reason === 'too-large' ? ISSUES.amountTooLarge : ISSUES.invalidAmount,
    };
  }
  let description = 'Airtime';
  let counterparty: string | null = null;
  if (structure.kind === 'reversal') {
    description = maskText('Reversal of ' + (structure.rawName ?? ''));
  } else if (structure.rawName !== null) {
    const name = cleanName(structure.rawName);
    if (name === '') {
      return { failure: ISSUES.unrecognisedMessage };
    }
    description = maskText(name);
    counterparty = description;
  }
  const date = parseSlashDate(structure.marker.dateText, 'dmy');
  const time = parseTime12(structure.marker.timeText);
  if (!date.ok || !time.ok) {
    return { failure: ISSUES.invalidDate };
  }
  const reference = copy.slice(0, CODE_LENGTH);
  const minor = structure.negative ? 0 - amount.value.minor : amount.value.minor;
  const rows = [buildRow(date.value, time.value, minor, description, counterparty, reference)];
  let costIssue = false;
  const tail = copy.slice(structure.marker.end);
  const costAt = indexOfKeyword(tail, 'transaction cost,');
  if (costAt >= 0) {
    let p = costAt + 17;
    if (tail.charAt(p) === ' ') {
      p += 1;
    }
    const cost = extractSmsAmount(tail, p);
    const parsed = cost === null ? null : parseAmountText(cost.digitsText, CURRENCY);
    if (parsed === null || !parsed.ok) {
      costIssue = true;
    } else if (parsed.value.minor > 0) {
      rows.push(
        buildRow(
          date.value,
          time.value,
          0 - parsed.value.minor,
          'Transaction cost',
          null,
          reference,
        ),
      );
    }
  }
  return { rows, costIssue };
}

function indexOfKeyword(text: string, keywordLowercase: string): number {
  for (let k = 0; k + keywordLowercase.length <= text.length; k += 1) {
    if (startsWithKeywordAt(text, k, keywordLowercase)) {
      return k;
    }
  }
  return -1;
}

export function parseSms(text: string): SmsParseResult {
  const starts: MessageStart[] = [];
  for (let from = 0; ;) {
    const start = nextMessageStart(text, from);
    if (start === null) {
      break;
    }
    starts.push(start);
    from = start.bodyOffset;
  }

  let scanned = 0;
  let lineFeeds = 0;
  const lineAt = (offset: number): number => {
    while (scanned < offset) {
      if (text.charCodeAt(scanned) === 10) {
        lineFeeds += 1;
      }
      scanned += 1;
    }
    return lineFeeds + 1;
  };

  const issues: Issue[] = [];
  const rows: Row[] = [];

  const first = starts[0];
  const prefixEnd = first === undefined ? text.length : first.codeOffset;
  let firstText = 0;
  while (firstText < prefixEnd && isWhitespaceCode(text.charCodeAt(firstText))) {
    firstText += 1;
  }
  if (firstText < prefixEnd) {
    issues.push({
      line: lineAt(firstText),
      message: ISSUES.unexpectedTextBeforeFirstMessage,
      excerpt: buildExcerpt(collapseWhitespace(text.slice(firstText, prefixEnd))),
    });
  }

  starts.forEach((start, index) => {
    const next = starts[index + 1];
    const copy = collapseWhitespace(text.slice(start.codeOffset, next?.codeOffset ?? text.length));
    const line = lineAt(start.codeOffset);
    const outcome = parseMessage(copy);
    if ('failure' in outcome) {
      issues.push({ line, message: outcome.failure, excerpt: buildExcerpt(copy) });
      return;
    }
    rows.push(...outcome.rows);
    if (outcome.costIssue) {
      issues.push({ line, message: ISSUES.invalidTransactionCost, excerpt: buildExcerpt(copy) });
    }
  });

  return { transactions: assignTransactionIds<Transaction>(rows), issues };
}
