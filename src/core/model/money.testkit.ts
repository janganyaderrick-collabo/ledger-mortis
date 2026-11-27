import fc from 'fast-check';
import type { Money } from './types';

// Test-only helpers for money.ts. Nothing here is exported by the barrel.
// Everything is built from independent axes (sign, currency, digit body, decimal
// part, whitespace) so that one mutation of the parser breaks one axis only.

export const LIMIT_TEXT = '100000000000';
export const LIMIT = 100_000_000_000;

const ZERO_EXPONENT_CODES: readonly string[] = ['JPY', 'KRW', 'UGX', 'RWF'];

// Independent reference for the Currency_Exponent rule.
export function referenceExponent(code: string): 0 | 2 {
  return ZERO_EXPONENT_CODES.includes(code) ? 0 : 2;
}

export type SignStyle = 'none' | 'lead-minus' | 'lead-plus' | 'mid-minus' | 'mid-plus' | 'parens';

export type CurrencyPart =
  | { readonly kind: 'none' }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'symbol'; readonly text: string };

export interface AmountSpec {
  readonly sign: SignStyle;
  readonly currency: CurrencyPart;
  readonly gap: string; // whitespace between currency and the digits
  readonly integerDigits: string; // digits only, leading zeros allowed
  readonly grouped: boolean; // thousands commas on or off
  readonly decimals: string; // digits only, may be empty (no point then)
  readonly padLeft: string;
  readonly padRight: string;
  readonly defaultCurrency: string;
}

// The raw text pieces of an amount, in the order they are written.
export interface AmountParts {
  readonly padLeft: string;
  readonly openParen: string;
  readonly leadSign: string;
  readonly currency: string;
  readonly gap: string;
  readonly midSign: string;
  readonly integer: string;
  readonly fraction: string; // includes the point
  readonly closeParen: string;
  readonly padRight: string;
}

export function groupThousands(digits: string): string {
  const firstLength = digits.length % 3 === 0 ? 3 : digits.length % 3;
  let out = digits.slice(0, firstLength);
  for (let k = firstLength; k < digits.length; k += 3) {
    out += ',' + digits.slice(k, k + 3);
  }
  return out;
}

export function partsOf(spec: AmountSpec): AmountParts {
  const hasCurrency = spec.currency.kind !== 'none';
  return {
    padLeft: spec.padLeft,
    openParen: spec.sign === 'parens' ? '(' : '',
    leadSign: spec.sign === 'lead-minus' ? '-' : spec.sign === 'lead-plus' ? '+' : '',
    currency: spec.currency.kind === 'none' ? '' : spec.currency.text,
    gap: hasCurrency ? spec.gap : '',
    midSign: spec.sign === 'mid-minus' ? '-' : spec.sign === 'mid-plus' ? '+' : '',
    integer: spec.grouped ? groupThousands(spec.integerDigits) : spec.integerDigits,
    fraction: spec.decimals.length > 0 ? '.' + spec.decimals : '',
    closeParen: spec.sign === 'parens' ? ')' : '',
    padRight: spec.padRight,
  };
}

export function renderParts(p: AmountParts): string {
  return (
    p.padLeft +
    p.openParen +
    p.leadSign +
    p.currency +
    p.gap +
    p.midSign +
    p.integer +
    p.fraction +
    p.closeParen +
    p.padRight
  );
}

export function renderAmount(spec: AmountSpec): string {
  return renderParts(partsOf(spec));
}

export function resolvedCurrency(spec: AmountSpec): string {
  return spec.currency.kind === 'code' ? spec.currency.text.toUpperCase() : spec.defaultCurrency;
}

function stripLeadingZeros(digits: string): string {
  let k = 0;
  while (k < digits.length - 1 && digits.charAt(k) === '0') {
    k += 1;
  }
  return digits.slice(k);
}

// The decimal digits of the scaled absolute value, without leading zeros.
export function scaledDigits(spec: AmountSpec): string {
  const exponent = referenceExponent(resolvedCurrency(spec));
  const zeros = '0'.repeat(exponent - spec.decimals.length);
  return stripLeadingZeros(spec.integerDigits + spec.decimals + zeros);
}

export function exceedsLimit(scaled: string): boolean {
  return (
    scaled.length > LIMIT_TEXT.length ||
    (scaled.length === LIMIT_TEXT.length && scaled > LIMIT_TEXT)
  );
}

export type ExpectedAmount =
  | { readonly ok: true; readonly value: Money }
  | { readonly ok: false; readonly reason: 'too-large' };

export function expectedOf(spec: AmountSpec): ExpectedAmount {
  const scaled = scaledDigits(spec);
  if (exceedsLimit(scaled)) {
    return { ok: false, reason: 'too-large' };
  }
  let value = 0;
  for (let k = 0; k < scaled.length; k += 1) {
    value = value * 10 + (scaled.charCodeAt(k) - 48);
  }
  const negative =
    spec.sign === 'lead-minus' || spec.sign === 'mid-minus' || spec.sign === 'parens';
  return {
    ok: true,
    value: { minor: negative ? 0 - value : value, currency: resolvedCurrency(spec) },
  };
}

// ---- Arbitraries, one per axis ----

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
const UPPER_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const whitespaceArb: fc.Arbitrary<string> = fc.constantFrom(
  '',
  ' ',
  '\t',
  '\n',
  '\u00a0',
  '\ufeff',
  '  ',
  ' \t ',
);

export function digitsArb(minLength: number, maxLength: number): fc.Arbitrary<string> {
  return fc
    .array(fc.integer({ min: 0, max: 9 }), { minLength, maxLength })
    .map((digits) => digits.join(''));
}

export const upperCurrencyArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('USD', 'KES', 'EUR', 'JPY', 'KRW', 'UGX', 'RWF'),
  fc
    .array(fc.constantFrom(...UPPER_LETTERS), { minLength: 3, maxLength: 3 })
    .map((letters) => letters.join('')),
);

export const codeArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('JPY', 'KRW', 'UGX', 'RWF', 'USD', 'KES', 'EUR', 'jpy', 'Krw', 'uSd', 'ugx'),
  fc
    .array(fc.constantFrom(...LETTERS), { minLength: 3, maxLength: 3 })
    .map((letters) => letters.join('')),
);

export const symbolArb: fc.Arbitrary<string> = fc.constantFrom('$', '€', '£', '¥');

export const currencyPartArb: fc.Arbitrary<CurrencyPart> = fc.oneof(
  fc.constant<CurrencyPart>({ kind: 'none' }),
  codeArb.map((text): CurrencyPart => ({ kind: 'code', text })),
  symbolArb.map((text): CurrencyPart => ({ kind: 'symbol', text })),
);

export function signArb(hasCurrency: boolean): fc.Arbitrary<SignStyle> {
  return hasCurrency
    ? fc.constantFrom<SignStyle>(
        'none',
        'lead-minus',
        'lead-plus',
        'mid-minus',
        'mid-plus',
        'parens',
      )
    : fc.constantFrom<SignStyle>('none', 'lead-minus', 'lead-plus', 'parens');
}

const integerDigitsArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 8, arbitrary: digitsArb(1, 9) },
  { weight: 1, arbitrary: digitsArb(10, 16) },
);

// Sign, currency, digit body and decimal part are drawn independently.
// The decimal length depends only on the exponent of the resolved currency.
export const validSpecArb: fc.Arbitrary<AmountSpec> = fc
  .tuple(upperCurrencyArb, currencyPartArb)
  .chain(([defaultCurrency, currency]) => {
    const resolved = currency.kind === 'code' ? currency.text.toUpperCase() : defaultCurrency;
    return fc.record({
      sign: signArb(currency.kind !== 'none'),
      currency: fc.constant(currency),
      gap: whitespaceArb,
      integerDigits: integerDigitsArb,
      grouped: fc.boolean(),
      decimals: digitsArb(0, referenceExponent(resolved)),
      padLeft: whitespaceArb,
      padRight: whitespaceArb,
      defaultCurrency: fc.constant(defaultCurrency),
    });
  });

// ---- Boundary specs around the Amount_Limit ----

const hugeScaledArb: fc.Arbitrary<string> = fc
  .tuple(fc.integer({ min: 1, max: 9 }), digitsArb(12, 40))
  .map(([first, rest]) => String(first) + rest);

export const boundaryScaledArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 2, arbitrary: fc.constant(LIMIT_TEXT) },
  { weight: 3, arbitrary: fc.integer({ min: 0, max: 60 }).map((k) => String(LIMIT + k)) },
  { weight: 3, arbitrary: fc.integer({ min: 1, max: 60 }).map((k) => String(LIMIT - k)) },
  { weight: 1, arbitrary: fc.constantFrom('1000000000000', '99999999999999', '1000000000001') },
  { weight: 1, arbitrary: hugeScaledArb },
);

export interface BoundaryCase {
  readonly spec: AmountSpec;
  readonly scaled: string; // the scaled absolute value, no leading zeros
}

// A valid-syntax amount whose scaled absolute value is `scaled`.
export const boundaryCaseArb: fc.Arbitrary<BoundaryCase> = fc
  .record({
    scaled: boundaryScaledArb,
    defaultCurrency: upperCurrencyArb,
    currency: currencyPartArb,
    gap: whitespaceArb,
    grouped: fc.boolean(),
    trimFraction: fc.boolean(),
    leadingZeros: fc.integer({ min: 0, max: 3 }),
    padLeft: whitespaceArb,
    padRight: whitespaceArb,
  })
  .chain((r) =>
    signArb(r.currency.kind !== 'none').map((sign): BoundaryCase => {
      const resolved =
        r.currency.kind === 'code' ? r.currency.text.toUpperCase() : r.defaultCurrency;
      const exponent = referenceExponent(resolved);
      const padded = r.scaled.padStart(exponent + 1, '0');
      const integerDigits = '0'.repeat(r.leadingZeros) + padded.slice(0, padded.length - exponent);
      let decimals = padded.slice(padded.length - exponent);
      if (r.trimFraction) {
        while (decimals.endsWith('0')) {
          decimals = decimals.slice(0, decimals.length - 1);
        }
      }
      return {
        scaled: r.scaled,
        spec: {
          sign,
          currency: r.currency,
          gap: r.gap,
          integerDigits,
          grouped: r.grouped,
          decimals,
          padLeft: r.padLeft,
          padRight: r.padRight,
          defaultCurrency: r.defaultCurrency,
        },
      };
    }),
  );

// ---- Single-axis mutations ----

export type MutationAxis =
  | 'two-leading-signs'
  | 'leading-and-middle-sign'
  | 'parens-with-sign'
  | 'unbalanced-parens'
  | 'code-and-symbol'
  | 'code-length'
  | 'decimal-comma'
  | 'decimal-count'
  | 'point-for-zero-exponent'
  | 'no-integer-digit'
  | 'trailing-point'
  | 'bad-grouping'
  | 'trailing-text'
  | 'empty';

export interface Mutation {
  readonly axis: MutationAxis;
  readonly text: string;
  readonly defaultCurrency: string; // the default the text was built for
}

const hugeIntegerArb: fc.Arbitrary<string> = digitsArb(13, 30);

// The base has no sign. Each mutation overrides the pieces of one axis only.
const baseSpecArb: fc.Arbitrary<AmountSpec> = validSpecArb.chain((spec) =>
  fc
    .oneof(fc.constant(spec.integerDigits), hugeIntegerArb)
    .map((integerDigits): AmountSpec => ({ ...spec, sign: 'none', integerDigits })),
);

function withParts(spec: AmountSpec, override: Partial<AmountParts>): string {
  return renderParts({ ...partsOf(spec), ...override });
}

function coded(spec: AmountSpec): AmountSpec {
  return spec.currency.kind === 'none'
    ? { ...spec, currency: { kind: 'code', text: 'USD' } }
    : spec;
}

function zeroExponent(spec: AmountSpec): AmountSpec {
  return { ...spec, currency: { kind: 'code', text: 'JPY' }, decimals: '' };
}

export const mutationArb: fc.Arbitrary<Mutation> = baseSpecArb.chain((base) => {
  const exponent = referenceExponent(resolvedCurrency(base));
  const mutate = (axis: MutationAxis, text: string): Mutation => ({
    axis,
    text,
    defaultCurrency: base.defaultCurrency,
  });
  const cases: fc.Arbitrary<Mutation>[] = [
    fc
      .constantFrom('--', '++', '-+', '+-')
      .map((leadSign) => mutate('two-leading-signs', withParts(base, { leadSign }))),
    fc
      .tuple(fc.constantFrom('-', '+'), fc.constantFrom('-', '+'))
      .map(([leadSign, midSign]) =>
        mutate('leading-and-middle-sign', withParts(coded(base), { leadSign, midSign })),
      ),
    fc
      .tuple(fc.constantFrom('-', '+'), fc.boolean())
      .map(([sign, middle]) =>
        mutate(
          'parens-with-sign',
          middle
            ? withParts(coded(base), { openParen: '(', closeParen: ')', midSign: sign })
            : withParts(base, { openParen: '(', closeParen: ')', leadSign: sign }),
        ),
      ),
    fc
      .constantFrom<Partial<AmountParts>>(
        { openParen: '(', closeParen: '' },
        { openParen: '', closeParen: ')' },
        { openParen: '(', closeParen: '))' },
      )
      .map((override) => mutate('unbalanced-parens', withParts(base, override))),
    fc
      .tuple(codeArb, symbolArb, whitespaceArb, fc.boolean())
      .map(([code, symbol, gap, symbolFirst]) =>
        mutate(
          'code-and-symbol',
          withParts(base, {
            currency: symbolFirst ? symbol + gap + code : code + gap + symbol,
            gap: '',
          }),
        ),
      ),
    fc
      .constantFrom('US', 'USDX', 'U', 'ABCDE')
      .map((currency) => mutate('code-length', withParts(base, { currency, gap: ' ' }))),
    fc
      .tuple(fc.integer({ min: 1, max: 3 }), digitsArb(1, 2))
      .chain(([integerLength, tail]) =>
        digitsArb(integerLength, integerLength).map((integer) =>
          mutate('decimal-comma', withParts(base, { integer, fraction: ',' + tail })),
        ),
      ),
    digitsArb(exponent + 1, exponent + 3).map((tail) =>
      mutate('decimal-count', withParts(base, { fraction: '.' + tail })),
    ),
    digitsArb(1, 3).map((tail) =>
      mutate('point-for-zero-exponent', withParts(zeroExponent(base), { fraction: '.' + tail })),
    ),
    digitsArb(1, Math.max(exponent, 1)).map((tail) =>
      mutate('no-integer-digit', withParts(base, { integer: '', fraction: '.' + tail })),
    ),
    fc.constant(mutate('trailing-point', withParts(base, { fraction: '.' }))),
    fc
      .oneof(
        fc
          .tuple(digitsArb(1, 3), fc.constantFrom(1, 2, 4, 5))
          .chain(([first, later]) => digitsArb(later, later).map((group) => first + ',' + group)),
        digitsArb(4, 8).map((first) => first + ',123'),
        digitsArb(1, 3).map((first) => first + ','),
        digitsArb(1, 3).map((first) => first + ',,123'),
        digitsArb(1, 3).map((first) => ',' + first + ',123'),
        digitsArb(1, 3).map((first) => first + ',123,45'),
      )
      .map((integer) => mutate('bad-grouping', withParts(base, { integer }))),
    fc
      .constantFrom('x', ' USD', 'abc', '.', ',', '-', '%', ' 5')
      .map((suffix) => mutate('trailing-text', withParts(base, { padRight: suffix }))),
    fc.constantFrom('', ' ', '\t', '\u00a0').map((text) => mutate('empty', text)),
  ];
  return fc.oneof(...cases);
});

// ---- Money and arbitrary text ----

export const boundedMoneyArb: fc.Arbitrary<Money> = fc.record({
  minor: fc.oneof(
    { weight: 4, arbitrary: fc.integer({ min: -LIMIT, max: LIMIT }) },
    { weight: 1, arbitrary: fc.integer({ min: -1000, max: 1000 }) },
    { weight: 1, arbitrary: fc.constantFrom(0, 1, -1, 5, -5, 99, 100, LIMIT, -LIMIT, LIMIT - 1) },
  ),
  currency: upperCurrencyArb,
});

const AMOUNT_ALPHABET = '0123456789,.()+- $€£¥USDusdJPYabc\t\u00a0x'.split('');

export const amountLikeTextArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...AMOUNT_ALPHABET), { maxLength: 40 })
  .map((chars) => chars.join(''));

export const anyTextArb: fc.Arbitrary<string> = fc.oneof(
  fc.string({ unit: 'binary', maxLength: 60 }),
  fc.string({ unit: 'grapheme', maxLength: 60 }),
  amountLikeTextArb,
  digitsArb(1, 400),
  mutationArb.map((m) => m.text),
);
