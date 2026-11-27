import { isAsciiDigit, isAsciiLetter, isWhitespaceCode } from './chars';
import type { Money, ParseOutcome } from './types';

export const AMOUNT_LIMIT = 100_000_000_000;

const ZERO_EXPONENT_CURRENCIES: readonly string[] = ['JPY', 'KRW', 'UGX', 'RWF'];

function isWellFormedCurrency(currency: string): boolean {
  if (currency.length !== 3) {
    return false;
  }
  for (let k = 0; k < 3; k += 1) {
    const code = currency.charCodeAt(k);
    if (code < 65 || code > 90) {
      return false;
    }
  }
  return true;
}

export function currencyExponent(currency: string): 0 | 2 {
  return ZERO_EXPONENT_CURRENCIES.includes(currency) ? 0 : 2;
}

export function createMoney(minor: number, currency: string): Money {
  if (!Number.isSafeInteger(minor)) {
    throw new Error('Money minor must be a safe integer');
  }
  if (!isWellFormedCurrency(currency)) {
    throw new Error('Money currency must be three uppercase letters A-Z');
  }
  return { minor: minor === 0 ? 0 : minor, currency };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error('Cannot add Money values of different currencies');
  }
  return createMoney(a.minor + b.minor, a.currency);
}

export function formatMoney(money: Money): string {
  const exponent = currencyExponent(money.currency);
  let digits = String(Math.abs(money.minor));
  while (digits.length < exponent + 1) {
    digits = '0' + digits;
  }
  const body =
    exponent === 0
      ? digits
      : digits.slice(0, digits.length - exponent) + '.' + digits.slice(digits.length - exponent);
  return money.minor < 0 ? '-' + body : body;
}

const CURRENCY_SYMBOLS = '$€£¥';

function isSignCode(code: number): boolean {
  return code === 45 || code === 43;
}

const invalid: ParseOutcome<Money> = { ok: false, reason: 'invalid' };

export function parseAmountText(text: string, defaultCurrency: string): ParseOutcome<Money> {
  const s = text.trim();
  const n = s.length;
  if (n === 0) {
    return invalid;
  }
  let i = 0;

  // Step 2: optional opening parenthesis.
  const parenthesised = s.charCodeAt(0) === 40;
  if (parenthesised) {
    i += 1;
  }

  // Step 3: optional leading sign, not allowed together with parentheses.
  let negative = parenthesised;
  let hasLeadingSign = false;
  if (i < n && isSignCode(s.charCodeAt(i))) {
    if (parenthesised) {
      return invalid;
    }
    hasLeadingSign = true;
    negative = s.charCodeAt(i) === 45;
    i += 1;
  }

  // Step 4: optional currency code (exactly three letters) or one symbol.
  let code: string | null = null;
  let hasCurrency = false;
  if (i < n && isAsciiLetter(s.charCodeAt(i))) {
    let end = i;
    while (end < n && isAsciiLetter(s.charCodeAt(end))) {
      end += 1;
    }
    if (end - i !== 3) {
      return invalid;
    }
    code = s.slice(i, end).toUpperCase();
    hasCurrency = true;
    i = end;
  } else if (i < n && CURRENCY_SYMBOLS.includes(s.charAt(i))) {
    hasCurrency = true;
    i += 1;
  }

  // Step 5: after a currency, whitespace and an optional middle sign.
  if (hasCurrency) {
    while (i < n && isWhitespaceCode(s.charCodeAt(i))) {
      i += 1;
    }
    if (i < n && isSignCode(s.charCodeAt(i)) && !hasLeadingSign && !parenthesised) {
      negative = s.charCodeAt(i) === 45;
      i += 1;
    }
  }

  // Step 6: resolve currency and exponent before reading decimals.
  const currency = code ?? defaultCurrency;
  const exponent = currencyExponent(currency);

  let value = 0;
  let over = false;
  const grow = (digit: number): void => {
    if (over) {
      return;
    }
    value = value * 10 + digit;
    if (value > AMOUNT_LIMIT) {
      over = true;
    }
  };

  // Step 7: integer part, with optional thousands grouping.
  if (i >= n || !isAsciiDigit(s.charCodeAt(i))) {
    return invalid;
  }
  let firstGroupLength = 0;
  while (i < n && isAsciiDigit(s.charCodeAt(i))) {
    grow(s.charCodeAt(i) - 48);
    firstGroupLength += 1;
    i += 1;
  }
  if (i < n && s.charCodeAt(i) === 44) {
    if (firstGroupLength > 3) {
      return invalid;
    }
    while (i < n && s.charCodeAt(i) === 44) {
      i += 1;
      let groupLength = 0;
      while (i < n && isAsciiDigit(s.charCodeAt(i))) {
        grow(s.charCodeAt(i) - 48);
        groupLength += 1;
        i += 1;
      }
      if (groupLength !== 3) {
        return invalid;
      }
    }
  }

  // Step 8: optional decimal part.
  let decimals = 0;
  if (i < n && s.charCodeAt(i) === 46) {
    if (exponent === 0) {
      return invalid;
    }
    i += 1;
    while (i < n && isAsciiDigit(s.charCodeAt(i))) {
      grow(s.charCodeAt(i) - 48);
      decimals += 1;
      i += 1;
    }
    if (decimals < 1 || decimals > exponent) {
      return invalid;
    }
  }

  // Step 9: closing parenthesis, then the end of the text.
  if (parenthesised) {
    if (i >= n || s.charCodeAt(i) !== 41) {
      return invalid;
    }
    i += 1;
  }
  if (i !== n) {
    return invalid;
  }

  for (let k = decimals; k < exponent; k += 1) {
    grow(0);
  }
  if (over) {
    return { ok: false, reason: 'too-large' };
  }
  return { ok: true, value: createMoney(negative ? 0 - value : value, currency) };
}
