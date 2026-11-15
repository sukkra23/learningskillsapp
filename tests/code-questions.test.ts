/**
 * Runs every coding question's reference solutions against its own hidden
 * tests: JavaScript in Node through the same harness the browser worker uses,
 * and Python through Pyodide. Also checks that the starter code does NOT pass.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContentFromDisk } from '../scripts/load-content';
import { nodeQuestions, type Question } from '../src/content/schema';
import { normaliseOutput } from '../src/grading';
import { judge, type RawRun } from '../src/runner/compare';
import { runJs } from '../src/runner/jsHarness';
import { PY_HARNESS } from '../src/runner/pyHarness';

type CodeQ = Extract<Question, { type: 'code' }>;
const { catalog } = loadContentFromDisk();
const code: [string, CodeQ][] = [];
const pythonPredict: [string, Extract<Question, { type: 'predict-output' }>][] = [];
const runnableTabs: [string, string][] = [];
for (const n of catalog.nodes) {
  for (const { question: q } of nodeQuestions(n)) {
    if (q.type === 'code') code.push([`${n.id}/${q.id}`, q]);
    if (q.type === 'predict-output' && q.language === 'python') pythonPredict.push([`${n.id}/${q.id}`, q]);
  }
  for (const s of n.steps) if (s.kind === 'code-tabs') for (const t of s.tabs) if (t.runnable && t.language === 'python') runnableTabs.push([`${n.id}/${s.id}`, t.code]);
}
const tests = (q: CodeQ) => q.tests.map((t) => ({ args: t.args, expected: t.expected, hidden: t.hidden }));

let py: (code: string, entry: string | null, args: unknown[][]) => RawRun;
beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const dir = path.dirname(require.resolve('pyodide/package.json'));
  const { loadPyodide } = (await import('pyodide')) as unknown as { loadPyodide(o: { indexURL: string }): Promise<{ runPython(c: string): unknown; globals: { get(n: string): (...a: unknown[]) => string } }> };
  const p = await loadPyodide({ indexURL: dir + '/' });
  p.runPython(PY_HARNESS);
  py = (c, entry, args) => JSON.parse(p.globals.get('__orbit_run')(c, entry, JSON.stringify(args))) as RawRun;
}, 120000);

describe('coding questions', () => {
  it('there is at least one, with visible and hidden tests', () => {
    expect(code.length).toBeGreaterThan(0);
    for (const [k, q] of code) {
      expect(q.tests.some((t) => t.hidden), k).toBe(true);
      expect(q.tests.some((t) => !t.hidden), k).toBe(true);
    }
  });
  it.each(code)('%s: JavaScript reference passes every test and the starter does not', (_k, q) => {
    const v = q.variants.javascript!;
    const r = judge(runJs(v.reference, q.entry, q.tests.map((t) => t.args)), tests(q));
    expect(r.error).toBeUndefined();
    expect(r.tests.filter((t) => !t.pass)).toEqual([]);
    expect(judge(runJs(v.starter, q.entry, q.tests.map((t) => t.args)), tests(q)).tests.every((t) => t.pass)).toBe(false);
  });
  it.each(code)('%s: Python reference passes every test and the starter does not', (_k, q) => {
    const v = q.variants.python!;
    const r = judge(py(v.reference, q.entry, q.tests.map((t) => t.args)), tests(q));
    expect(r.error).toBeUndefined();
    expect(r.tests.filter((t) => !t.pass)).toEqual([]);
    expect(judge(py(v.starter, q.entry, q.tests.map((t) => t.args)), tests(q)).tests.every((t) => t.pass)).toBe(false);
  });
});

describe('Python that the lessons show really produces the stated output', () => {
  it.each(pythonPredict)('%s', (_k, q) => {
    const r = py(q.code, null, []);
    expect(r.error).toBeNull();
    expect(normaliseOutput(r.stdout)).toBe(normaliseOutput(q.answer));
  });
  it.each(runnableTabs)('runnable tab in %s executes without error', (_k, src) => {
    const r = py(src, null, []);
    expect(r.error).toBeNull();
    expect(r.stdout.trim()).toBe('10');
  });
  it('the Python harness reports errors and failed tests', () => {
    expect(py('def f(:\n  pass', 'f', [[1]]).error).toMatch(/SyntaxError/);
    expect(py('x = 1', 'f', [[1]]).error).toMatch(/Define a function named f/);
    expect(py('def f(a):\n    return 1 / a', 'f', [[0]]).tests[0]).toMatchObject({ ok: false, error: expect.stringContaining('ZeroDivisionError') });
    expect(py('def f(a):\n    print("hi")\n    return (a, a)', 'f', [[2]])).toMatchObject({ stdout: 'hi\n', tests: [{ ok: true, got: [2, 2] }] });
  });
});
