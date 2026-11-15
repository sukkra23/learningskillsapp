export type Gate = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR';
export type Bit = 0 | 1;

export function gate(g: Gate, a: Bit, b: Bit = 0): Bit {
  switch (g) {
    case 'AND': return (a & b) as Bit;
    case 'OR': return (a | b) as Bit;
    case 'NOT': return (a ^ 1) as Bit;
    case 'NAND': return ((a & b) ^ 1) as Bit;
    case 'NOR': return ((a | b) ^ 1) as Bit;
    case 'XOR': return (a ^ b) as Bit;
  }
}
export const halfAdder = (a: Bit, b: Bit) => ({ sum: gate('XOR', a, b), carry: gate('AND', a, b) });
export function fullAdder(a: Bit, b: Bit, cin: Bit) {
  const h1 = halfAdder(a, b), h2 = halfAdder(h1.sum, cin);
  return { sum: h2.sum, carry: gate('OR', h1.carry, h2.carry) };
}

export type AluOp = 'ADD' | 'SUB' | 'AND' | 'OR' | 'XOR' | 'NOT';
export interface AluResult { result: number; carry: Bit; zero: Bit; negative: Bit; overflow: Bit; carries: Bit[] }

/** An n-bit ALU built from a ripple-carry adder. SUB is A + (NOT B) + 1; carry=1 on SUB means no borrow. */
export function alu(a: number, b: number, op: AluOp, bits: number): AluResult {
  const mask = (1 << bits) - 1;
  a &= mask; b &= mask;
  let result = 0, carry: Bit = 0, overflow: Bit = 0;
  const carries: Bit[] = [];
  if (op === 'ADD' || op === 'SUB') {
    const bb = op === 'SUB' ? ~b & mask : b;
    let c: Bit = op === 'SUB' ? 1 : 0;
    for (let i = 0; i < bits; i++) {
      const r = fullAdder(((a >> i) & 1) as Bit, ((bb >> i) & 1) as Bit, c);
      result |= r.sum << i;
      c = r.carry;
      carries.push(c);
    }
    carry = c;
    const sa = (a >> (bits - 1)) & 1, sb = (bb >> (bits - 1)) & 1, sr = (result >> (bits - 1)) & 1;
    overflow = (sa === sb && sr !== sa ? 1 : 0) as Bit;
  } else result = (op === 'AND' ? a & b : op === 'OR' ? a | b : op === 'XOR' ? a ^ b : ~a) & mask;
  return { result, carry, zero: (result === 0 ? 1 : 0) as Bit, negative: ((result >> (bits - 1)) & 1) as Bit, overflow, carries };
}
export const toSigned = (x: number, bits: number) => (x & (1 << (bits - 1)) ? x - (1 << bits) : x);
export const toBits = (x: number, bits: number): Bit[] => Array.from({ length: bits }, (_, i) => ((x >> (bits - 1 - i)) & 1) as Bit);
