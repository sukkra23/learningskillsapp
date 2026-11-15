import { lazy, Suspense, useState, type FormEvent } from 'react';
import type { Question } from '../content/schema';
import { grade, type Response } from '../grading';
import { matchChecklist } from '../grading/explain';
import type { AttemptResult } from '../progress/reducers';
import { useProgress } from '../progress/store';
import { Markdown } from '../ui/Markdown';
import { initialResponse, isAnswerable, QuestionInput } from './inputs';

const CodeProblem = lazy(() => import('../runner/CodeProblem'));

export interface QuestionCardProps {
  question: Question;
  /** Globally unique key, "<nodeId>/<questionId>"; also seeds any shuffling. */
  qkey: string;
  /** practice: retries, hints, give up. quiz: one submission, no hints. */
  mode: 'practice' | 'quiz';
  /** Show the worked solution once the question is finished. */
  showSolution?: boolean;
  onResolved(result: AttemptResult): void;
}

type Status = 'open' | 'correct' | 'wrong' | 'gaveup';

export function QuestionCard({ question: q, qkey, mode, showSolution = true, onResolved }: QuestionCardProps) {
  const [resp, setResp] = useState<Response | null>(() => initialResponse(q, qkey));
  const [status, setStatus] = useState<Status>('open');
  const [tries, setTries] = useState(0);
  const [hints, setHints] = useState(0);
  const [msg, setMsg] = useState('');
  const [comparing, setComparing] = useState(false); // explain: model answer is showing
  const scratch = useProgress((s) => s.scratch[qkey] ?? '');
  const done = status !== 'open';

  const finish = (s: Status, t: number) => {
    setStatus(s);
    onResolved({ correct: s === 'correct', tries: t, hintsUsed: hints, gaveUp: s === 'gaveup' });
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (done || !resp || !isAnswerable(q, resp)) return;
    if (q.type === 'explain' && resp.type === 'explain' && !comparing) {
      setResp({ ...resp, ticks: matchChecklist(resp.text, q.checklist) });
      setComparing(true);
      return;
    }
    const g = grade(q, resp);
    if (g.invalid) { setMsg(g.invalid); return; }
    const t = tries + 1;
    setTries(t);
    if (g.correct) { setMsg(''); finish('correct', t); }
    else if (mode === 'quiz' || q.type === 'explain') { setMsg(''); finish('wrong', t); }
    else setMsg(t === 1 ? 'Not quite. Try again, or take a hint.' : 'Still not right. A hint may help, or you can see the solution.');
  };

  const onCode = (passed: number, total: number) => {
    if (done) return;
    const t = tries + 1;
    setTries(t);
    if (passed === total) finish('correct', t);
    else { setMsg(`${passed} of ${total} tests pass.`); if (mode === 'quiz') finish('wrong', t); }
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Question">
      <Markdown className="text-lg">{q.prompt}</Markdown>

      {q.type === 'code' ? (
        <Suspense fallback={<p className="text-muted">Loading the code editor…</p>}><CodeProblem question={q} qkey={qkey} disabled={done} onResult={onCode} /></Suspense>
      ) : q.type === 'explain' ? (
        <ExplainInput q={q} qkey={qkey} resp={resp} setResp={setResp} comparing={comparing} done={done} />
      ) : (
        <QuestionInput q={q} seed={qkey} value={resp} onChange={(r) => { setResp(r); if (!done) setMsg(''); }} disabled={done} reveal={done && showSolution} />
      )}

      <div aria-live="polite" className="min-h-[1.5rem]">
        {status === 'correct' && <p className="font-semibold text-success">{q.type === 'explain' ? 'Saved. Your self-assessment covers the key points.' : 'Correct.'}</p>}
        {status === 'wrong' && <p className="font-semibold text-danger">{q.type === 'explain' ? 'Saved. Compare the points you missed with the model answer.' : 'Incorrect.'}</p>}
        {status === 'gaveup' && <p className="font-semibold text-muted">Here is the solution. This question will come back in review.</p>}
        {!done && msg && <p className="text-danger">{msg}</p>}
      </div>

      {!done && (
        <div className="flex flex-wrap items-center gap-2">
          {q.type !== 'code' && (
            <button type="submit" className="btn btn-primary" disabled={!isAnswerable(q, resp)}>
              {q.type === 'explain' ? (comparing ? 'Save self-assessment' : 'Compare with model answer') : 'Check'}
            </button>
          )}
          {mode === 'practice' && hints < q.hints.length && (
            <button type="button" className="btn" onClick={() => setHints(hints + 1)}>{hints === 0 ? 'Hint' : 'Another hint'} ({q.hints.length - hints} left)</button>
          )}
          {mode === 'practice' && q.type !== 'explain' && (
            <button type="button" className="btn" onClick={() => finish('gaveup', tries)}>Show solution</button>
          )}
        </div>
      )}

      {hints > 0 && (
        <ol className="space-y-2" aria-label="Hints">
          {q.hints.slice(0, hints).map((h, i) => (
            <li key={i} className="rounded-xl border border-border bg-surface2 px-4 py-2 text-sm"><span className="font-semibold">Hint {i + 1}. </span><Markdown inline>{h}</Markdown></li>
          ))}
        </ol>
      )}

      {done && showSolution && (
        <section className="rounded-xl border border-border bg-surface2 px-4 py-3" aria-label="Worked solution">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Worked solution</h3>
          <Markdown>{q.solution}</Markdown>
        </section>
      )}

      {mode === 'practice' && q.type !== 'explain' && q.type !== 'code' && (
        <details className="rounded-xl border border-border px-4 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-muted">Scratchpad: show your working</summary>
          <label htmlFor={`scratch-${qkey}`} className="sr-only">Scratchpad</label>
          <textarea id={`scratch-${qkey}`} rows={5} value={scratch} onChange={(e) => useProgress.getState().setScratch(qkey, e.target.value)}
            placeholder="Work it out here. Saved on this device, never graded." className="input mt-2 w-full font-mono" />
        </details>
      )}
    </form>
  );
}

function ExplainInput({ q, qkey, resp, setResp, comparing, done }: {
  q: Extract<Question, { type: 'explain' }>; qkey: string; resp: Response | null; setResp(r: Response): void; comparing: boolean; done: boolean;
}) {
  const r = resp?.type === 'explain' ? resp : { type: 'explain' as const, text: '', ticks: [] };
  return (
    <div className="space-y-3">
      <label htmlFor={`ex-${qkey}`} className="block text-sm text-muted">Explain in your own words (two or three sentences).</label>
      <textarea id={`ex-${qkey}`} rows={5} value={r.text} disabled={comparing || done} onChange={(e) => setResp({ ...r, text: e.target.value })} className="input w-full" />
      {(comparing || done) && (
        <>
          <section className="rounded-xl border border-border bg-surface2 px-4 py-3" aria-label="Model answer">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Model answer</h3>
            <Markdown>{q.modelAnswer}</Markdown>
          </section>
          <fieldset disabled={done} className="space-y-1.5">
            <legend className="text-sm font-semibold">Did your explanation cover each point?</legend>
            <p className="text-sm text-muted">Points are pre-ticked when their key words appear in your text. Correct any that are wrong: you are the judge.</p>
            {q.checklist.map((c, i) => (
              <label key={i} className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                <input type="checkbox" className="mt-1 accent-[rgb(var(--accent))]" checked={!!r.ticks[i]} onChange={() => setResp({ ...r, ticks: q.checklist.map((_, j) => (j === i ? !r.ticks[j] : !!r.ticks[j])) })} />
                <span>{c.point}</span>
              </label>
            ))}
          </fieldset>
        </>
      )}
    </div>
  );
}
