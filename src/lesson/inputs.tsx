import { useState } from 'react';
import type { Question } from '../content/schema';
import type { Response } from '../grading';
import { seededOrder } from '../grading/shuffle';
import { Markdown } from '../ui/Markdown';

export function initialResponse(q: Question, seed: string): Response | null {
  switch (q.type) {
    case 'mcq': return null;
    case 'multi': return { type: 'multi', choices: [] };
    case 'numeric': return { type: 'numeric', text: '' };
    case 'expression': return { type: 'expression', text: '' };
    case 'order': return { type: 'order', order: seededOrder(q.items.length, seed) };
    case 'match': return { type: 'match', picks: q.pairs.map(() => -1) };
    case 'predict-output': return { type: 'predict-output', text: '' };
    case 'explain': return { type: 'explain', text: '', ticks: [] };
    case 'code': return null;
  }
}

export function isAnswerable(q: Question, r: Response | null): boolean {
  if (!r) return false;
  switch (r.type) {
    case 'multi': return r.choices.length > 0;
    case 'numeric': case 'expression': return r.text.trim().length > 0;
    case 'predict-output': return true;
    case 'match': return r.picks.every((p) => p >= 0);
    case 'explain': return r.text.trim().length >= 20;
    default: return q.type === r.type;
  }
}

interface Props { q: Question; seed: string; value: Response | null; onChange(r: Response): void; disabled: boolean; reveal?: boolean }

const choiceClass = (selected: boolean, state: 'none' | 'right' | 'wrong') =>
  `flex w-full cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
    state === 'right' ? 'border-success bg-surface' : state === 'wrong' ? 'border-danger bg-surface' : selected ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-strong'}`;

export function QuestionInput({ q, seed, value, onChange, disabled, reveal = false }: Props) {
  switch (q.type) {
    case 'mcq': {
      const sel = value?.type === 'mcq' ? value.choice : -1;
      return (
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="sr-only">Choose one answer</legend>
          {q.choices.map((c, i) => (
            <label key={i} className={choiceClass(sel === i, reveal ? (i === q.answer ? 'right' : sel === i ? 'wrong' : 'none') : 'none')}>
              <input type="radio" name={seed} className="mt-1 accent-[rgb(var(--accent))]" checked={sel === i} onChange={() => onChange({ type: 'mcq', choice: i })} />
              <Markdown inline>{c}</Markdown>
              {reveal && i === q.answer && <span className="ml-auto text-sm font-semibold text-success">Correct answer</span>}
            </label>
          ))}
        </fieldset>
      );
    }
    case 'multi': {
      const sel = value?.type === 'multi' ? value.choices : [];
      return (
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="mb-1 text-sm text-muted">Select all that apply.</legend>
          {q.choices.map((c, i) => (
            <label key={i} className={choiceClass(sel.includes(i), reveal ? (q.answers.includes(i) ? 'right' : sel.includes(i) ? 'wrong' : 'none') : 'none')}>
              <input type="checkbox" className="mt-1 accent-[rgb(var(--accent))]" checked={sel.includes(i)}
                onChange={() => onChange({ type: 'multi', choices: sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i] })} />
              <Markdown inline>{c}</Markdown>
              {reveal && q.answers.includes(i) && <span className="ml-auto text-sm font-semibold text-success">Correct</span>}
            </label>
          ))}
        </fieldset>
      );
    }
    case 'numeric': case 'expression': {
      const text = value && 'text' in value ? value.text : '';
      const id = `in-${seed}`;
      return (
        <div>
          <label htmlFor={id} className="mb-1 block text-sm text-muted">
            {q.type === 'numeric' ? 'Your answer (a number; fractions like 3/4 and forms like 2e-3 are fine)' : `Your answer (an expression in ${q.variables.join(', ') || 'numbers'}; write multiplication as 2*x or 2x)`}
          </label>
          <div className="flex items-center gap-2">
            <input id={id} type="text" inputMode={q.type === 'numeric' ? 'decimal' : 'text'} autoComplete="off" spellCheck={false} disabled={disabled} value={text}
              onChange={(e) => onChange({ type: q.type, text: e.target.value } as Response)} className="input w-full max-w-xs font-mono" />
            {q.type === 'numeric' && q.unit && <span className="text-muted"><Markdown inline>{q.unit}</Markdown></span>}
          </div>
        </div>
      );
    }
    case 'predict-output': {
      const text = value?.type === 'predict-output' ? value.text : '';
      const id = `in-${seed}`;
      return (
        <div>
          <pre className="mb-3 overflow-x-auto rounded-xl bg-surface2 p-3 font-mono text-sm" aria-label={`${q.language} code`}><code>{q.code}</code></pre>
          <label htmlFor={id} className="mb-1 block text-sm text-muted">What does this program print? Type the exact output.</label>
          <textarea id={id} rows={Math.min(6, Math.max(2, q.answer.split('\n').length + 1))} disabled={disabled} value={text} spellCheck={false}
            onChange={(e) => onChange({ type: 'predict-output', text: e.target.value })} className="input w-full max-w-md font-mono" />
        </div>
      );
    }
    case 'order': return <OrderInput q={q} value={value?.type === 'order' ? value.order : []} onChange={(order) => onChange({ type: 'order', order })} disabled={disabled} />;
    case 'match': {
      const picks = value?.type === 'match' ? value.picks : [];
      const rights = seededOrder(q.pairs.length, seed + ':r');
      return (
        <ul className="space-y-2">
          {q.pairs.map(([left], i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
              <span className="min-w-[8rem] flex-1 font-medium" id={`m-${seed}-${i}`}><Markdown inline>{left}</Markdown></span>
              <select aria-labelledby={`m-${seed}-${i}`} disabled={disabled} value={picks[i] ?? -1} className="input max-w-full flex-[2] py-1.5"
                onChange={(e) => onChange({ type: 'match', picks: picks.map((p, j) => (j === i ? +e.target.value : p)) })}>
                <option value={-1}>Choose a match</option>
                {rights.map((r) => <option key={r} value={r}>{q.pairs[r][1]}</option>)}
              </select>
            </li>
          ))}
        </ul>
      );
    }
    default: return null;
  }
}

/** Reorderable list: drag with a pointer, or use the up/down buttons from the keyboard. */
function OrderInput({ q, value, onChange, disabled }: { q: Extract<Question, { type: 'order' }>; value: number[]; onChange(o: number[]): void; disabled: boolean }) {
  const [drag, setDrag] = useState<number | null>(null);
  const [live, setLive] = useState('');
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
    setLive(`Moved to position ${to + 1} of ${value.length}.`);
  };
  return (
    <div>
      <p className="mb-1 text-sm text-muted">Put these in order. Drag the items, or use the arrow buttons.</p>
      <ol className="space-y-2">
        {value.map((idx, pos) => (
          <li key={idx} draggable={!disabled} onDragStart={() => setDrag(pos)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, pos); setDrag(null); }}
            className={`flex items-center gap-2 rounded-xl border-2 bg-surface px-3 py-2 ${drag === pos ? 'border-accent opacity-60' : 'border-border'} ${disabled ? '' : 'cursor-grab'}`}>
            <span className="w-6 text-center text-sm tabular-nums text-muted">{pos + 1}</span>
            <span className="flex-1"><Markdown inline>{q.items[idx]}</Markdown></span>
            <button type="button" className="btn px-2 py-1" disabled={disabled || pos === 0} onClick={() => move(pos, pos - 1)} aria-label={`Move "${q.items[idx]}" up`}>&uarr;</button>
            <button type="button" className="btn px-2 py-1" disabled={disabled || pos === value.length - 1} onClick={() => move(pos, pos + 1)} aria-label={`Move "${q.items[idx]}" down`}>&darr;</button>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">{live}</p>
    </div>
  );
}
