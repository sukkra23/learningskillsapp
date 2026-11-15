import { useRef, useState } from 'react';
import { netForce } from './sim/mechanics';
import { fmt, Readout, Slider, v } from './ui';

interface Props { mass: number; forces: [number, number][]; gravity: boolean }
const CX = 200, CY = 170, G = 9.8;
const COLORS = ['cs', 'engineering', 'math', 'physics'];

function Arrow({ mag, angle, scale, color, dashed = false, label }: { mag: number; angle: number; scale: number; color: string; dashed?: boolean; label: string }) {
  if (mag < 1e-9) return null;
  const a = (angle * Math.PI) / 180, ux = Math.cos(a), uy = -Math.sin(a);
  const x2 = CX + ux * mag * scale, y2 = CY + uy * mag * scale;
  return (
    <g>
      <line x1={CX} y1={CY} x2={x2} y2={y2} stroke={color} strokeWidth={4} strokeDasharray={dashed ? '7 5' : undefined} strokeLinecap="round" />
      <path d={`M${x2 + ux * 12},${y2 + uy * 12} L${x2 - uy * 7},${y2 + ux * 7} L${x2 + uy * 7},${y2 - ux * 7} Z`} fill={color} />
      <text x={x2 + ux * 26} y={y2 + uy * 26 + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={v('fg')}>{label}</text>
    </g>
  );
}

/** Free-body diagram builder: add forces on a block, drag their tips, and read off the net force and acceleration. */
export default function ForceDiagram({ mass: m0, forces: f0, gravity: g0 }: Props) {
  const [forces, setForces] = useState<[number, number][]>(f0.length ? f0 : [[10, 0]]);
  const [mass, setMass] = useState(m0);
  const [gravity, setGravity] = useState(g0);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);
  const all: [number, number][] = gravity ? [...forces, [mass * G, 270]] : forces;
  const net = netForce(all);
  const scale = 105 / Math.max(10, ...all.map(([m]) => m), net.magnitude);
  const update = (i: number, mag: number, angle: number) => setForces((f) => f.map((x, k) => (k === i ? [Math.max(0, mag), ((angle % 360) + 360) % 360] : x)));

  const onMove = (e: React.PointerEvent) => {
    if (drag.current === null || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 400 - CX, y = ((e.clientY - r.top) / r.height) * 340 - CY;
    update(drag.current, Math.round((Math.hypot(x, y) / scale) * 2) / 2, Math.round((Math.atan2(-y, x) * 180) / Math.PI / 5) * 5);
  };
  const balanced = net.magnitude < 0.05;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <svg ref={svg} viewBox="0 0 400 340" className="w-full touch-none" role="img" onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}
        aria-label={`Free-body diagram of a ${fmt(mass)} kilogram block with ${all.length} force${all.length === 1 ? '' : 's'}. Net force ${fmt(net.magnitude)} newtons${balanced ? ', balanced' : ` at ${fmt(net.angle, 0)} degrees`}.`}>
        <line x1="20" y1={CY} x2="380" y2={CY} stroke={v('border')} /><line x1={CX} y1="20" x2={CX} y2="320" stroke={v('border')} />
        <rect x={CX - 26} y={CY - 26} width="52" height="52" rx="8" fill={v('surface2')} stroke={v('fg')} strokeWidth="2.5" />
        <text x={CX} y={CY + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill={v('fg')}>{fmt(mass)} kg</text>
        {forces.map(([mag, ang], i) => <Arrow key={i} mag={mag} angle={ang} scale={scale} color={v(COLORS[i % 4])} label={`F${i + 1}`} />)}
        {gravity && <Arrow mag={mass * G} angle={270} scale={scale} color={v('muted')} label="weight" />}
        {!balanced && <Arrow mag={net.magnitude} angle={net.angle} scale={scale} color={v('danger')} dashed label="net" />}
        {forces.map(([mag, ang], i) => {
          const a = (ang * Math.PI) / 180;
          return <circle key={i} cx={CX + Math.cos(a) * mag * scale} cy={CY - Math.sin(a) * mag * scale} r={13} fill="transparent" className="cursor-grab" onPointerDown={(e) => { drag.current = i; (e.target as Element).setPointerCapture?.(e.pointerId); }} />;
        })}
      </svg>
      <div className="space-y-3">
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold">Forces (drag an arrow tip, or type values)</legend>
          {forces.map(([mag, ang], i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-7 font-mono font-bold" style={{ color: v(COLORS[i % 4]) }}>F{i + 1}</span>
              <label className="flex items-center gap-1"><span className="sr-only">F{i + 1} </span>size<input type="number" min={0} step={0.5} value={mag} onChange={(e) => update(i, +e.target.value, ang)} className="input w-20 py-1" /> N</label>
              <label className="flex items-center gap-1"><span className="sr-only">F{i + 1} </span>angle<input type="number" step={5} value={ang} onChange={(e) => update(i, mag, +e.target.value)} className="input w-20 py-1" />&deg;</label>
              <button type="button" className="btn px-2 py-1" onClick={() => setForces(forces.filter((_, k) => k !== i))} aria-label={`Remove force F${i + 1}`} disabled={forces.length === 1 && !gravity}>Remove</button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn" onClick={() => setForces([...forces, [5, 90]])} disabled={forces.length >= 4}>Add a force</button>
            <label className="btn cursor-pointer"><input type="checkbox" checked={gravity} onChange={(e) => setGravity(e.target.checked)} className="accent-[rgb(var(--accent))]" /> Include weight (mg)</label>
          </div>
          <p className="text-xs text-muted">Angles are measured anticlockwise from the positive x direction (pointing right).</p>
        </fieldset>
        <Slider label="Mass" value={mass} min={0.5} max={10} step={0.5} unit="kg" onChange={setMass} />
        <Readout items={[['Sum of Fx', `${fmt(net.fx)} N`], ['Sum of Fy', `${fmt(net.fy)} N`], ['Net force', `${fmt(net.magnitude)} N`], ['Direction', balanced ? 'none' : `${fmt(net.angle, 1)}°`], ['a = F/m', `${fmt(net.magnitude / mass)} m/s²`]]} />
        <p className="text-sm" aria-live="polite">{balanced ? 'The forces balance: the net force is zero, so the velocity does not change.' : 'The forces do not balance, so the block accelerates in the direction of the dashed net-force arrow.'}</p>
      </div>
    </div>
  );
}
