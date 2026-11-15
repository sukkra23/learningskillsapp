import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { catalog } from '../content';
import type { SkillNode } from '../content/schema';
import { nodeState } from '../graph/graph';
import { QuizRunner, type QuizResult } from '../lesson/QuizRunner';
import { dayString } from '../progress/sm2';
import { useProgress } from '../progress/store';
import { canAttemptTestOut } from '../progress/types';

/** Topics that become available because `node` is now mastered. */
function Unlocked({ node }: { node: SkillNode }) {
  const nodes = useProgress((s) => s.nodes);
  const opened = catalog.nodes.filter((n) => n.prerequisites.includes(node.id) && nodeState(n, (id) => nodes[id]).state === 'available');
  const waiting = catalog.nodes.filter((n) => n.prerequisites.includes(node.id) && n.status === 'stub');
  return (
    <div className="text-sm">
      {opened.length > 0 && <p>Unlocked: {opened.map((n, i) => <span key={n.id}>{i > 0 && ', '}<Link className="text-accent underline" to={`/node/${n.id}`}>{n.title}</Link></span>)}</p>}
      {opened.length === 0 && waiting.length > 0 && <p className="text-muted">The next topics on this branch are still being written.</p>}
    </div>
  );
}

function Outcome({ node, result, kind }: { node: SkillNode; result: QuizResult; kind: 'checkpoint' | 'test-out' }) {
  const passed = result.score >= node.masteryThreshold;
  const need = Math.round(node.masteryThreshold * 100);
  return (
    <div className={`card space-y-2 border-2 ${passed ? 'border-success' : 'border-border'}`} role="status">
      <p className="text-lg font-semibold">{passed ? `Mastered: ${node.title}` : `Not yet. You need ${need}% to master this topic.`}</p>
      {passed ? <Unlocked node={node} /> : kind === 'checkpoint'
        ? <p className="text-sm text-muted">Review the lesson or the problem set, then try the checkpoint again. There is no limit on attempts.</p>
        : <p className="text-sm text-muted">You can try to test out again tomorrow, or work through the lesson now.</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        <Link to={`/node/${node.id}`} className="btn">Topic page</Link>
        {!passed && <Link to={`/learn/${node.id}`} className="btn btn-primary">Go to the lesson</Link>}
        <Link to={`/track/${node.track}`} className="btn">Skill map</Link>
      </div>
    </div>
  );
}

export function CheckpointPage() {
  const { nodeId = '' } = useParams();
  const node = catalog.byId.get(nodeId)!;
  const record = useProgress((s) => s.recordCheckpoint);
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <p className="text-sm text-muted"><Link to={`/node/${node.id}`} className="underline">{node.title}</Link> / Checkpoint</p>
        <h1 className="text-2xl">Checkpoint quiz</h1>
        <p className="text-sm text-muted">{node.checkpoint.length} questions, one attempt at each, no hints. Score {Math.round(node.masteryThreshold * 100)}% or more to master this topic.</p>
      </header>
      <QuizRunner key={attempt} questions={node.checkpoint} keyPrefix={`${node.id}/cp${attempt}`} reveal onFinish={(r) => record(node.id, r.score, node.masteryThreshold)}>
        {(r) => (<><Outcome node={node} result={r} kind="checkpoint" />{r.score < node.masteryThreshold && <button type="button" className="btn" onClick={() => setAttempt(attempt + 1)}>Retake checkpoint</button>}</>)}
      </QuizRunner>
    </div>
  );
}

export function TestOutPage() {
  const { nodeId = '' } = useParams();
  const node = catalog.byId.get(nodeId)!;
  const record = useProgress((s) => s.recordTestOut);
  // Read once: recording the attempt must not hide the result that is on screen.
  const [allowed] = useState(() => canAttemptTestOut(useProgress.getState().nodes[node.id], dayString(new Date())));
  const [started, setStarted] = useState(false);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <p className="text-sm text-muted"><Link to={`/node/${node.id}`} className="underline">{node.title}</Link> / Test out</p>
        <h1 className="text-2xl">Test out of {node.title}</h1>
      </header>
      {!allowed ? (
        <div className="card"><p>You have already tried to test out of this topic today. You can try again tomorrow, or <Link to={`/learn/${node.id}`} className="text-accent underline">take the lesson</Link> now.</p></div>
      ) : !started ? (
        <div className="card space-y-3">
          <p>{node.testOut.length} harder questions with one attempt at each, no hints, and no answers shown until the end. Score {Math.round(node.masteryThreshold * 100)}% or more and this topic is marked as mastered without taking the lesson.</p>
          <p className="text-sm text-muted">You get one test-out attempt per topic per day. Starting counts as today's attempt.</p>
          <button type="button" className="btn btn-primary" onClick={() => { record(node.id, 0, node.masteryThreshold); setStarted(true); }}>Start</button>
        </div>
      ) : (
        <QuizRunner questions={node.testOut} keyPrefix={`${node.id}/to`} reveal={false} onFinish={(r) => record(node.id, r.score, node.masteryThreshold)}>
          {(r) => <Outcome node={node} result={r} kind="test-out" />}
        </QuizRunner>
      )}
    </div>
  );
}
