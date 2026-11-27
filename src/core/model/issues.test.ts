import { describe, it, expect } from 'vitest';
import { ISSUES } from './issues';

describe('ISSUES', () => {
  it('Req 7.9: holds exactly 15 entries, 14 strings and one function', () => {
    const values = Object.values(ISSUES);
    expect(values).toHaveLength(15);
    expect(values.filter((v) => typeof v === 'string')).toHaveLength(14);
    expect(values.filter((v) => typeof v === 'function')).toHaveLength(1);
  });

  it('Req 7.9: every literal message equals the string of the requirement', () => {
    expect(ISSUES.emptyInput).toBe('Empty input');
    expect(ISSUES.unrecognisedText).toBe('Unrecognised text');
    expect(ISSUES.unrecognisedHeader).toBe('Unrecognised header');
    expect(ISSUES.malformedQuotedField).toBe('Malformed quoted field');
    expect(ISSUES.unterminatedQuote).toBe('Unterminated quote');
    expect(ISSUES.invalidDate).toBe('Invalid date');
    expect(ISSUES.invalidAmount).toBe('Invalid amount');
    expect(ISSUES.amountTooLarge).toBe('Amount too large');
    expect(ISSUES.currencyMismatch).toBe('Currency mismatch');
    expect(ISSUES.invalidDebitOrCredit).toBe('Invalid debit or credit');
    expect(ISSUES.missingDescription).toBe('Missing description');
    expect(ISSUES.unexpectedTextBeforeFirstMessage).toBe('Unexpected text before first message');
    expect(ISSUES.unrecognisedMessage).toBe('Unrecognised message');
    expect(ISSUES.invalidTransactionCost).toBe('Invalid transaction cost');
  });

  it('Req 7.9: wrongNumberOfFields(3, 5) gives the parameterised message', () => {
    expect(ISSUES.wrongNumberOfFields(3, 5)).toBe('Wrong number of fields: expected 3, found 5');
  });

  it('Req 7.9: wrongNumberOfFields writes multi-digit counts in decimal', () => {
    expect(ISSUES.wrongNumberOfFields(12, 0)).toBe('Wrong number of fields: expected 12, found 0');
  });

  it('Req 7.9: all 14 literal messages are distinct', () => {
    const literals = Object.values(ISSUES).filter((v) => typeof v === 'string');
    expect(new Set(literals).size).toBe(14);
  });
});
