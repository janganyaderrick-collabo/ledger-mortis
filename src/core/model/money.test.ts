import { describe, it, expect } from 'vitest';
import {
  AMOUNT_LIMIT,
  addMoney,
  createMoney,
  currencyExponent,
  formatMoney,
  parseAmountText,
} from './money';

function accepted(text: string, minor: number, currency: string, defaultCurrency = 'USD'): void {
  const result = parseAmountText(text, defaultCurrency);
  expect(result).toEqual({ ok: true, value: { minor, currency } });
}

function invalid(text: string, defaultCurrency = 'USD'): void {
  expect(parseAmountText(text, defaultCurrency)).toEqual({ ok: false, reason: 'invalid' });
}

function tooLarge(text: string, defaultCurrency = 'USD'): void {
  expect(parseAmountText(text, defaultCurrency)).toEqual({ ok: false, reason: 'too-large' });
}

describe('Algorithm A worked examples (Decision D9)', () => {
  it('Req 2.10, 2.11: example 1, "1,250.00" gives 125000 USD', () => {
    accepted('1,250.00', 125000, 'USD');
  });

  it('Req 2.6: example 2, "(500)" gives -50000 USD', () => {
    accepted('(500)', -50000, 'USD');
  });

  it('Req 2.17: example 3, "-0.00" gives positive zero USD', () => {
    const result = parseAmountText('-0.00', 'USD');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.is(result.value.minor, 0)).toBe(true);
      expect(result.value.currency).toBe('USD');
    }
  });

  it('Req 2.14, 2.21: example 4, ".50" is invalid', () => {
    invalid('.50');
  });

  it('Req 2.14, 2.21: example 5, "5." is invalid', () => {
    invalid('5.');
  });

  it('Req 2.13, 2.15, 2.21: example 6, "1.234,56" is invalid', () => {
    invalid('1.234,56');
  });

  it('Req 2.8: example 7, "+5" gives 500 USD', () => {
    accepted('+5', 500, 'USD');
  });

  it('Req 2.2, 2.5: example 8, "USD -5" with default KES gives -500 USD', () => {
    accepted('USD -5', -500, 'USD', 'KES');
  });

  it('Req 2.2, 2.21: example 9, "$5 USD" is invalid', () => {
    invalid('$5 USD');
  });

  it('Req 2.12, 2.21: example 10, "JPY 1500.00" is invalid', () => {
    invalid('JPY 1500.00');
  });

  it('Req 2.20: example 11, "1,000,000,000.00" is exactly the limit', () => {
    accepted('1,000,000,000.00', 100_000_000_000, 'USD');
  });

  it('Req 2.16: example 12, "1,000,000,000.01" is too-large', () => {
    tooLarge('1,000,000,000.01');
  });

  it('Req 2.21: example 13, 200 nines then "x" is invalid, not too-large', () => {
    invalid('9'.repeat(200) + 'x');
  });
});

describe('createMoney (Requirement 1)', () => {
  it('Req 1.1: holds minor and currency', () => {
    expect(createMoney(1250, 'USD')).toEqual({ minor: 1250, currency: 'USD' });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5, 2 ** 53])(
    'Req 1.2: throws for the unsafe minor %s',
    (minor) => {
      expect(() => createMoney(minor, 'USD')).toThrow();
    },
  );

  it.each(['usd', 'US', 'USDX', 'U5D', '', 'USd', ' USD', 'ÜSD'])(
    'Req 1.3: throws for the malformed currency "%s"',
    (currency) => {
      expect(() => createMoney(1, currency)).toThrow();
    },
  );

  it('Req 1.4: stores negative zero as positive zero', () => {
    expect(Object.is(createMoney(-0, 'USD').minor, 0)).toBe(true);
    expect(Object.is(createMoney(0, 'USD').minor, 0)).toBe(true);
  });

  it.each(['JPY', 'KRW', 'UGX', 'RWF'])('Req 1.5: %s has exponent 0', (code) => {
    expect(currencyExponent(code)).toBe(0);
  });

  it.each(['USD', 'KES', 'EUR', 'GBP', 'JPX', 'KRX', 'UGY', 'RWG'])(
    'Req 1.6: %s has exponent 2',
    (code) => {
      expect(currencyExponent(code)).toBe(2);
    },
  );

  it('Req 1.7: adds two same-currency values', () => {
    expect(addMoney(createMoney(150, 'KES'), createMoney(-400, 'KES'))).toEqual({
      minor: -250,
      currency: 'KES',
    });
  });

  it('Req 1.8: throws when adding different currencies', () => {
    expect(() => addMoney(createMoney(1, 'USD'), createMoney(1, 'KES'))).toThrow();
  });

  it('Req 1.9: throws when the sum is not a safe integer', () => {
    expect(() =>
      addMoney(createMoney(Number.MAX_SAFE_INTEGER, 'USD'), createMoney(1, 'USD')),
    ).toThrow();
    expect(() =>
      addMoney(createMoney(Number.MIN_SAFE_INTEGER, 'USD'), createMoney(-1, 'USD')),
    ).toThrow();
  });

  it('Req 1.10: addition is commutative, associative and has a zero identity', () => {
    const a = createMoney(7, 'USD');
    const b = createMoney(-30, 'USD');
    const c = createMoney(1000, 'USD');
    const zero = createMoney(0, 'USD');
    expect(addMoney(a, b)).toEqual(addMoney(b, a));
    expect(addMoney(addMoney(a, b), c)).toEqual(addMoney(a, addMoney(b, c)));
    expect(addMoney(a, zero)).toEqual(a);
    expect(Object.is(addMoney(createMoney(5, 'USD'), createMoney(-5, 'USD')).minor, 0)).toBe(true);
  });

  it('Req 1.11: accepts any safe integer, also above the Amount_Limit', () => {
    expect(createMoney(Number.MAX_SAFE_INTEGER, 'USD').minor).toBe(Number.MAX_SAFE_INTEGER);
    expect(createMoney(Number.MIN_SAFE_INTEGER, 'USD').minor).toBe(Number.MIN_SAFE_INTEGER);
    expect(createMoney(AMOUNT_LIMIT * 10, 'USD').minor).toBe(1_000_000_000_000);
  });

  it('Req 2.16, 2.20: AMOUNT_LIMIT is 100,000,000,000', () => {
    expect(AMOUNT_LIMIT).toBe(100_000_000_000);
  });
});

describe('parseAmountText whitespace, currency and symbols (Requirement 2)', () => {
  it.each([
    ['leading and trailing spaces', '  5.00  '],
    ['tab and newline', '\t5.00\n'],
    ['no-break space', '\u00a05.00\u00a0'],
    ['byte-order mark', '\ufeff5.00'],
  ])('Req 2.1: accepts %s around the text', (_name, text) => {
    accepted(text, 500, 'USD');
  });

  it('Req 2.1: whitespace only or empty is invalid', () => {
    invalid('');
    invalid('   ');
    invalid('\t\n');
  });

  it('Req 2.1: whitespace inside the digits is invalid', () => {
    invalid('1 000');
    invalid('5 .00');
    invalid('5. 00');
  });

  it.each([
    ['USD 5', 'USD'],
    ['usd 5', 'USD'],
    ['Kes 5', 'KES'],
    ['eUr5', 'EUR'],
    ['xyz 5', 'XYZ'],
  ])('Req 2.2: code in "%s" gives %s, replacing the default', (text, currency) => {
    accepted(text, 500, currency, 'GBP');
  });

  it('Req 2.2: lowercase code of a zero-exponent currency selects exponent 0', () => {
    accepted('jpy 1500', 1500, 'JPY');
    invalid('jpy 15.00');
  });

  it('Req 2.2: a code with two or four letters is invalid', () => {
    invalid('US 5');
    invalid('USDX 5');
    invalid('U 5');
  });

  it('Req 2.2: a code after the digits is invalid', () => {
    invalid('5 USD');
    invalid('5USD');
  });

  it.each(['$', '€', '£', '¥'])(
    'Req 2.3: symbol %s is ignored, default currency kept',
    (symbol) => {
      accepted(symbol + '5', 500, 'KES', 'KES');
      accepted(symbol + ' 5.25', 525, 'KES', 'KES');
    },
  );

  it('Req 2.3: a symbol after the digits is invalid', () => {
    invalid('5$');
    invalid('5 €');
  });

  it('Req 2.3: two symbols are invalid', () => {
    invalid('$$5');
    invalid('$ €5');
  });

  it.each(['USD $5', 'USD$5', '$USD 5', '$ USD 5', '€ usd5', 'usd €5'])(
    'Req 2.4: code and symbol together in "%s" is invalid',
    (text) => {
      invalid(text);
    },
  );

  it.each([
    ['USD 5', 'USD'],
    ['USD5', 'USD'],
    ['$ 5', 'USD'],
    ['USD \t 5', 'USD'],
    ['USD\u00a05', 'USD'],
  ])('Req 2.9: whitespace between currency and digits in "%s" is accepted', (text) => {
    accepted(text, 500, 'USD');
  });
});

describe('parseAmountText sign markers (Req 2.5 to 2.8)', () => {
  it.each([
    ['-5', 'USD'],
    ['-USD 5', 'USD'],
    ['-$5', 'USD'],
    ['-$ 5', 'USD'],
    ['USD -5', 'USD'],
    ['USD-5', 'USD'],
    ['$-5', 'USD'],
    ['$ -5', 'USD'],
  ])('Req 2.5: minus in "%s" gives a negative amount', (text) => {
    accepted(text, -500, 'USD');
  });

  it.each(['- 5', 'USD - 5', '-USD - 5', '$ - 5', '-\t5'])(
    'Req 2.5: whitespace after a sign in "%s" is invalid',
    (text) => {
      invalid(text);
    },
  );

  it.each(['(5)', '(USD 5)', '($5)', '(USD5)', '($ 5)', ' (5) '])(
    'Req 2.6: parentheses in "%s" give a negative amount',
    (text) => {
      accepted(text, -500, 'USD');
    },
  );

  it.each(['( 5)', '(5 )', '(5', '5)', '((5))', '(5))', '()', '(', ')', '(5)x', 'USD(5)'])(
    'Req 2.6: malformed parentheses in "%s" are invalid',
    (text) => {
      invalid(text);
    },
  );

  it.each([
    '--5',
    '++5',
    '-+5',
    '+-5',
    '-USD -5',
    '+USD +5',
    '-USD +5',
    '+$ -5',
    '(-5)',
    '(+5)',
    '-(5)',
    '+(5)',
    '(USD -5)',
    '(USD +5)',
    '(5)-',
    '5-',
    '5+',
    'USD 5-',
  ])('Req 2.7: two sign markers in "%s" are invalid', (text) => {
    invalid(text);
  });

  it.each([
    ['+5', 'USD'],
    ['+USD 5', 'USD'],
    ['+$5', 'USD'],
    ['USD +5', 'USD'],
    ['USD+5', 'USD'],
    ['$+5', 'USD'],
  ])('Req 2.8: plus in "%s" gives a positive amount', (text) => {
    accepted(text, 500, 'USD');
  });
});

describe('parseAmountText integer digits and decimals (Req 2.10 to 2.15)', () => {
  it.each([
    ['1,234', 123400],
    ['12,345', 1234500],
    ['123,456', 12345600],
    ['1,234,567', 123456700],
    ['12,345,678.90', 1234567890],
    ['123,456,789.9', 12345678990],
  ])('Req 2.10: "%s" has a valid first group and valid later groups', (text, minor) => {
    accepted(text, minor, 'USD');
  });

  it('Req 2.10: an unbroken run of digits of any length is accepted', () => {
    accepted('5', 500, 'USD');
    accepted('1234567', 123456700, 'USD');
    accepted('000012', 1200, 'USD');
    accepted('0', 0, 'USD');
  });

  it.each(['1234,567', '12345,678', '1,23', '1,2', '1,2345', '12,34', '1,234,56', '1,234,5678'])(
    'Req 2.10: "%s" has a first group over 3 digits or a later group not of 3 digits',
    (text) => {
      invalid(text);
    },
  );

  it.each(['1,,234', ',123', '1,', '1,234,', ',', '1,234,,567', '1,234 ,567'])(
    'Req 2.10: "%s" has a misplaced comma',
    (text) => {
      invalid(text);
    },
  );

  it('Req 2.10: grouping combines with a decimal part', () => {
    accepted('1,234.5', 123450, 'USD');
    invalid('1,234,5.5');
  });

  it.each([
    ['5', 500],
    ['5.0', 500],
    ['5.00', 500],
    ['5.5', 550],
    ['5.05', 505],
    ['0.07', 7],
    ['1.15', 115],
    ['0.00', 0],
  ])('Req 2.11: exponent 2 accepts "%s" (0, 1 and 2 decimals)', (text, minor) => {
    accepted(text, minor, 'USD');
  });

  it.each(['5.123', '5.000', '5.001', '5.1234', '0.001'])(
    'Req 2.11, 2.13: exponent 2 rejects %s (more than 2 decimals, no rounding)',
    (text) => {
      invalid(text);
    },
  );

  it.each(['5.', '0.', '5. ', '5.x'])('Req 2.11, 2.14: "%s" has a point without digits', (text) => {
    invalid(text);
  });

  it.each([
    ['5', 5],
    ['1500', 1500],
    ['0', 0],
  ])('Req 2.11: exponent 0 accepts the integer "%s"', (text, minor) => {
    for (const code of ['JPY', 'KRW', 'UGX', 'RWF']) {
      accepted(text, minor, code, code);
      accepted(code + ' ' + text, minor, code, 'USD');
    }
  });

  it.each(['5.0', '5.00', '5.', '1500.5', '0.0', '.5'])(
    'Req 2.12: exponent 0 rejects the point in "%s"',
    (text) => {
      invalid(text, 'JPY');
      invalid(text, 'KRW');
      invalid(text, 'UGX');
      invalid(text, 'RWF');
      invalid('JPY ' + text);
    },
  );

  it('Req 2.12: a code can set exponent 0 over a default of exponent 2', () => {
    accepted('KRW 5', 5, 'KRW', 'USD');
    invalid('KRW 5.00', 'USD');
  });

  it('Req 2.12: a code can set exponent 2 over a default of exponent 0', () => {
    accepted('USD 5.25', 525, 'USD', 'JPY');
  });

  it('Req 2.13: nothing is rounded, so 5.999 is invalid, not 600', () => {
    invalid('5.999');
    invalid('0.005');
  });

  it.each(['.5', '.50', '.0', 'USD .50', '-.5', '(.5)', '$.50'])(
    'Req 2.14: "%s" has no integer digit',
    (text) => {
      invalid(text);
    },
  );

  it.each(['12,5', '12,50', '1.234,56', '1,5', '1.234,5', '0,50', '5,', '1.000,00'])(
    'Req 2.15 and Req 23.5: decimal comma "%s" is invalid and not converted',
    (text) => {
      invalid(text);
    },
  );
});

describe('parseAmountText limit and failure reasons (Req 2.16 to 2.21)', () => {
  it('Req 2.20: exponent 2, the exact limit in several spellings is accepted', () => {
    accepted('1000000000', 100_000_000_000, 'USD');
    accepted('1000000000.0', 100_000_000_000, 'USD');
    accepted('1000000000.00', 100_000_000_000, 'USD');
    accepted('1,000,000,000', 100_000_000_000, 'USD');
    accepted('$ 1,000,000,000.00', 100_000_000_000, 'USD');
    accepted('-1000000000.00', -100_000_000_000, 'USD');
    accepted('(1000000000.00)', -100_000_000_000, 'USD');
    accepted('0001000000000.00', 100_000_000_000, 'USD');
  });

  it('Req 2.20: exponent 0, the exact limit is accepted', () => {
    accepted('100000000000', 100_000_000_000, 'JPY', 'JPY');
    accepted('JPY 100,000,000,000', 100_000_000_000, 'JPY');
    accepted('-100000000000', -100_000_000_000, 'KRW', 'KRW');
    accepted('100000000000', 100_000_000_000, 'UGX', 'UGX');
  });

  it('Req 2.20: one minor unit below the limit is accepted for both exponents', () => {
    accepted('999999999.99', 99_999_999_999, 'USD');
    accepted('99999999999', 99_999_999_999, 'JPY', 'JPY');
  });

  it('Req 2.16: exponent 2, limit plus one minor unit is too-large', () => {
    tooLarge('1000000000.01');
    tooLarge('-1000000000.01');
    tooLarge('(1000000000.01)');
    tooLarge('1,000,000,000.01');
  });

  it('Req 2.16: exponent 2, limit plus a whole unit is too-large', () => {
    tooLarge('1000000001');
    tooLarge('1000000000.1');
    tooLarge('1,000,000,001');
  });

  it('Req 2.16: exponent 0, limit plus one is too-large', () => {
    tooLarge('100000000001', 'JPY');
    tooLarge('-100000000001', 'KRW');
    tooLarge('UGX 100,000,000,001');
    tooLarge('RWF 100000000001', 'USD');
  });

  it('Req 2.16: values far above the limit and above 2^53 are too-large without throwing', () => {
    tooLarge('9'.repeat(200));
    tooLarge('9'.repeat(200) + '.99');
    tooLarge('90071992547409.91');
    tooLarge('9007199254740993', 'JPY');
    tooLarge('1' + '0'.repeat(30), 'JPY');
  });

  it('Req 2.16: leading zeros do not make a small value too-large', () => {
    accepted('0'.repeat(50) + '5', 500, 'USD');
  });

  it.each([
    ['20 nines with a decimal comma', '9'.repeat(20) + ',5'],
    ['20 nines with a trailing point', '9'.repeat(20) + '.'],
    ['20 nines with three decimals', '9'.repeat(20) + '.999'],
    ['limit with three decimals', '1,000,000,000.001'],
    ['huge value with two signs', '--' + '9'.repeat(20)],
    ['huge value and a code after the digits', '9'.repeat(20) + ' USD'],
    ['huge value with a code and a symbol', 'USD $' + '9'.repeat(20)],
    ['huge value with bad grouping', '1234,' + '999'.repeat(10)],
    ['huge value with unbalanced parentheses', '(' + '9'.repeat(20)],
  ])('Req 2.21: invalid wins over too-large: %s', (_name, text) => {
    invalid(text);
  });

  it('Req 2.21: invalid wins over too-large for exponent 0', () => {
    invalid('9'.repeat(20) + '.0', 'JPY');
    invalid('9'.repeat(20) + 'x', 'JPY');
  });

  it('Req 2.17: negative zero from "-0.00" and "(0.00)" is positive zero', () => {
    for (const text of ['-0.00', '(0.00)', '-USD 0.00', '(0)', '-0', '$-0.0']) {
      const result = parseAmountText(text, 'USD');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Object.is(result.value.minor, 0)).toBe(true);
      }
    }
    const yen = parseAmountText('-0', 'JPY');
    expect(yen.ok && Object.is(yen.value.minor, 0)).toBe(true);
    const plus = parseAmountText('+0.00', 'USD');
    expect(plus.ok && Object.is(plus.value.minor, 0)).toBe(true);
  });

  it('Req 2.18: values are built digit by digit, so float traps stay exact', () => {
    accepted('0.1', 10, 'USD');
    accepted('0.3', 30, 'USD');
    accepted('4.35', 435, 'USD');
    accepted('1.00', 100, 'USD');
    accepted('999999999.99', 99_999_999_999, 'USD');
  });

  it('Req 2.19: odd input never throws', () => {
    const odd = [
      '',
      ' ',
      '\0',
      '\ud800',
      'ab\udc00',
      '\u{1F600}',
      '5\u0000',
      'NaN',
      'Infinity',
      '1e5',
      '0x10',
    ];
    for (const text of odd) {
      expect(() => parseAmountText(text, 'USD')).not.toThrow();
      expect(parseAmountText(text, 'USD').ok).toBe(false);
    }
  });

  it('Req 2.21: every other rejection carries the reason "invalid"', () => {
    for (const text of ['abc', '5x', 'x5', '1e5', '5 5', '5..0', '5.0.0', '+', '-', '$', 'USD']) {
      invalid(text);
    }
  });
});

describe('formatMoney (Requirement 3)', () => {
  it.each([
    [5, 'USD', '0.05'],
    [50, 'USD', '0.50'],
    [100, 'USD', '1.00'],
    [123456, 'KES', '1234.56'],
    [100_000_000_000, 'USD', '1000000000.00'],
  ])('Req 3.1: %s %s formats as %s with exactly 2 decimals', (minor, currency, text) => {
    expect(formatMoney(createMoney(minor, currency))).toBe(text);
  });

  it.each([
    [5, 'JPY', '5'],
    [1500, 'KRW', '1500'],
    [100_000_000_000, 'UGX', '100000000000'],
    [12, 'RWF', '12'],
  ])('Req 3.1: %s %s formats as %s with no decimal point', (minor, currency, text) => {
    expect(formatMoney(createMoney(minor, currency))).toBe(text);
  });

  it('Req 3.2: a negative value has a leading minus', () => {
    expect(formatMoney(createMoney(-5, 'USD'))).toBe('-0.05');
    expect(formatMoney(createMoney(-125000, 'USD'))).toBe('-1250.00');
    expect(formatMoney(createMoney(-7, 'JPY'))).toBe('-7');
  });

  it('Req 3.3: no thousands commas, symbol or currency code', () => {
    const text = formatMoney(createMoney(123456789012, 'USD'));
    expect(text).toBe('1234567890.12');
    expect(text.includes(',')).toBe(false);
    expect(text.includes('USD')).toBe(false);
    expect(text.includes('$')).toBe(false);
  });

  it('Req 3.5: zero formats as "0.00" for exponent 2 and "0" for exponent 0', () => {
    expect(formatMoney(createMoney(0, 'USD'))).toBe('0.00');
    expect(formatMoney(createMoney(-0, 'USD'))).toBe('0.00');
    expect(formatMoney(createMoney(0, 'JPY'))).toBe('0');
  });

  it('Req 3.4: formatted text parses back to the same Money', () => {
    for (const money of [
      createMoney(125000, 'USD'),
      createMoney(-5, 'KES'),
      createMoney(0, 'USD'),
      createMoney(1500, 'JPY'),
      createMoney(-100_000_000_000, 'USD'),
      createMoney(100_000_000_000, 'RWF'),
    ]) {
      expect(parseAmountText(formatMoney(money), money.currency)).toEqual({
        ok: true,
        value: money,
      });
    }
  });
});
