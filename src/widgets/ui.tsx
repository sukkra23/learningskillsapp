import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

export const v = (name: string) => `rgb(var(--${name}))`;
/** Resolved colour for canvas drawing, which cannot use CSS variables directly. */
export const cssColor = (name: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim().split(/\s+/).join(',')})`;
export const fmt = (x: number, digits = 2) => (Number.isFinite(x) ? (Math.abs(x) < 5e-10 ? 0 : x).toFixed(digits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : 'n/a');

export function Slider({ label, value, min, max, step, onChange, unit = '', digits = 2 }: {
  label: ReactNode; value: number; min: number; max: number; step: number; onChange(v: number): void; unit?: string; digits?: number;
}) {
  const id = useId();
  return (
    <div className="flex min-w-[11rem] flex-1 flex-col gap-0.5">
      <label htmlFor={id} className="flex justify-between gap-2 text-sm"><span>{label}</span><span className="font-mono tabular-nums">{fmt(value, digits)}{unit && ` ${unit}`}</span></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[rgb(var(--accent))]" />
    </div>
  );
}

export function Readout({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-x-3 gap-y-1 text-sm" aria-live="off">
      {items.map(([k, val]) => <div key={k} className="flex justify-between gap-2 rounded-lg bg-surface2 px-2.5 py-1"><dt className="text-muted">{k}</dt><dd className="font-mono tabular-nums">{val}</dd></div>)}
    </dl>
  );
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange(v: boolean): void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 font-mono text-sm font-semibold ${on ? 'border-accent bg-accent text-accent-fg' : 'border-strong bg-surface text-fg'}`}>
      {label} = {on ? 1 : 0}
    </button>
  );
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Animation loop. `tick` receives elapsed seconds (capped, so a background tab
 * does not produce a huge jump). Nothing plays until the learner presses play.
 */
export function usePlay(tick: (dt: number) => void): [boolean, (p: boolean) => void] {
  const [playing, setPlaying] = useState(false);
  const fn = useRef(tick);
  fn.current = tick;
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => { fn.current(Math.min(0.05, (now - last) / 1000)); last = now; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return [playing, useCallback((p: boolean) => setPlaying(p), [])];
}

export function PlayControls({ playing, setPlaying, onReset, extra }: { playing: boolean; setPlaying(p: boolean): void; onReset(): void; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-primary" onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
      <button type="button" className="btn" onClick={() => { setPlaying(false); onReset(); }}>Reset</button>
      {extra}
    </div>
  );
}
