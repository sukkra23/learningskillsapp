import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { catalog } from '../content';
import { qid } from '../content/schema';
import { QuestionCard } from '../lesson/QuestionCard';
import { useProgress } from '../progress/store';
import { Icon } from '../ui/Icon';

const LEVEL = ['', 'Warm-up', 'Easy', 'Medium', 'Hard', 'Challenge'];

export function ProblemsPage() {
  const { nodeId = '' } = useParams();
  const node = catalog.byId.get(nodeId)!;
  const attempts = useProgress((s) => s.attempts);
  const record = useProgress((s) => s.recordAttempt);
  const firstOpen = Math.max(0, node.problems.findIndex((p) => !attempts[qid(node.id, p.id)]?.correct));
  const [i, setI] = useState(firstOpen);
  const [round, setRound] = useState(0);
  const q = node.problems[i];
  const key = qid(node.id, q.id);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <p className="text-sm text-muted"><Link to={`/node/${node.id}`} className="underline">{node.title}</Link> / Problem set</p>
        <h1 className="text-2xl">Problem set</h1>
        <p className="text-sm text-muted">Problems run from easy to hard. Hints reveal one at a time, and the worked solution appears when you solve a problem or ask for it.</p>
      </header>
      <nav aria-label="Problems" className="flex flex-wrap gap-1.5">
        {node.problems.map((p, k) => {
          const a = attempts[qid(node.id, p.id)];
          return (
            <button key={p.id} type="button" onClick={() => { setI(k); setRound(round + 1); }} aria-current={k === i ? 'true' : undefined}
              aria-label={`Problem ${k + 1}, ${LEVEL[p.difficulty]}${a?.correct ? ', solved' : a ? ', attempted' : ''}`}
              className={`flex h-9 min-w-[2.25rem] items-center justify-center gap-1 rounded-lg border-2 px-2 text-sm font-medium ${k === i ? 'border-accent bg-accent-soft' : a?.correct ? 'border-success' : 'border-border'}`}>
              {k + 1}{a?.correct && <Icon name="check" size={13} className="text-success" />}
            </button>
          );
        })}
      </nav>
      <div className="card">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Problem {i + 1} &middot; {LEVEL[q.difficulty]}</p>
        <QuestionCard key={`${key}:${round}`} question={q} qkey={key} mode="practice" onResolved={(r) => record(key, r)} />
      </div>
      <div className="flex justify-between gap-2">
        <button type="button" className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</button>
        {i + 1 < node.problems.length
          ? <button type="button" className="btn btn-primary" onClick={() => setI(i + 1)}>Next problem</button>
          : <Link to={`/learn/${node.id}/checkpoint`} className="btn btn-primary">Checkpoint quiz <Icon name="arrow" size={16} /></Link>}
      </div>
    </div>
  );
}
