/**
 * Pure state transitions for learner progress. The Zustand store is a thin
 * wrapper around these, which keeps them easy to unit-test.
 */
import { addDays, newCard, qualityFor, sm2 } from './sm2';
import { XP, emptyNode, type DiagnosticRecord, type NodeProgress, type ProgressData } from './types';
import type { TrackId } from '../content/schema';

const node = (s: ProgressData, id: string): NodeProgress => s.nodes[id] ?? emptyNode();
const withNode = (s: ProgressData, id: string, patch: Partial<NodeProgress>): ProgressData =>
  ({ ...s, nodes: { ...s.nodes, [id]: { ...node(s, id), ...patch } } });

export function touchStreak(s: ProgressData, today: string): ProgressData {
  const { current, best, lastActiveDay } = s.streak;
  if (lastActiveDay === today) return s;
  const next = lastActiveDay === addDays(today, -1) ? current + 1 : 1;
  return { ...s, streak: { current: next, best: Math.max(best, next), lastActiveDay: today } };
}

export function completeStep(s: ProgressData, nodeId: string, stepId: string, today: string): ProgressData {
  const n = node(s, nodeId);
  if (n.stepsDone.includes(stepId)) return { ...s, lastNode: nodeId };
  const out = withNode(s, nodeId, { stepsDone: [...n.stepsDone, stepId] });
  return touchStreak({ ...out, xp: out.xp + XP.step, lastNode: nodeId }, today);
}

export interface AttemptResult { correct: boolean; tries: number; hintsUsed: number; gaveUp: boolean }

/** Records the final outcome of a question and schedules it for spaced review. */
export function recordAttempt(s: ProgressData, questionId: string, r: AttemptResult, today: string, opts: { review?: boolean } = {}): ProgressData {
  const first = !s.attempts[questionId]?.correct;
  const attempts = { ...s.attempts, [questionId]: { tries: r.tries, correct: r.correct, gaveUp: r.gaveUp } };
  const card = sm2(s.reviews[questionId] ?? newCard(today), qualityFor(r), today);
  const xp = s.xp + (r.correct ? (opts.review ? XP.review : first ? XP.correct : 0) : 0);
  return touchStreak({ ...s, attempts, reviews: { ...s.reviews, [questionId]: card }, xp }, today);
}

export function recordCheckpoint(s: ProgressData, nodeId: string, score: number, threshold: number, today: string): ProgressData {
  const n = node(s, nodeId);
  const passed = score >= threshold;
  const newlyMastered = passed && n.mastery === 'none';
  const out = withNode(s, nodeId, {
    checkpointBest: Math.max(n.checkpointBest, score),
    mastery: newlyMastered ? 'checkpoint' : n.mastery,
  });
  return touchStreak({ ...out, xp: out.xp + (newlyMastered ? XP.checkpoint : 0), lastNode: nodeId }, today);
}

export function recordTestOut(s: ProgressData, nodeId: string, score: number, threshold: number, today: string): ProgressData {
  const n = node(s, nodeId);
  const passed = score >= threshold && n.mastery === 'none';
  const out = withNode(s, nodeId, { lastTestOutDay: today, mastery: passed ? 'test-out' : n.mastery });
  return touchStreak({ ...out, xp: out.xp + (passed ? XP.checkpoint : 0) }, today);
}

/**
 * Applies a placement result. Mastery earned by checkpoint or test-out is never
 * removed; earlier placement marks for this track are replaced.
 */
export function applyDiagnostic(
  s: ProgressData, track: TrackId, record: DiagnosticRecord,
  labels: Record<string, { estimate: number; label: 'mastered' | 'review' | 'queued' }>,
): ProgressData {
  const nodes = { ...s.nodes };
  for (const [id, placement] of Object.entries(labels)) {
    const n = nodes[id] ?? emptyNode();
    let mastery = n.mastery;
    if (mastery === 'placed' || mastery === 'none') mastery = placement.label === 'mastered' ? 'placed' : 'none';
    nodes[id] = { ...n, placement, mastery };
  }
  return { ...s, nodes, diagnostics: { ...s.diagnostics, [track]: record }, onboarded: true };
}

export function dueReviews(s: ProgressData, today: string): string[] {
  return Object.entries(s.reviews).filter(([, c]) => c.due <= today).sort((a, b) => a[1].due.localeCompare(b[1].due) || a[0].localeCompare(b[0])).map(([id]) => id);
}
