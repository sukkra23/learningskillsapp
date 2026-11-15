import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../app/theme';
import { boxEnergy, boxPsi, doublePendulumDeriv, doublePendulumEnergy, orbitEnergy, orbitStep, rk4, type Vec4 } from './sim/mechanics';
import { cssColor, fmt, PlayControls, Readout, Slider, usePlay, v } from './ui';

function useCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useTheme((s) => s.resolved);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    draw(ctx, c.width, c.height);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, theme]);
  return ref;
}

/** Double pendulum with an optional twin started 0.001 rad away, to show sensitive dependence. */
export function DoublePendulum() {
  const [a1, setA1] = useState(120), [a2, setA2] = useState(-20), [twin, setTwin] = useState(true);
  const init = (d = 0): Vec4 => [((a1 * Math.PI) / 180) + d, 0, (a2 * Math.PI) / 180, 0];
  const [s, setS] = useState<Vec4>(() => init());
  const [s2, setS2] = useState<Vec4>(() => init(0.001));
  const trail = useRef<[number, number][]>([]), trail2 = useRef<[number, number][]>([]);
  const [time, setTime] = useState(0);
  const e0 = useRef(doublePendulumEnergy(init()));
  const adv = (q: Vec4, dt: number) => { let n = q; for (let i = 0; i < 8; i++) n = rk4(n, (x) => doublePendulumDeriv(x), dt / 8); return n; };
  const [playing, setPlaying] = usePlay((dt) => { setS((q) => adv(q, dt)); setS2((q) => adv(q, dt)); setTime((t) => t + dt); });
  const reset = () => { setS(init()); setS2(init(0.001)); trail.current = []; trail2.current = []; setTime(0); e0.current = doublePendulumEnergy(init()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPlaying(false); reset(); }, [a1, a2]);
  const pts = (q: Vec4, L: number, cx: number, cy: number) => {
    const x1 = cx + L * Math.sin(q[0]), y1 = cy + L * Math.cos(q[0]);
    return [x1, y1, x1 + L * Math.sin(q[2]), y1 + L * Math.cos(q[2])];
  };
  const ref = useCanvas((ctx, w, h) => {
    const L = w * 0.22, cx = w / 2, cy = h * 0.42;
    ctx.clearRect(0, 0, w, h);
    const drawOne = (q: Vec4, tr: [number, number][], color: string, faint: boolean) => {
      const [x1, y1, x2, y2] = pts(q, L, cx, cy);
      tr.push([x2, y2]); if (tr.length > 400) tr.shift();
      ctx.globalAlpha = faint ? 0.5 : 1;
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
      tr.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.strokeStyle = cssColor('fg'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.fillStyle = color; for (const [x, y] of [[x1, y1], [x2, y2]]) { ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    };
    if (twin) drawOne(s2, trail2.current, cssColor('engineering'), true);
    drawOne(s, trail.current, cssColor('accent'), false);
    ctx.fillStyle = cssColor('fg'); ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
  }, [s, s2, twin]);
  const gap = Math.abs(s[2] - s2[2]);
  return (
    <div className="space-y-3">
      <canvas ref={ref} width={520} height={400} className="w-full rounded-xl bg-surface2" role="img"
        aria-label={`Double pendulum after ${fmt(time, 1)} seconds.${twin ? ` A twin that started one thousandth of a radian away now differs by ${fmt(gap, 3)} radians.` : ''}`} />
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Slider label="Upper arm start angle" value={a1} min={-170} max={170} step={5} unit={'°'} onChange={setA1} />
        <Slider label="Lower arm start angle" value={a2} min={-170} max={170} step={5} unit={'°'} onChange={setA2} />
      </div>
      <PlayControls playing={playing} setPlaying={setPlaying} onReset={reset}
        extra={<label className="btn cursor-pointer"><input type="checkbox" checked={twin} onChange={(e) => setTwin(e.target.checked)} className="accent-[rgb(var(--accent))]" /> Show a twin started 0.001 rad apart</label>} />
      <Readout items={[['Time', `${fmt(time, 1)} s`], ['Gap between twins', `${fmt(gap, 3)} rad`], ['Energy drift', `${fmt(Math.abs(doublePendulumEnergy(s) - e0.current), 5)} J`]]} />
      <p className="text-sm text-muted">The equations are exact and deterministic, yet two starts that differ by 0.001 rad soon move completely differently. Small start angles stay regular; large ones are chaotic.</p>
    </div>
  );
}

/** A planet around a fixed star. Speed is in units of the circular-orbit speed at the starting distance. */
export function OrbitSim() {
  const [speed, setSpeed] = useState(1.2);
  const init = () => ({ x: 1, y: 0, vx: 0, vy: speed });
  const [s, setS] = useState(init);
  const [time, setTime] = useState(0);
  const trail = useRef<[number, number][]>([]);
  const [playing, setPlaying] = usePlay((dt) => { setS((q) => { let n = q; for (let i = 0; i < 20; i++) n = orbitStep(n, 1, (dt * 1.5) / 20); return n; }); setTime((t) => t + dt * 1.5); });
  const reset = () => { setS(init()); trail.current = []; setTime(0); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPlaying(false); reset(); }, [speed]);
  const E = 0.5 * speed * speed - 1, bound = E < 0, a = bound ? -1 / (2 * E) : Infinity, period = bound ? 2 * Math.PI * a ** 1.5 : Infinity;
  const ref = useCanvas((ctx, w, h) => {
    const sc = bound ? Math.min(90, (w * 0.42) / Math.max(1, 2 * a - 1)) : 40, cx = w / 2 + (bound ? ((2 * a - 2) * sc) / 2 : 0), cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    trail.current.push([s.x, s.y]); if (trail.current.length > 3000) trail.current.shift();
    ctx.strokeStyle = cssColor('accent'); ctx.lineWidth = 1.5; ctx.beginPath();
    trail.current.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * sc, cy - y * sc) : ctx.moveTo(cx + x * sc, cy - y * sc))); ctx.stroke();
    ctx.fillStyle = cssColor('warn'); ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 7); ctx.fill();
    ctx.fillStyle = cssColor('accent'); ctx.beginPath(); ctx.arc(cx + s.x * sc, cy - s.y * sc, 6, 0, 7); ctx.fill();
  }, [s]);
  const shape = Math.abs(speed - 1) < 0.005 ? 'circle' : speed < Math.SQRT2 - 0.005 ? 'ellipse' : Math.abs(speed - Math.SQRT2) < 0.005 ? 'parabola (just escapes)' : 'hyperbola (escapes)';
  return (
    <div className="space-y-3">
      <canvas ref={ref} width={520} height={360} className="w-full rounded-xl bg-surface2" role="img" aria-label={`Orbit simulation. Launch speed ${fmt(speed)} times the circular speed gives a ${shape}.`} />
      <Slider label="Launch speed (1 = circular orbit speed)" value={speed} min={0.5} max={1.6} step={0.01} onChange={setSpeed} />
      <PlayControls playing={playing} setPlaying={setPlaying} onReset={reset} />
      <Readout items={[['Orbit shape', shape], ['Energy per kg', fmt(E, 3)], ['Period', bound ? fmt(period, 2) : 'never returns'], ['Distance now', fmt(Math.hypot(s.x, s.y), 3)], ['Speed now', fmt(Math.hypot(s.vx, s.vy), 3)], ['Energy drift', fmt(Math.abs(orbitEnergy(s, 1) - E), 6)]]} />
      <p className="text-sm text-muted">Units are chosen so that GM = 1 and the starting distance is 1. Below escape speed (1.414) the energy is negative and the orbit closes; at or above it the planet never comes back. Elapsed time: {fmt(time, 1)}.</p>
    </div>
  );
}

/** Two point sources of circular waves. Brightness shows displacement; nodal lines are where the waves cancel. */
export function WaveInterference() {
  const [lambda, setLambda] = useState(24), [sep, setSep] = useState(72), [phase, setPhase] = useState(0);
  const [playing, setPlaying] = usePlay((dt) => setPhase((p) => (p + dt * 5) % (2 * Math.PI)));
  const ref = useCanvas((ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const hi = cssColor('accent').match(/\d+/g)!.map(Number), lo = cssColor('surface').match(/\d+/g)!.map(Number);
    const k = (2 * Math.PI) / lambda, y1 = h / 2 - sep / 2, y2 = h / 2 + sep / 2, sx = 30;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r1 = Math.hypot(x - sx, y - y1), r2 = Math.hypot(x - sx, y - y2);
      const amp = (Math.sin(k * r1 - phase) + Math.sin(k * r2 - phase)) / 2; // -1..1
      const t = (amp + 1) / 2, i = (y * w + x) * 4;
      img.data[i] = lo[0] + (hi[0] - lo[0]) * t; img.data[i + 1] = lo[1] + (hi[1] - lo[1]) * t; img.data[i + 2] = lo[2] + (hi[2] - lo[2]) * t; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = cssColor('danger'); for (const y of [y1, y2]) { ctx.beginPath(); ctx.arc(sx, y, 4, 0, 7); ctx.fill(); }
  }, [lambda, sep, phase]);
  const nodal = 2 * Math.floor(sep / lambda + 0.5);
  return (
    <div className="space-y-3">
      <canvas ref={ref} width={300} height={200} className="w-full rounded-xl" style={{ imageRendering: 'auto' }} role="img"
        aria-label={`Interference pattern from two sources ${fmt(sep / lambda)} wavelengths apart, giving ${nodal} nodal lines where the waves cancel.`} />
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Slider label="Wavelength" value={lambda} min={10} max={50} step={1} onChange={setLambda} />
        <Slider label="Source separation" value={sep} min={0} max={150} step={2} onChange={setSep} />
      </div>
      <PlayControls playing={playing} setPlaying={setPlaying} onReset={() => setPhase(0)} />
      <Readout items={[['Separation / wavelength', fmt(sep / lambda)], ['Nodal lines', String(nodal)]]} />
      <p className="text-sm text-muted">Where the two path lengths differ by a whole number of wavelengths the waves add; where they differ by half a wavelength they cancel, leaving the still, flat bands.</p>
    </div>
  );
}

/** Stationary states of a particle in an infinite square well, and a 1+2 superposition that sloshes. */
export function ParticleInBox() {
  const [n, setN] = useState(1), [mix, setMix] = useState(false), [t, setT] = useState(0);
  const [playing, setPlaying] = usePlay((dt) => setT((x) => x + dt));
  const W = 560, H = 300, L = 40, R = 400, X = (x: number) => L + x * (R - L);
  const prob = (x: number) => (mix ? 0.5 * (boxPsi(1, x) ** 2 + boxPsi(2, x) ** 2 + 2 * boxPsi(1, x) * boxPsi(2, x) * Math.cos(3 * t * 2)) : boxPsi(n, x) ** 2);
  const path = (f: (x: number) => number, y0: number, sc: number) => { let d = ''; for (let i = 0; i <= 120; i++) { const x = i / 120; d += `${i ? 'L' : 'M'}${X(x).toFixed(1)},${(y0 - f(x) * sc).toFixed(1)}`; } return d; };
  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={mix ? 'Equal mix of states 1 and 2: the probability density sloshes from side to side.' : `State n = ${n}: the wavefunction has ${n - 1} interior node${n === 2 ? '' : 's'} and energy ${boxEnergy(n)} times the ground-state energy.`}>
        <line x1={L} x2={L} y1={10} y2={H - 20} stroke={v('fg')} strokeWidth={4} /><line x1={R} x2={R} y1={10} y2={H - 20} stroke={v('fg')} strokeWidth={4} />
        <line x1={L} x2={R} y1={95} y2={95} stroke={v('border-strong')} /><line x1={L} x2={R} y1={H - 20} y2={H - 20} stroke={v('border-strong')} />
        {!mix && <path d={path((x) => boxPsi(n, x), 95, 45)} fill="none" stroke={v('accent')} strokeWidth={3} />}
        <path d={`${path(prob, H - 20, 42)} L${R},${H - 20} L${L},${H - 20} Z`} fill={v('accent-soft')} stroke={v('physics')} strokeWidth={2.5} />
        <text x={L + 8} y={24} fontSize="12" fontWeight="700" fill={v('fg')}>{mix ? '' : 'wavefunction ψ(x)'}</text>
        <text x={L + 8} y={170} fontSize="12" fontWeight="700" fill={v('fg')}>probability density |{'ψ'}|{'²'}</text>
        <text x={470} y={20} textAnchor="middle" fontSize="12" fontWeight="700" fill={v('fg')}>Energy levels</text>
        {[1, 2, 3, 4, 5, 6].map((k) => {
          const y = H - 22 - (boxEnergy(k) / 36) * (H - 60), on = mix ? k <= 2 : k === n;
          return <g key={k}><line x1={430} x2={510} y1={y} y2={y} stroke={on ? v('accent') : v('border-strong')} strokeWidth={on ? 4 : 2} /><text x={516} y={y + 4} fontSize="11" fill={v('fg')}>{k * k} E{'₁'}</text><text x={424} y={y + 4} textAnchor="end" fontSize="11" fill={v('muted')}>n={k}</text></g>;
        })}
      </svg>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Slider label="Quantum number n" value={n} min={1} max={6} step={1} onChange={(x) => { setN(x); setMix(false); }} />
        <label className="btn cursor-pointer"><input type="checkbox" checked={mix} onChange={(e) => setMix(e.target.checked)} className="accent-[rgb(var(--accent))]" /> Mix states 1 and 2</label>
        {mix && <button type="button" className="btn btn-primary" onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>}
      </div>
      <Readout items={mix ? [['States', '1 and 2, equal parts'], ['Energy gap', '3 E₁']] : [['Energy', `${boxEnergy(n)} E₁`], ['Interior nodes', String(n - 1)], ['Wavelength', `${fmt(2 / n)} L`]]} />
      <p className="text-sm text-muted">{mix ? 'A single energy state has a probability density that never changes. A mix of two does: it oscillates at a rate set by the energy gap.' : 'Only wavelengths that fit a whole number of half-waves into the box are allowed, which is why the energy comes in steps: E = n² E₁.'}</p>
    </div>
  );
}
