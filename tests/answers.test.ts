/**
 * Independent cross-check of the seed content. Every numeric answer in every
 * ready node and diagnostic is recomputed here from first principles (or
 * verified by substituting it back into its equation), and every derivative
 * answer is compared with a numerical derivative. A coverage test fails if a
 * numeric question is added without a check.
 */
import { evaluate } from 'mathjs';
import { describe, expect, it } from 'vitest';
import { loadContentFromDisk } from '../scripts/load-content';
import { selfCheckContent } from '../src/content/selfcheck';
import { nodeQuestions, type Question } from '../src/content/schema';
import { withinTolerance } from '../src/grading/numeric';
import { solveCircuit, thevenin, type Component } from '../src/widgets/sim/circuit';
import { run } from '../src/widgets/sim/cpu';
import { alu, gate, toSigned, type Bit } from '../src/widgets/sim/logic';
import { collide, netForce, projectile } from '../src/widgets/sim/mechanics';

const { catalog, errors } = loadContentFromDisk();
const all = new Map<string, Question>();
for (const n of catalog.nodes) for (const { question } of nodeQuestions(n)) all.set(`${n.id}/${question.id}`, question);
for (const [track, items] of Object.entries(catalog.diagnostics)) for (const i of items) all.set(`${track}.diag/${i.question.id}`, i.question);

type Check = number | ((answer: number) => boolean);
const g = 9.8, sin = (d: number) => Math.sin((d * Math.PI) / 180), cos = (d: number) => Math.cos((d * Math.PI) / 180);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// ---------- circuits ----------
const R = (id: string, a: string, b: string, value: number): Component => ({ id, type: 'R', a, b, value });
const V = (id: string, a: string, value: number): Component => ({ id, type: 'V', a, b: '0', value });
const sol = (c: Component[]) => { const r = solveCircuit(c, '0'); if (!r.ok) throw new Error(r.error); return r.solution; };
const par = (...rs: number[]) => 1 / rs.reduce((s, r) => s + 1 / r, 0);
const th = (c: Component[], a: string) => thevenin(c, '0', a, '0')!;

const serPar = sol([V('v', 'a', 12), R('r4', 'a', 'm', 4), R('r6', 'm', '0', 6), R('r3', 'm', '0', 3)]);
const t4c = sol([V('v', 'a', 10), R('r2', 'a', 'm', 2), R('r3', 'm', '0', 3), R('r6', 'm', '0', 6)]);
const twoLoop = sol([V('v1', 'a', 10), R('r1', 'a', 'm', 2), R('r2', 'm', '0', 4), R('r3', 'm', 'b', 4), V('v2', 'b', 6)]);
const kp4 = sol([V('v1', 'a', 6), R('r1', 'a', 'm', 3), V('v2', 'b', 12), R('r2', 'b', 'm', 6), R('r3', 'm', '0', 2)]);
const kp6 = sol([V('v', 's', 10), R('r1', 's', 'A', 1), R('r2', 'A', '0', 2), R('r3', 'A', 'B', 2), R('r4', 'B', '0', 2)]);
const kt = sol([V('v1', 'a', 12), R('r1', 'a', 'm', 3), R('r2', 'm', '0', 6), R('r3', 'm', 'b', 6), V('v2', 'b', 6)]);
const ek7 = sol([V('v', 's', 12), R('r1', 's', 'A', 2), R('r2', 'A', '0', 4), R('r3', 'A', 'B', 2), R('r4', 'B', '0', 4)]);
const eo6 = sol([V('v', 'a', 18), R('r3', 'a', 'm', 3), R('ra', 'm', '0', 6), R('rb', 'm', '0', 6)]);
const divider = (v: number, top: number, bottom: number) => [V('v', 'a', v), R('rt', 'a', 'out', top), R('rb', 'out', '0', bottom)];
const tee = (v: number, series: number, shunt: number, out: number) => [V('v', 'a', v), R('rs', 'a', 'n', series), R('rp', 'n', '0', shunt), R('ro', 'n', 'out', out)];
const lessonTh = th(divider(12, 6, 3), 'out'), s2Th = th(divider(24, 8, 4), 'out'), pTh = th(divider(9, 1000, 2000), 'out');
const cTh = th(divider(20, 6, 4), 'out'), tTh = th(tee(18, 6, 3, 2), 'out');

// ---------- CPU programs ----------
const SUM = ['LOADI R0, 0', 'LOAD R1, 0', 'LOADI R2, 1', 'ADD R0, R1', 'SUB R1, R2', 'JNZ 3', 'STORE R0, 1', 'HALT'];
const loop = (n: number) => ['LOADI R0, 0', `LOADI R1, ${n}`, 'LOADI R2, 1', 'ADD R0, R1', 'SUB R1, R2', 'JNZ 3', 'HALT'];
const bin = (s: string) => parseInt(s, 2);
const count = (f: (a: Bit, b: Bit, c: Bit) => number) => { let k = 0; for (const a of [0, 1] as Bit[]) for (const b of [0, 1] as Bit[]) for (const c of [0, 1] as Bit[]) k += f(a, b, c); return k; };

const CHECKS: Record<string, Check> = {
  // ===== physics.kinematics =====
  'physics.kinematics/s2': 0 + 3 * 4,
  'physics.kinematics/s3': 0.5 * 3 * 4 ** 2,
  'physics.kinematics/p1': 150 / 12,
  'physics.kinematics/p2': (a) => near(20 ** 2 + 2 * -5 * a, 0),
  'physics.kinematics/p4': 15 ** 2 / (2 * g),
  'physics.kinematics/p5': projectile(20, 30, 0, g).range,
  'physics.kinematics/p6': 12 * Math.sqrt((2 * 45) / g),
  'physics.kinematics/c2': 5 + 2 * 6,
  'physics.kinematics/c3': 0.5 * 4 * 5 ** 2,
  'physics.kinematics/c5': Math.abs((10 ** 2 - 30 ** 2) / (2 * 80)),
  'physics.kinematics/t1': Math.sqrt((2 * 80) / g),
  'physics.kinematics/t2': projectile(24.5, 90, 0, g).tFlight,
  'physics.kinematics/t4': projectile(18, 35, 0, g).maxHeight,
  'physics.kinematics/t5': 0.5 * 0.5 * 40 ** 2 + 0.5 * 40 * 60,
  // ===== physics.newtons-laws =====
  'physics.newtons-laws/s2': 20 / 4,
  'physics.newtons-laws/s3': netForce([[6, 0], [8, 90]]).magnitude / 2,
  'physics.newtons-laws/p1': 70 * g,
  'physics.newtons-laws/p2': 1200 * (25 / 10),
  'physics.newtons-laws/p3': 60 * (g + 2),
  'physics.newtons-laws/p5': (30 - 0.2 * 5 * g) / 5,
  'physics.newtons-laws/p6': ((5 - 3) * g) / (5 + 3),
  'physics.newtons-laws/c2': 4 / 0.5,
  'physics.newtons-laws/c3': (10 - 4) / 3,
  'physics.newtons-laws/c5': 12 * g,
  'physics.newtons-laws/t1': g * sin(30),
  'physics.newtons-laws/t2': 50 / (10 * g),
  'physics.newtons-laws/t3': (480 - 60 * g) / 60,
  'physics.newtons-laws/t5': netForce([[5, 0], [5, 120]]).magnitude / 1,
  // ===== physics.energy-momentum =====
  'physics.energy-momentum/s1': 0.5 * 2 * 3 ** 2,
  'physics.energy-momentum/s2': Math.sqrt(2 * g * 5),
  'physics.energy-momentum/s3': 3 * 4,
  'physics.energy-momentum/p1': 50 * 4,
  'physics.energy-momentum/p2': 3 * g * 10,
  'physics.energy-momentum/p3': (0.5 * 1000 * 20 ** 2) / 8000,
  'physics.energy-momentum/p4': collide(2, 3, 1, 0, 0).u2,
  'physics.energy-momentum/p5': collide(2, 3, 1, 0, 0).keBefore - collide(2, 3, 1, 0, 0).keAfter,
  'physics.energy-momentum/p6': collide(2, 3, 1, 0, 1).u2,
  'physics.energy-momentum/c1': 0.5 * 4 * 5 ** 2,
  'physics.energy-momentum/c3': Math.sqrt(2 * g * 20),
  'physics.energy-momentum/c4': Math.abs(0.15 * (-30 - 40)),
  'physics.energy-momentum/t1': 3 / 0.3,
  'physics.energy-momentum/t2': 100 * 8 * cos(60),
  'physics.energy-momentum/t3': collide(3, 4, 2, -6, 0).u1,
  'physics.energy-momentum/t4': collide(1, 6, 2, 0, 1).u1,
  // ===== physics diagnostic =====
  'physics.diag/dk1': 100 / 20, 'physics.diag/dk3': 2 * 5, 'physics.diag/dk4': 0.5 * 2 * 25,
  'physics.diag/dk6': projectile(19.6, 90, 0, g).maxHeight, 'physics.diag/dk7': projectile(30, 30, 0, g).range,
  'physics.diag/dn2': 2 * 3, 'physics.diag/dn4': (10 - 4) / 2, 'physics.diag/dn6': 50 * (g + 1.2), 'physics.diag/dn7': ((6 - 2) * g) / 8,
  'physics.diag/de2': 0.5 * 2 * 16, 'physics.diag/de3': 5 * 2, 'physics.diag/de4': Math.sqrt(2 * g * 10),
  'physics.diag/de5': collide(4, 3, 2, 0, 0).u1, 'physics.diag/de7': collide(3, 2, 1, 0, 1).u2,

  // ===== engineering.ohms-law =====
  'engineering.ohms-law/s1': sol([V('v', 'a', 9), R('r', 'a', '0', 3)]).current.r,
  'engineering.ohms-law/s2': sol([V('v', 'a', 12), R('r1', 'a', 'm', 2), R('r2', 'm', '0', 4)]).current.r1,
  'engineering.ohms-law/s3': par(6, 12),
  'engineering.ohms-law/s4': sol([V('v', 'a', 6), R('r', 'a', '0', 12)]).power.r,
  'engineering.ohms-law/p1': 10 / 2,
  'engineering.ohms-law/p2': sol([V('v', 'a', 12), R('r1', 'a', 'b', 10), R('r2', 'b', 'c', 20), R('r3', 'c', '0', 30)]).current.r1,
  'engineering.ohms-law/p3': sol([V('v', 'a', 12), R('r1', 'a', 'b', 10), R('r2', 'b', 'c', 20), R('r3', 'c', '0', 30)]).voltage.c,
  'engineering.ohms-law/p4': par(6, 3),
  'engineering.ohms-law/p5': serPar.current.v,
  'engineering.ohms-law/p6': serPar.power.r6,
  'engineering.ohms-law/c1': 0.5 * 40,
  'engineering.ohms-law/c2': 24 / (4 + 8),
  'engineering.ohms-law/c3': par(10, 10),
  'engineering.ohms-law/c5': 2 ** 2 * 5,
  'engineering.ohms-law/t1': 120 ** 2 / 60,
  'engineering.ohms-law/t2': par(12, 6, 4),
  'engineering.ohms-law/t3': sol(divider(9, 1000, 2000)).voltage.out,
  'engineering.ohms-law/t4': t4c.current.r3,
  // ===== engineering.kirchhoff =====
  'engineering.kirchhoff/s1': 3 + 2 - 1,
  'engineering.kirchhoff/s2': 12 - 5 - 4,
  'engineering.kirchhoff/s4': twoLoop.current.r2,
  'engineering.kirchhoff/p1': 5 - 2,
  'engineering.kirchhoff/p2': 9 - 3.5,
  'engineering.kirchhoff/p3': sol([V('v', 'a', 12), R('r1', 'a', 'm', 2), R('r2', 'm', '0', 4), R('r3', 'm', '0', 4)]).voltage.m,
  'engineering.kirchhoff/p4': kp4.voltage.m,
  'engineering.kirchhoff/p5': kp4.current.v2,
  'engineering.kirchhoff/p6': kp6.voltage.B,
  'engineering.kirchhoff/c1': 7 - 4,
  'engineering.kirchhoff/c2': 24 - 10 - 6,
  'engineering.kirchhoff/c4': sol([V('v', 'a', 20), R('r1', 'a', 'm', 5), R('r2', 'm', '0', 10), R('r3', 'm', '0', 10)]).voltage.m,
  'engineering.kirchhoff/t1': kt.voltage.m,
  'engineering.kirchhoff/t2': Math.abs(kt.current.v2),
  'engineering.kirchhoff/t3': -kt.power.v1,
  // Opposing batteries in one loop: the 4 V source has its + terminal at node c.
  'engineering.kirchhoff/t5': sol([V('v1', 'a', 12), R('r1', 'a', 'b', 3), R('r2', 'b', 'c', 5), V('v2', 'c', 4)]).current.r1,
  // ===== engineering.thevenin =====
  'engineering.thevenin/s2': s2Th.vth,
  'engineering.thevenin/s3': s2Th.rth,
  'engineering.thevenin/s4': 10 / (5 + 15),
  'engineering.thevenin/s5': lessonTh.vth / lessonTh.rth,
  'engineering.thevenin/p2': pTh.vth,
  'engineering.thevenin/p3': pTh.rth,
  'engineering.thevenin/p4': sol([...divider(9, 1000, 2000), R('load', 'out', '0', 1000)]).current.load * 1000,
  'engineering.thevenin/p5': 12 ** 2 / (4 * 6),
  'engineering.thevenin/p6': th(tee(12, 4, 12, 3), 'out').rth,
  'engineering.thevenin/c2': cTh.vth,
  'engineering.thevenin/c3': cTh.rth,
  'engineering.thevenin/c4': sol([...divider(20, 6, 4), R('load', 'out', '0', 5.6)]).current.load,
  'engineering.thevenin/t1': tTh.vth,
  'engineering.thevenin/t2': tTh.rth,
  'engineering.thevenin/t3': sol([...tee(18, 6, 3, 2), R('load', 'out', '0', 8)]).voltage.out,
  'engineering.thevenin/t4': tTh.vth / tTh.rth,
  'engineering.thevenin/t5': sol([...tee(18, 6, 3, 2), R('load', 'out', '0', tTh.rth)]).power.load,
  // ===== engineering diagnostic =====
  'engineering.diag/eo2': 2 * 5, 'engineering.diag/eo3': 3 + 6, 'engineering.diag/eo4': 12 * 3, 'engineering.diag/eo5': par(3, 6),
  'engineering.diag/eo6': eo6.current.v, 'engineering.diag/eo7': eo6.power.ra,
  'engineering.diag/ek1': 6 - 2, 'engineering.diag/ek3': 15 - 4 - 5,
  'engineering.diag/ek4': sol([V('v', 'a', 10), R('r1', 'a', 'm', 2), R('r2', 'm', '0', 4), R('r3', 'm', '0', 4)]).voltage.m,
  'engineering.diag/ek5': sol([V('v1', 'a', 9), R('r1', 'a', 'm', 3), V('v2', 'b', 6), R('r2', 'b', 'm', 6), R('r3', 'm', '0', 2)]).voltage.m,
  'engineering.diag/ek6': sol([V('v1', 'a', 9), R('r', 'a', 'c', 12), V('v2', 'c', 3)]).current.r,
  'engineering.diag/ek7': ek7.voltage.A,
  'engineering.diag/et3': th(divider(10, 5, 5), 'out').vth, 'engineering.diag/et4': th(divider(10, 5, 5), 'out').rth,
  'engineering.diag/et5': 12 / (4 + 2), 'engineering.diag/et6': 10 ** 2 / (4 * 5), 'engineering.diag/et7': th(tee(30, 10, 15, 4), 'out').rth,

  // ===== cs.logic-gates =====
  'cs.logic-gates/s3': gate('NAND', 1, 1),
  'cs.logic-gates/s4': 2 ** 3,
  'cs.logic-gates/s5': gate('OR', gate('AND', 1, 0), gate('NOT', 0)),
  'cs.logic-gates/p1': gate('OR', 0, 0),
  'cs.logic-gates/p2': gate('XOR', 1, 1),
  'cs.logic-gates/p5': count((a, b, c) => (c === 0 && gate('XOR', a, b) === gate('OR', a, b) ? 1 : 0)),
  'cs.logic-gates/c1': gate('AND', 1, 0),
  'cs.logic-gates/c3': 2 ** 4,
  'cs.logic-gates/c5': gate('XOR', gate('AND', 1, 1), 0),
  'cs.logic-gates/t2': 2 ** (2 ** 2),
  'cs.logic-gates/t3': gate('OR', gate('NOT', gate('OR', 0, 1)), gate('AND', 1, 1)),
  // ===== cs.binary-alu =====
  'cs.binary-alu/s1': bin('1101'),
  'cs.binary-alu/s3': toSigned(bin('1010'), 4),
  'cs.binary-alu/p1': bin('0101'),
  'cs.binary-alu/p2': 2 ** 8 - 1,
  'cs.binary-alu/p4': toSigned(bin('11111111'), 8),
  'cs.binary-alu/p5': alu(bin('1100'), bin('0110'), 'ADD', 4).result,
  'cs.binary-alu/p6': toSigned(bin('10000000'), 8),
  'cs.binary-alu/c1': bin('1001'),
  'cs.binary-alu/c3': toSigned(bin('1000'), 4),
  'cs.binary-alu/c5': 2 ** 5,
  'cs.binary-alu/t1': toSigned(bin('10010110'), 8),
  'cs.binary-alu/t2': toSigned(alu(bin('0101'), bin('0111'), 'SUB', 4).result, 4),
  'cs.binary-alu/t4': Math.ceil(Math.log2(1000 + 1)),
  // ===== cs.cpu-cycle =====
  'cs.cpu-cycle/s2': run(['LOADI R0, 5', 'LOADI R1, 7', 'ADD R0, R1', 'STORE R0, 0', 'HALT']).mem[0],
  'cs.cpu-cycle/s3': run(SUM, { 0: 3 }).mem[1],
  'cs.cpu-cycle/p2': run(['LOADI R0, 9', 'LOADI R1, 4', 'SUB R0, R1', 'HALT']).reg[0],
  'cs.cpu-cycle/p4': run(SUM, { 0: 3 }).cycles,
  'cs.cpu-cycle/p5': run(['LOADI R0, 200', 'LOADI R1, 100', 'ADD R0, R1', 'HALT']).reg[0],
  'cs.cpu-cycle/c2': run(['LOADI R0, 3', 'LOADI R1, 3', 'SUB R0, R1', 'HALT']).zero ? 1 : 0,
  'cs.cpu-cycle/c4': run(['LOADI R0, 2', 'ADD R0, R0', 'ADD R0, R0', 'HALT']).reg[0],
  'cs.cpu-cycle/t1': run(loop(5)).reg[0],
  'cs.cpu-cycle/t2': run(loop(5)).cycles,
  'cs.cpu-cycle/t4': run(['LOADI R0, 5', 'LOADI R1, 10', 'SUB R0, R1', 'HALT']).reg[0],
  // ===== cs diagnostic =====
  'cs.diag/cl1': gate('AND', 1, 1), 'cs.diag/cl3': gate('XOR', 1, 0), 'cs.diag/cl5': 2 ** 5,
  'cs.diag/cl7': count((a, b, c) => gate('AND', gate('XOR', a, b), gate('NOT', c))),
  'cs.diag/cb1': bin('10'), 'cs.diag/cb2': bin('0111'), 'cs.diag/cb4': alu(bin('1010'), bin('0011'), 'ADD', 4).result,
  'cs.diag/cb5': toSigned(bin('1111'), 4), 'cs.diag/cb6': toSigned(bin('1011'), 4),
  'cs.diag/cc4': run(['LOADI R0, 6', 'LOADI R1, 2', 'ADD R0, R1', 'ADD R0, R1', 'HALT']).reg[0],
  'cs.diag/cc6': run(loop(4)).reg[0], 'cs.diag/cc7': run(loop(4)).cycles,

  // ===== math.algebra (equations are verified by substituting the answer back) =====
  'math.algebra/s1': 20 - 3 * (1 + 2) ** 2,
  'math.algebra/s2': (x) => near(5 * x - 7, 18),
  'math.algebra/p1': 2 * (3 + 5) - 4,
  'math.algebra/p3': (x) => near(3 * (x - 2), 2 * x + 5),
  'math.algebra/p5': (x) => near(x + (10 - x), 10) && near(x - (10 - x), 4),
  'math.algebra/p6': (x) => near(2 * x * x - 3 * x - 5, 0) && x > 0,
  'math.algebra/c1': 18 - 2 * (4 + 1),
  'math.algebra/c2': (x) => near(4 * x + 9, 1),
  'math.algebra/c5': (x) => near(x * x - x - 12, 0) && x > 0,
  'math.algebra/t1': (x) => near((2 * x + 1) / 3, 5),
  'math.algebra/t2': (x) => near(x / 2 + x / 3, 10),
  'math.algebra/t4': (y) => near(2 * (y + 1) + 3 * y, 12),
  // ===== math.functions =====
  'math.functions/s1': 3 * (-2) ** 2 - 2,
  'math.functions/p1': 5 - 2 * 4,
  'math.functions/p3': (x) => near(2 ** x, 32),
  'math.functions/p6': (x) => { const f = (t: number) => 2 * t * t - 12 * t + 7; return f(x) < f(x - 0.01) && f(x) < f(x + 0.01); },
  'math.functions/c1': 5 ** 2 - 4 * 5,
  'math.functions/t1': 3 * 2 ** 4,
  'math.functions/t3': Math.min(...Array.from({ length: 2001 }, (_, i) => { const x = i / 100 - 7; return x * x - 6 * x + 13; })),
  // ===== math.limits-derivatives (limits are checked numerically close to the point) =====
  'math.limits-derivatives/s1': (3 ** 2 - 1 ** 2) / (3 - 1),
  'math.limits-derivatives/s2': ((3 + 1e-6) ** 2 - (3 - 1e-6) ** 2) / 2e-6,
  'math.limits-derivatives/p2': (a) => { const f = (x: number) => x * x + 3 * x; return Math.abs((f(2 + 1e-6) - f(2 - 1e-6)) / 2e-6 - a) < 1e-5; },
  'math.limits-derivatives/p3': (a) => Math.abs(((2 + 1e-7) ** 2 - 4) / 1e-7 - a) < 1e-5,
  'math.limits-derivatives/p5': (x) => { const f = (t: number) => t * t - 8 * t + 3; return Math.abs((f(x + 1e-6) - f(x - 1e-6)) / 2e-6) < 1e-6; },
  'math.limits-derivatives/c2': (a) => Math.abs(((2 + 1e-6) ** 3 - (2 - 1e-6) ** 3) / 2e-6 - a) < 1e-5,
  'math.limits-derivatives/c4': (a) => Math.abs((3 * 1e-7 ** 2 + 2 * 1e-7) / 1e-7 - a) < 1e-5,
  'math.limits-derivatives/t2': (x) => { const f = (t: number) => t ** 3 - 6 * t * t; return f(x) < f(x - 0.01) && f(x) < f(x + 0.01); },
  'math.limits-derivatives/t4': (a) => Math.abs(((3 + 1e-7) ** 2 - 9) / 1e-7 - a) < 1e-5,
  'math.limits-derivatives/t5': (b) => near(2 * 1 + b, 1 ** 2),
  // ===== math diagnostic =====
  'math.diag/ma1': 7 + 3 * 4,
  'math.diag/ma2': (x) => near(2 * x + 5, 17),
  'math.diag/ma5': (x) => near(3 * (x - 1), x + 7),
  'math.diag/ma6': (x) => near(x * x - 7 * x + 10, 0) && x > 3.5,
  'math.diag/ma7': (x) => near(3 * x + 2 * (x - 2), 16),
  'math.diag/mf1': 2 * 3 + 1,
  'math.diag/mf6': (x) => near(3 ** x, 81),
  'math.diag/mf7': Math.max(...Array.from({ length: 2001 }, (_, i) => { const x = i / 100 - 8; return -2 * x * x + 8 * x + 1; })),
  'math.diag/ml3': (a) => { const f = (x: number) => x * x - 5 * x; return Math.abs((f(4 + 1e-6) - f(4 - 1e-6)) / 2e-6 - a) < 1e-5; },
  'math.diag/ml5': (a) => Math.abs(((1 + 1e-7) ** 2 - 1) / 1e-7 - a) < 1e-5,
};

/** Expression answers that are derivatives or inverses, checked numerically against the original function. */
const DERIVATIVES: Record<string, string> = {
  'math.limits-derivatives/s4': '4*x^3 - 2*x + 7', 'math.limits-derivatives/s5': '(x^2 + 1)^3', 'math.limits-derivatives/p1': 'x^5',
  'math.limits-derivatives/p4': 'x^2 * sin(x)', 'math.limits-derivatives/p6': 'sin(x^2)', 'math.limits-derivatives/c1': '3*x^2 + 5*x',
  'math.limits-derivatives/t1': '(2*x + 1)^3', 'math.limits-derivatives/t3': 'x * exp(x)',
  'math.diag/ml2': 'x^3', 'math.diag/ml4': '5*x^4 - 3*x^2 + 2', 'math.diag/ml6': '(x^2 + 1)^3', 'math.diag/ml7': 'x * cos(x)',
};
const INVERSES: Record<string, string> = {
  'math.functions/s4': '3*x - 6', 'math.functions/p5': '(x - 1)/4', 'math.functions/c4': 'x/2 + 5', 'math.functions/t4': '(2*x + 3)/5', 'math.diag/mf5': '2*x - 8',
};
const COMPOSITIONS: Record<string, [outer: string, inner: string]> = {
  'math.functions/s3': ['2*x + 1', 'x^2'], 'math.functions/p4': ['x^2', '2*x + 1'], 'math.functions/c3': ['x + 3', '2*x'],
  'math.functions/t2': ['x^2 + 1', 'x - 2'], 'math.diag/mf4': ['x^2', 'x + 1'],
};
const EXPANSIONS: Record<string, string> = {
  'math.algebra/s3': '(x + 3)*(x - 2)', 'math.algebra/p2': '3*x + 2*(x - 4)', 'math.algebra/p4': '(2*x - 1)^2', 'math.algebra/c3': '(x + 4)*(x - 4)', 'math.algebra/t3': '(x - 2)*(x^2 + 2*x + 4)',
};
const at = (e: string, x: number) => evaluate(e, { x }) as number;
const XS = [-1.7, -0.4, 0.3, 0.9, 1.6, 2.4];

describe('content is valid', () => {
  it('passes the schema, the graph checks and the self-check', () => {
    expect(errors).toEqual([]);
    expect(selfCheckContent(catalog)).toEqual([]);
  });
  it('has the promised seed: at least 3 ready nodes and 20 diagnostic items per track', () => {
    for (const t of catalog.tracks) {
      expect(catalog.nodes.filter((n) => n.track === t.id && n.status === 'ready').length, t.id).toBeGreaterThanOrEqual(3);
      expect(catalog.diagnostics[t.id].length, t.id).toBeGreaterThanOrEqual(20);
    }
  });
  it('diagnostics cover every difficulty level and both tiers for each ready node', () => {
    for (const t of catalog.tracks) {
      const items = catalog.diagnostics[t.id];
      expect(new Set(items.map((i) => i.question.difficulty)).size, t.id).toBe(5);
      for (const n of catalog.nodes.filter((x) => x.track === t.id && x.status === 'ready'))
        for (const tier of ['basic', 'advanced']) expect(items.some((i) => i.nodeId === n.id && i.tier === tier), `${n.id} ${tier}`).toBe(true);
    }
  });
});

describe('numeric answers are independently verified', () => {
  const numeric = [...all].filter(([, q]) => q.type === 'numeric');
  it('every numeric question has a check', () => {
    expect(numeric.map(([k]) => k).filter((k) => !(k in CHECKS))).toEqual([]);
    expect(Object.keys(CHECKS).filter((k) => all.get(k)?.type !== 'numeric')).toEqual([]);
  });
  it.each(numeric.map(([k, q]) => [k, q] as const))('%s', (key, q) => {
    if (q.type !== 'numeric') return;
    const check = CHECKS[key];
    if (typeof check === 'function') expect(check(q.answer), `stated answer ${q.answer} fails its equation`).toBe(true);
    // The independently computed value must fall inside the question's own tolerance, as a learner's would.
    else expect(withinTolerance(check, q.answer, q.tolerance), `recomputed ${check}, content says ${q.answer}`).toBe(true);
  });
});

describe('expression answers are independently verified', () => {
  const ans = (k: string) => { const q = all.get(k); if (q?.type !== 'expression') throw new Error(`${k} is not an expression question`); return q.answer; };
  it.each(Object.entries(DERIVATIVES))('%s is the derivative of %s', (k, f) => {
    for (const x of XS) expect(at(ans(k), x)).toBeCloseTo((at(f, x + 1e-5) - at(f, x - 1e-5)) / 2e-5, 5);
  });
  it.each(Object.entries(INVERSES))('%s undoes %s', (k, f) => {
    for (const x of XS) expect(at(ans(k), at(f, x))).toBeCloseTo(x, 9);
  });
  it.each(Object.entries(COMPOSITIONS))('%s is the composition', (k, [outer, inner]) => {
    for (const x of XS) expect(at(ans(k), x)).toBeCloseTo(at(outer, at(inner, x)), 9);
  });
  it.each(Object.entries(EXPANSIONS))('%s expands %s', (k, f) => {
    expect(ans(k)).not.toMatch(/[()]/);
    for (const x of XS) expect(at(ans(k), x)).toBeCloseTo(at(f, x), 9);
  });
  it('every expression question is covered by one of the tables', () => {
    const covered = new Set([...Object.keys(DERIVATIVES), ...Object.keys(INVERSES), ...Object.keys(COMPOSITIONS), ...Object.keys(EXPANSIONS), 'physics.kinematics/p3', 'physics.newtons-laws/p4']);
    expect([...all].filter(([, q]) => q.type === 'expression').map(([k]) => k).filter((k) => !covered.has(k))).toEqual([]);
  });
  it('physics formulas reproduce numeric cases', () => {
    expect(evaluate(ans('physics.kinematics/p3'), { u: 0, a: 3, t: 4 })).toBeCloseTo(24, 9);
    expect(evaluate(ans('physics.newtons-laws/p4'), { g: 9.8, theta: Math.PI / 6 })).toBeCloseTo(4.9, 9);
  });
});

describe('worked CPU trace matches the simulator', () => {
  it('the C trace in cs.cpu-cycle ends with the right total and output', () => {
    const step = catalog.byId.get('cs.cpu-cycle')!.steps.find((s) => s.kind === 'code-tabs');
    if (step?.kind !== 'code-tabs') throw new Error('missing code-tabs step');
    const trace = step.tabs.find((t) => t.language === 'c')!.trace!;
    const last = trace[trace.length - 1];
    expect(last.stdout).toBe('10\n');
    expect(last.stack[0].vars.find((v) => v.name === 'total')!.value).toBe(String(1 + 2 + 3 + 4));
    const lines = step.tabs.find((t) => t.language === 'c')!.code.split('\n').length;
    for (const f of trace) expect(f.line).toBeLessThanOrEqual(lines);
  });
});
