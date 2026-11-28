import fc from 'fast-check';
import type { CsvDelimiter } from './csv-reader';

export type CsvLineBreak = '\n' | '\r\n';

export interface WrittenCsv {
  readonly text: string;
  // 1-based physical line on which each row starts.
  readonly startLines: readonly number[];
}

function countLineFeeds(text: string): number {
  let count = 0;
  for (let k = 0; k < text.length; k += 1) {
    if (text.charCodeAt(k) === 10) {
      count += 1;
    }
  }
  return count;
}

// Test_Only_Helper CSV writer: quotes a field exactly when it holds the delimiter,
// a double quote or a line break, and doubles inner quotes.
export function writeCsvField(field: string, delimiter: CsvDelimiter): string {
  const needsQuotes =
    field.includes(delimiter) ||
    field.includes('"') ||
    field.includes('\n') ||
    field.includes('\r');
  return needsQuotes ? '"' + field.split('"').join('""') + '"' : field;
}

export function writeCsvRow(row: readonly string[], delimiter: CsvDelimiter): string {
  return row.map((field) => writeCsvField(field, delimiter)).join(delimiter);
}

// Rows are separated by the given breaks in turn (cycled); an optional break ends the text.
export function writeCsv(
  rows: readonly (readonly string[])[],
  delimiter: CsvDelimiter,
  breaks: readonly CsvLineBreak[],
  trailingBreak: boolean,
): WrittenCsv {
  const startLines: number[] = [];
  const parts: string[] = [];
  let line = 1;
  rows.forEach((row, index) => {
    const rowText = writeCsvRow(row, delimiter);
    const lineBreak = breaks.length === 0 ? '\n' : (breaks[index % breaks.length] ?? '\n');
    startLines.push(line);
    parts.push(rowText);
    if (index < rows.length - 1 || trailingBreak) {
      parts.push(lineBreak);
    }
    line += countLineFeeds(rowText) + 1;
  });
  return { text: parts.join(''), startLines };
}

export const delimiterArb: fc.Arbitrary<CsvDelimiter> = fc.constantFrom<CsvDelimiter>(
  ',',
  ';',
  '\t',
);

export const lineBreakArb: fc.Arbitrary<CsvLineBreak> = fc.constantFrom<CsvLineBreak>('\n', '\r\n');

const HEADER_CHARS = ['a', 'b', 'c', 'D', 'e', '1', '2'] as const;

// A header row: at least two plain fields, so the delimiter count is at least 1.
export const headerRowArb: fc.Arbitrary<string[]> = fc.array(
  fc
    .array(fc.constantFrom(...HEADER_CHARS), { minLength: 1, maxLength: 4 })
    .map((chars) => chars.join('')),
  { minLength: 2, maxLength: 4 },
);

// A body field that mixes plain characters, the chosen delimiter, quotes, spaces and breaks.
export function bodyFieldArb(delimiter: CsvDelimiter): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom('a', 'b', '1', ' ', '"', '\n', '\r', delimiter), {
      minLength: 0,
      maxLength: 6,
    })
    .map((chars) => chars.join(''));
}

export interface CsvTable {
  readonly delimiter: CsvDelimiter;
  readonly header: readonly string[];
  readonly body: readonly (readonly string[])[];
  readonly breaks: readonly CsvLineBreak[];
  readonly trailingBreak: boolean;
}

// Rows have at least two fields so that no row can be mistaken for a blank line.
export const csvTableArb: fc.Arbitrary<CsvTable> = delimiterArb.chain((delimiter) =>
  fc.record({
    delimiter: fc.constant(delimiter),
    header: headerRowArb,
    body: fc.array(fc.array(bodyFieldArb(delimiter), { minLength: 2, maxLength: 4 }), {
      minLength: 0,
      maxLength: 6,
    }),
    breaks: fc.array(lineBreakArb, { minLength: 1, maxLength: 4 }),
    trailingBreak: fc.boolean(),
  }),
);
