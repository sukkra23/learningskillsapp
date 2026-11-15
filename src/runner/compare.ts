/** Structural equality for test results. Numbers compare with a small relative tolerance. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b);
    return a === b || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  const ka = Object.keys(a as object).sort(), kb = Object.keys(b as object).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export interface RawTest { ok: boolean; got?: unknown; error?: string }
export interface RawRun { stdout: string; error: string | null; tests: RawTest[] }

export interface TestSpec { args: unknown[]; expected?: unknown; hidden: boolean }
export interface TestOutcome { pass: boolean; hidden: boolean; args: unknown[]; expected?: unknown; got?: unknown; error?: string }
export interface RunResult { stdout: string; error?: string; timedOut?: boolean; tests: TestOutcome[] }

export const MAX_OUTPUT = 20000;
export const clip = (s: string) => (s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + '\n... output truncated ...' : s);

/** Combines what the program produced with what the tests expected. */
export function judge(raw: RawRun, tests: TestSpec[]): RunResult {
  return {
    stdout: clip(raw.stdout),
    error: raw.error ?? undefined,
    tests: tests.map((t, i) => {
      const r = raw.tests[i];
      if (!r) return { pass: false, hidden: t.hidden, args: t.args, expected: t.expected, error: 'did not run' };
      return { pass: r.ok && deepEqual(r.got, t.expected), hidden: t.hidden, args: t.args, expected: t.expected, got: r.got, error: r.error };
    }),
  };
}
