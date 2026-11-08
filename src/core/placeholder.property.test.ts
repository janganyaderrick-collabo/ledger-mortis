import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const reverse = <T>(items: readonly T[]): T[] => [...items].reverse();

// Feature: 00-foundation, Property 1: reversing a list twice returns the original list
describe('placeholder property-based test (fast-check toolchain proof)', () => {
  it('reverse(reverse(xs)) deep-equals xs for any integer array', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (xs) => {
        expect(reverse(reverse(xs))).toEqual(xs);
      }),
      { numRuns: 100 },
    );
  });
});
