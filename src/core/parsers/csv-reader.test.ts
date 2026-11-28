import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { chooseDelimiter, readCsv, type CsvRecord } from './csv-reader';
import { csvTableArb, writeCsv } from './csv-reader.testkit';

function rec(fields: string[], startLine: number, rawText: string): CsvRecord {
  return { fields, startLine, rawText };
}

describe('readCsv line breaks', () => {
  it('Req 9.1: LF line breaks give exact fields, start lines and raw text', () => {
    expect(readCsv('a,b\n1,2\n3,4')).toEqual({
      headerLine: rec(['a', 'b'], 1, 'a,b'),
      delimiter: ',',
      records: [rec(['1', '2'], 2, '1,2'), rec(['3', '4'], 3, '3,4')],
      issues: [],
    });
  });

  it('Req 9.1: CRLF line breaks give the same result and drop the CR from raw text', () => {
    expect(readCsv('a,b\r\n1,2\r\n3,4\r\n')).toEqual({
      headerLine: rec(['a', 'b'], 1, 'a,b'),
      delimiter: ',',
      records: [rec(['1', '2'], 2, '1,2'), rec(['3', '4'], 3, '3,4')],
      issues: [],
    });
  });

  it('Req 9.1: LF and CRLF may be mixed in one text', () => {
    const out = readCsv('a,b\r\n1,2\n3,4\r\n5,6');
    expect(out.headerLine).toEqual(rec(['a', 'b'], 1, 'a,b'));
    expect(out.records).toEqual([
      rec(['1', '2'], 2, '1,2'),
      rec(['3', '4'], 3, '3,4'),
      rec(['5', '6'], 4, '5,6'),
    ]);
    expect(out.issues).toEqual([]);
  });

  it('Req 9.1: a lone CR is an ordinary character and does not count as a line break', () => {
    const out = readCsv('a,b\n1\r2,x\ny,z');
    expect(out.records).toEqual([rec(['1\r2', 'x'], 2, '1\r2,x'), rec(['y', 'z'], 3, 'y,z')]);
    expect(out.issues).toEqual([]);
  });

  it('Req 9.1: a text with only lone CRs is a single physical line', () => {
    const out = readCsv('a,b\r1,2');
    expect(out.headerLine).toEqual(rec(['a', 'b\r1', '2'], 1, 'a,b\r1,2'));
    expect(out.records).toEqual([]);
  });

  it('Req 9.9: a trailing line break and no trailing line break give the same records', () => {
    const expected = {
      headerLine: rec(['a'], 1, 'a'),
      delimiter: ',',
      records: [rec(['1'], 2, '1')],
      issues: [],
    };
    expect(readCsv('a\n1\n')).toEqual(expected);
    expect(readCsv('a\n1')).toEqual(expected);
  });

  it('Req 9.10: the reader does not strip a byte-order mark', () => {
    const out = readCsv('\uFEFFa,b\n1,2');
    expect(out.headerLine).toEqual(rec(['\uFEFFa', 'b'], 1, '\uFEFFa,b'));
    expect(out.records).toEqual([rec(['1', '2'], 2, '1,2')]);
  });
});

describe('readCsv quoting', () => {
  it('Req 9.4, 9.5: a quoted field may hold the delimiter', () => {
    const out = readCsv('a,b\n"x,y",z');
    expect(out.records).toEqual([rec(['x,y', 'z'], 2, '"x,y",z')]);
    expect(out.issues).toEqual([]);
  });

  it('Req 9.5, 9.10: a quoted LF stays in the field and the next record counts the extra line', () => {
    const out = readCsv('a,b\n"x\ny",z\n3,4');
    expect(out.records).toEqual([rec(['x\ny', 'z'], 2, '"x y",z'), rec(['3', '4'], 4, '3,4')]);
  });

  it('Req 9.5, 9.10: a quoted CRLF stays in the field and counts as one line', () => {
    const out = readCsv('a,b\r\n"x\r\ny",z\r\n3,4');
    expect(out.records).toEqual([rec(['x\r\ny', 'z'], 2, '"x y",z'), rec(['3', '4'], 4, '3,4')]);
  });

  it('Req 9.4: a doubled quote inside a quoted field is one quote', () => {
    const out = readCsv('a,b\n"he said ""hi""",z');
    expect(out.records).toEqual([rec(['he said "hi"', 'z'], 2, '"he said ""hi""",z')]);
  });

  it('Req 9.4: a quoted field that is only an escaped quote is one quote character', () => {
    const out = readCsv('a,b\n"""",z');
    expect(out.records).toEqual([rec(['"', 'z'], 2, '"""",z')]);
  });

  it('Req 9.4, 9.9: an empty quoted field is empty and a line with only "" is not blank', () => {
    expect(readCsv('a,b\n"",z').records).toEqual([rec(['', 'z'], 2, '"",z')]);
    const out = readCsv('a\n""\nb');
    expect(out.records).toEqual([rec([''], 2, '""'), rec(['b'], 3, 'b')]);
  });

  it('Req 9.6: a quote inside an unquoted field is kept literally', () => {
    const out = readCsv('a,b\nx"y,z');
    expect(out.records).toEqual([rec(['x"y', 'z'], 2, 'x"y,z')]);
    expect(out.issues).toEqual([]);
  });

  it('Req 9.5, 9.9: a blank line inside a quoted field is part of the field', () => {
    const out = readCsv('a,b\n"x\n\ny",z');
    expect(out.records).toEqual([rec(['x\n\ny', 'z'], 2, '"x  y",z')]);
  });
});

describe('readCsv malformed and unterminated quotes', () => {
  it('Req 9.7, 9.10, 9.11: text after a closing quote is reported and the next line is read', () => {
    const out = readCsv('a,b\n"x"y,z\n3,4');
    expect(out.issues).toEqual([{ line: 2, message: 'Malformed quoted field', excerpt: '"x"y,z' }]);
    expect(out.records).toEqual([rec(['3', '4'], 3, '3,4')]);
  });

  it('Req 9.7: whitespace and then text after a closing quote is malformed', () => {
    const out = readCsv('a,b\n"x" y,z\n3,4');
    expect(out.issues).toEqual([
      { line: 2, message: 'Malformed quoted field', excerpt: '"x" y,z' },
    ]);
    expect(out.records).toEqual([rec(['3', '4'], 3, '3,4')]);
  });

  it('Req 9.7: a second quote after a closing quote and whitespace is malformed', () => {
    const out = readCsv('a,b\n"x" "y",z\n3,4');
    expect(out.issues).toEqual([
      { line: 2, message: 'Malformed quoted field', excerpt: '"x" "y",z' },
    ]);
    expect(out.records).toEqual([rec(['3', '4'], 3, '3,4')]);
  });

  it('Req 9.7: recovery ignores quotes on the rest of the bad line', () => {
    const out = readCsv('a,b\n"x"y,"z\n3,4\n5,6');
    expect(out.issues).toEqual([
      { line: 2, message: 'Malformed quoted field', excerpt: '"x"y,"z' },
    ]);
    expect(out.records).toEqual([rec(['3', '4'], 3, '3,4'), rec(['5', '6'], 4, '5,6')]);
  });

  it('Req 9.7, 9.10: a malformed record on the last line without a line break is reported', () => {
    const out = readCsv('a,b\n1,2\n"x"y');
    expect(out.issues).toEqual([{ line: 3, message: 'Malformed quoted field', excerpt: '"x"y' }]);
    expect(out.records).toEqual([rec(['1', '2'], 2, '1,2')]);
  });

  it('Req 9.7: a malformed record after a multi-line field reports the record start line', () => {
    const out = readCsv('a,b\n\n"x\ny"z,3\n5,6');
    expect(out.issues).toEqual([
      { line: 3, message: 'Malformed quoted field', excerpt: '"x y"z,3' },
    ]);
    expect(out.records).toEqual([rec(['5', '6'], 5, '5,6')]);
  });

  it('Req 9.4: whitespace after a closing quote is ignored', () => {
    const out = readCsv('a,b\n"x"  ,z\n"p" \t\n"q"\r\n');
    expect(out.issues).toEqual([]);
    expect(out.records).toEqual([
      rec(['x', 'z'], 2, '"x"  ,z'),
      rec(['p'], 3, '"p" \t'),
      rec(['q'], 4, '"q"'),
    ]);
  });

  it('Req 9.8, 9.10, 9.11: an unterminated quote consumes the rest and stops reading', () => {
    const out = readCsv('a,b\n1,2\n"x,y\n3,4');
    expect(out.records).toEqual([rec(['1', '2'], 2, '1,2')]);
    expect(out.issues).toEqual([{ line: 3, message: 'Unterminated quote', excerpt: '"x,y 3,4' }]);
  });

  it('Req 9.8: an unterminated quote on the last line gives one issue and no more records', () => {
    const out = readCsv('a,b\n"x');
    expect(out.records).toEqual([]);
    expect(out.issues).toEqual([{ line: 2, message: 'Unterminated quote', excerpt: '"x' }]);
  });

  it('Req 9.11: the excerpt of a multi-line record has one space per line break', () => {
    const out = readCsv('a,b\r\n"first\r\nsecond\nthird"z,3');
    expect(out.issues).toEqual([
      { line: 2, message: 'Malformed quoted field', excerpt: '"first second third"z,3' },
    ]);
  });

  it('Req 9.11: the excerpt is masked', () => {
    const out = readCsv('a,b\n"x"y,0711000222');
    expect(out.issues).toEqual([
      { line: 2, message: 'Malformed quoted field', excerpt: '"x"y,[number]' },
    ]);
  });

  it('Req 9.11: the excerpt is cut to 60 characters', () => {
    const out = readCsv('a,b\n"x"' + 'y'.repeat(80));
    expect(out.issues).toEqual([
      { line: 2, message: 'Malformed quoted field', excerpt: '"x"' + 'y'.repeat(57) },
    ]);
  });
});

describe('readCsv blank lines, empty fields and the header', () => {
  it('Req 9.9, 9.10: blank and whitespace-only lines are skipped and still counted', () => {
    const out = readCsv('a,b\n\n   \n1,2\n\t\r\n3,4');
    expect(out.issues).toEqual([]);
    expect(out.records).toEqual([rec(['1', '2'], 4, '1,2'), rec(['3', '4'], 6, '3,4')]);
  });

  it('Req 9.2, 9.10: the header is the first non-blank line, with its line number', () => {
    const out = readCsv('\n  \r\na;b\n1;2');
    expect(out.headerLine).toEqual(rec(['a', 'b'], 3, 'a;b'));
    expect(out.delimiter).toBe(';');
    expect(out.records).toEqual([rec(['1', '2'], 4, '1;2')]);
  });

  it('Req 9.2, 9.9: text of only blank lines has no header and no records', () => {
    expect(readCsv('')).toEqual({ headerLine: null, delimiter: ',', records: [], issues: [] });
    expect(readCsv('\n \r\n\n')).toEqual({
      headerLine: null,
      delimiter: ',',
      records: [],
      issues: [],
    });
  });

  it('Req 9.1: empty fields are kept: leading, trailing and consecutive delimiters', () => {
    const out = readCsv('a,b,c\n,x,\n,,\nx,,y');
    expect(out.records).toEqual([
      rec(['', 'x', ''], 2, ',x,'),
      rec(['', '', ''], 3, ',,'),
      rec(['x', '', 'y'], 4, 'x,,y'),
    ]);
    expect(readCsv('a,b\n1,').records).toEqual([rec(['1', ''], 2, '1,')]);
  });

  it('Req 9.3: readCsv uses the delimiter chosen from the header line', () => {
    expect(readCsv('a;b\n1;2').delimiter).toBe(';');
    expect(readCsv('a\tb\n1\t2').records).toEqual([rec(['1', '2'], 2, '1\t2')]);
  });

  it('Req 9.3: only the first physical line of a multi-line header cell is counted', () => {
    const out = readCsv('"a\nb",c;d;e\n1,2');
    expect(out.delimiter).toBe(',');
    expect(out.headerLine).toEqual(rec(['a\nb', 'c;d;e'], 1, '"a b",c;d;e'));
    expect(out.records).toEqual([rec(['1', '2'], 3, '1,2')]);
  });

  it('Req 9.7: a bad quote in the header gives a header with no fields and no reader issue', () => {
    const out = readCsv('"a"x,b\n1,2');
    expect(out.headerLine).toEqual(rec([], 1, '"a"x,b'));
    expect(out.issues).toEqual([]);
    expect(out.records).toEqual([rec(['1', '2'], 2, '1,2')]);
  });

  it('Req 9.8: an unterminated quote in the header gives a header with no fields', () => {
    const out = readCsv('"a,b\n1,2');
    expect(out.headerLine).toEqual(rec([], 1, '"a,b 1,2'));
    expect(out.issues).toEqual([]);
    expect(out.records).toEqual([]);
  });
});

describe('chooseDelimiter', () => {
  it('Req 9.3: picks the most frequent of comma, semicolon and tab', () => {
    expect(chooseDelimiter('a,b,c')).toBe(',');
    expect(chooseDelimiter('a;b;c')).toBe(';');
    expect(chooseDelimiter('a\tb\tc')).toBe('\t');
    expect(chooseDelimiter('a,b;c;d')).toBe(';');
    expect(chooseDelimiter('a,b\tc\td')).toBe('\t');
  });

  it('Req 9.3: ties break comma, then semicolon, then tab', () => {
    expect(chooseDelimiter('a,b;c')).toBe(',');
    expect(chooseDelimiter('a,b\tc')).toBe(',');
    expect(chooseDelimiter('a;b\tc')).toBe(';');
    expect(chooseDelimiter('a,b;c\td')).toBe(',');
  });

  it('Req 9.3: delimiters inside quotes are not counted', () => {
    expect(chooseDelimiter('"a,b,c",d;e;f')).toBe(';');
    expect(chooseDelimiter('"a;b;c";d\te\tf')).toBe('\t');
  });

  it('Req 9.3: with no delimiter at all the comma is chosen', () => {
    expect(chooseDelimiter('abc')).toBe(',');
    expect(chooseDelimiter('')).toBe(',');
    expect(chooseDelimiter('"a,b"')).toBe(',');
  });
});

describe('readCsv worked example', () => {
  it('Req 9.1 to 9.11: the 10-line example of Algorithm E gives the documented start lines', () => {
    const text = [
      'Date,Description,Amount',
      '2026-11-01,"Moonlight Cloud Storage",-9.99',
      '',
      '2026-11-02,"Crypt Cafe',
      'Night Shift",-4.50',
      '2026-11-03,Hollow Hill Grocers,-23.10',
      '2026-11-04,"Raven" Rides,-6.00',
      '2026-11-05,Gloom Gym,-30.00,extra',
      'not-a-date,Spectral Streaming,-12.99',
      '2026-11-08,"Unfinished,-5.00',
    ].join('\n');
    expect(readCsv(text)).toEqual({
      headerLine: rec(['Date', 'Description', 'Amount'], 1, 'Date,Description,Amount'),
      delimiter: ',',
      records: [
        rec(
          ['2026-11-01', 'Moonlight Cloud Storage', '-9.99'],
          2,
          '2026-11-01,"Moonlight Cloud Storage",-9.99',
        ),
        rec(
          ['2026-11-02', 'Crypt Cafe\nNight Shift', '-4.50'],
          4,
          '2026-11-02,"Crypt Cafe Night Shift",-4.50',
        ),
        rec(
          ['2026-11-03', 'Hollow Hill Grocers', '-23.10'],
          6,
          '2026-11-03,Hollow Hill Grocers,-23.10',
        ),
        rec(['2026-11-05', 'Gloom Gym', '-30.00', 'extra'], 8, '2026-11-05,Gloom Gym,-30.00,extra'),
        rec(
          ['not-a-date', 'Spectral Streaming', '-12.99'],
          9,
          'not-a-date,Spectral Streaming,-12.99',
        ),
      ],
      issues: [
        { line: 7, message: 'Malformed quoted field', excerpt: '[number],"Raven" Rides,-6.00' },
        { line: 10, message: 'Unterminated quote', excerpt: '[number],"Unfinished,-5.00' },
      ],
    });
  });
});

describe('readCsv round trip', () => {
  // Reader round trip (not one of the numbered properties): write rows, read them back.
  it('Req 9.1 to 9.6, 9.9, 9.10: written rows are read back with the same fields and start lines', () => {
    fc.assert(
      fc.property(csvTableArb, (table) => {
        const rows = [table.header, ...table.body];
        const written = writeCsv(rows, table.delimiter, table.breaks, table.trailingBreak);
        const out = readCsv(written.text);
        expect(out.issues).toEqual([]);
        expect(out.delimiter).toBe(table.delimiter);
        const read = [out.headerLine, ...out.records].map((r) =>
          r === null ? null : { fields: r.fields, startLine: r.startLine },
        );
        const expected = rows.map((fields, k) => ({
          fields,
          startLine: written.startLines[k],
        }));
        expect(read).toEqual(expected);
      }),
      { numRuns: 300 },
    );
  });
});
