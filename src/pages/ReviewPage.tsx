import { useState } from 'react';
import { Link } from 'react-router-dom';
import { findQuestion } from '../content';
import { ProgressBar } from '../lesson/ProgressBar';
import { QuestionCard } from '../lesson/QuestionCard';
import { dueReviews } from '../progress/reducers';
import { daysBetween, dayString } from '../progress/sm2';
import { useProgress } from '../progress/store';

const SESSION_MAX = 20;

export function ReviewPage() {
  const today = dayString(new Date());
  // The queue is fixed when the session starts, so answering does not reshuffle it.
  const [queue] = useState(() => dueReviews(useProgress.getState(), today).filter((k) => findQuestion(k)).slice(0, SESSION_MAX));
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [right, setRight] = useState(0);
  const reviews = useProgress((s) => s.reviews);
  const record = useProgress((s) => s.recordAttempt);
  const upcoming = Object.values(reviews).filter((c) => c.due > today).sort((a, b) => a.due.localeCompare(b.due))[0];

  if (queue.length === 0 || i >= queue.length) {
    return (
      <div className="card mx-auto max-w-xl space-y-2 text-center">
        <h1 className="text-2xl">{queue.length ? 'Review complete' : 'Nothing to review'}</h1>
        {queue.length > 0 && <p>{right} of {queue.length} recalled correctly.</p>}
        <p className="text-muted">
          {Object.keys(reviews).length === 0 ? 'Questions you answer in lessons and problem sets come back here on a spaced schedule.'
            : upcoming ? `Next review in ${daysBetween(today, upcoming.due)} day${daysBetween(today, upcoming.due) === 1 ? '' : 's'}.` : 'You are up to date.'}
        </p>
        <Link to="/" className="btn btn-primary">Home</Link>
      </div>
    );
  }

  const key = queue[i];
  const { node, question } = findQuestion(key)!;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-2xl">Review</h1>
        <p className="text-sm text-muted">Questions return at growing intervals when you get them right, and sooner when you do not.</p>
      </header>
      <ProgressBar value={i} max={queue.length} label="Review progress" />
      <div className="card">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">From <Link to={`/node/${node.id}`} className="underline">{node.title}</Link></p>
        <QuestionCard key={key} question={question} qkey={key} mode="practice" onResolved={(r) => { record(key, r, { review: true }); setAnswered(true); if (r.correct) setRight((x) => x + 1); }} />
      </div>
      <button type="button" className="btn btn-primary" disabled={!answered} onClick={() => { setI(i + 1); setAnswered(false); }}>{i + 1 < queue.length ? 'Next' : 'Finish'}</button>
    </div>
  );
}
