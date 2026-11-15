import { describe, expect, it } from 'vitest';
import { deepEqual, judge } from './compare';
import { runJs } from './jsHarness';

describe('deepEqual', () => {
  it('compares nested structures and tolerates float noise', () => {
    expect(deepEqual([1, [2, { a: 'x' }]], [1, [2, { a: 'x' }]])).toBe(true);
    expect(deepEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual('1', 1)).toBe(false);
    expect(deepEqual(null, [])).toBe(false);
    expect(deepEqual([], {})).toBe(false);
  });
});

describe('runJs + judge', () => {
  const tests = [{ args: [2, 3], expected: 5, hidden: false }, { args: [-1, 1], expected: 0, hidden: true }];
  it('passes a correct solution and captures console output', () => {
    const r = judge(runJs('function add(a, b) { console.log("hi", [a]); return a + b; }', 'add', tests.map((t) => t.args)), tests);
    expect(r.tests.map((t) => t.pass)).toEqual([true, true]);
    expect(r.stdout).toBe('hi [2]\nhi [-1]');
  });
  it('fails a wrong solution and reports what it returned', () => {
    const r = judge(runJs('const add = (a, b) => a - b;', 'add', tests.map((t) => t.args)), tests);
    expect(r.tests.map((t) => t.pass)).toEqual([false, false]);
    expect(r.tests[0].got).toBe(-1);
  });
  it('reports syntax errors, missing functions and thrown errors', () => {
    expect(runJs('function (', 'add', []).error).toMatch(/SyntaxError/);
    expect(runJs('let x = 1;', 'add', [[1]]).error).toMatch(/Define a function named add/);
    const r = judge(runJs('function add() { throw new RangeError("no"); }', 'add', tests.map((t) => t.args)), tests);
    expect(r.tests[0]).toMatchObject({ pass: false, error: 'RangeError: no' });
  });
  it('does not let one test mutate the arguments of the next', () => {
    const args = [[[3, 1, 2]]];
    runJs('function f(a) { a.sort(); return a; }', 'f', args);
    expect(args[0][0]).toEqual([3, 1, 2]);
  });
  it('runs plain scripts with no entry point', () => {
    expect(runJs('console.log(1 + 1)', null, [])).toEqual({ stdout: '2', error: null, tests: [] });
  });
});
