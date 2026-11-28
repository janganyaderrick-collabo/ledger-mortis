import type { FormatId } from './types';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 16777619;
const HEX_DIGITS = '0123456789abcdef';
const UNIT_SEPARATOR = '\u001F';

// Hand-written UTF-8 encoder. A lone surrogate becomes U+FFFD (EF BF BD).
function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  let i = 0;
  while (i < text.length) {
    let cp = text.codePointAt(i) ?? 0xfffd;
    i += cp > 0xffff ? 2 : 1;
    if (cp >= 0xd800 && cp <= 0xdfff) {
      cp = 0xfffd;
    }
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return bytes;
}

// Standard 32-bit FNV-1a over the UTF-8 bytes, as 8 lowercase hex digits.
export function fnv1a32Hex(input: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (const b of utf8Bytes(input)) {
    hash = Math.imul(hash ^ b, FNV_PRIME) >>> 0;
  }
  let hex = '';
  for (let shift = 28; shift >= 0; shift -= 4) {
    hex += HEX_DIGITS.charAt((hash >>> shift) & 15);
  }
  return hex;
}

export function buildHashInput(
  formatId: FormatId,
  isoDate: string,
  minorText: string,
  currency: string,
  maskedDescription: string,
): string {
  return [formatId, isoDate, minorText, currency, maskedDescription].join(UNIT_SEPARATOR);
}

// Adds ids in row order: "tx-" + hash, then "-n" from the second occurrence.
export function assignTransactionIds<T extends { readonly id: string }>(
  rows: readonly (Omit<T, 'id'> & { readonly hashInput: string })[],
): readonly T[] {
  const counts = new Map<string, number>();
  return rows.map((row) => {
    const { hashInput, ...rest } = row;
    const base = `tx-${fnv1a32Hex(hashInput)}`;
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    const id = n === 1 ? base : `${base}-${String(n)}`;
    return { ...rest, id } as unknown as T;
  });
}
