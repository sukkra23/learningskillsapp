import { useState } from 'react';
import { alu, toBits, toSigned, type AluOp } from './sim/logic';

const OPS: AluOp[] = ['ADD', 'SUB', 'AND', 'OR', 'XOR', 'NOT'];
const SYMBOL: Record<AluOp, string> = { ADD: '+', SUB: '−', AND: 'AND', OR: 'OR', XOR: 'XOR', NOT: 'NOT' };

function Bits({ name, value, bits, onChange }: { name: string; value: number; bits: number; onChange?(v: number): void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-14 font-mono text-sm font-semibold">{name}</span>
      <div className="flex gap-1" role="group" aria-label={`${name}: ${bits} bits, most significant first`}>
        {toBits(value, bits).map((bit, i) => {
          const place = bits - 1 - i;
          return onChange ? (
            <button key={i} type="button" aria-pressed={bit === 1} aria-label={`${name} bit ${place} (worth ${1 << place}): ${bit}`} onClick={() => onChange(value ^ (1 << place))}
              className={`h-10 w-9 rounded-lg border-2 font-mono text-lg font-bold ${bit ? 'border-accent bg-accent text-accent-fg' : 'border-strong bg-surface'}`}>{bit}</button>
          ) : <span key={i} className={`flex h-10 w-9 items-center justify-center rounded-lg border-2 font-mono text-lg font-bold ${bit ? 'border-success bg-surface2' : 'border-border bg-surface2 text-muted'}`}>{bit}</span>;
        })}
      </div>
      <span className="font-mono text-sm text-muted">= {value} unsigned, {toSigned(value, bits)} signed</span>
    </div>
  );
}

export default function Alu({ bits }: { bits: 4 | 8 }) {
  const [a, setA] = useState(bits === 4 ? 0b0101 : 0b00010110);
  const [b, setB] = useState(bits === 4 ? 0b0011 : 0b00001011);
  const [op, setOp] = useState<AluOp>('ADD');
  const r = alu(a, b, op, bits);
  const arith = op === 'ADD' || op === 'SUB';
  const flags: [string, number, string][] = [
    ['Zero', r.zero, 'the result is 0'], ['Negative', r.negative, 'the top bit is 1'],
    ['Carry', r.carry, op === 'SUB' ? 'no borrow was needed (A is at least B, unsigned)' : 'the unsigned result did not fit'], ['Overflow', r.overflow, 'the signed result did not fit'],
  ];
  return (
    <div className="space-y-3">
      <Bits name="A" value={a} bits={bits} onChange={setA} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-14 text-sm text-muted">Operation</span>
        <div role="group" aria-label="ALU operation" className="flex flex-wrap gap-1">
          {OPS.map((o) => <button key={o} type="button" aria-pressed={o === op} onClick={() => setOp(o)} className={`btn px-3 py-1 font-mono ${o === op ? 'btn-primary' : ''}`}>{o}</button>)}
        </div>
      </div>
      {op !== 'NOT' && <Bits name="B" value={b} bits={bits} onChange={setB} />}
      {arith && (
        <div className="flex flex-wrap items-center gap-2 text-muted">
          <span className="w-14 font-mono text-sm">carries</span>
          <div className="flex gap-1" aria-label="Carry out of each bit position">{[...r.carries].reverse().map((c, i) => <span key={i} className="flex h-6 w-9 items-center justify-center font-mono text-sm">{c}</span>)}</div>
          {op === 'SUB' && <span className="text-xs">Subtraction is A + (NOT B) + 1.</span>}
        </div>
      )}
      <div className="border-t-2 border-strong pt-3"><Bits name="Result" value={r.result} bits={bits} /></div>
      <p className="font-mono text-sm" aria-live="polite">{op === 'NOT' ? `NOT ${a}` : `${a} ${SYMBOL[op]} ${b}`} = {r.result}{arith && r.overflow ? ` (signed: ${toSigned(a, bits)} ${SYMBOL[op]} ${toSigned(b, bits)} does not fit in ${bits} bits)` : ''}</p>
      <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
        {flags.map(([name, on, why]) => (
          <li key={name} className={`rounded-lg border-2 px-3 py-1.5 ${on ? 'border-accent bg-accent-soft' : 'border-border'}`}>
            <span className="font-semibold">{name} flag: {on}</span>{on === 1 && (arith || name === 'Zero' || name === 'Negative') && <span className="text-muted"> ({why})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
