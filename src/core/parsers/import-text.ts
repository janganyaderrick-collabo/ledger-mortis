import { isWhitespaceCode } from '../model/chars';
import { ISSUES } from '../model/issues';
import { buildExcerpt } from '../model/masking';
import type { DateOrder, ImportOptions, ImportResult } from '../model/types';
import { parseCsv } from './csv-parser';
import { detectFormat } from './detect';
import { parseSms } from './sms-parser';

const BYTE_ORDER_MARK = 0xfeff;

type ImportFormat = 'auto' | 'csv' | 'mobile-money-sms';

interface ResolvedOptions {
  readonly format: ImportFormat;
  readonly defaultCurrency: string;
  readonly dateOrder: DateOrder;
}

function isUpperAscii(code: number): boolean {
  return code >= 65 && code <= 90;
}

function resolveOptions(options: ImportOptions): ResolvedOptions {
  const format: unknown = options.format ?? 'auto';
  const defaultCurrency: unknown = options.defaultCurrency ?? 'USD';
  const dateOrder: unknown = options.dateOrder ?? 'dmy';
  if (format !== 'auto' && format !== 'csv' && format !== 'mobile-money-sms') {
    throw new Error('Invalid import option: format');
  }
  if (
    typeof defaultCurrency !== 'string' ||
    defaultCurrency.length !== 3 ||
    !isUpperAscii(defaultCurrency.charCodeAt(0)) ||
    !isUpperAscii(defaultCurrency.charCodeAt(1)) ||
    !isUpperAscii(defaultCurrency.charCodeAt(2))
  ) {
    throw new Error('Invalid import option: defaultCurrency');
  }
  if (dateOrder !== 'dmy' && dateOrder !== 'mdy') {
    throw new Error('Invalid import option: dateOrder');
  }
  return { format, defaultCurrency, dateOrder };
}

function isBlank(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    if (!isWhitespaceCode(text.charCodeAt(i))) {
      return false;
    }
  }
  return true;
}

// Finds the first physical line (split on LF) that is not blank, with its 1-based number.
function firstNonBlankLine(text: string): { readonly line: number; readonly text: string } {
  let line = 1;
  let start = 0;
  for (;;) {
    const lf = text.indexOf('\n', start);
    const end = lf < 0 ? text.length : lf;
    const raw = text.slice(start, end);
    if (!isBlank(raw) || lf < 0) {
      const trimmedEnd = raw.endsWith('\r') ? raw.length - 1 : raw.length;
      return { line, text: raw.slice(0, trimmedEnd) };
    }
    line += 1;
    start = lf + 1;
  }
}

export function importText(text: string, options: ImportOptions = {}): ImportResult {
  const opts = resolveOptions(options);
  const body = text.length > 0 && text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text;
  if (isBlank(body)) {
    return {
      format: 'unknown',
      transactions: [],
      issues: [{ line: 1, message: ISSUES.emptyInput, excerpt: '' }],
    };
  }
  const format = opts.format === 'auto' ? detectFormat(body) : opts.format;
  if (format === 'csv') {
    const parsed = parseCsv(body, opts.defaultCurrency, opts.dateOrder);
    return { format, transactions: parsed.transactions, issues: parsed.issues };
  }
  if (format === 'mobile-money-sms') {
    const parsed = parseSms(body);
    return { format, transactions: parsed.transactions, issues: parsed.issues };
  }
  const first = firstNonBlankLine(body);
  return {
    format: 'unknown',
    transactions: [],
    issues: [
      { line: first.line, message: ISSUES.unrecognisedText, excerpt: buildExcerpt(first.text) },
    ],
  };
}
