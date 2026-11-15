import { useState } from 'react';
import { kinematics } from './sim/mechanics';
import { fmt, PlayControls, Readout, Slider, usePlay, v } from './ui';

const TMAX = 5, W = 560, PH = 92, L = 46;
const tx = (t: number) => L + (t / TMAX) * (W - L - 10);

function Plot({ top, label, f, t, lo, hi, color }: { top: number; label: string; f(t: number): number; t: number; lo: number; hi: number; color: string }) {
  const y = (val: number) => top + PH - 8 - ((Math.min(hi, Math.max(lo, val)) - lo) / (hi - lo)) * (PH - 16);
  let d = '';
  for (let i = 0; i <= 100; i++) { const q = (TMAX * i) / 100; d += `${i ? 'L' : 'M'}${tx(q).toFixed(1)},${y(f(q)).toFixed(1)}`; }
  return (
    <g>
      <rect x={L} y={top} width={W - L - 10} height={PH} fill="none" stroke={v('border')} />
      {lo < 0 && hi > 0 && <line x1={L} x2={W - 10} y1={y(0)} y2={y(0)} stroke={v('border-strong')} />}
      <text x={L - 6} y={top + 12} textAnchor="end" fontSize="10" fill={v('muted')}>{hi}</text>
      <text x={L - 6} y={top + PH - 2} textAnchor="end" fontSize="10" fill={v('muted')}>{lo}</text>
      <text x={L + 6} y={top + 14} fontSize="12" fontWeight="700" fill={v('fg')}>{label}</text>
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} />
      <line x1={tx(t)} x2={tx(t)} y1={top} y2={top + PH} stroke={v('muted')} strokeDasharray="3 3" />
      <circle cx={tx(t)} cy={y(f(t))} r={5} fill={color} stroke={v('surface')} strokeWidth={1.5} />
    </g>
  );
}

/** Position, velocity and acceleration graphs for constant acceleration, linked to a moving object. */
export default function MotionGraphs(p: { x0: number; v0: number; a: number }) {
  const [x0, setX0] = useState(p.x0), [v0, setV0] = useState(p.v0), [a, setA] = useState(p.a), [t, setT] = useState(0);
  const k = kinematics(x0, v0, a);
  const [playing, setPlaying] = usePlay((dt) => setT((x) => { const n = x + dt; if (n >= TMAX) { setPlaying(false); return TMAX; } return n; }));
  const trackX = (x: number) => L + ((Math.min(60, Math.max(-60, x)) + 60) / 120) * (W - L - 10);
  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} 356`} className="w-full" role="img"
        aria-label={`Motion with starting position ${fmt(x0)} metres, starting velocity ${fmt(v0)} metres per second and acceleration ${fmt(a)} metres per second squared. At ${fmt(t)} seconds: position ${fmt(k.x(t), 1)} metres, velocity ${fmt(k.v(t), 1)} metres per second.`}>
        <line x1={L} x2={W - 10} y1={26} y2={26} stroke={v('fg')} strokeWidth={2} />
        {[-60, -30, 0, 30, 60].map((x) => <g key={x}><line x1={trackX(x)} x2={trackX(x)} y1={21} y2={31} stroke={v('fg')} /><text x={trackX(x)} y={46} textAnchor="middle" fontSize="10" fill={v('muted')}>{x} m</text></g>)}
        <circle cx={trackX(k.x(t))} cy={26} r={9} fill={v('accent')} stroke={v('surface')} strokeWidth={2} />
        {Math.abs(k.v(t)) > 0.05 && <line x1={trackX(k.x(t))} y1={10} x2={trackX(k.x(t)) + k.v(t) * 3} y2={10} stroke={v('physics')} strokeWidth={3} />}
        <Plot top={58} label="position x (m)" f={k.x} t={t} lo={-60} hi={60} color={v('accent')} />
        <Plot top={58 + PH + 6} label="velocity v (m/s)" f={k.v} t={t} lo={-20} hi={20} color={v('physics')} />
        <Plot top={58 + 2 * (PH + 6)} label={'acceleration a (m/s²)'} f={() => a} t={t} lo={-5} hi={5} color={v('danger')} />
        {[0, 1, 2, 3, 4, 5].map((s) => <text key={s} x={tx(s)} y={352} textAnchor="middle" fontSize="10" fill={v('muted')}>{s} s</text>)}
      </svg>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Slider label={'Start position x₀'} value={x0} min={-40} max={40} step={1} unit="m" onChange={setX0} />
        <Slider label={'Start velocity v₀'} value={v0} min={-15} max={15} step={0.5} unit="m/s" onChange={setV0} />
        <Slider label="Acceleration a" value={a} min={-4} max={4} step={0.25} unit={'m/s²'} onChange={setA} />
      </div>
      <PlayControls playing={playing} setPlaying={(x) => { if (x && t >= TMAX) setT(0); setPlaying(x); }} onReset={() => setT(0)}
        extra={<label className="flex flex-1 items-center gap-2 text-sm text-muted">Time<input type="range" min={0} max={TMAX} step={0.01} value={t} onChange={(e) => { setPlaying(false); setT(+e.target.value); }} className="w-full max-w-xs accent-[rgb(var(--accent))]" aria-label="Time" /></label>} />
      <Readout items={[['t', `${fmt(t)} s`], ['x', `${fmt(k.x(t), 1)} m`], ['v', `${fmt(k.v(t), 1)} m/s`]]} />
      <p className="text-sm text-muted">The slope of the position graph is the velocity. The slope of the velocity graph is the acceleration.</p>
    </div>
  );
}
