import type { RawRun } from './compare';

const show = (v: unknown): string => {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
};

/**
 * Runs learner JavaScript and, if `entry` is given, calls that function once
 * per argument list. Shared by the browser worker and the Node content tests.
 */
export function runJs(code: string, entry: string | null, argLists: unknown[][]): RawRun {
  const out: string[] = [];
  const log = (...a: unknown[]) => { out.push(a.map(show).join(' ')); };
  const fakeConsole = { log, info: log, warn: log, error: log, debug: log };
  const run: RawRun = { stdout: '', error: null, tests: [] };
  try {
    const tail = entry ? `\n;return typeof ${entry} === "function" ? ${entry} : undefined;` : '';
    const fn = new Function('console', `"use strict";\n${code}${tail}`)(fakeConsole) as ((...a: unknown[]) => unknown) | undefined;
    if (entry) {
      if (!fn) throw new Error(`Define a function named ${entry}.`);
      for (const args of argLists) {
        try {
          const got = fn(...(JSON.parse(JSON.stringify(args)) as unknown[]));
          run.tests.push({ ok: true, got: got === undefined ? null : JSON.parse(JSON.stringify(got)) });
        } catch (e) { run.tests.push({ ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }); }
      }
    }
  } catch (e) { run.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e); }
  run.stdout = out.join('\n');
  return run;
}
