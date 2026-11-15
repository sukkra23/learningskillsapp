/**
 * A tiny teaching CPU: four 8-bit registers, a program counter, an
 * instruction register, a zero flag, and 8 bytes of data memory. The program
 * is stored separately from data. One call to step() performs one phase of
 * the fetch-decode-execute cycle.
 */
export type Phase = 'fetch' | 'decode' | 'execute';
export interface Cpu {
  pc: number; ir: string; reg: number[]; zero: boolean; mem: number[];
  phase: Phase; halted: boolean; cycles: number; note: string;
}
export const MEM_SIZE = 8;
const OPS = ['LOADI', 'LOAD', 'STORE', 'ADD', 'SUB', 'JMP', 'JZ', 'JNZ', 'HALT'] as const;
type Op = (typeof OPS)[number];
export interface Instr { op: Op; r?: number; s?: number; n?: number }

export function parseInstr(text: string): Instr {
  const [opRaw, ...rest] = text.trim().replace(/,/g, ' ').split(/\s+/);
  const op = opRaw.toUpperCase() as Op;
  if (!OPS.includes(op)) throw new Error(`Unknown instruction "${opRaw}"`);
  const reg = (s: string | undefined) => { const m = /^R([0-3])$/i.exec(s ?? ''); if (!m) throw new Error(`Expected a register R0-R3 in "${text}"`); return +m[1]; };
  const num = (s: string | undefined) => { const v = Number(s); if (!Number.isInteger(v)) throw new Error(`Expected a number in "${text}"`); return v; };
  switch (op) {
    case 'LOADI': case 'LOAD': case 'STORE': return { op, r: reg(rest[0]), n: num(rest[1]) };
    case 'ADD': case 'SUB': return { op, r: reg(rest[0]), s: reg(rest[1]) };
    case 'JMP': case 'JZ': case 'JNZ': return { op, n: num(rest[0]) };
    case 'HALT': return { op };
  }
}

export function describe(i: Instr): string {
  switch (i.op) {
    case 'LOADI': return `Put the number ${i.n} into R${i.r}.`;
    case 'LOAD': return `Copy memory cell ${i.n} into R${i.r}.`;
    case 'STORE': return `Copy R${i.r} into memory cell ${i.n}.`;
    case 'ADD': return `Add R${i.s} to R${i.r} (the ALU does this) and set the zero flag if the result is 0.`;
    case 'SUB': return `Subtract R${i.s} from R${i.r} and set the zero flag if the result is 0.`;
    case 'JMP': return `Jump: set the program counter to ${i.n}.`;
    case 'JZ': return `Jump to ${i.n} if the zero flag is set.`;
    case 'JNZ': return `Jump to ${i.n} if the zero flag is not set.`;
    case 'HALT': return 'Stop.';
  }
}

export function reset(memory: Record<string, number> = {}): Cpu {
  const mem = new Array<number>(MEM_SIZE).fill(0);
  for (const [k, v] of Object.entries(memory)) if (+k >= 0 && +k < MEM_SIZE) mem[+k] = v & 255;
  return { pc: 0, ir: '', reg: [0, 0, 0, 0], zero: false, mem, phase: 'fetch', halted: false, cycles: 0, note: 'Ready. The program counter points at instruction 0.' };
}

/** Advances one phase. Pure: returns a new state. */
export function step(c: Cpu, program: string[]): Cpu {
  if (c.halted) return c;
  if (c.phase === 'fetch') {
    if (c.pc < 0 || c.pc >= program.length) return { ...c, halted: true, note: `The program counter (${c.pc}) is past the end of the program, so the CPU stops.` };
    return { ...c, ir: program[c.pc], pc: c.pc + 1, phase: 'decode', note: `Fetch: copy instruction ${c.pc} into the instruction register, then add 1 to the program counter.` };
  }
  const i = parseInstr(c.ir);
  if (c.phase === 'decode') return { ...c, phase: 'execute', note: `Decode: "${c.ir}" means: ${describe(i)}` };
  const n: Cpu = { ...c, reg: [...c.reg], mem: [...c.mem], phase: 'fetch', cycles: c.cycles + 1 };
  const addr = (a: number) => { if (a < 0 || a >= MEM_SIZE) throw new Error(`Memory address ${a} is out of range`); return a; };
  switch (i.op) {
    case 'LOADI': n.reg[i.r!] = i.n! & 255; n.note = `Execute: R${i.r} is now ${n.reg[i.r!]}.`; break;
    case 'LOAD': n.reg[i.r!] = n.mem[addr(i.n!)]; n.note = `Execute: R${i.r} is now ${n.reg[i.r!]} (read from memory cell ${i.n}).`; break;
    case 'STORE': n.mem[addr(i.n!)] = n.reg[i.r!]; n.note = `Execute: memory cell ${i.n} is now ${n.reg[i.r!]}.`; break;
    case 'ADD': case 'SUB': {
      const v = (n.reg[i.r!] + (i.op === 'ADD' ? 1 : -1) * n.reg[i.s!]) & 255;
      n.reg[i.r!] = v; n.zero = v === 0;
      n.note = `Execute: R${i.r} is now ${v}. Zero flag is ${n.zero ? 'set' : 'clear'}.`; break;
    }
    case 'JMP': n.pc = i.n!; n.note = `Execute: program counter set to ${i.n}.`; break;
    case 'JZ': case 'JNZ': {
      const take = i.op === 'JZ' ? n.zero : !n.zero;
      if (take) n.pc = i.n!;
      n.note = `Execute: zero flag is ${n.zero ? 'set' : 'clear'}, so the jump is ${take ? `taken (program counter = ${i.n})` : 'not taken'}.`; break;
    }
    case 'HALT': n.halted = true; n.note = 'Execute: HALT. The CPU stops.'; break;
  }
  return n;
}

/** Runs to completion (or until maxCycles instructions have executed). */
export function run(program: string[], memory: Record<string, number> = {}, maxCycles = 1000): Cpu {
  let c = reset(memory);
  while (!c.halted && c.cycles < maxCycles) c = step(c, program);
  return c;
}
