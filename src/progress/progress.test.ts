import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { exportFile, importFile, loadProgress, savePendingSync, saveProgress } from './persistence';
import { applyDiagnostic, completeStep, dueReviews, recordAttempt, recordCheckpoint, recordTestOut, touchStreak } from './reducers';
import { addDays, daysBetween, newCard, qualityFor, sm2 } from './sm2';
import { XP, canAttemptTestOut, emptyProgress } from './types';

const D = '2026-03-10';

describe('SM-2', () => {
  it('follows the 1, 6, interval*ease schedule', () => {
    let c = sm2(newCard(D), 5, D);
    expect(c).toMatchObject({ reps: 1, interval: 1, due: '2026-03-11' });
    expect(c.ease).toBeCloseTo(2.6);
    c = sm2(c, 5, c.due);
    expect(c).toMatchObject({ reps: 2, interval: 6, due: '2026-03-17' });
    c = sm2(c, 5, c.due);
    expect(c.interval).toBe(Math.round(6 * 2.8));
  });
  it('resets on a lapse and never drops ease below 1.3', () => {
    let c = newCard(D);
    for (let i = 0; i < 10; i++) c = sm2(c, 0, D);
    expect(c).toMatchObject({ reps: 0, interval: 1 });
    expect(c.ease).toBe(1.3);
  });
  it('quality 4 leaves ease unchanged, quality 3 lowers it by 0.14', () => {
    expect(sm2(newCard(D), 4, D).ease).toBeCloseTo(2.5);
    expect(sm2(newCard(D), 3, D).ease).toBeCloseTo(2.36);
  });
  it('derives quality deterministically', () => {
    expect(qualityFor({ correct: true, tries: 1, hintsUsed: 0, gaveUp: false })).toBe(5);
    expect(qualityFor({ correct: true, tries: 1, hintsUsed: 2, gaveUp: false })).toBe(4);
    expect(qualityFor({ correct: true, tries: 3, hintsUsed: 0, gaveUp: false })).toBe(3);
    expect(qualityFor({ correct: false, tries: 2, hintsUsed: 0, gaveUp: true })).toBe(1);
  });
  it('handles month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3);
  });
});

describe('progress reducers', () => {
  it('counts a streak across consecutive days and resets after a gap', () => {
    let s = touchStreak(emptyProgress(), D);
    s = touchStreak(s, D);
    expect(s.streak.current).toBe(1);
    s = touchStreak(s, addDays(D, 1));
    expect(s.streak).toMatchObject({ current: 2, best: 2 });
    s = touchStreak(s, addDays(D, 5));
    expect(s.streak).toMatchObject({ current: 1, best: 2 });
  });
  it('awards step XP once', () => {
    let s = completeStep(emptyProgress(), 'math.a', 's1', D);
    s = completeStep(s, 'math.a', 's1', D);
    expect(s.xp).toBe(XP.step);
    expect(s.nodes['math.a'].stepsDone).toEqual(['s1']);
    expect(s.lastNode).toBe('math.a');
  });
  it('masters a node only at or above the threshold and keeps the best score', () => {
    let s = recordCheckpoint(emptyProgress(), 'math.a', 0.6, 0.8, D);
    expect(s.nodes['math.a']).toMatchObject({ mastery: 'none', checkpointBest: 0.6 });
    s = recordCheckpoint(s, 'math.a', 0.8, 0.8, D);
    expect(s.nodes['math.a'].mastery).toBe('checkpoint');
    s = recordCheckpoint(s, 'math.a', 0.4, 0.8, D);
    expect(s.nodes['math.a']).toMatchObject({ mastery: 'checkpoint', checkpointBest: 0.8 });
  });
  it('limits test-out to one attempt per day', () => {
    let s = recordTestOut(emptyProgress(), 'math.a', 0.5, 0.8, D);
    expect(s.nodes['math.a'].mastery).toBe('none');
    expect(canAttemptTestOut(s.nodes['math.a'], D)).toBe(false);
    expect(canAttemptTestOut(s.nodes['math.a'], addDays(D, 1))).toBe(true);
    s = recordTestOut(s, 'math.a', 1, 0.8, addDays(D, 1));
    expect(s.nodes['math.a'].mastery).toBe('test-out');
  });
  it('schedules reviews and lists the due ones', () => {
    let s = recordAttempt(emptyProgress(), 'math.a/q1', { correct: true, tries: 1, hintsUsed: 0, gaveUp: false }, D);
    s = recordAttempt(s, 'math.a/q2', { correct: false, tries: 1, hintsUsed: 0, gaveUp: true }, D);
    expect(s.xp).toBe(XP.correct);
    expect(dueReviews(s, D)).toEqual([]);
    expect(dueReviews(s, addDays(D, 1))).toEqual(['math.a/q1', 'math.a/q2']);
  });
  it('placement marks mastery but never removes earned mastery', () => {
    const rec = { takenAt: D, ability: 3, asked: 8, correct: 5, basic: { asked: 4, correct: 3 }, advanced: { asked: 4, correct: 2 }, estimates: {}, path: [], recommended: null };
    let s = recordCheckpoint(emptyProgress(), 'math.b', 1, 0.8, D);
    s = applyDiagnostic(s, 'math', rec, { 'math.a': { estimate: 0.9, label: 'mastered' }, 'math.b': { estimate: 0.1, label: 'queued' } });
    expect(s.nodes['math.a'].mastery).toBe('placed');
    expect(s.nodes['math.b'].mastery).toBe('checkpoint');
    s = applyDiagnostic(s, 'math', rec, { 'math.a': { estimate: 0.5, label: 'review' } });
    expect(s.nodes['math.a'].mastery).toBe('none');
  });
});

describe('persistence', () => {
  it('round-trips through IndexedDB', async () => {
    const s = completeStep(emptyProgress(), 'cs.a', 's1', D);
    await saveProgress(s);
    expect(await loadProgress()).toEqual(s);
  });
  it('a synchronous page-hide journal wins over the older IndexedDB copy and is then cleared', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    const old = completeStep(emptyProgress(), 'cs.a', 's1', D);
    await saveProgress(old);
    const newer = completeStep(old, 'cs.a', 's2', D);
    savePendingSync(newer);
    expect(await loadProgress()).toEqual(newer);
    expect(store.size).toBe(0);
    expect(await loadProgress()).toEqual(newer); // now from IndexedDB
    vi.unstubAllGlobals();
  });
  it('round-trips through export and import, and rejects junk', () => {
    const s = recordCheckpoint(emptyProgress(), 'cs.a', 1, 0.8, D);
    const r = importFile(exportFile(s));
    expect(r.ok && r.data).toEqual(s);
    expect(importFile('not json').ok).toBe(false);
    expect(importFile('{"version":1,"xp":"lots"}').ok).toBe(false);
  });
});
