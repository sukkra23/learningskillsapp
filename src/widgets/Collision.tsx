import { useState } from 'react';
import { collide } from './sim/mechanics';
import { fmt, PlayControls, Readout, Slider, usePlay, v } from './ui';

const SCALE = 40; // pixels per metre
const size = (m: number) => 26 + 9 * Math.sqrt(m);
const START = { x1: 110, x2: 330 };

export default function Collision(p: { m1: number; m2: number; v1: number; v2: number; elasticity: number }) {
  const [m1, setM1] = useState(p.m1), [m2, setM2] = useState(p.m2), [v1, setV1] = useState(p.v1), [v2, setV2] = useState(p.v2), [e, setE] = useState(p.elasticity);
  const [s, setS] = useState({ ...START, u1: p.v1, u2: p.v2, hit: false });
  const out = collide(m1, v1, m2, v2, e);
  const willHit = v1 > v2;
  const w1 = size(m1), w2 = size(m2);
  const reset = (nv1 = v1, nv2 = v2) => setS({ ...START, u1: nv1, u2: nv2, hit: false });
  const [playing, setPlaying] = usePlay((dt) => setS((q) => {
    let { x1, x2, u1, u2, hit } = q;
    x1 += u1 * SCALE * dt; x2 += u2 * SCALE * dt;
    if (!hit && x1 + w1 / 2 >= x2 - w2 / 2) { hit = true; u1 = out.u1; u2 = out.u2; x1 = x2 - w2 / 2 - w1 / 2; }
    if (x1 < -60 || x2 > 620 || x1 > 620 || x2 < -60) setPlaying(false);
    return { x1, x2, u1, u2, hit };
  }));
  const ch = (f: (x: number) => void, which?: 1 | 2) => (x: number) => { f(x); setPlaying(false); reset(which === 1 ? x : v1, which === 2 ? x : v2); };
  const block = (x: number, w: number, m: number, u: number, color: string, name: string) => (
    <g>
      <rect x={x - w / 2} y={110 - w} width={w} height={w} rx={6} fill={color} />
      <text x={x} y={110 - w / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={v('surface')}>{name}</text>
      <text x={x} y={132} textAnchor="middle" fontSize="11" fill={v('muted')}>{fmt(m)} kg</text>
      {Math.abs(u) > 0.01 && <><line x1={x} y1={100 - w - 8} x2={x + u * 16} y2={100 - w - 8} stroke={v('fg')} strokeWidth={3} /><text x={x + u * 16 + (u > 0 ? 6 : -6)} y={100 - w - 4} textAnchor={u > 0 ? 'start' : 'end'} fontSize="11" fill={v('fg')}>{fmt(u)} m/s</text></>}
    </g>
  );
  const lost = out.keBefore - out.keAfter;
  return (
    <div className="space-y-3">
      <svg viewBox="0 0 560 145" className="w-full" role="img"
        aria-label={`Block A, ${fmt(m1)} kilograms at ${fmt(v1)} metres per second, and block B, ${fmt(m2)} kilograms at ${fmt(v2)} metres per second. ${willHit ? `After colliding: A moves at ${fmt(out.u1)} and B at ${fmt(out.u2)} metres per second.` : 'They never collide.'}`}>
        <line x1="0" y1="110" x2="560" y2="110" stroke={v('fg')} strokeWidth="2" />
        {block(s.x1, w1, m1, s.u1, v('cs'), 'A')}{block(s.x2, w2, m2, s.u2, v('engineering'), 'B')}
      </svg>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Slider label="Mass of A" value={m1} min={0.5} max={5} step={0.5} unit="kg" onChange={ch(setM1)} />
        <Slider label="Velocity of A" value={v1} min={-3} max={5} step={0.5} unit="m/s" onChange={ch(setV1, 1)} />
        <Slider label="Mass of B" value={m2} min={0.5} max={5} step={0.5} unit="kg" onChange={ch(setM2)} />
        <Slider label="Velocity of B" value={v2} min={-5} max={3} step={0.5} unit="m/s" onChange={ch(setV2, 2)} />
        <Slider label="Bounciness e (1 elastic, 0 they stick)" value={e} min={0} max={1} step={0.05} onChange={ch(setE)} />
      </div>
      <PlayControls playing={playing} setPlaying={setPlaying} onReset={() => reset()} />
      {!willHit && <p className="text-sm text-muted">A is not catching up with B, so there is no collision. Make A faster than B.</p>}
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Momentum and kinetic energy before and after the collision</caption>
        <thead><tr className="text-left text-muted"><td /><th scope="col" className="px-2 py-1 font-medium">Before</th><th scope="col" className="px-2 py-1 font-medium">After</th></tr></thead>
        <tbody className="font-mono">
          <tr><th scope="row" className="px-2 py-1 text-left font-sans font-normal">Velocity of A</th><td className="px-2">{fmt(v1)} m/s</td><td className="px-2">{willHit ? fmt(out.u1) : fmt(v1)} m/s</td></tr>
          <tr><th scope="row" className="px-2 py-1 text-left font-sans font-normal">Velocity of B</th><td className="px-2">{fmt(v2)} m/s</td><td className="px-2">{willHit ? fmt(out.u2) : fmt(v2)} m/s</td></tr>
          <tr className="bg-accent-soft"><th scope="row" className="px-2 py-1 text-left font-sans font-semibold">Total momentum</th><td className="px-2">{fmt(out.pBefore)} kg m/s</td><td className="px-2">{fmt(out.pAfter)} kg m/s</td></tr>
          <tr><th scope="row" className="px-2 py-1 text-left font-sans font-normal">Total kinetic energy</th><td className="px-2">{fmt(out.keBefore)} J</td><td className="px-2">{fmt(willHit ? out.keAfter : out.keBefore)} J</td></tr>
        </tbody>
      </table>
      <Readout items={[['Kinetic energy lost', willHit ? `${fmt(lost)} J` : '0 J'], ['Fraction lost', willHit && out.keBefore > 0 ? `${fmt((100 * lost) / out.keBefore, 0)}%` : '0%']]} />
    </div>
  );
}
