/**
 * Skill-graph engine. Pure functions only: used by the app, the route guards,
 * the diagnostic, and the build-time validator.
 */
export interface GraphNode {
  id: string;
  status: 'ready' | 'stub';
  prerequisites: string[];
  masteryThreshold: number;
}

export type MasteryKind = 'none' | 'placed' | 'checkpoint' | 'test-out';
export interface NodeProgressLike { mastery: MasteryKind }
export type ProgressLookup = (nodeId: string) => NodeProgressLike | undefined;

/** Structural problems in the graph. An empty array means the graph is valid. */
export function checkGraph(nodes: GraphNode[]): string[] {
  const errors: string[] = [];
  const byId = new Map<string, GraphNode>();
  for (const n of nodes) {
    if (byId.has(n.id)) errors.push(`duplicate node id "${n.id}"`);
    byId.set(n.id, n);
  }
  for (const n of nodes) {
    const seen = new Set<string>();
    for (const p of n.prerequisites) {
      if (p === n.id) errors.push(`"${n.id}" lists itself as a prerequisite`);
      if (seen.has(p)) errors.push(`"${n.id}" lists prerequisite "${p}" twice`);
      seen.add(p);
      const target = byId.get(p);
      if (!target) errors.push(`"${n.id}" has unknown prerequisite "${p}"`);
      else if (n.status === 'ready' && target.status === 'stub')
        errors.push(`ready node "${n.id}" depends on stub "${p}", so it could never be unlocked`);
    }
  }
  const cycle = findCycle(nodes);
  if (cycle) errors.push(`cycle: ${cycle.join(' -> ')}`);
  return errors;
}

/** Returns one cycle as a list of ids (first id repeated at the end), or null. */
export function findCycle(nodes: GraphNode[]): string[] | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const state = new Map<string, 0 | 1 | 2>(); // 0 unseen, 1 on stack, 2 done
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    state.set(id, 1);
    stack.push(id);
    for (const p of byId.get(id)?.prerequisites ?? []) {
      if (!byId.has(p)) continue;
      const s = state.get(p) ?? 0;
      if (s === 1) return [...stack.slice(stack.indexOf(p)), p];
      if (s === 0) { const c = visit(p); if (c) return c; }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const n of nodes) if ((state.get(n.id) ?? 0) === 0) { const c = visit(n.id); if (c) return c; }
  return null;
}

/**
 * Topological order (prerequisites first) using Kahn's algorithm. Ties are
 * broken by input order, so the result is stable. Throws on a cycle.
 */
export function topoOrder<T extends GraphNode>(nodes: T[]): T[] {
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const indeg = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const n of nodes) {
    const prereqs = n.prerequisites.filter((p) => index.has(p));
    indeg.set(n.id, prereqs.length);
    for (const p of prereqs) dependents.set(p, [...(dependents.get(p) ?? []), n.id]);
  }
  const ready = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const out: T[] = [];
  while (ready.length) {
    ready.sort((a, b) => index.get(a)! - index.get(b)!);
    const id = ready.shift()!;
    out.push(nodes[index.get(id)!]);
    for (const d of dependents.get(id) ?? []) {
      indeg.set(d, indeg.get(d)! - 1);
      if (indeg.get(d) === 0) ready.push(d);
    }
  }
  if (out.length !== nodes.length) throw new Error('graph has a cycle');
  return out;
}

/** Longest prerequisite chain below each node (0 for roots), counting only nodes in the list. */
export function depths(nodes: GraphNode[]): Map<string, number> {
  const d = new Map<string, number>();
  for (const n of topoOrder(nodes)) {
    const ps = n.prerequisites.filter((p) => d.has(p));
    d.set(n.id, ps.length ? Math.max(...ps.map((p) => d.get(p)!)) + 1 : 0);
  }
  return d;
}

/** All transitive prerequisites of a node. */
export function ancestors(id: string, byId: Map<string, GraphNode>): Set<string> {
  const out = new Set<string>();
  const walk = (x: string) => {
    for (const p of byId.get(x)?.prerequisites ?? []) if (!out.has(p)) { out.add(p); walk(p); }
  };
  walk(id);
  return out;
}

export function descendants(id: string, nodes: GraphNode[]): Set<string> {
  const out = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of nodes) {
      if (out.has(n.id) || n.id === id) continue;
      if (n.prerequisites.some((p) => p === id || out.has(p))) { out.add(n.id); grew = true; }
    }
  }
  return out;
}

export const isVerified = (p: NodeProgressLike | undefined) => !!p && p.mastery !== 'none';

export type LockState = 'coming-soon' | 'mastered' | 'locked' | 'available';
export interface NodeState { state: LockState; missing: string[] }

/**
 * The single source of truth for whether a node can be entered.
 * `missing` lists the direct prerequisites that are not yet verified.
 */
export function nodeState(node: GraphNode, progress: ProgressLookup): NodeState {
  const missing = node.prerequisites.filter((p) => !isVerified(progress(p)));
  if (node.status === 'stub') return { state: 'coming-soon', missing };
  if (isVerified(progress(node.id))) return { state: 'mastered', missing: [] };
  return missing.length ? { state: 'locked', missing } : { state: 'available', missing: [] };
}

/** A lesson, problem set or checkpoint may be opened only in these states. */
export const canEnter = (s: NodeState) => s.state === 'available' || s.state === 'mastered';

/** Test-out is allowed for a ready, not-yet-mastered node whose prerequisites are all verified. */
export const canTestOut = (s: NodeState) => s.state === 'available';
