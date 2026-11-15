import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { catalog, trackNodes } from '../content';
import type { TrackId } from '../content/schema';
import { useNodeStates } from '../app/useNodeState';
import { useProgress } from '../progress/store';
import { NodeActions, StateChip } from '../ui/NodeCard';
import { SkillMap } from '../ui/SkillMap';
import { NotFound } from './NotFound';

export function TrackPage() {
  const { track } = useParams();
  const t = catalog.tracks.find((x) => x.id === track);
  const states = useNodeStates();
  const progress = useProgress((s) => s.nodes);
  const diag = useProgress((s) => (t ? s.diagnostics[t.id as TrackId] : undefined));
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [heat, setHeat] = useState(false);
  if (!t) return <NotFound />;
  const nodes = trackNodes(t.id);
  const sel = selected ? catalog.byId.get(selected) : undefined;
  const badges = Object.fromEntries(nodes.filter((n) => progress[n.id]?.placement?.label === 'review' && states.get(n.id)?.state !== 'mastered').map((n) => [n.id, 'Review']));
  const strands = [...new Set([...t.strands, ...nodes.map((n) => n.strand ?? 'Other')])].filter((s) => nodes.some((n) => (n.strand ?? 'Other') === s));

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted"><Link to="/" className="underline">Home</Link> / Tracks</p>
        <h1 className="text-3xl">{t.title}</h1>
        <p className="mt-1 max-w-3xl text-muted">{t.description}</p>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="View" className="flex gap-1">
          <button type="button" className={`btn ${view === 'map' ? 'btn-primary' : ''}`} aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</button>
          <button type="button" className={`btn ${view === 'list' ? 'btn-primary' : ''}`} aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
        </div>
        {diag && view === 'map' && <button type="button" className="btn" aria-pressed={heat} onClick={() => setHeat(!heat)}>{heat ? 'Hide' : 'Show'} placement heatmap</button>}
        <Link to={`/diagnostic/${t.id}`} className="btn ml-auto">{diag ? 'Retake placement test' : 'Take placement test'}</Link>
      </div>

      {view === 'map' ? (
        <>
          <SkillMap nodes={nodes} states={states} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} heat={heat ? diag?.estimates : undefined} badges={badges} />
          <p className="text-xs text-muted">Arrows run from a prerequisite to the topic it unlocks. Select a topic for details.</p>
          <div aria-live="polite">
            {sel && (
              <section className="card space-y-3" aria-label={`Details for ${sel.title}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl"><Link to={`/node/${sel.id}`} className="hover:underline">{sel.title}</Link></h2>
                  <StateChip state={states.get(sel.id)!.state} />
                  {badges[sel.id] && <span className="chip">Review</span>}
                </div>
                <p className="text-muted">{sel.summary}</p>
                <NodeActions node={sel} state={states.get(sel.id)!} />
                {states.get(sel.id)!.state === 'coming-soon' && states.get(sel.id)!.missing.length > 0 && (
                  <p className="text-sm text-muted">Builds on: {sel.prerequisites.map((id, i) => <span key={id}>{i > 0 && ', '}<Link className="underline" to={`/node/${id}`}>{catalog.byId.get(id)?.title}</Link></span>)}</p>
                )}
                <Link to={`/node/${sel.id}`} className="text-sm text-accent underline">Open topic page</Link>
              </section>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {strands.map((s) => (
            <section key={s} aria-label={s}>
              <h2 className="mb-2 text-lg">{s}</h2>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                {nodes.filter((n) => (n.strand ?? 'Other') === s).map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <Link to={`/node/${n.id}`} className="font-medium hover:underline">{n.title}</Link>
                    <StateChip state={states.get(n.id)!.state} />
                    <span className="w-full text-sm text-muted sm:w-auto sm:flex-1">{n.summary}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
