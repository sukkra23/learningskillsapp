import { useMemo } from 'react';
import type { SkillNode } from '../content/schema';
import { depths, type NodeState } from '../graph/graph';
import { STATE_LABEL } from '../app/useNodeState';
import { Icon } from './Icon';

const W = 172, H = 60, GX = 56, GY = 14, PAD = 12;

export interface SkillMapProps {
  nodes: SkillNode[];
  states: Map<string, NodeState>;
  selected?: string | null;
  onSelect(id: string): void;
  /** Optional 0..1 mastery estimate per node; switches the map to heatmap colouring. */
  heat?: Record<string, number>;
  /** Extra short label per node (for example "Review"). */
  badges?: Record<string, string>;
}

const stateClass: Record<NodeState['state'], string> = {
  mastered: 'border-success bg-surface',
  available: 'border-accent bg-accent-soft',
  locked: 'border-border bg-surface2 text-muted',
  'coming-soon': 'border-dashed border-border bg-transparent text-muted',
};

/** Layered left-to-right layout: column = longest prerequisite chain within the track. */
export function layout(nodes: SkillNode[]) {
  const d = depths(nodes);
  const cols: SkillNode[][] = [];
  for (const n of nodes) (cols[d.get(n.id)!] ??= []).push(n);
  const pos = new Map<string, { x: number; y: number }>();
  cols.forEach((col, c) => col.forEach((n, r) => pos.set(n.id, { x: PAD + c * (W + GX), y: PAD + r * (H + GY) })));
  const width = PAD * 2 + cols.length * W + (cols.length - 1) * GX;
  const height = PAD * 2 + Math.max(...cols.map((c) => c.length)) * (H + GY) - GY;
  return { pos, width, height };
}

export function SkillMap({ nodes, states, selected, onSelect, heat, badges }: SkillMapProps) {
  const { pos, width, height } = useMemo(() => layout(nodes), [nodes]);
  const sel = selected ? nodes.find((n) => n.id === selected) : undefined;
  const related = new Set(sel ? [sel.id, ...sel.prerequisites] : []);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface" role="group" aria-label="Skill map. Scroll sideways to see later topics.">
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} className="absolute inset-0" aria-hidden="true">
          {nodes.flatMap((n) => n.prerequisites.filter((p) => pos.has(p)).map((p) => {
            const a = pos.get(p)!, b = pos.get(n.id)!;
            const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, mx = (x1 + x2) / 2;
            const hot = sel && n.id === sel.id;
            return <path key={`${p}>${n.id}`} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none"
              stroke={hot ? 'rgb(var(--accent))' : 'rgb(var(--border-strong))'} strokeWidth={hot ? 2.5 : 1.25} opacity={sel && !hot ? 0.35 : 0.9} />;
          }))}
        </svg>
        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const st = states.get(n.id)!;
          const h = heat?.[n.id];
          const pct = h === undefined ? null : Math.round(h * 100);
          return (
            <button key={n.id} type="button" onClick={() => onSelect(n.id)} aria-pressed={selected === n.id}
              aria-label={`${n.title}. ${STATE_LABEL[st.state]}${pct !== null ? `. Estimated mastery ${pct} percent` : ''}${badges?.[n.id] ? `. ${badges[n.id]}` : ''}`}
              className={`absolute flex items-center gap-2 rounded-xl border-2 px-2.5 text-left text-[13px] font-medium leading-tight transition hover:brightness-105 ${stateClass[st.state]} ${selected === n.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''} ${sel && !related.has(n.id) ? 'opacity-60' : ''}`}
              style={{ left: p.x, top: p.y, width: W, height: H }}>
              {st.state === 'mastered' && <Icon name="check" className="text-success" />}
              {st.state === 'locked' && <Icon name="lock" size={15} />}
              {st.state === 'coming-soon' && <Icon name="clock" size={15} />}
              <span className="line-clamp-2 flex-1">{n.title}</span>
              {pct !== null && (
                <span className="flex flex-col items-end gap-0.5 text-[11px] tabular-nums">
                  {pct}%
                  <span className="block h-1.5 w-9 overflow-hidden rounded bg-border"><span className="block h-full bg-accent" style={{ width: `${pct}%` }} /></span>
                </span>
              )}
              {badges?.[n.id] && pct === null && <span className="chip">{badges[n.id]}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
