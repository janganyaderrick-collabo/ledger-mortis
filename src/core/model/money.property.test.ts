import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { AMOUNT_LIMIT, currencyExponent, formatMoney, parseAmountText } from './money';
import {
  anyTextArb,
  boundaryCaseArb,
  boundedMoneyArb,
  exceedsLimit,
  expectedOf,
  mutationArb,
  renderAmount,
  upperCurrencyArb,
  validSpecArb,
} from './money.testkit';

const RUNS = { numRuns: 300 };

describe('money properties', () => {
  // Feature: 01-parsers, Property 7: Amount_Grammar accept/reject table
  it('Req 2.1 to 2.15, 2.21: P7 grammar-valid texts parse to the expected signed value', () => {
    fc.assert(
      fc.property(validSpecArb, (spec) => {
        const result = parseAmountText(renderAmount(spec), spec.defaultCurrency);
        expect(result).toEqual(expectedOf(spec));
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 7: Amount_Grammar accept/reject table
  it('Req 2.4, 2.7, 2.10 to 2.15, 2.21: P7 every single-rule mutation is invalid', () => {
    fc.assert(
      fc.property(mutationArb, (mutation) => {
        const result = parseAmountText(mutation.text, mutation.defaultCurrency);
        expect(result, `${mutation.axis}: ${JSON.stringify(mutation.text)}`).toEqual({
          ok: false,
          reason: 'invalid',
        });
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 8: The Amount_Limit boundary is exact
  it('Req 2.16, 2.20: P8 accepted exactly up to the limit, too-large above it', () => {
    fc.assert(
      fc.property(boundaryCaseArb, ({ spec, scaled }) => {
        const result = parseAmountText(renderAmount(spec), spec.defaultCurrency);
        if (exceedsLimit(scaled)) {
          expect(result).toEqual({ ok: false, reason: 'too-large' });
        } else {
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(Math.abs(result.value.minor)).toBeLessThanOrEqual(AMOUNT_LIMIT);
            expect(String(Math.abs(result.value.minor))).toBe(scaled);
          }
        }
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 10: Amount parsing never throws
  it('Req 2.19: P10 any text gives a well-formed outcome and never throws', () => {
    fc.assert(
      fc.property(anyTextArb, upperCurrencyArb, (text, defaultCurrency) => {
        const result = parseAmountText(text, defaultCurrency);
        if (result.ok) {
          expect(Number.isSafeInteger(result.value.minor)).toBe(true);
          expect(Math.abs(result.value.minor)).toBeLessThanOrEqual(AMOUNT_LIMIT);
          expect(Object.is(result.value.minor, -0)).toBe(false);
          expect(result.value.currency.length).toBe(3);
        } else {
          expect(['invalid', 'too-large']).toContain(result.reason);
        }
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 11: Money formatting is round-trippable, sign-correct and bare
  it('Req 3.1 to 3.4, 20.2: P11 formatting is bare, signed, exact in decimals and round-trips', () => {
    fc.assert(
      fc.property(boundedMoneyArb, (money) => {
        const text = formatMoney(money);
        const exponent = currencyExponent(money.currency);
        const abs = Math.abs(money.minor);

        expect(text.startsWith('-')).toBe(money.minor < 0);
        expect(text.includes(',')).toBe(false);
        expect(text.includes(money.currency)).toBe(false);
        for (const symbol of ['$', '€', '£', '¥', '+', ' ']) {
          expect(text.includes(symbol)).toBe(false);
        }

        // Independent reference built with integer division.
        const unit = exponent === 0 ? 1 : 100;
        const whole = String(Math.floor(abs / unit));
        const fraction = exponent === 0 ? '' : '.' + String(abs % unit).padStart(2, '0');
        const reference = (money.minor < 0 ? '-' : '') + whole + fraction;
        expect(text).toBe(reference);
        expect(text.includes('.')).toBe(exponent !== 0);

        expect(parseAmountText(text, money.currency)).toEqual({ ok: true, value: money });
      }),
      RUNS,
    );
  });
});
