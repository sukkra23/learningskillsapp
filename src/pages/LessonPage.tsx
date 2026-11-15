import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { catalog } from '../content';
import { qid, type SkillNode, type Step } from '../content/schema';
import { CodeTabs } from '../lesson/CodeTabs';
import { ProgressBar } from '../lesson/ProgressBar';
import { QuestionCard } from '../lesson/QuestionCard';
import { useProgress } from '../progress/store';
import { Icon } from '../ui/Icon';
import { Markdown } from '../ui/Markdown';
import { WidgetHost } from '../widgets/WidgetHost';

export function LessonPage() {
  const { nodeId = '' } = useParams();
  const node = catalog.byId.get(nodeId)!; // the route guard has already checked that it exists and is unlocked
  return <Lesson key={node.id} node={node} />;
}

function StepBody({ node, step, onResolved }: { node: SkillNode; step: Step; onResolved(correct: boolean): void }) {
  const record = useProgress((s) => s.recordAttempt);
  if (step.kind === 'question') {
    const key = qid(node.id, step.question.id);
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Check your understanding</h2>
        <QuestionCard question={step.question} qkey={key} mode="practice" onResolved={(r) => { record(key, r); onResolved(r.correct); }} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {step.title && <h2 className="text-2xl">{step.title}</h2>}
      <Markdown className="text-lg">{step.body}</Markdown>
      {step.kind === 'explain' && step.widget && <WidgetHost widget={step.widget} />}
      {step.kind === 'code-tabs' && <CodeTabs step={step} />}
    </div>
  );
}

// A stable reference: a selector that returned a fresh [] each time would re-render for ever.
const NONE: string[] = [];

function Lesson({ node }: { node: SkillNode }) {
  const [params, setParams] = useSearchParams();
  const stepsDone = useProgress((s) => s.nodes[node.id]?.stepsDone ?? NONE);
  const attempts = useProgress((s) => s.attempts);
  const completeStep = useProgress((s) => s.completeStep);
  const total = node.steps.length;
  // Resume at the first unfinished step unless the URL names one.
  const resume = Math.max(0, node.steps.findIndex((s) => !stepsDone.includes(s.id)));
  const raw = params.get('step');
  const index = raw === 'done' ? total : Math.min(total - 1, Math.max(0, raw === null ? resume : (parseInt(raw, 10) || 1) - 1));
  const [resolvedNow, setResolvedNow] = useState<Record<string, boolean>>({});
  const top = useRef<HTMLDivElement>(null);
  // Move focus to the new step when the learner navigates, but not on first load (that would skip the skip link).
  const first = useRef(true);
  useEffect(() => { if (first.current) first.current = false; else top.current?.focus(); }, [index]);

  const go = (i: number) => setParams({ step: i >= total ? 'done' : String(i + 1) });

  if (index >= total) {
    return (
      <div className="mx-auto max-w-2xl space-y-4" ref={top} tabIndex={-1}>
        <ProgressBar value={total} max={total} label="Lesson progress" />
        <div className="card space-y-3 text-center">
          <h1 className="text-2xl">Lesson complete: {node.title}</h1>
          <p className="text-muted">Practise with the problem set, or go straight to the checkpoint quiz. Scoring {Math.round(node.masteryThreshold * 100)}% or more on the checkpoint masters this topic and unlocks what comes next.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to={`/learn/${node.id}/problems`} className="btn">Problem set ({node.problems.length})</Link>
            <Link to={`/learn/${node.id}/checkpoint`} className="btn btn-primary">Checkpoint quiz <Icon name="arrow" size={16} /></Link>
          </div>
          <button type="button" className="text-sm text-accent underline" onClick={() => go(0)}>Go through the lesson again</button>
        </div>
      </div>
    );
  }

  const step = node.steps[index];
  const isQuestion = step.kind === 'question';
  const resolved = !isQuestion || resolvedNow[step.id] || !!attempts[qid(node.id, step.question.id)] || stepsDone.includes(step.id);
  const next = () => { completeStep(node.id, step.id); go(index + 1); };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <Link to={`/node/${node.id}`} className="text-muted underline" aria-label={`Leave lesson and return to ${node.title}`}>{node.title}</Link>
      </div>
      <ProgressBar value={index} max={total} label="Lesson progress" />
      <div ref={top} tabIndex={-1} className="card min-h-[18rem] outline-none" aria-label={`Step ${index + 1} of ${total}`}>
        <StepBody key={step.id} node={node} step={step} onResolved={() => setResolvedNow((r) => ({ ...r, [step.id]: true }))} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn" onClick={() => go(index - 1)} disabled={index === 0}>Back</button>
        {isQuestion && !resolved && <span className="text-sm text-muted">Answer the question to continue.</span>}
        <button type="button" className="btn btn-primary" onClick={next} disabled={!resolved}>{index + 1 === total ? 'Finish lesson' : 'Continue'} <Icon name="arrow" size={16} /></button>
      </div>
    </div>
  );
}
