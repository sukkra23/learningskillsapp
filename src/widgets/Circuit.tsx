import { useMemo, useState } from 'react';
import { solveCircuit, thevenin, type Component } from './sim/circuit';
import { v } from './ui';

type Kind = 'none' | 'W' | 'R' | 'V';
interface Edge { kind: Kind; value: number; flip: boolean }
type Edges = Record<string, Edge>;
const COLS = 4;
const EDGE_IDS = [...[0, 1, 2].map((i) => `T${i}`), ...[0, 1, 2].map((i) => `B${i}`), ...[0, 1, 2, 3].map((i) => `V${i}`)];
const none: Edge = { kind: 'none', value: 0, flip: false };
const W: Edge = { kind: 'W', value: 0, flip: false };
const R = (value: number): Edge => ({ kind: 'R', value, flip: false });
const V = (value: number): Edge => ({ kind: 'V', value, flip: false });
const base = (o: Partial<Edges>): Edges => ({ ...Object.fromEntries(EDGE_IDS.map((id) => [id, none])), ...o }) as Edges;

export const PRESETS: Record<string, { label: string; edges: Edges }> = {
  series: { label: 'Series', edges: base({ V0: V(9), T0: R(100), T1: R(200), V2: W, B0: W, B1: W }) },
  parallel: { label: 'Parallel', edges: base({ V0: V(6), T0: W, T1: W, V1: R(20), V2: R(30), B0: W, B1: W }) },
  divider: { label: 'Voltage divider', edges: base({ V0: V(12), T0: R(100), V1: R(200), B0: W }) },
  'two-loop': { label: 'Two loops', edges: base({ V0: V(10), T0: R(2), V1: R(4), T1: R(4), V2: V(6), B0: W, B1: W }) },
  thevenin: { label: 'Source with load', edges: base({ V0: V(12), T0: R(6), V1: R(3), T1: W, V2: R(2), B0: W, B1: W }) },
  empty: { label: 'Blank', edges: base({ V0: V(9) }) },
};

const ends = (id: string): [string, string] => {
  const i = +id[1];
  return id[0] === 'T' ? [`t${i}`, `t${i + 1}`] : id[0] === 'B' ? [`b${i}`, `b${i + 1}`] : [`t${i}`, `b${i}`];
};
const pos = (node: string) => ({ x: 70 + 150 * +node[1], y: node[0] === 't' ? 60 : 210 });
const NAME: Record<string, string> = Object.fromEntries(EDGE_IDS.map((id) => [id, id[0] === 'T' ? `top ${+id[1] + 1}` : id[0] === 'B' ? `bottom ${+id[1] + 1}` : `upright ${+id[1] + 1}`]));

/** Engineering notation: 0.03 A -> "30 mA". */
export function si(x: number, unit: string): string {
  if (!Number.isFinite(x)) return 'n/a';
  const a = Math.abs(x);
  if (a < 1e-9) return `0 ${unit}`;
  const [k, p] = a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'k'] : a >= 1 ? [1, ''] : a >= 1e-3 ? [1e-3, 'm'] : [1e-6, 'µ'];
  return `${+(x / (k as number)).toPrecision(3)} ${p}${unit}`;
}

export default function Circuit({ preset, editable }: { preset: keyof typeof PRESETS; editable: boolean }) {
  const [edges, setEdges] = useState<Edges>(PRESETS[preset].edges);
  const [sel, setSel] = useState<string | null>(null);
  const set = (id: string, patch: Partial<Edge>) => setEdges((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const components = useMemo(() => EDGE_IDS.filter((id) => edges[id].kind !== 'none').map((id): Component => {
    const [a, b] = ends(id), e = edges[id];
    return { id, type: e.kind as Component['type'], a: e.flip ? b : a, b: e.flip ? a : b, value: e.value };
  }), [edges]);
  const result = useMemo(() => solveCircuit(components, 'b0'), [components]);
  const sol = result.ok ? result.solution : null;
  const selEdge = sel ? edges[sel] : null;
  const selComp = components.find((c) => c.id === sel);
  const th = useMemo(() => (selComp && selComp.type === 'R' ? thevenin(components.filter((c) => c.id !== sel), 'b0', selComp.a, selComp.b) : null), [components, sel, selComp]);
  const used = new Set(components.flatMap((c) => [c.a, c.b]));

  const describe = (id: string) => {
    const e = edges[id];
    if (e.kind === 'none') return `${NAME[id]}: empty`;
    if (e.kind === 'W') return `${NAME[id]}: wire`;
    const c = sol ? `, current ${si(Math.abs(sol.current[id]), 'A')}` : '';
    return e.kind === 'R' ? `${NAME[id]}: resistor ${si(e.value, 'Ω')}${c}` : `${NAME[id]}: voltage source ${si(e.value, 'V')}${c}`;
  };

  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Example circuits">
          <span className="mr-1 text-sm text-muted">Load an example:</span>
          {Object.entries(PRESETS).map(([k, p]) => <button key={k} type="button" className="btn px-2.5 py-1 text-xs" onClick={() => { setEdges(p.edges); setSel(null); }}>{p.label}</button>)}
        </div>
      )}
      <svg viewBox="0 0 590 270" className="w-full" role="group" aria-label="Circuit. Select a branch to edit it.">
        {EDGE_IDS.map((id) => {
          const [na, nb] = ends(id), a = pos(na), b = pos(nb), e = edges[id];
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, vert = id[0] === 'V';
          const i = sol && e.kind !== 'none' && e.kind !== 'W' ? sol.current[id] : 0;
          // Arrow shows conventional current through the branch, in drawing direction a->b.
          const along = e.kind === 'V' ? -i : i;
          const dir = (e.flip ? -along : along) >= 0 ? 1 : -1;
          const active = sel === id;
          const stroke = active ? v('accent') : v('fg');
          return (
            <g key={id} role="button" tabIndex={editable ? 0 : -1} aria-label={describe(id)} aria-pressed={active} className={editable ? 'cursor-pointer' : ''}
              onClick={() => editable && setSel(active ? null : id)} onKeyDown={(ev) => { if (editable && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); setSel(active ? null : id); } }}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={34} />
              {e.kind === 'none'
                ? <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active ? v('accent') : v('border')} strokeWidth={2} strokeDasharray="3 7" />
                : <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={active ? 3.5 : 2.5} />}
              {e.kind === 'R' && (<>
                <rect x={mx - (vert ? 11 : 30)} y={my - (vert ? 30 : 11)} width={vert ? 22 : 60} height={vert ? 60 : 22} rx={4} fill={v('surface')} stroke={stroke} strokeWidth={2.5} />
                <text x={vert ? mx + 18 : mx} y={vert ? my - 6 : my - 18} textAnchor={vert ? 'start' : 'middle'} fontSize="13" fontWeight="600" fill={v('fg')}>{si(e.value, 'Ω')}</text>
              </>)}
              {e.kind === 'V' && (<>
                <circle cx={mx} cy={my} r={19} fill={v('surface')} stroke={stroke} strokeWidth={2.5} />
                <text x={vert ? mx : mx + (e.flip ? 9 : -9)} y={vert ? my + (e.flip ? 13 : -4) : my + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill={v('fg')}>+</text>
                <text x={vert ? mx : mx + (e.flip ? -9 : 9)} y={vert ? my + (e.flip ? -4 : 14) : my + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill={v('fg')}>{'−'}</text>
                <text x={vert ? mx + 26 : mx} y={vert ? my - 6 : my - 26} textAnchor={vert ? 'start' : 'middle'} fontSize="13" fontWeight="600" fill={v('fg')}>{si(e.value, 'V')}</text>
              </>)}
              {sol && (e.kind === 'R' || e.kind === 'V') && Math.abs(i) > 1e-9 && (
                <text x={vert ? mx + (e.kind === 'V' ? 26 : 18) : mx} y={vert ? my + 12 : my + 28} textAnchor={vert ? 'start' : 'middle'} fontSize="12" fill={v('accent')} fontWeight="600">
                  {vert ? (dir > 0 ? '↓' : '↑') : dir > 0 ? '→' : '←'} {si(Math.abs(i), 'A')}
                </text>
              )}
            </g>
          );
        })}
        {Array.from({ length: COLS }, (_, c) => ['t', 'b'].map((r) => {
          const id = `${r}${c}`, p = pos(id);
          if (!used.has(id)) return <circle key={id} cx={p.x} cy={p.y} r={3} fill={v('border-strong')} />;
          return (
            <g key={id}>
              <circle cx={p.x} cy={p.y} r={5} fill={v('fg')} />
              {sol && <text x={p.x} y={r === 't' ? p.y - 12 : p.y + 24} textAnchor="middle" fontSize="12" fill={v('muted')}>{id === 'b0' ? 'ground 0 V' : si(sol.voltage[id] ?? 0, 'V')}</text>}
            </g>
          );
        }))}
      </svg>
      {!result.ok && <p role="alert" className="text-sm text-danger">{result.error}</p>}

      {editable && (
        <div className="rounded-xl border border-border bg-surface2 p-3 text-sm" aria-live="polite">
          {!sel || !selEdge ? <p className="text-muted">Select any branch of the ladder to place a wire, resistor or voltage source there. Node voltages and branch currents update as you edit.</p> : (
            <div className="space-y-2">
              <p className="font-semibold capitalize">Branch: {NAME[sel]}</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-0.5">Component
                  <select className="input py-1.5" value={selEdge.kind} onChange={(e) => { const k = e.target.value as Kind; set(sel, { kind: k, value: k === 'R' ? selEdge.value || 100 : k === 'V' ? selEdge.value || 9 : 0 }); }}>
                    <option value="none">Empty (open)</option><option value="W">Wire</option><option value="R">Resistor</option><option value="V">Voltage source</option>
                  </select>
                </label>
                {(selEdge.kind === 'R' || selEdge.kind === 'V') && (
                  <label className="flex flex-col gap-0.5">{selEdge.kind === 'R' ? 'Resistance (ohms)' : 'Voltage (volts)'}
                    <input type="number" className="input w-32 py-1.5" min={selEdge.kind === 'R' ? 0.1 : -1000} step="any" value={selEdge.value} onChange={(e) => set(sel, { value: +e.target.value })} />
                  </label>
                )}
                {selEdge.kind === 'V' && <button type="button" className="btn" onClick={() => set(sel, { flip: !selEdge.flip })}>Flip polarity</button>}
              </div>
              {sol && selComp && selComp.type !== 'W' && (
                <p className="font-mono">Voltage across: {si(Math.abs(sol.voltage[selComp.a] - sol.voltage[selComp.b]), 'V')} &middot; Current: {si(Math.abs(sol.current[sel]), 'A')} &middot; Power {sol.power[sel] < 0 ? 'delivered' : 'dissipated'}: {si(Math.abs(sol.power[sel]), 'W')}</p>
              )}
              {th && Number.isFinite(th.rth) && (
                <p>Seen from this resistor, the rest of the circuit behaves like a <span className="font-mono font-semibold">{si(Math.abs(th.vth), 'V')}</span> source in series with <span className="font-mono font-semibold">{si(th.rth, 'Ω')}</span> (its Thevenin equivalent).</p>
              )}
            </div>
          )}
        </div>
      )}
      {sol && (
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Voltage, current and power for each component</caption>
          <thead><tr className="text-muted">{['Component', 'Value', 'Voltage', 'Current', 'Power'].map((h) => <th key={h} scope="col" className="border-b border-border px-2 py-1 font-medium">{h}</th>)}</tr></thead>
          <tbody className="font-mono">
            {components.filter((c) => c.type !== 'W').map((c) => (
              <tr key={c.id} className={c.id === sel ? 'bg-accent-soft' : ''}>
                <th scope="row" className="px-2 py-1 font-sans font-normal capitalize">{c.type === 'R' ? 'Resistor' : 'Source'}, {NAME[c.id]}</th>
                <td className="px-2 py-1">{si(c.value, c.type === 'R' ? 'Ω' : 'V')}</td>
                <td className="px-2 py-1">{si(Math.abs(sol.voltage[c.a] - sol.voltage[c.b]), 'V')}</td>
                <td className="px-2 py-1">{si(Math.abs(sol.current[c.id]), 'A')}</td>
                <td className="px-2 py-1">{si(Math.abs(sol.power[c.id]), 'W')} {sol.power[c.id] < -1e-12 ? 'out' : 'in'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
