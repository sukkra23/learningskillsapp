import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

/** WCAG 2.1 relative luminance and contrast ratio. */
const lum = ([r, g, b]: number[]) => {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contrast = (a: number[], b: number[]) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const block = (selector: string) => {
  const body = css.slice(css.indexOf(selector)).match(/\{([^}]*)\}/)![1];
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(\d+) (\d+) (\d+)/g)].map((m) => [m[1], [+m[2], +m[3], +m[4]]]));
};
const themes = { light: block(':root'), dark: block("[data-theme='dark']") };

const TEXT = ['fg', 'muted', 'accent', 'success', 'danger', 'warn', 'cs', 'engineering', 'math', 'physics'];
const SURFACES = ['bg', 'surface', 'surface2'];

describe.each(Object.entries(themes))('%s theme contrast (WCAG AA)', (_name, t) => {
  it('defines every token', () => {
    for (const k of [...TEXT, ...SURFACES, 'border', 'border-strong', 'accent-fg', 'accent-soft']) expect(t[k], k).toBeDefined();
  });
  it.each(TEXT.flatMap((fg) => SURFACES.map((bg) => [fg, bg])))('text %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it('button and selected-state text is at least 4.5:1', () => {
    expect(contrast(t['accent-fg'], t.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.fg, t['accent-soft'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.accent, t['accent-soft'])).toBeGreaterThanOrEqual(4.5);
  });
  it('control borders and focus rings are at least 3:1', () => {
    for (const bg of SURFACES) {
      expect(contrast(t['border-strong'], t[bg])).toBeGreaterThanOrEqual(3);
      expect(contrast(t.accent, t[bg])).toBeGreaterThanOrEqual(3);
    }
  });
});
