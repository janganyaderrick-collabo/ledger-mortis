import { isAsciiDigit } from './chars';

export const MASK_TOKEN = '[number]';

const MIN_MASKED_DIGITS = 7;
const EXCERPT_LIMIT = 60;
const SPACE = 32;
const HYPHEN = 45;

// Replaces every Digit_Group of 7 or more digits (single space or hyphen joins runs).
export function maskText(text: string): string {
  const n = text.length;
  const out: string[] = [];
  let i = 0;
  while (i < n) {
    if (!isAsciiDigit(text.charCodeAt(i))) {
      let k = i;
      while (k < n && !isAsciiDigit(text.charCodeAt(k))) {
        k += 1;
      }
      out.push(text.slice(i, k));
      i = k;
      continue;
    }
    const start = i;
    let digits = 0;
    let j = i;
    for (;;) {
      while (j < n && isAsciiDigit(text.charCodeAt(j))) {
        j += 1;
        digits += 1;
      }
      const sep = j + 1 < n ? text.charCodeAt(j) : -1;
      if ((sep === SPACE || sep === HYPHEN) && isAsciiDigit(text.charCodeAt(j + 1))) {
        j += 1;
        continue;
      }
      break;
    }
    out.push(digits >= MIN_MASKED_DIGITS ? MASK_TOKEN : text.slice(start, j));
    i = j;
  }
  return out.join('');
}

// Masks first, then cuts to 60 UTF-16 units without splitting a surrogate pair.
export function buildExcerpt(sourceText: string): string {
  const masked = maskText(sourceText);
  if (masked.length <= EXCERPT_LIMIT) {
    return masked;
  }
  const last = masked.charCodeAt(EXCERPT_LIMIT - 1);
  const end = last >= 0xd800 && last <= 0xdbff ? EXCERPT_LIMIT - 1 : EXCERPT_LIMIT;
  return masked.slice(0, end);
}
