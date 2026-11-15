import { useState } from 'react';
import type { TraceFrame } from '../content/schema';

const ROW = 26, FRAME_HEAD = 24, BOX_W = 210, GAP = 90, PAD = 8;
const KIND_NOTE: Record<string, string> = { pointer: 'pointer', borrow: 'borrow', moved: 'moved', owner: 'owns', value: '' };

/**
 * Step-through view of a pre-recorded execution: source with the current line
 * highlighted, the stack frames, the heap, and arrows for pointers and borrows.
 */
export function TraceView({ code, trace, language }: { code: string; trace: TraceFrame[]; language: string }) {
  const [i, setI] = useState(0);
  const f = trace[Math.min(i, trace.length - 1)];
  const lines = code.split('\n');

  // Lay out stack variables (left column) and heap cells (right column) on a fixed grid.
  const anchors = new Map<string, { x: number; y: number }>();
  let y = PAD;
  const frames = f.stack.map((fr) => {
    const top = y;
    y += FRAME_HEAD;
    const vars = fr.vars.map((v) => { const vy = y; anchors.set(`${fr.name}.${v.name}`, { x: PAD, y: vy + ROW / 2 }); y += ROW; return { ...v, y: vy }; });
    y += 10;
    return { name: fr.name, top, height: y - top - 10, vars };
  });
  const stackH = y;
  const hx = PAD + BOX_W + GAP;
  let hy = PAD + FRAME_HEAD;
  const heap = f.heap.map((h) => { const cy = hy; anchors.set(h.id, { x: hx, y: cy + ROW / 2 }); hy += ROW + 8; return { ...h, y: cy }; });
  const height = Math.max(stackH, hy) + PAD;
  const width = heap.length ? hx + BOX_W + PAD : PAD * 2 + BOX_W + 40;

  const arrows = frames.flatMap((fr) => fr.vars.filter((v) => v.target && anchors.has(v.target)).map((v) => {
    const to = anchors.get(v.target!)!;
    const fromX = PAD + BOX_W, fromY = v.y + ROW / 2;
    const toStack = to.x === PAD;
    const d = toStack
      ? `M${fromX},${fromY} C${fromX + 50},${fromY} ${fromX + 50},${to.y} ${PAD + BOX_W + 6},${to.y}`
      : `M${fromX},${fromY} C${fromX + GAP / 2},${fromY} ${to.x - GAP / 2},${to.y} ${to.x - 6},${to.y}`;
    return { key: `${fr.name}.${v.name}`, d, dashed: v.kind === 'borrow' };
  }));

  const describe = `Step ${i + 1} of ${trace.length}, line ${f.line}. ` +
    f.stack.map((fr) => `Frame ${fr.name}: ${fr.vars.map((v) => `${v.name} ${v.kind === 'moved' ? 'has been moved' : `is ${v.value}`}${v.target ? ` pointing to ${v.target}` : ''}`).join('; ') || 'no variables'}.`).join(' ') +
    (f.heap.length ? ` Heap: ${f.heap.map((h) => `${h.label ?? h.id} holds ${h.value}${h.freed ? ' (freed)' : ''}`).join('; ')}.` : '');

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <pre className="overflow-x-auto rounded-xl bg-surface2 py-2 font-mono text-sm" aria-label={`${language} source code`}>
          {lines.map((l, n) => (
            <div key={n} className={`flex px-2 ${n + 1 === f.line ? 'bg-accent-soft font-semibold' : ''}`} aria-current={n + 1 === f.line ? 'step' : undefined}>
              <span className="mr-3 w-6 shrink-0 select-none text-right text-muted">{n + 1}</span><code className="whitespace-pre">{l || ' '}</code>
            </div>
          ))}
        </pre>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface p-1">
          <svg width={width} height={height} role="img" aria-label={describe} className="text-[12px]">
            <defs><marker id="tv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="rgb(var(--accent))" /></marker></defs>
            <text x={PAD} y={PAD + 2} dominantBaseline="hanging" fill="rgb(var(--muted))" fontWeight="600">Stack</text>
            {heap.length > 0 && <text x={hx} y={PAD + 2} dominantBaseline="hanging" fill="rgb(var(--muted))" fontWeight="600">Heap</text>}
            {frames.map((fr) => (
              <g key={fr.name}>
                <text x={PAD + BOX_W} y={fr.top + 16} textAnchor="end" fill="rgb(var(--muted))">{fr.name}()</text>
                {fr.vars.map((v) => (
                  <g key={v.name} opacity={v.kind === 'moved' ? 0.5 : 1}>
                    <rect x={PAD} y={v.y} width={BOX_W} height={ROW - 3} rx={5} fill="rgb(var(--surface2))" stroke="rgb(var(--border-strong))" strokeDasharray={v.kind === 'moved' ? '4 3' : undefined} />
                    <text x={PAD + 8} y={v.y + 15} fill="rgb(var(--fg))" fontFamily="ui-monospace, monospace">{v.name}</text>
                    <text x={PAD + BOX_W - 8} y={v.y + 15} textAnchor="end" fill="rgb(var(--fg))" fontFamily="ui-monospace, monospace" textDecoration={v.kind === 'moved' ? 'line-through' : undefined}>{v.value}</text>
                    {KIND_NOTE[v.kind] && <text x={PAD + BOX_W / 2} y={v.y + 15} textAnchor="middle" fill="rgb(var(--muted))" fontSize="10">{KIND_NOTE[v.kind]}</text>}
                  </g>
                ))}
              </g>
            ))}
            {heap.map((h) => (
              <g key={h.id} opacity={h.freed ? 0.5 : 1}>
                <rect x={hx} y={h.y} width={BOX_W} height={ROW - 3} rx={5} fill="rgb(var(--accent-soft))" stroke="rgb(var(--border-strong))" strokeDasharray={h.freed ? '4 3' : undefined} />
                <text x={hx + 8} y={h.y + 15} fill="rgb(var(--muted))" fontSize="10">{h.label ?? h.id}{h.freed ? ' (freed)' : ''}</text>
                <text x={hx + BOX_W - 8} y={h.y + 15} textAnchor="end" fill="rgb(var(--fg))" fontFamily="ui-monospace, monospace">{h.value}</text>
              </g>
            ))}
            {arrows.map((a) => <path key={a.key} d={a.d} fill="none" stroke="rgb(var(--accent))" strokeWidth={1.75} strokeDasharray={a.dashed ? '5 4' : undefined} markerEnd="url(#tv-arrow)" />)}
          </svg>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>Back</button>
        <button type="button" className="btn btn-primary" onClick={() => setI(Math.min(trace.length - 1, i + 1))} disabled={i >= trace.length - 1}>Step</button>
        <label className="flex flex-1 items-center gap-2 text-sm text-muted">
          <span className="whitespace-nowrap">Step {i + 1} / {trace.length}</span>
          <input type="range" min={0} max={trace.length - 1} value={i} onChange={(e) => setI(+e.target.value)} className="w-full max-w-xs accent-[rgb(var(--accent))]" aria-label="Execution step" />
        </label>
      </div>
      <p className="min-h-[1.5rem] text-sm" aria-live="polite">{f.note}</p>
      {f.stdout && <div className="text-sm"><span className="text-muted">Output so far</span><pre className="rounded-xl bg-surface2 p-2 font-mono">{f.stdout}</pre></div>}
    </div>
  );
}
