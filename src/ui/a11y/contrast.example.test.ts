import { describe, it, expect } from 'vitest';
import { contrastRatio, AA_NORMAL, AA_LARGE_UI } from './contrast';

// Mirror of the design tokens in .kiro/steering/design-language.md; task 7.2 checks tokens.css against these values.
const TOKENS = {
  ink: '#0B0B14',
  fog: '#1B1B2E',
  bone: '#E8E2D0',
  ember: '#FF7A1A',
  ghost: '#7FE3D0',
  blood: '#C0392B',
  'blood-text': '#FF6B5B',
} as const;

type TokenName = keyof typeof TOKENS;

const BACKGROUNDS: readonly TokenName[] = ['ink', 'fog'];
const NORMAL_TEXT_TOKENS: readonly TokenName[] = ['bone', 'ember', 'ghost', 'blood-text'];

const NORMAL_CASES: ReadonlyArray<readonly [TokenName, TokenName]> = NORMAL_TEXT_TOKENS.flatMap(
  (token) => BACKGROUNDS.map((background) => [token, background] as const),
);

const BLOOD_CASES: ReadonlyArray<readonly [TokenName, TokenName]> = BACKGROUNDS.map(
  (background) => ['blood', background] as const,
);

describe('design token contrast', () => {
  // Feature: 00-foundation, Property 4: all normal-text tokens meet AA on both backgrounds
  it.each(NORMAL_CASES)('%s on %s meets AA normal text', (token, background) => {
    const ratio = contrastRatio(TOKENS[token], TOKENS[background]);
    expect(ratio >= AA_NORMAL, `${token} on ${background}: ratio ${ratio.toFixed(2)}`).toBe(true);
  });

  // Feature: 00-foundation, Property 5: blood meets only the large-text/UI threshold
  it.each(BLOOD_CASES)('%s on %s meets the large-text/UI threshold', (token, background) => {
    const ratio = contrastRatio(TOKENS[token], TOKENS[background]);
    expect(ratio >= AA_LARGE_UI, `${token} on ${background}: ratio ${ratio.toFixed(2)}`).toBe(true);
  });

  it('keeps blood out of normal text and uses blood-text instead', () => {
    const names: readonly string[] = NORMAL_TEXT_TOKENS;
    expect(names).not.toContain('blood');
    expect(names).toContain('blood-text');
  });

  it.each([
    ['ink', 'bone'],
    ['bone', 'ink'],
  ] as const)('Lights-On pairing %s on %s meets AA normal text', (a, b) => {
    const ratio = contrastRatio(TOKENS[a], TOKENS[b]);
    expect(ratio >= AA_NORMAL, `${a} on ${b}: ratio ${ratio.toFixed(2)}`).toBe(true);
  });
});
