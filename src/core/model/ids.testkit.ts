import fc from 'fast-check';
import type { FormatId } from './types';

// Test-only helpers for ids.ts. Nothing here is exported by the barrel.

// Independent reference FNV-1a 32: TextEncoder bytes and BigInt arithmetic.
export function referenceFnv1a32OfBytes(bytes: Iterable<number>): string {
  let hash = BigInt(2166136261);
  const prime = BigInt(16777619);
  for (const b of bytes) {
    hash = BigInt.asUintN(32, (hash ^ BigInt(b)) * prime);
  }
  return hash.toString(16).padStart(8, '0');
}

export function referenceFnv1a32Hex(input: string): string {
  return referenceFnv1a32OfBytes(new TextEncoder().encode(input));
}

export function hexOf(bytes: readonly number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

export function referenceUtf8Hex(text: string): string {
  return hexOf(Array.from(new TextEncoder().encode(text)));
}

export interface HashFields {
  readonly formatId: FormatId;
  readonly isoDate: string;
  readonly minorText: string;
  readonly currency: string;
  readonly description: string;
}

// Text without the field separator U+001F, with multi-byte and lone-surrogate units.
const fieldTextArb = fc.string({
  unit: fc.oneof(
    fc.constantFrom('a', 'Z', '0', '9', ' ', '-', '€', '😀', 'é', '\uD800', '\uDC00'),
    fc.integer({ min: 0x20, max: 0x7e }).map((c) => String.fromCharCode(c)),
  ),
  maxLength: 20,
});

export const hashFieldsArb: fc.Arbitrary<HashFields> = fc.record({
  formatId: fc.constantFrom<FormatId>('csv', 'mobile-money-sms', 'unknown'),
  isoDate: fc
    .tuple(
      fc.integer({ min: 1, max: 9999 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 }),
    )
    .map(
      ([y, m, d]) =>
        `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    ),
  minorText: fc.integer({ min: -1_000_000, max: 1_000_000 }).map((n) => String(n)),
  currency: fc.constantFrom('USD', 'KES', 'JPY', 'EUR'),
  description: fieldTextArb,
});

// Fields that Hash_Input must ignore.
export interface ExcludedFields {
  readonly time: string | undefined;
  readonly counterparty: string | undefined;
  readonly reference: string | undefined;
}

export const excludedFieldsArb: fc.Arbitrary<ExcludedFields> = fc.record({
  time: fc.option(fc.constantFrom('00:00', '09:15', '23:59'), { nil: undefined }),
  counterparty: fc.option(fieldTextArb, { nil: undefined }),
  reference: fc.option(fieldTextArb, { nil: undefined }),
});

// Rows for assignTransactionIds: a small pool of hash inputs forces repeats.
export const hashInputRowsArb: fc.Arbitrary<readonly string[]> = fc.array(
  fc.constantFrom('a', 'b', 'c', 'd', ''),
  { maxLength: 30 },
);
