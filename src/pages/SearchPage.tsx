import { Link, useSearchParams } from 'react-router-dom';
import { catalog } from '../content';
import { search } from '../content/search';
import { useNodeStates } from '../app/useNodeState';
import { StateChip } from '../ui/NodeCard';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const hits = search(catalog.nodes, q);
  const states = useNodeStates();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl">Search</h1>
      <label htmlFor="q" className="sr-only">Search topics and lessons</label>
      <input id="q" type="search" autoFocus value={q} onChange={(e) => setParams({ q: e.target.value }, { replace: true })} placeholder="Try: derivative, cache, momentum" className="input w-full" />
      <p role="status" className="text-sm text-muted">{q ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : 'Type to search every topic and lesson.'}</p>
      <ul className="space-y-2">
        {hits.map(({ node, snippet }) => (
          <li key={node.id} className="card py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/node/${node.id}`} className="text-lg font-semibold hover:underline">{node.title}</Link>
              <StateChip state={states.get(node.id)!.state} />
              <span className="text-xs text-muted">{catalog.tracks.find((t) => t.id === node.track)?.title}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{snippet}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
