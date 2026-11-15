import { Link } from 'react-router-dom';
import { catalog } from '../content';
import { useNodeStates } from '../app/useNodeState';
import { useProgress } from '../progress/store';
import { StateChip } from '../ui/NodeCard';

export function Bookmarks() {
  const bookmarks = useProgress((s) => s.bookmarks);
  const notes = useProgress((s) => s.notes);
  const states = useNodeStates();
  const ids = [...new Set([...bookmarks, ...Object.keys(notes).filter((k) => notes[k].trim())])].filter((id) => catalog.byId.has(id));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl">Saved topics and notes</h1>
      {ids.length === 0 && <p className="text-muted">Nothing saved yet. Use "Save topic" or write a note on any topic page.</p>}
      <ul className="space-y-2">
        {ids.map((id) => {
          const n = catalog.byId.get(id)!;
          return (
            <li key={id} className="card py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/node/${id}`} className="text-lg font-semibold hover:underline">{n.title}</Link>
                <StateChip state={states.get(id)!.state} />
                {bookmarks.includes(id) && <span className="chip">Saved</span>}
              </div>
              {notes[id]?.trim() && <p className="mt-2 whitespace-pre-wrap border-l-2 border-border pl-3 text-sm">{notes[id]}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
