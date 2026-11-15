import { useState } from 'react';
import { rk4 } from './sim/mechanics';
import { fmt, PlayControls, Slider, usePlay, v } from './ui';

const G = 9.8, K = 0.2, XMAX = 6; // track: y = K x^2 (metres)
const X = (x: number) => 190 + x * 28, Y = (y: number) => 250 - y * 28;

/** A ball sliding in a bowl: potential and kinetic energy trade places; friction turns both into heat. */
export default function EnergyRamp(p: { height: number; mass: number }) {
  const [h0, setH0] = useState(p.height), [mass, setMass] = useState(p.mass), [mu, setMu] = useState(0);
  const start = (h: number): [number, number] => [-Math.sqrt(h / K), 0];
  const [s, setS] = useState<[number, number]>(() => start(p.height));
  const deriv = ([x, vx]: [number, number]): [number, number] => [vx, (-4 * K * K * x * vx * vx - 2 * G * K * x) / (1 + 4 * K * K * x * x) - mu * vx];
  const [playing, setPlaying] = usePlay((dt) => setS((q) => { let n = q; for (let i = 0; i < 4; i++) n = rk4(n, deriv, dt / 4); return n; }));
  const [x, vx] = s, y = K * x * x, speed2 = vx * vx * (1 + 4 * K * K * x * x);
  const pe = mass * G * y, ke = 0.5 * mass * speed2, total = mass * G * h0, heat = Math.max(0, total - pe - ke);
  let d = '';
  for (let i = 0; i <= 60; i++) { const q = -XMAX + (2 * XMAX * i) / 60; d += `${i ? 'L' : 'M'}${X(q).toFixed(1)},${Y(K * q * q).toFixed(1)}`; }
  const bars: [string, number, string][] = [['Potential', pe, v('cs')], ['Kinetic', ke, v('physics')], ['Heat', heat, v('engineering')]];
  const top = Math.max(total, 1);
  return (
    <div className="space-y-3">
      <svg viewBox="0 0 560 280" className="w-full" role="img"
        aria-label={`Ball of ${fmt(mass)} kilograms in a bowl, released from ${fmt(h0)} metres. Now at height ${fmt(y)} metres moving at ${fmt(Math.sqrt(speed2))} metres per second. Potential energy ${fmt(pe, 1)} joules, kinetic energy ${fmt(ke, 1)} joules, heat ${fmt(heat, 1)} joules.`}>
        <path d={d} fill="none" stroke={v('fg')} strokeWidth={3} />
        <line x1={X(-XMAX)} x2={X(XMAX)} y1={Y(h0)} y2={Y(h0)} stroke={v('muted')} strokeDasharray="4 5" />
        <text x={X(XMAX)} y={Y(h0) - 5} textAnchor="end" fontSize="11" fill={v('muted')}>release height {fmt(h0)} m</text>
        <circle cx={X(x)} cy={Y(y) - 9} r={9} fill={v('accent')} stroke={v('surface')} strokeWidth={2} />
        {bars.map(([name, val, color], i) => {
          const bh = (val / top) * 170;
          return <g key={name}><rect x={410 + i * 48} y={230 - bh} width={34} height={bh} fill={color} rx={3} /><text x={427 + i * 48} y={246} textAnchor="middle" fontSize="10.5" fill={v('fg')}>{name}</text><text x={427 + i * 48} y={224 - bh} textAnchor="middle" fontSize="10.5" fill={v('fg')}>{fmt(val, 1)} J</text></g>;
        })}
        <line x1={404} x2={556} y1={230 - 170 * (total / top)} y2={230 - 170 * (total / top)} stroke={v('fg')} strokeDasharray="4 4" />
        <text x={556} y={224 - 170 * (total / top) - 12} textAnchor="end" fontSize="10.5" fill={v('muted')}>total {fmt(total, 1)} J</text>
      </svg>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Slider label="Release height" value={h0} min={1} max={7} step={0.5} unit="m" onChange={(x2) => { setH0(x2); setPlaying(false); setS(start(x2)); }} />
        <Slider label="Mass" value={mass} min={0.5} max={5} step={0.5} unit="kg" onChange={setMass} />
        <Slider label="Friction" value={mu} min={0} max={0.6} step={0.05} onChange={setMu} />
      </div>
      <PlayControls playing={playing} setPlaying={setPlaying} onReset={() => setS(start(h0))} />
      <p className="text-sm text-muted">{mu === 0 ? 'With no friction, potential plus kinetic energy stays equal to the total at every instant.' : 'With friction, mechanical energy drains into heat, but the three bars still add up to the total.'}</p>
    </div>
  );
}
