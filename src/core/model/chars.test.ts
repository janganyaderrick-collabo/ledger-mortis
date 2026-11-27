import { describe, it, expect } from 'vitest';
import {
  isAsciiDigit,
  isAsciiLetter,
  isAsciiUpperOrDigit,
  isWhitespaceCode,
  asciiLowerCode,
  startsWithKeywordAt,
} from './chars';

describe('chars', () => {
  it('Req 19.1: isAsciiDigit accepts 0 to 9 and nothing next to them', () => {
    expect(isAsciiDigit(47)).toBe(false);
    expect(isAsciiDigit(48)).toBe(true);
    expect(isAsciiDigit(57)).toBe(true);
    expect(isAsciiDigit(58)).toBe(false);
    expect(isAsciiDigit(0x0663)).toBe(false); // Arabic-Indic digit is not ASCII
  });

  it('Req 19.1: isAsciiLetter accepts A-Z and a-z only', () => {
    expect(isAsciiLetter(64)).toBe(false);
    expect(isAsciiLetter(65)).toBe(true);
    expect(isAsciiLetter(90)).toBe(true);
    expect(isAsciiLetter(91)).toBe(false);
    expect(isAsciiLetter(96)).toBe(false);
    expect(isAsciiLetter(97)).toBe(true);
    expect(isAsciiLetter(122)).toBe(true);
    expect(isAsciiLetter(123)).toBe(false);
    expect(isAsciiLetter(0xe9)).toBe(false);
  });

  it('Req 19.1: isAsciiUpperOrDigit accepts A-Z and 0-9 but not a-z', () => {
    expect(isAsciiUpperOrDigit(48)).toBe(true);
    expect(isAsciiUpperOrDigit(57)).toBe(true);
    expect(isAsciiUpperOrDigit(65)).toBe(true);
    expect(isAsciiUpperOrDigit(90)).toBe(true);
    expect(isAsciiUpperOrDigit(97)).toBe(false);
    expect(isAsciiUpperOrDigit(58)).toBe(false);
    expect(isAsciiUpperOrDigit(64)).toBe(false);
    expect(isAsciiUpperOrDigit(91)).toBe(false);
  });

  it('Req 19.1: isWhitespaceCode accepts every code of the trim set, including U+FEFF and U+00A0', () => {
    const trimSet = [
      0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004,
      0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
      0xfeff,
    ];
    for (const code of trimSet) {
      expect(isWhitespaceCode(code)).toBe(true);
    }
  });

  it('Req 19.1: isWhitespaceCode matches String.prototype.trim for every UTF-16 code unit', () => {
    for (let code = 0; code <= 0xffff; code += 1) {
      const removedByTrim = String.fromCharCode(code).trim() === '';
      expect(isWhitespaceCode(code)).toBe(removedByTrim);
    }
  });

  it('Req 19.1: isWhitespaceCode rejects the codes next to the set', () => {
    expect(isWhitespaceCode(0x08)).toBe(false);
    expect(isWhitespaceCode(0x0e)).toBe(false);
    expect(isWhitespaceCode(0x1f)).toBe(false);
    expect(isWhitespaceCode(0x21)).toBe(false);
    expect(isWhitespaceCode(0x200b)).toBe(false); // zero-width space is not trimmed
    expect(isWhitespaceCode(0x180e)).toBe(false);
  });

  it('Req 19.1: asciiLowerCode folds A-Z only', () => {
    expect(asciiLowerCode(65)).toBe(97);
    expect(asciiLowerCode(90)).toBe(122);
    expect(asciiLowerCode(64)).toBe(64);
    expect(asciiLowerCode(91)).toBe(91);
    expect(asciiLowerCode(97)).toBe(97);
    expect(asciiLowerCode(0xc9)).toBe(0xc9); // non-ASCII stays unchanged
    expect(asciiLowerCode(0x212a)).toBe(0x212a); // Kelvin sign does not fold to "k"
  });

  it('Req 19.1: startsWithKeywordAt matches case-insensitively in the middle of a text', () => {
    expect(startsWithKeywordAt('You PAID to Bob', 4, 'paid')).toBe(true);
    expect(startsWithKeywordAt('You paid to Bob', 4, 'paid')).toBe(true);
    expect(startsWithKeywordAt('You paid to Bob', 4, 'pail')).toBe(false);
  });

  it('Req 19.1: startsWithKeywordAt handles the text edges', () => {
    expect(startsWithKeywordAt('paid', 0, 'paid')).toBe(true);
    expect(startsWithKeywordAt('xpaid', 1, 'paid')).toBe(true);
    expect(startsWithKeywordAt('pai', 0, 'paid')).toBe(false);
    expect(startsWithKeywordAt('paid', 1, 'paid')).toBe(false);
    expect(startsWithKeywordAt('paid', 4, 'paid')).toBe(false);
    expect(startsWithKeywordAt('paid', -1, 'paid')).toBe(false);
    expect(startsWithKeywordAt('', 0, 'a')).toBe(false);
    expect(startsWithKeywordAt('abc', 3, '')).toBe(true);
  });

  it('Req 19.1: startsWithKeywordAt does not fold non-ASCII letters', () => {
    expect(startsWithKeywordAt('\u212aa', 0, 'ka')).toBe(false);
  });
});
