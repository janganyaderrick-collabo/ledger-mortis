import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildExcerpt, maskText } from './masking';
import {
  anyUnitsTextArb,
  groupedTextArb,
  longestDigitGroup,
  pairAtCutArb,
  straddleArb,
} from './masking.testkit';

const RUNS = { numRuns: 300 };

describe('masking properties', () => {
  // Feature: 01-parsers, Property 18: Masking removes long digit groups and leaves short ones, idempotently
  it('Req 5.1, 5.3, 5.4: P18 long groups are masked, short ones kept, result idempotent', () => {
    fc.assert(
      fc.property(groupedTextArb, ({ text, expected }) => {
        expect(maskText(text)).toBe(expected);
      }),
      RUNS,
    );
    fc.assert(
      fc.property(anyUnitsTextArb, (text) => {
        const masked = maskText(text);
        expect(longestDigitGroup(masked)).toBeLessThan(7);
        expect(maskText(masked)).toBe(masked);
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 19: Excerpts are masked before being cut to 60 characters
  it('Req 5.7: P19 excerpts are masked first, then cut to at most 60 units', () => {
    fc.assert(
      fc.property(anyUnitsTextArb, (text) => {
        const masked = maskText(text);
        const excerpt = buildExcerpt(text);
        expect(excerpt.length).toBeLessThanOrEqual(60);
        expect(masked.startsWith(excerpt)).toBe(true);
        expect(longestDigitGroup(excerpt)).toBeLessThan(7);
        if (masked.length <= 60) {
          expect(excerpt).toBe(masked);
        } else {
          expect(excerpt.length).toBeGreaterThanOrEqual(59);
        }
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 19: Excerpts are masked before being cut to 60 characters
  it('Req 5.7: P19 a group crossing character 60 never leaks digits', () => {
    fc.assert(
      fc.property(straddleArb, (text) => {
        expect(/[0-9]/.test(buildExcerpt(text))).toBe(false);
      }),
      RUNS,
    );
  });

  // Feature: 01-parsers, Property 19: Excerpts are masked before being cut to 60 characters
  it('Req 5.7: P19 a surrogate pair is never split at the cut', () => {
    fc.assert(
      fc.property(pairAtCutArb, (text) => {
        const excerpt = buildExcerpt(text);
        expect(excerpt.length).toBe(59);
        expect(excerpt).toBe(text.slice(0, 59));
      }),
      RUNS,
    );
  });
});
