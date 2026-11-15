import { scaleLinear } from 'd3-scale';
import { compile } from 'mathjs';
import { useMemo, useState } from 'react';
import { fmt, Readout, Slider, v } from './ui';

interface Param { name: string; label?: string; min: number; max: number; step: number; value: number }
interface Props { expr: string; compare?: string; params: Param[]; xRange: [number, number]; yRange: [number, number]; mode: 'plot' | 'tangent' | 'secant'; caption?: string }

const W = 560, H = 340, M = { l: 38, r: 12, t: 12, b: 26 };

export default function FunctionPlot({ expr, compare, params, xRange, yRange, mode, caption }: Props) {
  const [vals, setVals] = useState(() => Object.fromEntries(params.map((p) => [p.name, p.value])));
  const [x0, setX0] = useState(() => +(xRange[0] + (xRange[1] - xRange[0]) * 0.65).toFixed(2));
  const [h, setH] = useState(1);
  const x = useMemo(() => scaleLinear().domain(xRange).range([M.l, W - M.r]), [xRange]);
  const y = useMemo(() => scaleLinear().domain(yRange).range([H - M.b, M.t]), [yRange]);

  const fns = useMemo(() => [expr, compare].filter((e): e is string => !!e).map((e) => {
    const c = compile(e);
    return (t: number) => { try { const r = c.evaluate({ ...vals, x: t }); return typeof r === 'number' ? r : NaN; } catch { return NaN; } };
  }), [expr, compare, vals]);
  const f = fns[0];

  const paths = useMemo(() => fns.map((fn) => {
    let d = '', pen = false;
    const span = yRange[1] - yRange[0];
    for (let i = 0; i <= 400; i++) {
      const t = xRange[0] + ((xRange[1] - xRange[0]) * i) / 400, val = fn(t);
      if (!Number.isFinite(val) || val > yRange[1] + span || val < yRange[0] - span) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(t).toFixed(1)},${y(val).toFixed(1)}`;
      pen = true;
    }
    return d;
  }), [fns, x, y, xRange, yRange]);

  const slope = (f(x0 + 1e-5) - f(x0 - 1e-5)) / 2e-5;
  const y0 = f(x0), y1 = f(x0 + h), secant = (y1 - y0) / h;
  const m = mode === 'secant' ? secant : slope;
  const line = (px: number, py: number, k: number) => `M${x(xRange[0])},${y(py + k * (xRange[0] - px))} L${x(xRange[1])},${y(py + k * (xRange[1] - px))}`;
  const summary = `Graph of y = ${expr}${params.length ? ` with ${params.map((p) => `${p.name} = ${fmt(vals[p.name])}`).join(', ')}` : ''}.` +
    (mode === 'tangent' ? ` Tangent at x = ${fmt(x0)} has slope ${fmt(slope, 3)}.` : mode === 'secant' ? ` Secant from x = ${fmt(x0)} to ${fmt(x0 + h)} has slope ${fmt(secant, 3)}.` : '');

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={summary}>
        <clipPath id="fp-clip"><rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} /></clipPath>
        {x.ticks(10).map((t) => <g key={`x${t}`}><line x1={x(t)} x2={x(t)} y1={M.t} y2={H - M.b} stroke={v('border')} strokeWidth={t === 0 ? 0 : 1} /><text x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill={v('muted')}>{t}</text></g>)}
        {y.ticks(8).map((t) => <g key={`y${t}`}><line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke={v('border')} strokeWidth={t === 0 ? 0 : 1} /><text x={M.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={v('muted')}>{t}</text></g>)}
        {yRange[0] <= 0 && yRange[1] >= 0 && <line x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} stroke={v('border-strong')} strokeWidth={1.5} />}
        {xRange[0] <= 0 && xRange[1] >= 0 && <line x1={x(0)} x2={x(0)} y1={M.t} y2={H - M.b} stroke={v('border-strong')} strokeWidth={1.5} />}
        <g clipPath="url(#fp-clip)">
          {paths[1] && <path d={paths[1]} fill="none" stroke={v('muted')} strokeWidth={2} strokeDasharray="6 5" />}
          <path d={paths[0]} fill="none" stroke={v('accent')} strokeWidth={3} strokeLinejoin="round" />
          {mode !== 'plot' && Number.isFinite(y0) && Number.isFinite(m) && <path d={line(x0, y0, m)} stroke={v('danger')} strokeWidth={2} />}
          {mode !== 'plot' && Number.isFinite(y0) && <circle cx={x(x0)} cy={y(y0)} r={6} fill={v('danger')} stroke={v('surface')} strokeWidth={2} />}
          {mode === 'secant' && Number.isFinite(y1) && <circle cx={x(x0 + h)} cy={y(y1)} r={6} fill={v('surface')} stroke={v('danger')} strokeWidth={3} />}
        </g>
      </svg>
      {caption && <p className="text-sm text-muted">{caption}</p>}
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {params.map((p) => <Slider key={p.name} label={p.label ?? p.name} value={vals[p.name]} min={p.min} max={p.max} step={p.step} onChange={(val) => setVals({ ...vals, [p.name]: val })} />)}
        {mode !== 'plot' && <Slider label="Point x" value={x0} min={xRange[0]} max={xRange[1]} step={0.05} onChange={setX0} />}
        {mode === 'secant' && <Slider label="Gap h" value={h} min={0.01} max={2} step={0.01} onChange={setH} />}
      </div>
      {mode === 'tangent' && <Readout items={[['x', fmt(x0)], ['f(x)', fmt(y0, 3)], ['Slope of tangent', fmt(slope, 3)]]} />}
      {mode === 'secant' && <Readout items={[['Rise', fmt(y1 - y0, 4)], ['Run h', fmt(h)], ['Secant slope', fmt(secant, 4)], ['Tangent slope', fmt(slope, 4)], ['Difference', fmt(Math.abs(secant - slope), 4)]]} />}
    </div>
  );
}
