import { describe, expect, it } from 'vitest';
import { directEstimate, place, type PlacementNode } from './placement';
import { ability, CONFIG, isDone, nextItem, replay, type Answer, type BankItem } from './staircase';

const node = (id: string, difficulty: number, prerequisites: string[] = [], status: 'ready' | 'stub' = 'ready'): PlacementNode => ({ id, difficulty, prerequisites, status, masteryThreshold: 0.8 });
// A chain a -> b -> c -> d(stub), with a side branch a -> e.
const NODES = [node('a', 1), node('b', 2, ['a']), node('c', 3, ['b']), node('e', 2, ['a']), node('d', 4, ['c'], 'stub')];
const ORDER = NODES.map((n) => n.id);
const BANK: BankItem[] = [];
for (const [nodeId, diffs] of [['a', [1, 1, 2, 2, 3]], ['b', [2, 2, 3, 3, 4]], ['c', [3, 3, 4, 4, 5, 5]], ['e', [2, 3, 3, 4]]] as const)
  diffs.forEach((difficulty, i) => BANK.push({ id: `${nodeId}${i}`, nodeId, difficulty, tier: difficulty <= 2 ? 'basic' : 'advanced' }));

/** Runs a whole test for a learner described by a predicate on the item. */
function run(knows: (it: BankItem) => boolean) {
  const answers: Answer[] = [];
  const seen: BankItem[] = [];
  for (let it = nextItem(BANK, answers, ORDER); it; it = nextItem(BANK, answers, ORDER)) { seen.push(it); answers.push({ itemId: it.id, correct: knows(it) }); }
  return { answers, seen };
}

describe('staircase', () => {
  it('starts mid-level, steps up on correct and down on wrong, and clamps', () => {
    expect(replay([]).level).toBe(3);
    expect(replay([{ itemId: 'x', correct: true }]).level).toBe(4);
    expect(replay([{ itemId: 'x', correct: false }]).level).toBe(2);
    const up = Array.from({ length: 6 }, (_, i) => ({ itemId: `${i}`, correct: true }));
    expect(replay(up).level).toBe(5);
    expect(replay(up.map((a) => ({ ...a, correct: false }))).level).toBe(1);
  });
  it('records a reversal at the level where the direction changed', () => {
    const s = replay([true, true, false, true, false].map((correct, i) => ({ itemId: `${i}`, correct })));
    expect(s.presented).toEqual([3, 4, 5, 4, 5]);
    expect(s.reversalLevels).toEqual([5, 4, 5]);
  });
  it('first item is at the start level', () => {
    expect(nextItem(BANK, [], ORDER)!.difficulty).toBe(CONFIG.startLevel);
  });
  it('never repeats an item and spreads questions across nodes', () => {
    const { seen } = run(() => true);
    expect(new Set(seen.map((s) => s.id)).size).toBe(seen.length);
    expect(new Set(seen.map((s) => s.nodeId)).size).toBe(4);
  });
  it('is deterministic', () => {
    const k = (it: BankItem) => it.difficulty <= 3;
    expect(run(k).seen.map((s) => s.id)).toEqual(run(k).seen.map((s) => s.id));
  });
  it('stops at the item cap for a consistent learner and early once it has enough reversals', () => {
    expect(run(() => true).answers).toHaveLength(CONFIG.maxItems);
    const r = run((it) => it.difficulty <= 3);
    expect(r.answers.length).toBeGreaterThanOrEqual(CONFIG.minItems);
    expect(r.answers.length).toBeLessThan(CONFIG.maxItems);
    expect(isDone(BANK, r.answers)).toBe(true);
  });
  it('stops when the bank runs out', () => {
    const small = BANK.slice(0, 3);
    expect(isDone(small, small.map((b) => ({ itemId: b.id, correct: true })))).toBe(true);
  });
  it('estimates ability near the learner\'s true level', () => {
    expect(ability(run(() => true).answers)).toBe(5);
    expect(ability(run(() => false).answers)).toBe(1);
    const a = ability(run((it) => it.difficulty <= 3).answers);
    expect(a).toBeGreaterThanOrEqual(3);
    expect(a).toBeLessThanOrEqual(4);
  });
});

describe('directEstimate', () => {
  const t = (asked: number, correct: number) => ({ asked, correct });
  it('weights basic and advanced equally when both were asked', () => {
    expect(directEstimate(t(2, 2), t(2, 1))).toBe(0.75);
    expect(directEstimate(t(1, 1), t(1, 1))).toBe(1);
  });
  it('caps basic-only evidence below mastery', () => {
    expect(directEstimate(t(3, 3), t(0, 0))).toBe(0.7);
  });
  it('uses advanced accuracy alone, and null with no evidence', () => {
    expect(directEstimate(t(0, 0), t(2, 2))).toBe(1);
    expect(directEstimate(t(0, 0), t(0, 0))).toBeNull();
  });
});

describe('place', () => {
  const ans = (pairs: Record<string, boolean>): Answer[] => Object.entries(pairs).map(([itemId, correct]) => ({ itemId, correct }));

  it('an expert is placed past everything that is ready', () => {
    const p = place(NODES, BANK, run(() => true).answers);
    expect(Object.values(p.labels).every((l) => l.label === 'mastered')).toBe(true);
    expect(p.path).toEqual([]);
    expect(p.recommended).toBeNull();
    expect(p.labels.d).toBeUndefined(); // stubs get an estimate but no label
    expect(p.estimates.d).toBeLessThan(0.8);
  });
  it('a beginner starts at the root with everything queued in prerequisite order', () => {
    const p = place(NODES, BANK, run(() => false).answers);
    expect(Object.values(p.labels).every((l) => l.label === 'queued')).toBe(true);
    expect(p.recommended).toBe('a');
    expect(p.path[0]).toBe('a');
    expect(p.path.indexOf('b')).toBeLessThan(p.path.indexOf('c'));
  });
  it('mastering a node implies its prerequisites, unless one was answered wrongly', () => {
    const p = place(NODES, BANK, ans({ c2: true, c4: true }));
    expect(p.labels.c.label).toBe('mastered');
    expect(p.labels.b.label).toBe('mastered');
    expect(p.labels.a.label).toBe('mastered');
    const q = place(NODES, BANK, ans({ c2: true, c4: true, a0: false }));
    expect(q.labels.a.label).toBe('queued');
    // Consistency: nothing stays mastered behind an unmastered prerequisite.
    expect(q.labels.b.label).toBe('review');
    expect(q.labels.c.label).toBe('review');
    expect(q.recommended).toBe('a');
  });
  it('failing a node marks its dependents as not known', () => {
    const p = place(NODES, BANK, ans({ a0: false, a2: false }));
    expect(p.estimates.b).toBe(0.1);
    expect(p.estimates.c).toBe(0.1);
    expect(p.labels.b.label).toBe('queued');
  });
  it('basic questions alone give "review", never "mastered"', () => {
    const p = place(NODES, BANK, ans({ a0: true, a1: true }));
    expect(p.estimates.a).toBe(0.7);
    expect(p.labels.a.label).toBe('review');
  });
  it('ability alone is capped below mastery', () => {
    const p = place(NODES, BANK, ans({ a4: true, b4: true, c4: true, c5: true, e3: true }));
    expect(p.ability).toBe(5);
    // "e" was never asked about: estimated from ability, capped at 0.75.
    expect(place(NODES, BANK, ans({ c2: true, c3: true, c4: true, c5: true })).estimates.e).toBe(0.75);
  });
  it('puts review nodes before queued ones when prerequisites allow', () => {
    // a mastered; e partly known (review); b unknown (queued). Both depend only on a.
    const p = place(NODES, BANK, ans({ a2: true, a4: true, a0: true, e0: true, e1: false, e2: true, b0: false, b2: false }));
    expect(p.labels.a.label).toBe('mastered');
    expect(p.labels.e.label).toBe('review');
    expect(p.labels.b.label).toBe('queued');
    expect(p.path).toEqual(['e', 'b', 'c']);
    expect(p.recommended).toBe('e');
  });
  it('respects mastery earned elsewhere and cross-track prerequisites', () => {
    const nodes = [node('x', 2, ['other.z']), node('y', 3, ['x'])];
    const bank: BankItem[] = [{ id: 'x0', nodeId: 'x', tier: 'advanced', difficulty: 3 }, { id: 'y0', nodeId: 'y', tier: 'advanced', difficulty: 4 }];
    const answers = ans({ x0: true, y0: true });
    expect(place(nodes, bank, answers).labels.x.label).toBe('review'); // other.z not verified
    expect(place(nodes, bank, answers, (id) => id === 'other.z').labels.y.label).toBe('mastered');
  });
  it('counts basic and advanced accuracy separately', () => {
    const p = place(NODES, BANK, ans({ a0: true, a1: false, c2: true }));
    expect(p.basic).toEqual({ asked: 2, correct: 1 });
    expect(p.advanced).toEqual({ asked: 1, correct: 1 });
    expect(p.asked).toBe(3);
    expect(p.correct).toBe(2);
  });
});
