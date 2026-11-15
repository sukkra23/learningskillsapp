import { describe, expect, it } from 'vitest';
import { ancestors, canEnter, canTestOut, checkGraph, depths, descendants, findCycle, nodeState, topoOrder, type GraphNode, type MasteryKind } from './graph';

const n = (id: string, prerequisites: string[] = [], status: 'ready' | 'stub' = 'ready'): GraphNode => ({ id, prerequisites, status, masteryThreshold: 0.8 });
const lookup = (m: Record<string, MasteryKind>) => (id: string) => (m[id] ? { mastery: m[id] } : undefined);

describe('checkGraph', () => {
  it('accepts a valid DAG', () => {
    expect(checkGraph([n('a'), n('b', ['a']), n('c', ['a', 'b'])])).toEqual([]);
  });
  it('reports missing ids, duplicates and self-loops', () => {
    const errs = checkGraph([n('a', ['zzz']), n('a'), n('b', ['b'])]);
    expect(errs.some((e) => e.includes('unknown prerequisite "zzz"'))).toBe(true);
    expect(errs.some((e) => e.includes('duplicate'))).toBe(true);
    expect(errs.some((e) => e.includes('itself'))).toBe(true);
  });
  it('reports cycles with the path', () => {
    const nodes = [n('a', ['c']), n('b', ['a']), n('c', ['b'])];
    expect(findCycle(nodes)).toHaveLength(4);
    expect(checkGraph(nodes).some((e) => e.startsWith('cycle:'))).toBe(true);
  });
  it('rejects a ready node behind a stub', () => {
    expect(checkGraph([n('a', [], 'stub'), n('b', ['a'])])[0]).toMatch(/depends on stub/);
    expect(checkGraph([n('a'), n('b', ['a'], 'stub')])).toEqual([]);
  });
});

describe('ordering', () => {
  const nodes = [n('d', ['b', 'c']), n('a'), n('b', ['a']), n('c', ['a'])];
  it('puts prerequisites first and is stable', () => {
    expect(topoOrder(nodes).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('throws on a cycle', () => {
    expect(() => topoOrder([n('a', ['b']), n('b', ['a'])])).toThrow();
  });
  it('computes depths, ancestors and descendants', () => {
    expect(Object.fromEntries(depths(nodes))).toEqual({ a: 0, b: 1, c: 1, d: 2 });
    expect([...ancestors('d', new Map(nodes.map((x) => [x.id, x])))].sort()).toEqual(['a', 'b', 'c']);
    expect([...descendants('a', nodes)].sort()).toEqual(['b', 'c', 'd']);
  });
});

describe('nodeState', () => {
  const b = n('b', ['a', 'x']);
  it('locks a node until every prerequisite is verified and lists what is missing', () => {
    expect(nodeState(b, lookup({}))).toEqual({ state: 'locked', missing: ['a', 'x'] });
    expect(nodeState(b, lookup({ a: 'checkpoint' }))).toEqual({ state: 'locked', missing: ['x'] });
    expect(nodeState(b, lookup({ a: 'checkpoint', x: 'placed' })).state).toBe('available');
  });
  it('treats mastery "none" as unverified', () => {
    expect(nodeState(b, lookup({ a: 'none', x: 'test-out' })).missing).toEqual(['a']);
  });
  it('reports mastered and coming-soon', () => {
    expect(nodeState(b, lookup({ b: 'test-out' })).state).toBe('mastered');
    expect(nodeState(n('s', [], 'stub'), lookup({})).state).toBe('coming-soon');
  });
  it('only lets available or mastered nodes be entered, and only available ones be tested out', () => {
    const locked = nodeState(b, lookup({}));
    const open = nodeState(n('a'), lookup({}));
    expect(canEnter(locked)).toBe(false);
    expect(canTestOut(locked)).toBe(false);
    expect(canEnter(open)).toBe(true);
    expect(canTestOut(open)).toBe(true);
    expect(canTestOut(nodeState(n('a'), lookup({ a: 'checkpoint' })))).toBe(false);
  });
});
