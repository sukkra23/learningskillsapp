import { Link, useParams, useSearchParams } from 'react-router-dom';
import { catalog } from '../content';
import { useNodeState, useNodeStates } from '../app/useNodeState';
import { useProgress } from '../progress/store';
import { Icon } from '../ui/Icon';
import { MissingPrereqs, NodeActions, StateChip } from '../ui/NodeCard';
import { TRACK_TEXT } from './Dashboard';
import { NotFound } from './NotFound';

export function NodePage() {
  const { nodeId = '' } = useParams();
  const node = catalog.byId.get(nodeId);
  return node ? <NodeView key={node.id} nodeId={node.id} /> : <NotFound />;
}

function NodeView({ nodeId }: { nodeId: string }) {
  const node = catalog.byId.get(nodeId)!;
  const state = useNodeState(node);
  const states = useNodeStates();
  const [params] = useSearchParams();
  const np = useProgress((s) => s.nodes[node.id]);
  const note = useProgress((s) => s.notes[node.id] ?? '');
  const bookmarked = useProgress((s) => s.bookmarks.includes(node.id));
  const { setNote, toggleBookmark } = useProgress.getState();
  const track = catalog.tracks.find((t) => t.id === node.track)!;
  const unlocks = catalog.nodes.filter((n) => n.prerequisites.includes(node.id));
  const how = { placed: 'by placement test', checkpoint: 'by checkpoint quiz', 'test-out': 'by testing out', none: '' }[np?.mastery ?? 'none'];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="text-sm text-muted"><Link to={`/track/${track.id}`} className="underline">{track.title}</Link>{node.strand && ` / ${node.strand}`}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{node.title}</h1>
          <StateChip state={state.state} />
        </div>
        <p className="mt-2 text-lg text-muted">{node.summary}</p>
        <p className="mt-2 flex flex-wrap gap-2 text-sm">
          <span className="chip"><Icon name="clock" size={13} /> about {node.estimatedMinutes} min</span>
          <span className="chip">Difficulty {node.difficulty} of 5</span>
          {state.state === 'mastered' && <span className="chip">Mastered {how}</span>}
          {np && np.checkpointBest > 0 && <span className="chip">Best checkpoint {Math.round(np.checkpointBest * 100)}%</span>}
          {np?.placement?.label === 'review' && state.state !== 'mastered' && <span className="chip">Placement: review</span>}
        </p>
      </header>

      {params.get('locked') && state.state === 'locked' && (
        <p role="alert" className="rounded-xl border border-danger p-3 text-sm">That lesson is locked, so you were brought here instead.</p>
      )}

      <section className="card space-y-3" aria-label="Start learning">
        <NodeActions node={node} state={state} />
        {state.state === 'locked' && (
          <p className="text-sm text-muted">Already know this? You can test out of a topic once its prerequisites are verified, so start with the first one listed above.</p>
        )}
        {state.state === 'coming-soon' && <MissingPrereqs missing={[]} />}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card" aria-labelledby="prereq-h">
          <h2 id="prereq-h" className="text-base">Prerequisites</h2>
          {node.prerequisites.length === 0 ? <p className="mt-2 text-sm text-muted">None. This is a starting point.</p> : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {node.prerequisites.map((id) => {
                const p = catalog.byId.get(id)!;
                const s = states.get(id)!.state;
                return <li key={id} className="flex items-center gap-2"><Icon name={s === 'mastered' ? 'check' : 'lock'} size={14} className={s === 'mastered' ? 'text-success' : 'text-muted'} /><Link to={`/node/${id}`} className="underline">{p.title}</Link>{p.track !== node.track && <span className={`text-xs ${TRACK_TEXT[p.track]}`}>{catalog.tracks.find((t) => t.id === p.track)?.title}</span>}<span className="sr-only">{s === 'mastered' ? 'verified' : 'not yet verified'}</span></li>;
              })}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="unlocks-h">
          <h2 id="unlocks-h" className="text-base">Unlocks</h2>
          {unlocks.length === 0 ? <p className="mt-2 text-sm text-muted">This is the end of a branch.</p> : (
            <ul className="mt-2 space-y-1.5 text-sm">{unlocks.map((n) => <li key={n.id}><Link to={`/node/${n.id}`} className="underline">{n.title}</Link></li>)}</ul>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="notes-h">
        <div className="flex items-center justify-between gap-2">
          <h2 id="notes-h" className="text-base">Your notes</h2>
          <button type="button" className="btn" aria-pressed={bookmarked} onClick={() => toggleBookmark(node.id)}><Icon name="bookmark" size={15} className={bookmarked ? 'text-accent' : 'text-muted'} />{bookmarked ? 'Saved' : 'Save topic'}</button>
        </div>
        <label htmlFor="note" className="sr-only">Notes for {node.title}</label>
        <textarea id="note" value={note} onChange={(e) => setNote(node.id, e.target.value)} rows={4} placeholder="Anything you want to remember about this topic. Saved on this device." className="input mt-3 w-full" />
      </section>
    </div>
  );
}
