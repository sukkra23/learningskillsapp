import { useState } from 'react';
import { fullAdder, gate, halfAdder, type Bit, type Gate } from './sim/logic';
import { Toggle, v } from './ui';

interface Props { mode: 'gate' | 'transistor' | 'half-adder' | 'full-adder'; gates: Gate[] }
const b = (x: boolean): Bit => (x ? 1 : 0);
const wire = (on: Bit | boolean) => (on ? v('accent') : v('border-strong'));

function Lamp({ on, label }: { on: Bit; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 font-mono text-sm font-semibold ${on ? 'border-warn text-fg' : 'border-border text-muted'}`}>
      <span aria-hidden="true" className={`h-3.5 w-3.5 rounded-full ${on ? 'bg-warn' : 'bg-surface2 ring-1 ring-strong'}`} />{label} = {on}
    </span>
  );
}

function TruthTable({ inputs, outputs, rows, current }: { inputs: string[]; outputs: string[]; rows: number[][]; current: number }) {
  return (
    <table className="border-collapse text-center font-mono text-sm">
      <caption className="sr-only">Truth table. The highlighted row matches the current inputs.</caption>
      <thead><tr>{[...inputs, ...outputs].map((h, i) => <th key={h} scope="col" className={`border border-border px-3 py-1 ${i >= inputs.length ? 'bg-surface2' : ''}`}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} aria-current={i === current ? 'true' : undefined} className={i === current ? 'bg-accent-soft font-bold' : ''}>{r.map((c, j) => <td key={j} className="border border-border px-3 py-1">{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

/** Standard gate symbols, drawn simply. */
function GateSymbol({ g, a, bIn, out }: { g: Gate; a: Bit; bIn: Bit; out: Bit }) {
  const single = g === 'NOT', bubble = g === 'NOT' || g === 'NAND' || g === 'NOR';
  const body = g === 'NOT' ? 'M70,25 L70,95 L130,60 Z'
    : g === 'AND' || g === 'NAND' ? 'M70,25 L105,25 A35,35 0 0 1 105,95 L70,95 Z'
    : 'M66,25 Q110,25 140,60 Q110,95 66,95 Q84,60 66,25 Z';
  const tip = g === 'NOT' ? 130 : 140;
  return (
    <svg viewBox="0 0 220 120" className="w-full max-w-xs" role="img" aria-label={`${g} gate. ${single ? `Input ${a}` : `Inputs ${a} and ${bIn}`}, output ${out}.`}>
      {single ? <line x1="10" y1="60" x2="70" y2="60" stroke={wire(a)} strokeWidth="4" /> : (<><line x1="10" y1="42" x2="74" y2="42" stroke={wire(a)} strokeWidth="4" /><line x1="10" y1="78" x2="74" y2="78" stroke={wire(bIn)} strokeWidth="4" /></>)}
      {g === 'XOR' && <path d="M56,25 Q74,60 56,95" fill="none" stroke={v('fg')} strokeWidth="3" />}
      <path d={body} fill={v('surface2')} stroke={v('fg')} strokeWidth="3" strokeLinejoin="round" />
      {bubble && <circle cx={tip + 7} cy="60" r="7" fill={v('surface')} stroke={v('fg')} strokeWidth="3" />}
      <line x1={tip + (bubble ? 14 : 0)} y1="60" x2="210" y2="60" stroke={wire(out)} strokeWidth="4" />
      <text x="100" y="65" textAnchor="middle" fontSize="13" fontWeight="700" fill={v('fg')}>{g}</text>
    </svg>
  );
}

/** Two switches between a battery and a lamp: in series (AND) or in parallel (OR). */
function Switches({ a, bIn, series }: { a: Bit; bIn: Bit; series: boolean }) {
  const lit = series ? a & bIn : a | bIn;
  const sw = (x: number, y: number, on: Bit, name: string) => (
    <g>
      <circle cx={x} cy={y} r="4" fill={v('fg')} /><circle cx={x + 50} cy={y} r="4" fill={v('fg')} />
      <line x1={x} y1={y} x2={x + 50} y2={on ? y : y - 22} stroke={on ? v('accent') : v('fg')} strokeWidth="4" strokeLinecap="round" />
      <text x={x + 25} y={y + 20} textAnchor="middle" fontSize="13" fontWeight="700" fill={v('fg')}>{name}</text>
    </g>
  );
  const live = lit ? v('accent') : v('border-strong');
  return (
    <svg viewBox="0 0 360 170" className="w-full max-w-md" role="img" aria-label={`Two switches in ${series ? 'series' : 'parallel'}. Switch A is ${a ? 'closed' : 'open'}, switch B is ${bIn ? 'closed' : 'open'}. The lamp is ${lit ? 'on' : 'off'}.`}>
      <line x1="30" y1="40" x2="30" y2="140" stroke={live} strokeWidth="3" /><line x1="30" y1="140" x2="330" y2="140" stroke={live} strokeWidth="3" /><line x1="330" y1="140" x2="330" y2="105" stroke={live} strokeWidth="3" />
      <line x1="18" y1="84" x2="42" y2="84" stroke={v('fg')} strokeWidth="4" /><line x1="23" y1="94" x2="37" y2="94" stroke={v('fg')} strokeWidth="4" />
      <rect x="20" y="80" width="20" height="18" fill={v('surface')} opacity="0" />
      {series ? (<>
        <line x1="30" y1="40" x2="80" y2="40" stroke={live} strokeWidth="3" />{sw(80, 40, a, 'A')}
        <line x1="130" y1="40" x2="190" y2="40" stroke={a ? live : v('border-strong')} strokeWidth="3" />{sw(190, 40, bIn, 'B')}
        <line x1="240" y1="40" x2="330" y2="40" stroke={live} strokeWidth="3" />
      </>) : (<>
        <line x1="30" y1="40" x2="100" y2="40" stroke={live} strokeWidth="3" /><line x1="100" y1="20" x2="100" y2="66" stroke={live} strokeWidth="3" />
        {sw(120, 20, a, 'A')}{sw(120, 66, bIn, 'B')}
        <line x1="100" y1="20" x2="120" y2="20" stroke={live} strokeWidth="3" /><line x1="100" y1="66" x2="120" y2="66" stroke={live} strokeWidth="3" />
        <line x1="170" y1="20" x2="200" y2="20" stroke={live} strokeWidth="3" /><line x1="170" y1="66" x2="200" y2="66" stroke={live} strokeWidth="3" />
        <line x1="200" y1="20" x2="200" y2="66" stroke={live} strokeWidth="3" /><line x1="200" y1="40" x2="330" y2="40" stroke={live} strokeWidth="3" />
      </>)}
      <line x1="330" y1="40" x2="330" y2="75" stroke={live} strokeWidth="3" />
      <circle cx="330" cy="90" r="15" fill={lit ? v('warn') : v('surface2')} stroke={v('fg')} strokeWidth="3" />
      <text x="330" y="95" textAnchor="middle" fontSize="12" fontWeight="700" fill={v('fg')}>{lit ? 'ON' : 'off'}</text>
    </svg>
  );
}

export default function LogicGates({ mode, gates }: Props) {
  const [a, setA] = useState(false), [bb, setB] = useState(false), [c, setC] = useState(false);
  const [g, setG] = useState<Gate>(gates[0]);
  const [series, setSeries] = useState(true);
  const A = b(a), B = b(bb), C = b(c);
  const two = [[0, 0], [0, 1], [1, 0], [1, 1]] as Bit[][];

  if (mode === 'transistor') {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Toggle label="A" on={a} onChange={setA} /><Toggle label="B" on={bb} onChange={setB} />
          <div role="group" aria-label="Wiring" className="ml-auto flex gap-1">
            <button type="button" className={`btn ${series ? 'btn-primary' : ''}`} aria-pressed={series} onClick={() => setSeries(true)}>Series</button>
            <button type="button" className={`btn ${!series ? 'btn-primary' : ''}`} aria-pressed={!series} onClick={() => setSeries(false)}>Parallel</button>
          </div>
        </div>
        <Switches a={A} bIn={B} series={series} />
        <p className="text-sm" aria-live="polite">{series ? 'In series, current flows only when A and B are both closed.' : 'In parallel, current flows when A or B (or both) is closed.'} A transistor is a switch like these that is opened and closed by a voltage instead of a finger.</p>
        <TruthTable inputs={['A', 'B']} outputs={['Lamp']} rows={two.map(([x, y]) => [x, y, series ? x & y : x | y])} current={A * 2 + B} />
      </div>
    );
  }
  if (mode === 'half-adder' || mode === 'full-adder') {
    const full = mode === 'full-adder';
    const r = full ? fullAdder(A, B, C) : halfAdder(A, B);
    const rows = full
      ? two.flatMap(([x, y]) => ([0, 1] as Bit[]).map((z) => { const o = fullAdder(x, y, z); return [x, y, z, o.carry, o.sum]; }))
      : two.map(([x, y]) => { const o = halfAdder(x, y); return [x, y, o.carry, o.sum]; });
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Toggle label="A" on={a} onChange={setA} /><Toggle label="B" on={bb} onChange={setB} />{full && <Toggle label="Carry in" on={c} onChange={setC} />}
          <span aria-hidden="true" className="px-1 text-muted">&rarr;</span>
          <Lamp on={r.carry} label="Carry out" /><Lamp on={r.sum} label="Sum" />
        </div>
        <p className="font-mono text-sm" aria-live="polite">{A} + {B}{full ? ` + ${C}` : ''} = {A + B + (full ? C : 0)} in decimal = {r.carry}{r.sum} in binary</p>
        <p className="text-sm text-muted">{full ? 'Sum = A XOR B XOR CarryIn. Carry out = (A AND B) OR (CarryIn AND (A XOR B)): two half adders and an OR gate.' : 'Sum = A XOR B. Carry = A AND B.'}</p>
        <TruthTable inputs={full ? ['A', 'B', 'Cin'] : ['A', 'B']} outputs={['Carry', 'Sum']} rows={rows} current={full ? A * 4 + B * 2 + C : A * 2 + B} />
      </div>
    );
  }
  const single = g === 'NOT';
  const out = gate(g, A, B);
  return (
    <div className="space-y-3">
      <div role="group" aria-label="Gate" className="flex flex-wrap gap-1">
        {gates.map((x) => <button key={x} type="button" className={`btn px-3 py-1 ${x === g ? 'btn-primary' : ''}`} aria-pressed={x === g} onClick={() => setG(x)}>{x}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-2"><Toggle label="A" on={a} onChange={setA} />{!single && <Toggle label="B" on={bb} onChange={setB} />}</div>
        <div className="min-w-[12rem] flex-1"><GateSymbol g={g} a={A} bIn={B} out={out} /></div>
        <Lamp on={out} label="Out" />
      </div>
      <TruthTable inputs={single ? ['A'] : ['A', 'B']} outputs={['Out']} rows={single ? [[0, gate(g, 0)], [1, gate(g, 1)]] : two.map(([x, y]) => [x, y, gate(g, x, y)])} current={single ? A : A * 2 + B} />
    </div>
  );
}
