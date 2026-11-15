import { useState } from 'react';
import { projectile } from './sim/mechanics';
import { fmt, PlayControls, Readout, Slider, usePlay, v } from './ui';

const W = 580, H = 300, PAD = 34, XMAX = 100, YMAX = 50;
const X = (x: number) => PAD + (x / XMAX) * (W - PAD - 28), Y = (y: number) => H - PAD - (y / YMAX) * (H - PAD - 10);

export default function Projectile(p: { speed: number; angle: number; height: number; g: number }) {
  const [speed, setSpeed] = useState(p.speed), [angle, setAngle] = useState(p.angle), [height, setHeight] = useState(p.height), [g, setG] = useState(p.g);
  const [t, setT] = useState(0);
  const sim = projectile(speed, angle, height, g);
  const [playing, setPlaying] = usePlay((dt) => setT((x) => { const n = x + dt; if (n >= sim.tFlight) { setPlaying(false); return sim.tFlight; } return n; }));
  const reset = () => setT(0);
  const change = (f: (x: number) => void) => (x: number) => { f(x); setT(0); setPlaying(false); };
  const now = sim.at(Math.min(t, sim.tFlight));
  const vy = sim.vy - g * t;
  let d = '';
  for (let i = 0; i <= 80; i++) { const q = sim.at((sim.tFlight * i) / 80); d += `${i ? 'L' : 'M'}${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`; }
  const s = 2.2; // velocity arrow scale, px per m/s

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`Projectile launched at ${fmt(speed)} metres per second, ${fmt(angle)} degrees, from ${fmt(height)} metres. Range ${fmt(sim.range, 1)} metres, maximum height ${fmt(sim.maxHeight, 1)} metres, time of flight ${fmt(sim.tFlight)} seconds.`}>
        <clipPath id="pj-clip"><rect x={PAD} y={0} width={W - PAD} height={H - PAD} /></clipPath>
        {[0, 20, 40, 60, 80, 100].map((x) => <g key={x}><line x1={X(x)} x2={X(x)} y1={Y(0)} y2={Y(YMAX)} stroke={v('border')} /><text x={X(x)} y={H - 14} textAnchor="middle" fontSize="11" fill={v('muted')}>{x} m</text></g>)}
        {[10, 20, 30, 40, 50].map((y) => <g key={y}><line x1={X(0)} x2={X(XMAX)} y1={Y(y)} y2={Y(y)} stroke={v('border')} /><text x={PAD - 5} y={Y(y) + 4} textAnchor="end" fontSize="11" fill={v('muted')}>{y}</text></g>)}
        <line x1={X(0)} x2={X(XMAX)} y1={Y(0)} y2={Y(0)} stroke={v('fg')} strokeWidth={2} />
        {height > 0 && <rect x={X(0) - 12} y={Y(height)} width={12} height={Y(0) - Y(height)} fill={v('surface2')} stroke={v('border-strong')} />}
        <g clipPath="url(#pj-clip)">
          <path d={d} fill="none" stroke={v('accent')} strokeWidth={2} strokeDasharray="5 5" />
          <line x1={X(now.x)} y1={Y(now.y)} x2={X(now.x) + sim.vx * s} y2={Y(now.y)} stroke={v('physics')} strokeWidth={3} />
          <line x1={X(now.x)} y1={Y(now.y)} x2={X(now.x)} y2={Y(now.y) - vy * s} stroke={v('danger')} strokeWidth={3} />
          <circle cx={X(now.x)} cy={Y(now.y)} r={8} fill={v('accent')} stroke={v('surface')} strokeWidth={2} />
        </g>
      </svg>
      <p className="text-xs text-muted">Arrows on the ball: <span className="font-semibold" style={{ color: v('physics') }}>horizontal velocity</span> (never changes) and <span className="font-semibold" style={{ color: v('danger') }}>vertical velocity</span> (changes by g every second).</p>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Slider label="Launch speed" value={speed} min={5} max={30} step={0.5} unit="m/s" onChange={change(setSpeed)} />
        <Slider label="Launch angle" value={angle} min={0} max={90} step={1} unit={'°'} onChange={change(setAngle)} />
        <Slider label="Launch height" value={height} min={0} max={30} step={1} unit="m" onChange={change(setHeight)} />
        <Slider label="Gravity g" value={g} min={1.6} max={25} step={0.1} unit={'m/s²'} onChange={change(setG)} />
      </div>
      <PlayControls playing={playing} setPlaying={(x) => { if (x && t >= sim.tFlight) setT(0); setPlaying(x); }} onReset={reset}
        extra={<label className="flex flex-1 items-center gap-2 text-sm text-muted">Time<input type="range" min={0} max={sim.tFlight} step={0.01} value={t} onChange={(e) => { setPlaying(false); setT(+e.target.value); }} className="w-full max-w-xs accent-[rgb(var(--accent))]" aria-label="Time" /></label>} />
      <Readout items={[['t', `${fmt(t)} s`], ['x', `${fmt(now.x, 1)} m`], ['y', `${fmt(Math.max(0, now.y), 1)} m`], ['vₓ', `${fmt(sim.vx, 1)} m/s`], ['vᵧ', `${fmt(vy, 1)} m/s`], ['Time of flight', `${fmt(sim.tFlight)} s`], ['Range', `${fmt(sim.range, 1)} m`], ['Max height', `${fmt(sim.maxHeight, 1)} m`]]} />
    </div>
  );
}
