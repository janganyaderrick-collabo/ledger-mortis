/** WCAG AA minimum contrast ratio for normal text. */
export const AA_NORMAL = 4.5;

/** WCAG AA minimum contrast ratio for large text, UI components and graphics. */
export const AA_LARGE_UI = 3.0;

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Parses exactly "#RRGGBB" (case-insensitive) into integer channels 0-255.
 * Throws a descriptive Error for anything else.
 */
export function parseHex(hex: string): { r: number; g: number; b: number } {
  if (typeof hex !== 'string' || !HEX_PATTERN.test(hex)) {
    const shown = typeof hex === 'string' ? `"${hex}"` : safeRender(hex);
    throw new Error(`Invalid hex color ${shown}: expected format #RRGGBB.`);
  }
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/** Renders any value for an error message without ever throwing. */
function safeRender(value: unknown): string {
  try {
    return `"${String(value)}" (${typeof value})`;
  } catch {
    return `(unprintable ${typeof value})`;
  }
}

/** Converts an 8-bit sRGB channel to its linear-light value. */
function linearize(channel: number): number {
  const c = channel / 255;
  // WCAG 2.x text also shows threshold 0.03928; for 8-bit inputs both give identical results, so 0.04045 is used.
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a "#RRGGBB" color, in [0, 1]. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio between two "#RRGGBB" colors; symmetric, in [1, 21]. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
