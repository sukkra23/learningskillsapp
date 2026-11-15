import { descendants, type GraphNode } from '../graph/graph';
import { ability, type Answer, type BankItem } from './staircase';

export const MASTERED = 0.8;
export const REVIEW = 0.4;
export type Label = 'mastered' | 'review' | 'queued';

export interface PlacementNode extends GraphNode { difficulty: number }
export interface Tally { asked: number; correct: number }
export interface Placement {
  ability: number;
  asked: number;
  correct: number;
  basic: Tally;
  advanced: Tally;
  /** 0..1 mastery estimate for every node passed in. */
  estimates: Record<string, number>;
  /** Labels for ready nodes only. */
  labels: Record<string, { estimate: number; label: Label }>;
  /** Ready nodes still to do, prerequisites first, review nodes before queued ones. */
  path: string[];
  recommended: string | null;
}

const acc = (t: Tally) => (t.asked ? t.correct / t.asked : 0);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Mastery from direct evidence on one node, or null if nothing was asked about it. */
export function directEstimate(basic: Tally, advanced: Tally): number | null {
  if (basic.asked && advanced.asked) return 0.5 * acc(basic) + 0.5 * acc(advanced);
  if (advanced.asked) return acc(advanced);
  // Basic questions alone can never show mastery.
  if (basic.asked) return 0.7 * acc(basic);
  return null;
}

/**
 * Turns diagnostic answers into per-node mastery estimates, labels and a path.
 * `nodes` are the track's nodes in topological order. `verifiedElsewhere`
 * reports nodes already mastered (including prerequisites in other tracks).
 */
export function place(nodes: PlacementNode[], bank: BankItem[], answers: Answer[], verifiedElsewhere: (id: string) => boolean = () => false): Placement {
  const items = new Map(bank.map((b) => [b.id, b]));
  const theta = ability(answers);
  const tallies = new Map<string, { basic: Tally; advanced: Tally }>();
  const basic: Tally = { asked: 0, correct: 0 }, advanced: Tally = { asked: 0, correct: 0 };
  for (const a of answers) {
    const it = items.get(a.itemId);
    if (!it) continue;
    const t = tallies.get(it.nodeId) ?? { basic: { asked: 0, correct: 0 }, advanced: { asked: 0, correct: 0 } };
    tallies.set(it.nodeId, t);
    for (const tally of [t[it.tier], it.tier === 'basic' ? basic : advanced]) { tally.asked++; if (a.correct) tally.correct++; }
  }

  const direct = new Map<string, number>();
  const hasWrong = new Set<string>();
  for (const [id, t] of tallies) {
    direct.set(id, directEstimate(t.basic, t.advanced)!);
    if (t.basic.correct < t.basic.asked || t.advanced.correct < t.advanced.asked) hasWrong.add(id);
  }

  // Inference through the graph.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const impliedKnown = new Set<string>();   // prerequisites of a directly mastered node
  const impliedUnknown = new Set<string>(); // dependents of a directly failed node
  for (const [id, m] of direct) {
    if (m >= MASTERED) {
      const walk = (x: string) => { for (const p of byId.get(x)?.prerequisites ?? []) if (byId.has(p) && !impliedKnown.has(p)) { impliedKnown.add(p); walk(p); } };
      walk(id);
    } else if (m < REVIEW) {
      for (const d of descendants(id, nodes)) impliedUnknown.add(d);
    }
  }

  const estimates: Record<string, number> = {};
  for (const n of nodes) {
    const d = direct.get(n.id);
    if (impliedKnown.has(n.id) && !hasWrong.has(n.id)) estimates[n.id] = Math.max(d ?? 0, 0.85);
    else if (d !== undefined) estimates[n.id] = d;
    else if (impliedUnknown.has(n.id)) estimates[n.id] = 0.1;
    // Ability alone suggests "review" at most: it is capped below the mastery line.
    else estimates[n.id] = clamp(0.5 + 0.25 * (theta - n.difficulty), 0, 0.75);
  }

  // Labels, with a consistency pass: nothing is "mastered" behind an unmastered prerequisite.
  const labels: Placement['labels'] = {};
  const ok = (id: string) => labels[id]?.label === 'mastered' || verifiedElsewhere(id);
  for (const n of nodes) {
    if (n.status !== 'ready') continue;
    const m = estimates[n.id];
    let label: Label = m >= MASTERED ? 'mastered' : m >= REVIEW ? 'review' : 'queued';
    if (label === 'mastered' && !n.prerequisites.every(ok)) label = 'review';
    labels[n.id] = { estimate: m, label };
  }

  // Path: Kahn's algorithm over the remaining ready nodes, taking review nodes first.
  const todo = nodes.filter((n) => n.status === 'ready' && !ok(n.id));
  const left = new Set(todo.map((n) => n.id));
  const path: string[] = [];
  while (left.size) {
    const avail = todo.filter((n) => left.has(n.id) && n.prerequisites.every((p) => !left.has(p)));
    if (!avail.length) break;
    const pick = avail.find((n) => labels[n.id].label === 'review') ?? avail[0];
    path.push(pick.id);
    left.delete(pick.id);
  }
  const recommended = path.find((id) => byId.get(id)!.prerequisites.every(ok)) ?? null;

  return { ability: theta, asked: answers.length, correct: answers.filter((a) => a.correct).length, basic, advanced, estimates, labels, path, recommended };
}
