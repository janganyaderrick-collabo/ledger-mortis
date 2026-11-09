import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseHex, relativeLuminance, contrastRatio } from './contrast';

const NUM_RUNS = 200;
const VALID_HEX = /^#[0-9a-fA-F]{6}$/;

const hex2 = (n: number): string => n.toString(16).toUpperCase().padStart(2, '0');
const format = (r: number, g: number, b: number): string => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

const channel = fc.integer({ min: 0, max: 255 });
const colour = fc.tuple(channel, channel, channel).map(([r, g, b]) => format(r, g, b));
const invalidString = fc.string().filter((s) => !VALID_HEX.test(s));

// Feature: 00-foundation, Property 3: the contrast function is symmetric, bounded and matches reference values
describe('contrast properties (generated inputs)', () => {
  it('is symmetric', () => {
    fc.assert(
      fc.property(colour, colour, (a, b) => {
        expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 12);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('is bounded between 1 and 21', () => {
    fc.assert(
      fc.property(colour, colour, (a, b) => {
        const ratio = contrastRatio(a, b);
        expect(ratio).toBeGreaterThanOrEqual(1);
        expect(ratio).toBeLessThanOrEqual(21 + 1e-9);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('gives 1 for a colour against itself', () => {
    fc.assert(
      fc.property(colour, (a) => {
        expect(contrastRatio(a, a)).toBeCloseTo(1, 12);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('keeps relative luminance within [0, 1]', () => {
    fc.assert(
      fc.property(colour, (a) => {
        const l = relativeLuminance(a);
        expect(l).toBeGreaterThanOrEqual(0);
        expect(l).toBeLessThanOrEqual(1 + 1e-12);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('never decreases luminance when a channel is raised', () => {
    const raised = fc
      .tuple(channel, channel, channel, fc.integer({ min: 0, max: 2 }))
      .chain(([r, g, b, idx]) => {
        const current = [r, g, b][idx] as number;
        return fc
          .integer({ min: current, max: 255 })
          .map((larger) => ({ rgb: [r, g, b] as [number, number, number], idx, larger }));
      });
    fc.assert(
      fc.property(raised, ({ rgb, idx, larger }) => {
        const next: [number, number, number] = [rgb[0], rgb[1], rgb[2]];
        next[idx] = larger;
        const before = relativeLuminance(format(rgb[0], rgb[1], rgb[2]));
        const after = relativeLuminance(format(next[0], next[1], next[2]));
        expect(after).toBeGreaterThanOrEqual(before);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('is case-insensitive', () => {
    fc.assert(
      fc.property(colour, (a) => {
        expect(relativeLuminance(a.toLowerCase())).toBe(relativeLuminance(a));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('round-trips parseHex over formatted channels', () => {
    fc.assert(
      fc.property(channel, channel, channel, (r, g, b) => {
        expect(parseHex(format(r, g, b))).toEqual({ r, g, b });
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('parseHex throws on any non-#RRGGBB string', () => {
    fc.assert(
      fc.property(invalidString, (s) => {
        expect(() => parseHex(s)).toThrow(/Invalid hex color/);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('contrastRatio throws if either argument is invalid', () => {
    fc.assert(
      fc.property(colour, invalidString, (good, bad) => {
        expect(() => contrastRatio(good, bad)).toThrow(/Invalid hex color/);
        expect(() => contrastRatio(bad, good)).toThrow(/Invalid hex color/);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('contrast reference values (fixed examples)', () => {
  it('matches externally known contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 9);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
    expect(contrastRatio('#000000', '#000000')).toBe(1);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('weights channels green > red > blue', () => {
    const g = relativeLuminance('#00FF00');
    const r = relativeLuminance('#FF0000');
    const b = relativeLuminance('#0000FF');
    expect(g).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(b);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 12);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 12);
  });

  it.each([
    ['#FFF'],
    ['FFFFFF'],
    ['#GGGGGG'],
    ['#FFFFFFF'],
    [''],
    [' #FFFFFF'],
    ['#FFFFFF '],
    [42 as unknown as string],
    [null as unknown as string],
    [undefined as unknown as string],
  ])('parseHex rejects %j', (input) => {
    expect(() => parseHex(input)).toThrow(/Invalid hex color/);
  });
});
