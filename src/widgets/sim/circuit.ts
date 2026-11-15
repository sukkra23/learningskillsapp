import { solve } from './linear';

/**
 * DC analysis of linear circuits by modified nodal analysis (MNA).
 * R: resistor (ohms). V: ideal voltage source, `a` is the + terminal (volts).
 * I: ideal current source pushing current from a to b through itself (amps).
 * W: ideal wire.
 */
export interface Component { id: string; type: 'R' | 'V' | 'I' | 'W'; a: string; b: string; value: number }
export interface Solution {
  /** Voltage of every node relative to ground. */
  voltage: Record<string, number>;
  /** Current through each component, positive from a to b (for V: positive out of the + terminal into the circuit). */
  current: Record<string, number>;
  /** Power absorbed by each component in watts (negative when delivering). */
  power: Record<string, number>;
}
export type SolveResult = { ok: true; solution: Solution } | { ok: false; error: string };

const GMIN = 1e-15; // tiny conductance to ground so that dangling nodes do not make the system singular

export function solveCircuit(components: Component[], ground: string): SolveResult {
  // Merge nodes joined by wires.
  const parent = new Map<string, string>();
  const find = (x: string): string => { if (!parent.has(x)) parent.set(x, x); const p = parent.get(x)!; if (p === x) return x; const r = find(p); parent.set(x, r); return r; };
  for (const c of components) { find(c.a); find(c.b); if (c.type === 'W') parent.set(find(c.a), find(c.b)); }
  find(ground);
  const g = find(ground);
  const names = [...new Set([...parent.keys()].map(find))].filter((n) => n !== g);
  const idx = new Map(names.map((n, i) => [n, i]));
  const sources = components.filter((c) => c.type === 'V');
  for (const s of sources) if (find(s.a) === find(s.b)) return { ok: false, error: 'A voltage source is short-circuited by a wire.' };
  for (const r of components) if (r.type === 'R' && !(r.value > 0)) return { ok: false, error: 'Resistances must be greater than zero.' };

  const n = names.length, m = sources.length;
  const A = Array.from({ length: n + m }, () => new Array<number>(n + m).fill(0));
  const z = new Array<number>(n + m).fill(0);
  const at = (node: string) => idx.get(find(node)); // undefined for ground
  for (let i = 0; i < n; i++) A[i][i] += GMIN;
  for (const c of components) {
    const a = at(c.a), b = at(c.b);
    if (c.type === 'R') {
      const G = 1 / c.value;
      if (a !== undefined) A[a][a] += G;
      if (b !== undefined) A[b][b] += G;
      if (a !== undefined && b !== undefined) { A[a][b] -= G; A[b][a] -= G; }
    } else if (c.type === 'I') {
      if (a !== undefined) z[a] -= c.value;
      if (b !== undefined) z[b] += c.value;
    }
  }
  sources.forEach((s, k) => {
    const a = at(s.a), b = at(s.b), row = n + k;
    if (a !== undefined) { A[a][row] += 1; A[row][a] += 1; }
    if (b !== undefined) { A[b][row] -= 1; A[row][b] -= 1; }
    z[row] = s.value;
  });
  const x = solve(A, z, 1e-20);
  if (!x || x.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e9)) return { ok: false, error: 'This circuit has no unique solution. Check for voltage sources connected in a loop with no resistance.' };

  const voltage: Record<string, number> = {};
  for (const node of parent.keys()) { const i = at(node); voltage[node] = i === undefined ? 0 : x[i]; }
  const current: Record<string, number> = {}, power: Record<string, number> = {};
  for (const c of components) {
    const v = voltage[c.a] - voltage[c.b];
    if (c.type === 'R') { current[c.id] = v / c.value; power[c.id] = (v * v) / c.value; }
    else if (c.type === 'I') { current[c.id] = c.value; power[c.id] = v * c.value; }
    else if (c.type === 'V') { const i = -x[n + sources.indexOf(c)]; current[c.id] = i; power[c.id] = -c.value * i; }
    else { current[c.id] = NaN; power[c.id] = 0; }
  }
  return { ok: true, solution: { voltage, current, power } };
}

/** Thevenin equivalent seen between two nodes: open-circuit voltage and resistance (by a 1 A test source with sources zeroed). */
export function thevenin(components: Component[], ground: string, a: string, b: string): { vth: number; rth: number } | null {
  const open = solveCircuit(components, ground);
  if (!open.ok) return null;
  const vth = open.solution.voltage[a] - open.solution.voltage[b];
  const dead = components.map((c): Component => (c.type === 'V' ? { ...c, type: 'W' } : c.type === 'I' ? { ...c, value: 0 } : c));
  const test = solveCircuit([...dead, { id: '__test', type: 'I', a: b, b: a, value: 1 }], ground);
  if (!test.ok) return null;
  return { vth, rth: test.solution.voltage[a] - test.solution.voltage[b] };
}
