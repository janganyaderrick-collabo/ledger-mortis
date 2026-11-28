import { isWhitespaceCode } from '../model/chars';
import { ISSUES } from '../model/issues';
import { buildExcerpt } from '../model/masking';
import type { Issue } from '../model/types';

export type CsvDelimiter = ',' | ';' | '\t';

export interface CsvRecord {
  readonly fields: readonly string[];
  readonly startLine: number;
  // Input slice of the Record, each line break replaced by one space (Algorithm E).
  readonly rawText: string;
}

export interface CsvReadOutcome {
  readonly headerLine: CsvRecord | null;
  readonly delimiter: CsvDelimiter;
  readonly records: readonly CsvRecord[];
  readonly issues: readonly Issue[];
}

const LF = 10;
const CR = 13;
const QUOTE = 34;
const COMMA = 44;
const SEMICOLON = 59;
const TAB = 9;

type State = 'fieldStart' | 'unquoted' | 'quoted' | 'quoteInQuoted' | 'afterClosingQuote';

function isBlankRange(text: string, from: number, to: number): boolean {
  for (let k = from; k < to; k += 1) {
    if (!isWhitespaceCode(text.charCodeAt(k))) {
      return false;
    }
  }
  return true;
}

// Text of the first physical line that is not blank (a CR directly before the LF is dropped).
function firstHeaderLineText(text: string): string | null {
  let start = 0;
  while (start <= text.length) {
    const lf = text.indexOf('\n', start);
    const end = lf === -1 ? text.length : lf;
    const lineEnd = lf !== -1 && end > start && text.charCodeAt(end - 1) === CR ? end - 1 : end;
    if (!isBlankRange(text, start, lineEnd)) {
      return text.slice(start, lineEnd);
    }
    if (lf === -1) {
      return null;
    }
    start = lf + 1;
  }
  return null;
}

// Counts delimiters outside double quotes; ties break comma, semicolon, tab.
export function chooseDelimiter(headerLineText: string): CsvDelimiter {
  let commas = 0;
  let semicolons = 0;
  let tabs = 0;
  let inQuotes = false;
  for (let k = 0; k < headerLineText.length; k += 1) {
    const code = headerLineText.charCodeAt(k);
    if (code === QUOTE) {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (code === COMMA) {
        commas += 1;
      } else if (code === SEMICOLON) {
        semicolons += 1;
      } else if (code === TAB) {
        tabs += 1;
      }
    }
  }
  if (commas >= semicolons && commas >= tabs) {
    return ',';
  }
  return semicolons >= tabs ? ';' : '\t';
}

// The slice [from, to) with each LF and each CRLF replaced by one space.
function rawSlice(text: string, from: number, to: number): string {
  const parts: string[] = [];
  let k = from;
  while (k < to) {
    const code = text.charCodeAt(k);
    if (code === CR && k + 1 < to && text.charCodeAt(k + 1) === LF) {
      parts.push(' ');
      k += 2;
    } else if (code === LF) {
      parts.push(' ');
      k += 1;
    } else {
      parts.push(text[k] ?? '');
      k += 1;
    }
  }
  return parts.join('');
}

export function readCsv(text: string): CsvReadOutcome {
  const headerText = firstHeaderLineText(text);
  const delimiter: CsvDelimiter = headerText === null ? ',' : chooseDelimiter(headerText);
  const delimiterCode = delimiter.charCodeAt(0);
  const n = text.length;

  let headerLine: CsvRecord | null = null;
  const records: CsvRecord[] = [];
  const issues: Issue[] = [];

  let state: State = 'fieldStart';
  let inRecord = false;
  let recordStart = 0;
  let recordStartLine = 1;
  let fields: string[] = [];
  let current = '';
  let currentQuoted = false;
  let line = 1;
  let i = 0;

  const resetRecord = (): void => {
    state = 'fieldStart';
    inRecord = false;
    fields = [];
    current = '';
    currentQuoted = false;
  };

  const endField = (): void => {
    fields.push(current);
    current = '';
    currentQuoted = false;
    state = 'fieldStart';
  };

  const endRecord = (contentEnd: number): void => {
    fields.push(current);
    const onlyField = fields[0] ?? '';
    const isBlank =
      fields.length === 1 && !currentQuoted && isBlankRange(onlyField, 0, onlyField.length);
    if (!isBlank) {
      const record: CsvRecord = {
        fields,
        startLine: recordStartLine,
        rawText: rawSlice(text, recordStart, contentEnd),
      };
      if (headerLine === null) {
        headerLine = record;
      } else {
        records.push(record);
      }
    }
    resetRecord();
  };

  // A flagged record: the header gets no fields and no issue (D5(a)); others get an issue.
  const flagRecord = (message: string, contentEnd: number): void => {
    const rawText = rawSlice(text, recordStart, contentEnd);
    if (headerLine === null) {
      headerLine = { fields: [], startLine: recordStartLine, rawText };
    } else {
      issues.push({ line: recordStartLine, message, excerpt: buildExcerpt(rawText) });
    }
    resetRecord();
  };

  while (i < n) {
    if (!inRecord) {
      inRecord = true;
      recordStart = i;
      recordStartLine = line;
    }
    const code = text.charCodeAt(i);
    const isLineBreak = code === LF || (code === CR && i + 1 < n && text.charCodeAt(i + 1) === LF);
    const breakLength = code === LF ? 1 : 2;

    if (state === 'quoted') {
      if (code === QUOTE) {
        state = 'quoteInQuoted';
        i += 1;
      } else if (isLineBreak) {
        current += text.slice(i, i + breakLength);
        line += 1;
        i += breakLength;
      } else {
        current += text[i] ?? '';
        i += 1;
      }
      continue;
    }

    if (code === delimiterCode) {
      endField();
      i += 1;
      continue;
    }
    if (isLineBreak) {
      endRecord(i);
      line += 1;
      i += breakLength;
      continue;
    }

    if (state === 'fieldStart') {
      if (code === QUOTE) {
        state = 'quoted';
        currentQuoted = true;
      } else {
        current += text[i] ?? '';
        state = 'unquoted';
      }
      i += 1;
    } else if (state === 'unquoted') {
      current += text[i] ?? '';
      i += 1;
    } else if (state === 'quoteInQuoted' && code === QUOTE) {
      current += '"';
      state = 'quoted';
      i += 1;
    } else if (isWhitespaceCode(code)) {
      state = 'afterClosingQuote';
      i += 1;
    } else {
      // Malformed: skip to the end of this physical line, ignoring quotes.
      const lf = text.indexOf('\n', i);
      if (lf === -1) {
        flagRecord(ISSUES.malformedQuotedField, n);
        i = n;
      } else {
        const contentEnd = text.charCodeAt(lf - 1) === CR && lf - 1 >= i ? lf - 1 : lf;
        flagRecord(ISSUES.malformedQuotedField, contentEnd);
        line += 1;
        i = lf + 1;
      }
    }
  }

  if (inRecord) {
    if (state === 'quoted') {
      flagRecord(ISSUES.unterminatedQuote, n);
    } else {
      endRecord(n);
    }
  }

  return { headerLine, delimiter, records, issues };
}
