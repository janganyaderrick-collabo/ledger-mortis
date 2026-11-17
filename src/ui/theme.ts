/** The two supported display themes: the default moonlit look and the plain Lights-On mode. */
export type Theme = 'dark' | 'lights-on';

/** Every Theme value, in display order, so callers and tests can iterate them. */
export const THEMES: readonly Theme[] = ['dark', 'lights-on'];

/** Returns the other theme: 'lights-on' for 'dark', and 'dark' for 'lights-on'. Pure. */
export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'lights-on' : 'dark';
}

/** Returns true only when the theme is 'lights-on'. */
export function isLightsOn(theme: Theme): boolean {
  return theme === 'lights-on';
}
