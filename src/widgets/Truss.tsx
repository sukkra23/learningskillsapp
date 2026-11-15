import { useMemo, useState } from 'react';
import { solveTruss, type Joint, type Member } from './sim/truss';
import { fmt, Slider, v } from './ui';

const H = 1.5;
const MEMBERS: Member[] = [['A', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'D'], ['C', 'E'], ['D', 'E']].map(([a, b]) => ({ id: a + b, a, b }));

/** A five-joint Warren truss on a pin and a roller, solved live by the method of joints. */
export default function Truss() {
  const [pc, setPc] = useState(10), [pb, setPb] = useState(0), [pd, setPd] = useState(0), [hb, setHb] = useState(0);
  const joints: Joint[] = useMemo(() => [
    { id: 'A', x: 0, y: 0, support: 'pin' }, { id: 'B', x: 1, y: H, load: { fx: hb, fy: -pb } }, { id: 'C', x: 2, y: 0, load: { fx: 0, fy: -pc } },
    { id: 'D', x: 3, y: H, load: { fx: 0, fy: -pd } }, { id: 'E', x: 4, y: 0, support: 'roller' },
  ], [pc, pb, pd, hb]);
  const sol = useMemo(() => solveTruss(joints, MEMBERS), [joints]);
  const X = (x: number) => 70 + x * 110, Y = (y: number) => 230 - y * 110;
  const J = Object.fromEntries(joints.map((j) => [j.id, j]));
  const kind = (f: number) => (Math.abs(f) < 1e-6 ? 'zero' : f > 0 ? 'tension' : 'compression');
  const colour = { tension: v('cs'), compression: v('danger'), zero: v('border-strong') };
  const max = sol ? Math.max(1, ...Object.values(sol.member).map(Math.abs)) : 1;
  const arrow = (x: number, y: number, dx: number, dy: number, label: string, key: string) => {
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) return null;
    const ux = dx / L, uy = dy / L, x2 = x + ux * 44, y2 = y + uy * 44;
    return <g key={key}><line x1={x} y1={y} x2={x2} y2={y2} stroke={v('warn')} strokeWidth={3} /><path d={`M${x2},${y2} l${-ux * 10 - uy * 5},${-uy * 10 + ux * 5} l${uy * 10},${-ux * 10} z`} fill={v('warn')} /><text x={x2 + ux * 8 + 4} y={y2 + uy * 14} fontSize="12" fontWeight="600" fill={v('fg')}>{label}</text></g>;
  };

  return (
    <div className="space-y-3">
      <svg viewBox="0 0 580 300" className="w-full" role="img"
        aria-label={sol ? `Truss. Member forces in kilonewtons: ${MEMBERS.map((m) => `${m.id} ${fmt(Math.abs(sol.member[m.id]))} ${kind(sol.member[m.id])}`).join(', ')}.` : 'Truss'}>
        {MEMBERS.map((m) => {
          const a = J[m.a], b = J[m.b], f = sol?.member[m.id] ?? 0, k = kind(f);
          const mx = (X(a.x) + X(b.x)) / 2, my = (Y(a.y) + Y(b.y)) / 2;
          return (
            <g key={m.id}>
              <line x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)} stroke={colour[k]} strokeWidth={3 + (7 * Math.abs(f)) / max} strokeLinecap={k === 'compression' ? 'butt' : 'round'} strokeDasharray={k === 'compression' ? '12 7' : undefined} />
              <rect x={mx - 30} y={my - 10} width={60} height={20} rx={5} fill={v('surface')} stroke={v('border')} />
              <text x={mx} y={my + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill={v('fg')}>{k === 'zero' ? '0' : `${fmt(Math.abs(f), 1)} ${k === 'tension' ? 'T' : 'C'}`}</text>
            </g>
          );
        })}
        {joints.map((j) => (
          <g key={j.id}>
            {j.support === 'pin' && <path d={`M${X(j.x)},${Y(j.y)} l-16,26 h32 z`} fill={v('surface2')} stroke={v('fg')} strokeWidth={2} />}
            {j.support === 'roller' && <><path d={`M${X(j.x)},${Y(j.y)} l-16,20 h32 z`} fill={v('surface2')} stroke={v('fg')} strokeWidth={2} /><circle cx={X(j.x) - 8} cy={Y(j.y) + 25} r={4} fill={v('fg')} /><circle cx={X(j.x) + 8} cy={Y(j.y) + 25} r={4} fill={v('fg')} /></>}
            <circle cx={X(j.x)} cy={Y(j.y)} r={7} fill={v('surface')} stroke={v('fg')} strokeWidth={2.5} />
            <text x={X(j.x) - (j.y === 0 ? 22 : 16)} y={Y(j.y) + (j.y === 0 ? 22 : -10)} fontSize="13" fontWeight="700" fill={v('fg')}>{j.id}</text>
            {j.load && arrow(X(j.x), Y(j.y) - (j.load.fy < 0 ? 52 : 0), 0, j.load.fy < 0 ? 1 : 0, '', `${j.id}v`)}
            {j.load && j.load.fy < 0 && <text x={X(j.x) + 10} y={Y(j.y) - 40} fontSize="12" fontWeight="600" fill={v('fg')}>{fmt(-j.load.fy, 1)} kN</text>}
            {j.load && j.load.fx !== 0 && arrow(X(j.x) - Math.sign(j.load.fx) * 52, Y(j.y), Math.sign(j.load.fx), 0, '', `${j.id}h`)}
          </g>
        ))}
        {sol && <text x={X(0)} y={292} textAnchor="middle" fontSize="12" fill={v('muted')}>{'↑'} {fmt(sol.reaction.A.ry, 2)} kN{Math.abs(sol.reaction.A.rx) > 1e-6 ? `, ${sol.reaction.A.rx > 0 ? '→' : '←'} ${fmt(Math.abs(sol.reaction.A.rx), 2)} kN` : ''}</text>}
        {sol && <text x={X(4)} y={292} textAnchor="middle" fontSize="12" fill={v('muted')}>{'↑'} {fmt(sol.reaction.E.ry, 2)} kN</text>}
      </svg>
      <p className="text-sm text-muted"><span className="font-semibold" style={{ color: v('cs') }}>Solid, labelled T</span>: tension (the member is being stretched). <span className="font-semibold" style={{ color: v('danger') }}>Dashed, labelled C</span>: compression (it is being squeezed). Thicker means more force.</p>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Slider label="Load at C (down)" value={pc} min={0} max={30} step={1} unit="kN" onChange={setPc} />
        <Slider label="Load at B (down)" value={pb} min={0} max={30} step={1} unit="kN" onChange={setPb} />
        <Slider label="Load at D (down)" value={pd} min={0} max={30} step={1} unit="kN" onChange={setPd} />
        <Slider label="Sideways load at B" value={hb} min={-15} max={15} step={1} unit="kN" onChange={setHb} />
      </div>
    </div>
  );
}
