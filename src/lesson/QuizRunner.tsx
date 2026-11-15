import { useEffect, useRef, useState } from 'react';
import type { Question } from '../content/schema';
import { quizScore } from '../grading';
import { Markdown } from '../ui/Markdown';
import { ProgressBar } from './ProgressBar';
import { QuestionCard } from './QuestionCard';

export interface QuizResult { score: number; results: boolean[] }

/**
 * Runs a fixed list of questions, one submission each, and reports the score.
 * With `reveal` the right answer and solution are shown after each question.
 */
export function QuizRunner({ questions, keyPrefix, reveal, onFinish, children }: {
  questions: Question[]; keyPrefix: string; reveal: boolean; onFinish(r: QuizResult): void;
  /** Rendered under the score once the quiz is finished. */
  children?(r: QuizResult): React.ReactNode;
}) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState<QuizResult | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const answered = results.length > i;
  useEffect(() => { heading.current?.focus(); }, [i, finished]);

  const next = () => {
    if (i + 1 < questions.length) { setI(i + 1); return; }
    const r = { score: quizScore(results), results };
    setFinished(r);
    onFinish(r);
  };

  if (finished) {
    const wrong = questions.filter((_, k) => !finished.results[k]);
    return (
      <div className="space-y-4">
        <h2 ref={heading} tabIndex={-1} className="text-2xl outline-none">Score: {Math.round(finished.score * 100)}% <span className="text-base font-normal text-muted">({finished.results.filter(Boolean).length} of {questions.length} correct)</span></h2>
        {children?.(finished)}
        {wrong.length > 0 && (
          <section aria-label="Questions to revisit" className="space-y-3">
            <h3 className="text-lg">Questions to revisit</h3>
            {wrong.map((q) => (
              <details key={q.id} className="card py-3">
                <summary className="cursor-pointer"><Markdown inline>{q.prompt.split('\n')[0]}</Markdown></summary>
                <Markdown className="mt-2 text-sm">{q.solution}</Markdown>
              </details>
            ))}
          </section>
        )}
      </div>
    );
  }

  const q = questions[i];
  return (
    <div className="space-y-4">
      <ProgressBar value={results.length} max={questions.length} label="Quiz progress" />
      <h2 ref={heading} tabIndex={-1} className="text-sm font-semibold uppercase tracking-wide text-muted outline-none">Question {i + 1} of {questions.length}</h2>
      <div className="card">
        <QuestionCard key={q.id} question={q} qkey={`${keyPrefix}/${q.id}`} mode="quiz" showSolution={reveal}
          onResolved={(r) => setResults((prev) => [...prev, r.correct])} />
      </div>
      {answered && !reveal && <p aria-live="polite" className="text-sm text-muted">Answer recorded.</p>}
      <button type="button" className="btn btn-primary" disabled={!answered} onClick={next}>{i + 1 < questions.length ? 'Next question' : 'See result'}</button>
    </div>
  );
}
