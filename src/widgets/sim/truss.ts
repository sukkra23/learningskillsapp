import { solve } from './linear';

export interface Joint { id: string; x: number; y: number; support?: 'pin' | 'roller'; load?: { fx: number; fy: number } }
export interface Member { id: string; a: string; b: string }
export interface TrussSolution { member: Record<string, number>; reaction: Record<string, { rx: number; ry: number }> }

/**
 * Method of joints for a statically determinate 2D truss, solved as one
 * linear system. Member forces are positive in tension. A pin gives two
 * reactions, a roller one (vertical). Returns null unless m + r = 2j and the
 * truss is stable.
 */
export function solveTruss(joints: Joint[], members: Member[]): TrussSolution | null {
  const ji = new Map(joints.map((j, i) => [j.id, i]));
  const reactions: { joint: string; dir: 'x' | 'y' }[] = [];
  for (const j of joints) {
    if (j.support === 'pin') reactions.push({ joint: j.id, dir: 'x' }, { joint: j.id, dir: 'y' });
    else if (j.support === 'roller') reactions.push({ joint: j.id, dir: 'y' });
  }
  const n = 2 * joints.length;
  if (members.length + reactions.length !== n) return null;
  const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const b = new Array<number>(n).fill(0);
  members.forEach((m, k) => {
    const a = joints[ji.get(m.a)!], c = joints[ji.get(m.b)!];
    const L = Math.hypot(c.x - a.x, c.y - a.y), ux = (c.x - a.x) / L, uy = (c.y - a.y) / L;
    // A member in tension pulls each joint towards the other end.
    A[2 * ji.get(m.a)!][k] += ux; A[2 * ji.get(m.a)! + 1][k] += uy;
    A[2 * ji.get(m.b)!][k] -= ux; A[2 * ji.get(m.b)! + 1][k] -= uy;
  });
  reactions.forEach((r, k) => { A[2 * ji.get(r.joint)! + (r.dir === 'x' ? 0 : 1)][members.length + k] = 1; });
  joints.forEach((j, i) => { b[2 * i] = -(j.load?.fx ?? 0); b[2 * i + 1] = -(j.load?.fy ?? 0); });
  const x = solve(A, b);
  if (!x) return null;
  const out: TrussSolution = { member: {}, reaction: {} };
  members.forEach((m, k) => { out.member[m.id] = x[k]; });
  reactions.forEach((r, k) => { const e = (out.reaction[r.joint] ??= { rx: 0, ry: 0 }); if (r.dir === 'x') e.rx = x[members.length + k]; else e.ry = x[members.length + k]; });
  return out;
}
