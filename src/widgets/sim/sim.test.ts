import { describe, expect, it } from 'vitest';
import { backward, initialNet, loss, sgdStep, type Net } from './backprop';
import { solveCircuit, thevenin, type Component } from './circuit';
import { parseInstr, reset, run, step } from './cpu';
import { solve } from './linear';
import { alu, fullAdder, gate, halfAdder, toBits, toSigned, type Bit } from './logic';
import { boxPsi, collide, doublePendulumDeriv, doublePendulumEnergy, kinematics, netForce, orbitEnergy, orbitStep, projectile, rk4, type Vec4 } from './mechanics';
import { solveTruss } from './truss';

describe('linear solve', () => {
  it('solves a 3x3 system and detects singular matrices', () => {
    expect(solve([[2, 1, -1], [-3, -1, 2], [-2, 1, 2]], [8, -11, -3])!.map((v) => +v.toFixed(9))).toEqual([2, 3, -1]);
    expect(solve([[1, 2], [2, 4]], [1, 2])).toBeNull();
  });
});

describe('circuit solver', () => {
  const R = (id: string, a: string, b: string, value: number): Component => ({ id, type: 'R', a, b, value });
  const V = (id: string, a: string, b: string, value: number): Component => ({ id, type: 'V', a, b, value });
  const ok = (c: Component[], g = 'gnd') => { const r = solveCircuit(c, g); if (!r.ok) throw new Error(r.error); return r.solution; };

  it('voltage divider: 12 V across 100 and 200 ohms', () => {
    const s = ok([V('v', 'top', 'gnd', 12), R('r1', 'top', 'mid', 100), R('r2', 'mid', 'gnd', 200)]);
    expect(s.voltage.mid).toBeCloseTo(8, 9);
    expect(s.current.r1).toBeCloseTo(0.04, 9);
    expect(s.current.v).toBeCloseTo(0.04, 9);
    expect(s.power.r1 + s.power.r2 + s.power.v).toBeCloseTo(0, 9); // energy is conserved
  });
  it('parallel resistors share voltage and split current', () => {
    const s = ok([V('v', 'a', 'gnd', 6), R('r1', 'a', 'gnd', 2), R('r2', 'a', 'gnd', 3)]);
    expect(s.current.r1).toBeCloseTo(3, 9);
    expect(s.current.r2).toBeCloseTo(2, 9);
    expect(s.current.v).toBeCloseTo(5, 9);
  });
  it('two-loop circuit satisfies Kirchhoff\'s current law at the middle node', () => {
    const s = ok([V('v1', 'a', 'gnd', 10), R('r1', 'a', 'm', 2), R('r2', 'm', 'gnd', 4), R('r3', 'm', 'b', 4), V('v2', 'b', 'gnd', 6)]);
    // Node equation: (10 - Vm)/2 = Vm/4 + (Vm - 6)/4  =>  Vm = 6.5
    expect(s.voltage.m).toBeCloseTo(6.5, 9);
    expect(s.current.r1 - s.current.r2 - s.current.r3).toBeCloseTo(0, 9);
  });
  it('wires merge nodes, and a shorted source is an error', () => {
    const s = ok([V('v', 'a', 'gnd', 5), { id: 'w', type: 'W', a: 'a', b: 'b', value: 0 }, R('r', 'b', 'gnd', 10)]);
    expect(s.voltage.b).toBeCloseTo(5, 9);
    expect(solveCircuit([V('v', 'a', 'gnd', 5), { id: 'w', type: 'W', a: 'a', b: 'gnd', value: 0 }], 'gnd').ok).toBe(false);
  });
  it('a dangling resistor carries no current', () => {
    const s = ok([V('v', 'a', 'gnd', 5), R('r', 'a', 'x', 10)]);
    expect(s.voltage.x).toBeCloseTo(5, 6);
    expect(s.current.r).toBeCloseTo(0, 9);
  });
  it('current source', () => {
    const s = ok([{ id: 'i', type: 'I', a: 'gnd', b: 'a', value: 2 }, R('r', 'a', 'gnd', 5)]);
    expect(s.voltage.a).toBeCloseTo(10, 9);
  });
  it('Thevenin equivalent of a divider', () => {
    const t = thevenin([V('v', 'top', 'gnd', 12), R('r1', 'top', 'out', 6), R('r2', 'out', 'gnd', 3)], 'gnd', 'out', 'gnd')!;
    expect(t.vth).toBeCloseTo(4, 9);
    expect(t.rth).toBeCloseTo(2, 9);
  });
});

describe('truss solver', () => {
  it('solves an equilateral triangle with a load at the apex', () => {
    const h = Math.sqrt(3) / 2;
    const s = solveTruss(
      [{ id: 'A', x: 0, y: 0, support: 'pin' }, { id: 'B', x: 1, y: 0, support: 'roller' }, { id: 'C', x: 0.5, y: h, load: { fx: 0, fy: -100 } }],
      [{ id: 'AB', a: 'A', b: 'B' }, { id: 'AC', a: 'A', b: 'C' }, { id: 'BC', a: 'B', b: 'C' }],
    )!;
    expect(s.reaction.A.ry).toBeCloseTo(50, 9);
    expect(s.reaction.B.ry).toBeCloseTo(50, 9);
    expect(s.reaction.A.rx).toBeCloseTo(0, 9);
    expect(s.member.AC).toBeCloseTo(-100 / Math.sqrt(3), 9); // compression
    expect(s.member.BC).toBeCloseTo(-100 / Math.sqrt(3), 9);
    expect(s.member.AB).toBeCloseTo(50 / Math.sqrt(3), 9);   // tension
  });
  it('rejects an indeterminate truss', () => {
    expect(solveTruss([{ id: 'A', x: 0, y: 0, support: 'pin' }, { id: 'B', x: 1, y: 0, support: 'pin' }], [{ id: 'AB', a: 'A', b: 'B' }])).toBeNull();
  });
});

describe('logic and ALU', () => {
  it('gate truth tables', () => {
    const tt = (g: Parameters<typeof gate>[0]) => [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => gate(g, a as Bit, b as Bit));
    expect(tt('AND')).toEqual([0, 0, 0, 1]);
    expect(tt('OR')).toEqual([0, 1, 1, 1]);
    expect(tt('NAND')).toEqual([1, 1, 1, 0]);
    expect(tt('NOR')).toEqual([1, 0, 0, 0]);
    expect(tt('XOR')).toEqual([0, 1, 1, 0]);
    expect([gate('NOT', 0), gate('NOT', 1)]).toEqual([1, 0]);
  });
  it('adders', () => {
    expect(halfAdder(1, 1)).toEqual({ sum: 0, carry: 1 });
    for (const a of [0, 1] as Bit[]) for (const b of [0, 1] as Bit[]) for (const c of [0, 1] as Bit[]) {
      const r = fullAdder(a, b, c);
      expect(r.sum + 2 * r.carry).toBe(a + b + c);
    }
  });
  it('ALU matches integer arithmetic for every 4-bit input', () => {
    for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
      const add = alu(a, b, 'ADD', 4), sub = alu(a, b, 'SUB', 4);
      expect(add.result).toBe((a + b) & 15);
      expect(add.carry).toBe(a + b > 15 ? 1 : 0);
      expect(sub.result).toBe((a - b) & 15);
      expect(sub.carry).toBe(a >= b ? 1 : 0);
      const sa = toSigned(a, 4), sb = toSigned(b, 4);
      expect(add.overflow).toBe(sa + sb > 7 || sa + sb < -8 ? 1 : 0);
      expect(sub.overflow).toBe(sa - sb > 7 || sa - sb < -8 ? 1 : 0);
      expect(alu(a, b, 'XOR', 4).result).toBe(a ^ b);
    }
  });
  it('flags and conversions', () => {
    expect(alu(5, 5, 'SUB', 4)).toMatchObject({ result: 0, zero: 1, negative: 0 });
    expect(alu(0b0101, 0, 'NOT', 4).result).toBe(0b1010);
    expect(toSigned(0b1111, 4)).toBe(-1);
    expect(toSigned(0b1000, 4)).toBe(-8);
    expect(toBits(5, 4)).toEqual([0, 1, 0, 1]);
  });
});

describe('teaching CPU', () => {
  const sumProgram = ['LOADI R0, 0', 'LOAD R1, 0', 'LOADI R2, 1', 'ADD R0, R1', 'SUB R1, R2', 'JNZ 3', 'STORE R0, 1', 'HALT'];
  it('sums 1..n with a loop', () => {
    const c = run(sumProgram, { 0: 4 });
    expect(c.halted).toBe(true);
    expect(c.mem[1]).toBe(10);
    expect(c.reg[0]).toBe(10);
    expect(c.cycles).toBe(3 + 4 * 3 + 2);
  });
  it('goes fetch, decode, execute and increments the PC during fetch', () => {
    let c = reset();
    c = step(c, sumProgram);
    expect(c).toMatchObject({ phase: 'decode', pc: 1, ir: 'LOADI R0, 0' });
    c = step(c, sumProgram);
    expect(c.phase).toBe('execute');
    c = step(c, sumProgram);
    expect(c).toMatchObject({ phase: 'fetch', cycles: 1 });
  });
  it('wraps at 8 bits, halts past the end, and rejects bad instructions', () => {
    expect(run(['LOADI R0, 250', 'LOADI R1, 10', 'ADD R0, R1', 'HALT']).reg[0]).toBe(4);
    expect(run(['LOADI R0, 1']).halted).toBe(true);
    expect(() => parseInstr('MUL R0, R1')).toThrow();
    expect(() => parseInstr('ADD R0, R9')).toThrow();
  });
});

describe('mechanics', () => {
  it('projectile: range, apex and time of flight', () => {
    const p = projectile(20, 45, 0, 9.8);
    expect(p.range).toBeCloseTo((20 * 20) / 9.8, 9);            // v^2 sin(2*theta) / g
    expect(p.maxHeight).toBeCloseTo((20 * 20 * 0.5) / (2 * 9.8), 9);
    expect(p.tFlight).toBeCloseTo((2 * 20 * Math.SQRT1_2) / 9.8, 9);
    expect(p.at(p.tFlight).y).toBeCloseTo(0, 9);
    expect(projectile(10, 0, 5, 10).tFlight).toBeCloseTo(1, 9);  // dropped 5 m: t = sqrt(2h/g)
  });
  it('constant acceleration', () => {
    const k = kinematics(2, 3, 4);
    expect(k.x(2)).toBe(16);
    expect(k.v(2)).toBe(11);
  });
  it('collisions conserve momentum; elastic ones conserve energy', () => {
    const e = collide(2, 3, 1, 0, 1);
    expect(e.u1).toBeCloseTo(1, 9);
    expect(e.u2).toBeCloseTo(4, 9);
    expect(e.keAfter).toBeCloseTo(e.keBefore, 9);
    const i = collide(2, 3, 1, 0, 0);
    expect(i.u1).toBeCloseTo(2, 9);
    expect(i.u2).toBeCloseTo(2, 9);
    expect(i.pAfter).toBeCloseTo(i.pBefore, 9);
    expect(i.keAfter).toBeLessThan(i.keBefore);
  });
  it('net force', () => {
    const n = netForce([[3, 0], [4, 90]]);
    expect(n.magnitude).toBeCloseTo(5, 9);
    expect(n.angle).toBeCloseTo(53.13, 2);
    expect(netForce([[10, 0], [10, 180]]).magnitude).toBeCloseTo(0, 9);
  });
  it('double pendulum conserves energy under RK4', () => {
    let s: Vec4 = [2, 0, 2.5, 0];
    const e0 = doublePendulumEnergy(s);
    for (let i = 0; i < 5000; i++) s = rk4(s, (x) => doublePendulumDeriv(x), 0.001);
    expect(Math.abs(doublePendulumEnergy(s) - e0)).toBeLessThan(1e-4);
  });
  it('a circular orbit stays circular and keeps its energy', () => {
    let s = { x: 1, y: 0, vx: 0, vy: 1 };
    const e0 = orbitEnergy(s, 1);
    for (let i = 0; i < 6283; i++) s = orbitStep(s, 1, 0.001); // about one period, 2*pi
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(1, 4);
    expect(orbitEnergy(s, 1)).toBeCloseTo(e0, 6);
    expect(s.x).toBeCloseTo(1, 3);
  });
  it('box wavefunctions are normalised and orthogonal', () => {
    const integrate = (f: (x: number) => number) => { let s = 0; const N = 2000; for (let i = 0; i < N; i++) s += f((i + 0.5) / N) / N; return s; };
    expect(integrate((x) => boxPsi(3, x) ** 2)).toBeCloseTo(1, 6);
    expect(integrate((x) => boxPsi(1, x) * boxPsi(2, x))).toBeCloseTo(0, 6);
  });
});

describe('backpropagation', () => {
  it('matches finite-difference gradients for every parameter', () => {
    const net = initialNet(), x = [0.6, -0.3], t = 1, g = backward(net, x, t), h = 1e-6;
    const num = (mut: (n: Net, d: number) => void) => {
      const a = structuredClone(net), b = structuredClone(net);
      mut(a, h); mut(b, -h);
      return (loss(a, x, t) - loss(b, x, t)) / (2 * h);
    };
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 2; i++) expect(g.w1[j][i]).toBeCloseTo(num((n, d) => { n.w1[j][i] += d; }), 8);
      expect(g.b1[j]).toBeCloseTo(num((n, d) => { n.b1[j] += d; }), 8);
      expect(g.w2[j]).toBeCloseTo(num((n, d) => { n.w2[j] += d; }), 8);
    }
    expect(g.b2).toBeCloseTo(num((n, d) => { n.b2 += d; }), 8);
  });
  it('gradient descent lowers the loss', () => {
    let net = initialNet();
    const before = loss(net, [1, 0], 1);
    for (let i = 0; i < 200; i++) net = sgdStep(net, [1, 0], 1, 0.5);
    expect(loss(net, [1, 0], 1)).toBeLessThan(before / 5);
  });
});
