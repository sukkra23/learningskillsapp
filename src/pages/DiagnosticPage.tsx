import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { catalog, trackNodes } from '../content';
import type { Track } from '../content/schema';
import { place, type Placement } from '../diagnostic/placement';
import { CONFIG, nextItem, type Answer, type BankItem } from '../diagnostic/staircase';
import { isVerified } from '../graph/graph';
import { ProgressBar } from '../lesson/ProgressBar';
import { QuestionCard } from '../lesson/QuestionCard';
import { useNodeStates } from '../app/useNodeState';
import { useProgress } from '../progress/store';
import { Icon } from '../ui/Icon';
import { SkillMap } from '../ui/SkillMap';
import { NotFound } from './NotFound';

export function DiagnosticPage() {
  const { track } = useParams();
  const t = catalog.tracks.find((x) => x.id === track);
  return t ? <Diagnostic key={t.id} track={t} /> : <NotFound />;
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : 'not asked');

function Diagnostic({ track }: { track: Track }) {
  const nodes = useMemo(() => trackNodes(track.id), [track.id]);
  const items = catalog.diagnostics[track.id];
  const bank: BankItem[] = useMemo(() => items.map((i) => ({ id: i.question.id, nodeId: i.nodeId, tier: i.tier, difficulty: i.question.difficulty })), [items]);
  const order = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const previous = useProgress((s) => s.diagnostics[track.id]);
  const apply = useProgress((s) => s.applyDiagnostic);
  const [phase, setPhase] = useState<'intro' | 'test' | 'done'>('intro');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [result, setResult] = useState<Placement | null>(null);

  if (bank.length === 0) return <div className="card mx-auto max-w-xl"><h1 className="text-2xl">{track.title} placement</h1><p className="mt-2 text-muted">This track has no placement test yet.</p></div>;

  const answer = (correct: boolean, itemId: string) => {
    const next = [...answers, { itemId, correct }];
    setAnswers(next);
    if (nextItem(bank, next, order)) return;
    // Finished: estimate mastery, then mark nodes complete / review / queued.
    const state = useProgress.getState();
    const p = place(nodes, bank, next, (id) => {
      const np = state.nodes[id];
      // Earlier placement marks for this track are being replaced, so they do not count as verified.
      return isVerified(np) && !(np!.mastery === 'placed' && catalog.byId.get(id)?.track === track.id);
    });
    apply(track.id, { takenAt: new Date().toISOString(), ability: p.ability, asked: p.asked, correct: p.correct, basic: p.basic, advanced: p.advanced, estimates: p.estimates, path: p.path, recommended: p.recommended }, p.labels);
    setResult(p);
    setPhase('done');
  };

  if (phase === 'intro') {
    return (
      <div className="card mx-auto max-w-2xl space-y-3">
        <h1 className="text-2xl">{track.title} placement test</h1>
        <p>Up to {CONFIG.maxItems} questions. The test adapts: a right answer brings a harder question, a wrong answer an easier one. It stops early once it has found your level.</p>
        <ul className="list-disc space-y-1 pl-6 text-sm text-muted">
          <li>There are no hints and no answers are shown, so the result reflects what you know today.</li>
          <li>If you do not know, say so. Guessing can place you in a lesson that is too hard.</li>
          <li>Topics you already know are marked complete, partly known topics are marked for review, and the rest are queued in order.</li>
        </ul>
        {previous && <p className="text-sm text-muted">You last took this test on {new Date(previous.takenAt).toLocaleDateString()}. Retaking replaces that placement but never removes mastery you earned in lessons.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => setPhase('test')}>Begin</button>
          <Link to={`/track/${track.id}`} className="btn">Not now</Link>
        </div>
      </div>
    );
  }

  if (phase === 'test') {
    const item = nextItem(bank, answers, order)!;
    const q = items.find((i) => i.question.id === item.id)!.question;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl">{track.title} placement test</h1>
        <ProgressBar value={answers.length} max={CONFIG.maxItems} label="Placement test progress" />
        <p className="text-sm text-muted">Question {answers.length + 1} (at most {CONFIG.maxItems})</p>
        <div className="card space-y-4">
          <QuestionCard key={item.id} question={q} qkey={`diag/${track.id}/${item.id}`} mode="quiz" showSolution={false} onResolved={(r) => answer(r.correct, item.id)} />
          <button type="button" className="btn" onClick={() => answer(false, item.id)}>I don't know</button>
        </div>
      </div>
    );
  }

  return <Results track={track} p={result!} retake={() => { setAnswers([]); setResult(null); setPhase('intro'); }} />;
}

function Results({ track, p, retake }: { track: Track; p: Placement; retake(): void }) {
  const nodes = trackNodes(track.id);
  const states = useNodeStates();
  const [selected, setSelected] = useState<string | null>(null);
  const rec = p.recommended ? catalog.byId.get(p.recommended) : undefined;
  const count = (l: string) => Object.values(p.labels).filter((x) => x.label === l).length;
  const badges = Object.fromEntries(Object.entries(p.labels).filter(([, v]) => v.label === 'review').map(([id]) => [id, 'Review']));
  const sel = selected ? catalog.byId.get(selected) : undefined;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl">Your {track.title} placement</h1>
        <p className="text-muted">{p.correct} of {p.asked} correct. Estimated level {p.ability.toFixed(1)} on a scale of 1 to 5.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card md:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Recommended starting point</h2>
          {rec ? (
            <>
              <p className="mt-1 text-2xl font-semibold">{rec.title}</p>
              <p className="text-muted">{rec.summary}</p>
              <Link to={`/learn/${rec.id}`} className="btn btn-primary mt-3">Start here <Icon name="arrow" size={16} /></Link>
            </>
          ) : <p className="mt-1">You placed out of every lesson that is available in this track. New topics will unlock as they are written.</p>}
        </div>
        <dl className="card grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Basic questions</dt><dd className="text-right font-semibold">{pct(p.basic.correct, p.basic.asked)}</dd>
          <dt className="text-muted">Advanced questions</dt><dd className="text-right font-semibold">{pct(p.advanced.correct, p.advanced.asked)}</dd>
          <dt className="text-muted">Marked complete</dt><dd className="text-right font-semibold">{count('mastered')}</dd>
          <dt className="text-muted">Marked for review</dt><dd className="text-right font-semibold">{count('review')}</dd>
          <dt className="text-muted">Queued</dt><dd className="text-right font-semibold">{count('queued')}</dd>
        </dl>
      </div>

      <section aria-labelledby="heat-h" className="space-y-2">
        <h2 id="heat-h" className="text-xl">Skill heatmap</h2>
        <p className="text-sm text-muted">Each topic shows its estimated mastery. Estimates for topics you were not asked about are inferred from related topics and your overall level.</p>
        <SkillMap nodes={nodes} states={states} heat={p.estimates} badges={badges} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} />
        <p aria-live="polite" className="min-h-[1.5rem] text-sm">{sel && <>{sel.title}: estimated mastery {Math.round(p.estimates[sel.id] * 100)}%{p.labels[sel.id] ? `, ${p.labels[sel.id].label === 'mastered' ? 'marked complete' : p.labels[sel.id].label === 'review' ? 'marked for review' : 'queued'}` : ', coming soon'}. <Link to={`/node/${sel.id}`} className="text-accent underline">Open topic</Link></>}</p>
      </section>

      <section aria-labelledby="path-h">
        <h2 id="path-h" className="text-xl">Your path</h2>
        {p.path.length === 0 ? <p className="text-muted">Nothing left to do in the lessons that are available.</p> : (
          <ol className="mt-2 space-y-1.5">
            {p.path.map((id, i) => {
              const n = catalog.byId.get(id)!;
              return (
                <li key={id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
                  <span className="w-6 text-center text-sm tabular-nums text-muted">{i + 1}</span>
                  <Link to={`/node/${id}`} className="font-medium hover:underline">{n.title}</Link>
                  <span className="chip">{p.labels[id].label === 'review' ? 'Review' : 'New'}</span>
                  {id === p.recommended && <span className="chip text-accent">Start here</span>}
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <div className="flex flex-wrap gap-2">
        <Link to={`/track/${track.id}`} className="btn">Open the skill map</Link>
        <button type="button" className="btn" onClick={retake}>Retake the test</button>
        <Link to="/" className="btn">Home</Link>
      </div>
    </div>
  );
}
