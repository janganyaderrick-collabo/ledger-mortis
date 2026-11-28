import fc from 'fast-check';

// Test-only helpers for masking.ts. Nothing here is exported by the barrel.

// A group is digit runs joined by exactly one space or one hyphen.
export interface GroupSpec {
  readonly runs: readonly string[]; // digit-only runs, at least one
  readonly joiners: readonly string[]; // " " or "-", one fewer than runs
}

export interface GroupedText {
  readonly text: string; // input text
  readonly expected: string; // what masking must produce, built by construction
}

// Separators that must never join two digit runs.
const NON_JOINING: readonly string[] = [
  '  ',
  '.',
  '/',
  ',',
  ' - ',
  ' -',
  '- ',
  '\n',
  '\t',
  ' x ',
  ': ',
  '   ',
];

export const MASK = '[number]';

const digitArb = fc.integer({ min: 0, max: 9 }).map((d) => String(d));

export function digitRunArb(minLength: number, maxLength: number): fc.Arbitrary<string> {
  return fc.array(digitArb, { minLength, maxLength }).map((ds) => ds.join(''));
}

const joinerArb = fc.constantFrom(' ', '-');

// A group whose total digit count lies in [minTotal, maxTotal].
export function groupArb(minTotal: number, maxTotal: number): fc.Arbitrary<GroupSpec> {
  return fc.integer({ min: 1, max: 4 }).chain((count) =>
    fc
      .tuple(
        fc.array(digitRunArb(1, 8), { minLength: count, maxLength: count }),
        fc.array(joinerArb, { minLength: count - 1, maxLength: count - 1 }),
      )
      .filter(([runs]) => {
        const total = runs.reduce((sum, r) => sum + r.length, 0);
        return total >= minTotal && total <= maxTotal;
      })
      .map(([runs, joiners]) => ({ runs, joiners })),
  );
}

export function groupText(group: GroupSpec): string {
  let out = group.runs[0] ?? '';
  for (let i = 1; i < group.runs.length; i += 1) {
    out += (group.joiners[i - 1] ?? ' ') + (group.runs[i] ?? '');
  }
  return out;
}

export function groupDigitCount(group: GroupSpec): number {
  return group.runs.reduce((sum, r) => sum + r.length, 0);
}

// Letters only, so filler text never touches a digit group.
const fillerArb = fc
  .array(fc.constantFrom('a', 'b', 'Z', 'q', ' ', '€', '😀', '#'), { maxLength: 6 })
  .map((cs) => cs.join(''));

const separatorArb = fc.constantFrom(...NON_JOINING);

// Alternating groups and non-joining separators, with the expected masked text.
export const groupedTextArb: fc.Arbitrary<GroupedText> = fc
  .tuple(
    fillerArb,
    fc.array(fc.tuple(groupArb(1, 12), separatorArb), { minLength: 0, maxLength: 5 }),
    fillerArb,
  )
  .map(([head, parts, tail]) => {
    let text = head;
    let expected = head;
    for (const [group, sep] of parts) {
      const raw = groupText(group);
      text += raw + sep;
      expected += (groupDigitCount(group) >= 7 ? MASK : raw) + sep;
    }
    return { text: text + tail, expected: expected + tail };
  });

// Arbitrary UTF-16 text, including lone surrogates.
export const anyUnitsTextArb: fc.Arbitrary<string> = fc.string({
  unit: fc.oneof(
    fc.integer({ min: 0, max: 0xffff }).map((c) => String.fromCharCode(c)),
    fc.constantFrom('0', '1', '5', '9', ' ', '-', '.', '/', 'a'),
  ),
  maxLength: 150,
});

// Independent reference: the longest digit group of a text, found with a pattern
// of digit runs joined by one space or one hyphen (a different method from the scan).
export function longestDigitGroup(text: string): number {
  const matches = text.match(/[0-9]+(?:[ -][0-9]+)*/g) ?? [];
  let best = 0;
  for (const m of matches) {
    const digits = m.replace(/[^0-9]/g, '').length;
    if (digits > best) {
      best = digits;
    }
  }
  return best;
}

// Filler of the given length, then a group that starts at `offset`, so that it
// can straddle character 60 of the masked text.
export const straddleArb: fc.Arbitrary<string> = fc
  .tuple(fc.integer({ min: 40, max: 62 }), groupArb(7, 16), fillerTail())
  .map(([offset, group, tail]) => 'x'.repeat(offset) + groupText(group) + tail);

function fillerTail(): fc.Arbitrary<string> {
  return fc.string({ unit: fc.constantFrom('a', 'b', ' ', '😀'), maxLength: 30 });
}

// Text of 'x' with a surrogate pair placed so that its high half is unit 59.
export const pairAtCutArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('😀', '👻', '𝒳'),
    fc.string({ unit: fc.constantFrom('a', 'b', '1'), maxLength: 10 }),
  )
  .map(([pair, tail]) => 'x'.repeat(59) + pair + tail);
