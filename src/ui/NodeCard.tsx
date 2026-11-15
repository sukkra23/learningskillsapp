import { Link } from 'react-router-dom';
import { catalog } from '../content';
import type { SkillNode } from '../content/schema';
import { canEnter, canTestOut, type NodeState } from '../graph/graph';
import { STATE_LABEL } from '../app/useNodeState';
import { useProgress } from '../progress/store';
import { Icon } from './Icon';

export function StateChip({ state }: { state: NodeState['state'] }) {
  const icon = state === 'mastered' ? 'check' : state === 'locked' ? 'lock' : state === 'coming-soon' ? 'clock' : null;
  const tone = state === 'mastered' ? 'text-success' : state === 'available' ? 'text-accent' : 'text-muted';
  return <span className={`chip ${tone}`}>{icon && <Icon name={icon} size={13} />}{STATE_LABEL[state]}</span>;
}

/** Explains why a node is locked: each missing prerequisite, linked. */
export function MissingPrereqs({ missing }: { missing: string[] }) {
  if (!missing.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface2 p-3" role="status">
      <p className="flex items-center gap-2 text-sm font-semibold"><Icon name="lock" size={15} /> Locked. Master {missing.length === 1 ? 'this' : `these ${missing.length}`} first:</p>
      <ul className="mt-2 space-y-1 text-sm">
        {missing.map((id) => {
          const p = catalog.byId.get(id);
          return (
            <li key={id}>
              <Link className="text-accent underline" to={`/node/${id}`}>{p?.title ?? id}</Link>
              {p && <span className="text-muted"> ({catalog.tracks.find((t) => t.id === p.track)?.title}{p.status === 'stub' ? ', coming soon' : ''})</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function NodeActions({ node, state }: { node: SkillNode; state: NodeState }) {
  const np = useProgress((s) => s.nodes[node.id]);
  if (state.state === 'coming-soon') return <p className="text-sm text-muted">This lesson is not written yet. It is on the map so you can see where the track is heading.</p>;
  if (!canEnter(state)) return <MissingPrereqs missing={state.missing} />;
  const done = np?.stepsDone.length ?? 0;
  return (
    <div className="flex flex-wrap gap-2">
      <Link to={`/learn/${node.id}`} className="btn btn-primary">{done === 0 ? 'Start lesson' : done >= node.steps.length ? 'Revisit lesson' : 'Continue lesson'} <Icon name="arrow" size={16} /></Link>
      <Link to={`/learn/${node.id}/problems`} className="btn">Problem set</Link>
      <Link to={`/learn/${node.id}/checkpoint`} className="btn">Checkpoint quiz</Link>
      {canTestOut(state) && <Link to={`/node/${node.id}/test-out`} className="btn">Test out</Link>}
    </div>
  );
}
