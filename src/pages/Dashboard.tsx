import { Link } from 'react-router-dom';
import { catalog, trackNodes } from '../content';
import type { TrackId } from '../content/schema';
import { useNodeStates } from '../app/useNodeState';
import { useProgress } from '../progress/store';
import { dueReviews } from '../progress/reducers';
import { dayString } from '../progress/sm2';
import { Icon } from '../ui/Icon';

export const TRACK_TEXT: Record<TrackId, string> = { cs: 'text-cs', engineering: 'text-engineering', math: 'text-math', physics: 'text-physics' };
export const TRACK_BG: Record<TrackId, string> = { cs: 'bg-cs', engineering: 'bg-engineering', math: 'bg-math', physics: 'bg-physics' };

export function Dashboard() {
  const states = useNodeStates();
  const p = useProgress();
  const due = dueReviews(p, dayString(new Date())).length;

  // "Continue": the last node touched if still open, else the first available node on any generated path, else any available node.
  const open = (id: string | null | undefined) => (id && ['available'].includes(states.get(id)?.state ?? '') ? catalog.byId.get(id) : undefined);
  const recommended = Object.values(p.diagnostics).map((d) => open(d?.recommended)).find(Boolean);
  const next = open(p.lastNode) ?? recommended ?? catalog.nodes.find((n) => states.get(n.id)?.state === 'available');
  const nextProgress = next ? (p.nodes[next.id]?.stepsDone.length ?? 0) / Math.max(1, next.steps.length) : 0;

  return (
    <div className="space-y-8">
      {!p.onboarded && (
        <section className="card border-accent bg-accent-soft" aria-labelledby="welcome">
          <h1 id="welcome" className="text-2xl">Welcome to Orbit</h1>
          <p className="mt-2 max-w-2xl text-muted">Short interactive lessons in computer science, engineering, mathematics and physics. Take a quick placement test to skip what you already know, or start from the beginning.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {catalog.tracks.map((t) => <Link key={t.id} to={`/diagnostic/${t.id}`} className="btn btn-primary">Place me in {t.title}</Link>)}
            <button type="button" className="btn" onClick={p.setOnboarded}>Start from the beginning</button>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3" aria-label="Your learning">
        <div className="card md:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{p.lastNode && next?.id === p.lastNode ? 'Continue' : 'Up next'}</h2>
          {next ? (
            <>
              <p className={`mt-2 text-xs font-semibold uppercase ${TRACK_TEXT[next.track]}`}>{catalog.tracks.find((t) => t.id === next.track)?.title}</p>
              <p className="text-2xl font-semibold">{next.title}</p>
              <p className="mt-1 text-muted">{next.summary}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-label="Lesson progress" aria-valuenow={Math.round(nextProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-accent" style={{ width: `${nextProgress * 100}%` }} />
              </div>
              <Link to={`/learn/${next.id}`} className="btn btn-primary mt-4">{nextProgress > 0 ? 'Continue' : 'Start'} <Icon name="arrow" size={16} /></Link>
            </>
          ) : <p className="mt-2 text-muted">You have mastered every lesson that is available. More are on the way.</p>}
        </div>
        <div className="card flex flex-col">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Review queue</h2>
          <p className="mt-2 text-4xl font-semibold tabular-nums">{due}</p>
          <p className="text-muted">{due === 1 ? 'question is' : 'questions are'} due today</p>
          <Link to="/review" className={`btn mt-auto ${due ? 'btn-primary' : ''}`}>{due ? 'Review now' : 'Open review'}</Link>
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center text-sm">
            <div><dt className="text-muted">Streak</dt><dd className="font-semibold">{p.streak.current} d</dd></div>
            <div><dt className="text-muted">Best</dt><dd className="font-semibold">{p.streak.best} d</dd></div>
            <div><dt className="text-muted">XP</dt><dd className="font-semibold">{p.xp}</dd></div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="tracks">
        <h2 id="tracks" className="mb-3 text-xl">Tracks</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {catalog.tracks.map((t) => {
            const nodes = trackNodes(t.id);
            const ready = nodes.filter((n) => n.status === 'ready');
            const mastered = ready.filter((n) => states.get(n.id)?.state === 'mastered').length;
            const pct = ready.length ? mastered / ready.length : 0;
            return (
              <article key={t.id} className="card flex flex-col">
                <div className={`mb-3 h-1.5 w-12 rounded-full ${TRACK_BG[t.id]}`} />
                <h3 className="text-xl"><Link to={`/track/${t.id}`} className="hover:underline">{t.title}</Link></h3>
                <p className="text-sm text-muted">{t.tagline}</p>
                <p className="mt-2 text-sm">{t.description}</p>
                <div className="mt-4 flex items-center gap-3 text-sm">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-label={`${t.title} mastery`} aria-valuenow={mastered} aria-valuemin={0} aria-valuemax={ready.length}>
                    <div className={`h-full ${TRACK_BG[t.id]}`} style={{ width: `${pct * 100}%` }} />
                  </div>
                  <span className="tabular-nums text-muted">{mastered}/{ready.length} mastered</span>
                </div>
                <p className="mt-1 text-xs text-muted">{nodes.length} topics on the map, {ready.length} available now</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/track/${t.id}`} className="btn">Skill map</Link>
                  <Link to={`/diagnostic/${t.id}`} className="btn">{p.diagnostics[t.id] ? 'Retake placement' : 'Placement test'}</Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
