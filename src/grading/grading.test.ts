import { describe, expect, it } from 'vitest';
import { Question } from '../content/schema';
import { selfCheckQuestion } from '../content/selfcheck';
import { equivalent, parseExpression, prng } from './expression';
import { matchChecklist, stem } from './explain';
import { grade, normaliseOutput, quizScore, referenceResponse } from './index';
import { parseNumber, withinTolerance } from './numeric';
import { seededOrder } from './shuffle';

const base = { id: 'q', prompt: 'p', difficulty: 1, hints: [], solution: 's' };
const Q = (x: object) => Question.parse({ ...base, ...x });

describe('parseNumber', () => {
  it.each([
    ['12.5', 12.5], [' -3 ', -3], ['3/4', 0.75], ['1.5e-3', 0.0015], ['2*pi', 2 * Math.PI], ['−2', -2],
    ['12,500', 12500], ['sqrt(2)', Math.SQRT2], ['2^10', 1024], ['.5', 0.5], ['1e3', 1000], ['π', Math.PI],
  ])('reads %s', (s, v) => expect(parseNumber(s)).toBeCloseTo(v, 12));
  it.each(['', 'abc', '12 m', '1,5', '5%', 'x+1', '1/0', 'cos(0)', '2+', 'process.exit()', '1;2'])('rejects %j', (s) => expect(parseNumber(s)).toBeNull());
});

describe('withinTolerance', () => {
  it('uses the larger of absolute and relative tolerance', () => {
    expect(withinTolerance(10.4, 10, { abs: 0.5 })).toBe(true);
    expect(withinTolerance(10.6, 10, { abs: 0.5 })).toBe(false);
    expect(withinTolerance(102, 100, { rel: 0.02 })).toBe(true);
    expect(withinTolerance(103, 100, { rel: 0.02 })).toBe(false);
    expect(withinTolerance(103, 100, { rel: 0.02, abs: 5 })).toBe(true);
  });
  it('defaults to 1% and treats abs:0 as exact', () => {
    expect(withinTolerance(100.9, 100)).toBe(true);
    expect(withinTolerance(101.1, 100)).toBe(false);
    expect(withinTolerance(7, 7, { abs: 0 })).toBe(true);
    expect(withinTolerance(7.0001, 7, { abs: 0 })).toBe(false);
  });
  it('handles negative and zero answers', () => {
    expect(withinTolerance(-9.81, -9.8, { rel: 0.01 })).toBe(true);
    expect(withinTolerance(0.001, 0, { abs: 0.01 })).toBe(true);
    expect(withinTolerance(0.1, 0, { rel: 0.5 })).toBe(false);
  });
});

describe('symbolic equivalence', () => {
  const eq = (a: string, b: string, vars = ['x']) => equivalent(a, b, vars);
  it.each([
    ['2*x + 2', '2(x+1)'], ['x^2 - 1', '(x-1)(x+1)'], ['(x+1)^2', 'x^2 + 2x + 1'], ['sin(x)^2 + cos(x)^2', '1'],
    ['x/2', '0.5x'], ['2x', 'x*2'], ['exp(2*x)', 'exp(x)^2'], ['ln(x^2)', '2*log(x)'], ['sqrt(x)^2', 'x'],
    ['1/(2*sqrt(x))', '0.5*x^(-1/2)'], ['x**3', 'x^3'], ['2*sin(x)*cos(x)', 'sin(2x)'],
  ])('%s is equivalent to %s', (a, b) => expect(eq(a, b)).toEqual({ equivalent: true }));
  it.each([
    ['2x + 1', '2x + 2'], ['x^2', 'x^3'], ['sin(x)', 'cos(x)'], ['x', 'abs(x) + 0.0001'], ['3x^2', '3x^2 + 0.001'], ['1/x', 'x'],
  ])('%s is not equivalent to %s', (a, b) => expect(eq(a, b).equivalent).toBe(false));
  it('works with several variables', () => {
    expect(eq('m*a', 'a*m', ['m', 'a']).equivalent).toBe(true);
    expect(eq('0.5*m*v^2', 'm*v^2/2', ['m', 'v']).equivalent).toBe(true);
    expect(eq('m*v', 'm*v^2', ['m', 'v']).equivalent).toBe(false);
  });
  it('reports unreadable input instead of marking it wrong', () => {
    expect(eq('2x +', 'x').error).toBeTruthy();
    expect(eq('y + 1', 'x').error).toMatch(/Unknown symbol "y"/);
    expect(eq('x = 2', 'x').error).toBeTruthy();
    expect(eq('', 'x').error).toBeTruthy();
    expect(eq('mv', 'm*v', ['m', 'v']).error).toMatch(/m\*v/);
    expect(eq('foo(x)', 'x').error).toMatch(/not a function/);
  });
  it('rejects code-like input', () => {
    expect(parseExpression('x; x=2', ['x']).ok).toBe(false);
    expect(parseExpression('[1,2]', ['x']).ok).toBe(false);
    expect(parseExpression('import("fs")', ['x']).ok).toBe(false);
  });
  it('is undefined-safe: a response undefined where the answer is defined is wrong', () => {
    expect(equivalent('sqrt(x - 10)', 'x', ['x']).equivalent).toBe(false);
  });
  it('uses a fixed seed', () => {
    const a = prng(42), b = prng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('explain checklist', () => {
  const checklist = [
    { point: 'Mentions that velocity is the rate of change of position', keywords: [['velocity'], ['rate of change', 'slope', 'derivative']] },
    { point: 'Mentions direction', keywords: [['direction', 'sign', 'vector']] },
  ];
  it('ticks a point only when every keyword group is present', () => {
    expect(matchChecklist('Velocity is the slope of the position graph.', checklist)).toEqual([true, false]);
    expect(matchChecklist('It has a direction.', checklist)).toEqual([false, true]);
    expect(matchChecklist('Velocities are derivatives and are vectors', checklist)).toEqual([true, true]);
    expect(matchChecklist('', checklist)).toEqual([false, false]);
  });
  it('stems simple suffixes but leaves short words alone', () => {
    expect(stem('accelerating')).toBe('accelerat');
    expect(stem('forces')).toBe('forc');
    expect(stem('gas')).toBe('gas');
  });
});

describe('grade', () => {
  it('mcq and multi', () => {
    const m = Q({ type: 'mcq', choices: ['a', 'b', 'c'], answer: 2 });
    expect(grade(m, { type: 'mcq', choice: 2 }).correct).toBe(true);
    expect(grade(m, { type: 'mcq', choice: 0 }).correct).toBe(false);
    const mm = Q({ type: 'multi', choices: ['a', 'b', 'c'], answers: [0, 2] });
    expect(grade(mm, { type: 'multi', choices: [2, 0] }).correct).toBe(true);
    expect(grade(mm, { type: 'multi', choices: [0] }).correct).toBe(false);
    expect(grade(mm, { type: 'multi', choices: [0, 1, 2] }).correct).toBe(false);
  });
  it('numeric: tolerance and unreadable input', () => {
    const n = Q({ type: 'numeric', answer: 9.8, tolerance: { abs: 0.05 } });
    expect(grade(n, { type: 'numeric', text: '9.81' }).correct).toBe(true);
    expect(grade(n, { type: 'numeric', text: '49/5' }).correct).toBe(true);
    expect(grade(n, { type: 'numeric', text: '10' }).correct).toBe(false);
    expect(grade(n, { type: 'numeric', text: 'ten' }).invalid).toBeTruthy();
  });
  it('expression', () => {
    const e = Q({ type: 'expression', answer: '3*x^2', variables: ['x'] });
    expect(grade(e, { type: 'expression', text: '3x*x' }).correct).toBe(true);
    expect(grade(e, { type: 'expression', text: '2x^3' }).correct).toBe(false);
    expect(grade(e, { type: 'expression', text: '3y^2' }).invalid).toBeTruthy();
  });
  it('order compares by text', () => {
    const o = Q({ type: 'order', items: ['fetch', 'decode', 'execute'] });
    expect(grade(o, { type: 'order', order: [0, 1, 2] }).correct).toBe(true);
    expect(grade(o, { type: 'order', order: [1, 0, 2] }).correct).toBe(false);
    const dup = Q({ type: 'order', items: ['a', 'a', 'b'] });
    expect(grade(dup, { type: 'order', order: [1, 0, 2] }).correct).toBe(true);
  });
  it('match', () => {
    const m = Q({ type: 'match', pairs: [['AND', '1 only if both'], ['OR', '1 if either'], ['NOT', 'flips']] });
    expect(grade(m, { type: 'match', picks: [0, 1, 2] }).correct).toBe(true);
    expect(grade(m, { type: 'match', picks: [1, 0, 2] }).correct).toBe(false);
    expect(grade(m, { type: 'match', picks: [0, 1] }).correct).toBe(false);
  });
  it('predict-output ignores trailing whitespace and line endings only', () => {
    const p = Q({ type: 'predict-output', language: 'c', code: 'x', answer: '3\n4' });
    expect(grade(p, { type: 'predict-output', text: '3  \r\n4\n\n' }).correct).toBe(true);
    expect(grade(p, { type: 'predict-output', text: '3 4' }).correct).toBe(false);
    expect(normaliseOutput('  a')).toBe('  a');
  });
  it('explain gives partial credit from ticks', () => {
    const e = Q({ type: 'explain', modelAnswer: 'alpha beta', checklist: [{ point: 'a', keywords: [['alpha']] }, { point: 'b', keywords: [['beta']] }, { point: 'c', keywords: [['alpha']] }] });
    expect(grade(e, { type: 'explain', text: '', ticks: [true, false, false] })).toEqual({ correct: false, score: 1 / 3 });
    expect(grade(e, { type: 'explain', text: '', ticks: [true, true, false] }).correct).toBe(true);
  });
  it('code needs every test to pass', () => {
    const c = Q({ type: 'code', entry: 'f', variants: { javascript: { starter: '', reference: 'function f(){}' } }, tests: [{ args: [1], expected: 1 }, { args: [2], expected: 2 }] });
    expect(grade(c, { type: 'code', passed: 2, total: 2 }).correct).toBe(true);
    expect(grade(c, { type: 'code', passed: 1, total: 2 })).toEqual({ correct: false, score: 0.5 });
  });
  it('throws on a mismatched response type', () => {
    expect(() => grade(Q({ type: 'mcq', choices: ['a', 'b'], answer: 0 }), { type: 'numeric', text: '1' })).toThrow();
  });
  it('quizScore', () => {
    expect(quizScore([true, true, false, true, true])).toBe(0.8);
    expect(quizScore([])).toBe(0);
  });
});

describe('content self-check', () => {
  it('accepts a consistent question and its reference response', () => {
    const q = Q({ type: 'numeric', answer: 20, tolerance: { abs: 0.1 } });
    expect(grade(q, referenceResponse(q)).correct).toBe(true);
    expect(selfCheckQuestion(q)).toEqual([]);
  });
  it('flags an over-wide tolerance, a bad expression and a weak model answer', () => {
    expect(selfCheckQuestion(Q({ type: 'numeric', answer: 20, tolerance: { rel: 0.5 } }))[0]).toMatch(/wider than 10%/);
    expect(selfCheckQuestion(Q({ type: 'expression', answer: '2*y', variables: ['x'] }))[0]).toMatch(/cannot be parsed/);
    expect(selfCheckQuestion(Q({ type: 'explain', modelAnswer: 'nothing relevant', checklist: [{ point: 'a', keywords: [['energy']] }] }))[0]).toMatch(/checklist/);
  });
});

describe('seededOrder', () => {
  it('is a deterministic non-identity permutation', () => {
    const a = seededOrder(5, 'node/q1');
    expect(a).toEqual(seededOrder(5, 'node/q1'));
    expect([...a].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(a).not.toEqual([0, 1, 2, 3, 4]);
    expect(seededOrder(2, 'x')).not.toEqual([0, 1]);
  });
});
