import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { assignTransactionIds, buildHashInput, fnv1a32Hex } from './ids';
import {
  excludedFieldsArb,
  hashFieldsArb,
  hashInputRowsArb,
  referenceFnv1a32Hex,
  referenceFnv1a32OfBytes,
  referenceUtf8Hex,
} from './ids.testkit';
import type { HashFields } from './ids.testkit';

const RUNS = { numRuns: 300 };
const US = '\u001F';

interface Row {
  readonly id: string;
  readonly n: number;
  readonly time?: string;
  readonly counterparty?: string;
  readonly reference?: string;
}

function ids(hashInputs: readonly string[]): readonly string[] {
  return assignTransactionIds<Row>(hashInputs.map((hashInput, n) => ({ n, hashInput }))).map(
    (row) => row.id,
  );
}

function hashInputOf(f: HashFields): string {
  return buildHashInput(f.formatId, f.isoDate, f.minorText, f.currency, f.description);
}

describe('fnv1a32Hex vectors', () => {
  it('Req 6.1, 6.2: empty string gives the offset basis', () => {
    expect(fnv1a32Hex('')).toBe('811c9dc5');
  });

  it('Req 6.1, 6.2: "a" gives e40c292c', () => {
    expect(fnv1a32Hex('a')).toBe('e40c292c');
  });

  it('Req 6.1, 6.2: "foobar" gives bf9cf968', () => {
    expect(fnv1a32Hex('foobar')).toBe('bf9cf968');
  });

  it('Req 6.1: the euro sign is hashed as UTF-8 bytes E2 82 AC', () => {
    expect(referenceUtf8Hex('€')).toBe('e2 82 ac');
    expect(fnv1a32Hex('€')).toBe(referenceFnv1a32OfBytes([0xe2, 0x82, 0xac]));
  });

  it('Req 6.1: U+1F600 is hashed as UTF-8 bytes F0 9F 98 80', () => {
    expect(referenceUtf8Hex('\u{1F600}')).toBe('f0 9f 98 80');
    expect(fnv1a32Hex('\u{1F600}')).toBe(referenceFnv1a32OfBytes([0xf0, 0x9f, 0x98, 0x80]));
  });

  it('Req 6.1: a lone U+D800 is hashed as EF BF BD', () => {
    expect(fnv1a32Hex('\uD800')).toBe(referenceFnv1a32OfBytes([0xef, 0xbf, 0xbd]));
    expect(fnv1a32Hex('\uD800')).toBe(fnv1a32Hex('\uFFFD'));
  });

  it('Req 6.2: the hash keeps leading zeros (8 lowercase hex digits)', () => {
    expect(fnv1a32Hex('x')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('buildHashInput', () => {
  it('Req 6.3: fields are joined by U+001F, in a fixed order', () => {
    expect(buildHashInput('csv', '2026-11-05', '-12500', 'USD', 'Moonlight Cloud Storage')).toBe(
      ['csv', '2026-11-05', '-12500', 'USD', 'Moonlight Cloud Storage'].join(US),
    );
  });

  it('Req 6.1, 6.3: a known Hash_Input has a known Base_Hash', () => {
    const input = buildHashInput('csv', '2026-11-05', '-12500', 'USD', 'Moonlight Cloud Storage');
    expect(fnv1a32Hex(input)).toBe('f586f212');
  });
});

describe('assignTransactionIds examples', () => {
  it('Req 6.4: the first occurrence uses the Base_Hash', () => {
    expect(ids(['a'])).toEqual(['tx-e40c292c']);
  });

  it('Req 6.5, 6.6: the second and third occurrences get -2 and -3 in row order', () => {
    expect(ids(['a', 'foobar', 'a', 'a'])).toEqual([
      'tx-e40c292c',
      'tx-bf9cf968',
      'tx-e40c292c-2',
      'tx-e40c292c-3',
    ]);
  });

  it('Req 6.7: all ids in one result differ', () => {
    const result = ids(['a', 'a', 'a', 'b']);
    expect(new Set(result).size).toBe(result.length);
  });

  it('Req 6.4: no rows give no ids', () => {
    expect(ids([])).toEqual([]);
  });

  it('Req 6.3: the hashInput helper field is not kept on the output', () => {
    const [row] = assignTransactionIds<Row>([{ n: 0, hashInput: 'a' }]);
    expect(row).toEqual({ n: 0, id: 'tx-e40c292c' });
  });
});

describe('ids properties', () => {
  // Feature: 01-parsers, Property 20: Hash computation matches an independent reference and ignores excluded fields
  it('Req 6.1, 6.2: P20 fnv1a32Hex matches the reference for any text', () => {
    fc.assert(
      fc.property(
        fc.string({
          unit: fc.integer({ min: 0, max: 0xffff }).map((c) => String.fromCharCode(c)),
          maxLength: 40,
        }),
        (text) => {
          const hash = fnv1a32Hex(text);
          expect(hash).toMatch(/^[0-9a-f]{8}$/);
          expect(hash).toBe(referenceFnv1a32Hex(text));
        },
      ),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 20: Hash computation matches an independent reference and ignores excluded fields
  it('Req 6.3: P20 Hash_Input is the five fields joined by U+001F', () => {
    fc.assert(
      fc.property(hashFieldsArb, (f) => {
        expect(hashInputOf(f)).toBe(
          [f.formatId, f.isoDate, f.minorText, f.currency, f.description].join(US),
        );
        expect(fnv1a32Hex(hashInputOf(f))).toBe(referenceFnv1a32Hex(hashInputOf(f)));
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 20: Hash computation matches an independent reference and ignores excluded fields
  it('Req 6.3: P20 time, counterparty and reference never change the id', () => {
    fc.assert(
      fc.property(hashFieldsArb, excludedFieldsArb, excludedFieldsArb, (f, x, y) => {
        const [a, b] = assignTransactionIds<Row>([
          { n: 0, hashInput: hashInputOf(f), ...x },
          { n: 0, hashInput: hashInputOf(f), ...y },
        ]).map((row) => row.id);
        expect(a).toBe('tx-' + fnv1a32Hex(hashInputOf(f)));
        expect(b).toBe(a + '-2');
        const [c, d] = [x, y].map(
          (extra) =>
            assignTransactionIds<Row>([{ n: 0, hashInput: hashInputOf(f), ...extra }])[0]?.id,
        );
        expect(c).toBe(d);
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 20: Hash computation matches an independent reference and ignores excluded fields
  it('Req 6.3: P20 each included field changes the Hash_Input', () => {
    fc.assert(
      fc.property(hashFieldsArb, hashFieldsArb, (a, b) => {
        fc.pre(
          a.formatId !== b.formatId ||
            a.isoDate !== b.isoDate ||
            a.minorText !== b.minorText ||
            a.currency !== b.currency ||
            a.description !== b.description,
        );
        expect(hashInputOf(a)).not.toBe(hashInputOf(b));
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 21: Id assignment is deterministic, ordered and collision-safe
  it('Req 6.4, 6.5, 6.6, 6.7, 6.8: P21 ids are deterministic, ordered and unique', () => {
    fc.assert(
      fc.property(hashInputRowsArb, (inputs) => {
        const first = ids(inputs);
        expect(ids(inputs)).toEqual(first);
        expect(first).toHaveLength(inputs.length);
        expect(new Set(first).size).toBe(first.length);

        const seen = new Map<string, number>();
        inputs.forEach((input, index) => {
          const count = (seen.get(input) ?? 0) + 1;
          seen.set(input, count);
          const base = 'tx-' + referenceFnv1a32Hex(input);
          expect(first[index]).toBe(count === 1 ? base : `${base}-${String(count)}`);
        });
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 21: Id assignment is deterministic, ordered and collision-safe
  it('Req 6.6, 6.7: P21 output keeps row order and fields, and ids stay unique', () => {
    fc.assert(
      fc.property(hashInputRowsArb, (inputs) => {
        const out = assignTransactionIds<Row>(inputs.map((hashInput, n) => ({ n, hashInput })));
        expect(out.map((row) => row.n)).toEqual(inputs.map((_, n) => n));
        for (const row of out) {
          expect(row.id).toMatch(/^tx-[0-9a-f]{8}(-[0-9]+)?$/);
        }
      }),
      RUNS,
    );
  });
});
