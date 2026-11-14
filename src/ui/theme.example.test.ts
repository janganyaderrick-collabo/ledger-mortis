import { describe, it, expect } from 'vitest';
import { THEMES, nextTheme, isLightsOn } from './theme';
import type { Theme } from './theme';

// Feature: 00-foundation, Property 2: the Lights-On toggle transition is an involution
describe('theme toggle transitions', () => {
  // Table-driven examples over the finite Theme domain (two values), so every case is checked exhaustively.
  it.each(THEMES)('nextTheme(%s) differs from the input', (t: Theme) => {
    expect(nextTheme(t)).not.toBe(t);
  });

  it.each(THEMES)('nextTheme(nextTheme(%s)) returns the original theme', (t: Theme) => {
    expect(nextTheme(nextTheme(t))).toBe(t);
  });

  it.each([
    ['dark', 'lights-on'],
    ['lights-on', 'dark'],
  ] as const)('nextTheme(%s) is %s', (input, expected) => {
    expect(nextTheme(input)).toBe(expected);
  });

  it.each([
    ['dark', false],
    ['lights-on', true],
  ] as const)('isLightsOn(%s) is %s', (input, expected) => {
    expect(isLightsOn(input)).toBe(expected);
  });

  // This is the property the toggle button's aria-pressed state relies on.
  it.each(THEMES)('isLightsOn flips after toggling from %s', (t: Theme) => {
    expect(isLightsOn(nextTheme(t))).toBe(!isLightsOn(t));
  });

  it('THEMES holds exactly dark and lights-on, in order, without duplicates', () => {
    expect(THEMES).toEqual(['dark', 'lights-on']);
    expect(THEMES).toHaveLength(2);
    expect(new Set(THEMES).size).toBe(THEMES.length);
  });
});
