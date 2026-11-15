import { evaluate } from 'mathjs';

/**
 * Parses what a learner typed into a number. Accepts decimals, scientific
 * notation, fractions and simple arithmetic with pi and e ("3/4", "2*pi",
 * "1.5e-3", "sqrt(2)"). Returns null for anything else, so that a typo is
 * reported as unreadable instead of being marked wrong.
 */
export function parseNumber(input: string): number | null {
  let s = input.trim().toLowerCase().replace(/[−–]/g, '-').replace(/×/g, '*').replace(/π/g, 'pi');
  if (!s) return null;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ''); // 12,500 -> 12500
  if (s.endsWith('%')) return null;
  // Only digits, operators, parentheses and the words pi, e, sqrt may appear.
  const words = s.match(/[a-z]+/g) ?? [];
  if (words.some((w) => !['pi', 'e', 'sqrt'].includes(w))) return null;
  if (!/^[0-9a-z+\-*/^().\s]+$/.test(s)) return null;
  try {
    const v = evaluate(s);
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch { return null; }
}

export interface Tolerance { abs?: number; rel?: number }

/** True when x is within max(abs, rel*|answer|) of answer. With no tolerance given, 1% relative. */
export function withinTolerance(x: number, answer: number, tol: Tolerance = {}): boolean {
  const abs = tol.abs ?? 0;
  const rel = tol.rel ?? (tol.abs === undefined ? 0.01 : 0);
  const allowed = Math.max(abs, rel * Math.abs(answer));
  return Math.abs(x - answer) <= allowed + 1e-12 * Math.max(1, Math.abs(answer));
}
