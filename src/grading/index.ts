import type { Question } from '../content/schema';
import { equivalent } from './expression';
import { matchChecklist } from './explain';
import { parseNumber, withinTolerance } from './numeric';

export interface GradeResult {
  correct: boolean;
  /** 0..1; partial credit only for `explain` and `code`. */
  score: number;
  /** Set when the response could not be read; the attempt should not be counted. */
  invalid?: string;
}

/** What the learner submits, per question type. */
export type Response =
  | { type: 'mcq'; choice: number }
  | { type: 'multi'; choices: number[] }
  | { type: 'numeric'; text: string }
  | { type: 'expression'; text: string }
  /** The items' original indices, in the learner's order. */
  | { type: 'order'; order: number[] }
  /** For each left item i, the index of the pair whose right side was chosen. */
  | { type: 'match'; picks: number[] }
  | { type: 'predict-output'; text: string }
  | { type: 'explain'; text: string; ticks: boolean[] }
  | { type: 'code'; passed: number; total: number };

const result = (correct: boolean): GradeResult => ({ correct, score: correct ? 1 : 0 });
export const normaliseOutput = (s: string) => s.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '').replace(/^\n+/, '');

/** Deterministic grading for every question type. Pure: same inputs, same result. */
export function grade(q: Question, r: Response): GradeResult {
  if (q.type !== r.type) throw new Error(`response type "${r.type}" does not match question type "${q.type}"`);
  switch (q.type) {
    case 'mcq': return result((r as { choice: number }).choice === q.answer);
    case 'multi': {
      const got = [...new Set((r as { choices: number[] }).choices)].sort((a, b) => a - b);
      const want = [...new Set(q.answers)].sort((a, b) => a - b);
      return result(got.length === want.length && got.every((v, i) => v === want[i]));
    }
    case 'numeric': {
      const x = parseNumber((r as { text: string }).text);
      if (x === null) return { correct: false, score: 0, invalid: 'Enter a number, such as 12.5, 3/4 or 2e-3.' };
      return result(withinTolerance(x, q.answer, q.tolerance));
    }
    case 'expression': {
      const e = equivalent((r as { text: string }).text, q.answer, q.variables, q.domain);
      return e.error ? { correct: false, score: 0, invalid: e.error } : result(e.equivalent);
    }
    case 'order': {
      const order = (r as { order: number[] }).order;
      // Compare by text so that two identical items are interchangeable.
      return result(order.length === q.items.length && order.every((idx, pos) => q.items[idx] === q.items[pos]));
    }
    case 'match': {
      const picks = (r as { picks: number[] }).picks;
      return result(picks.length === q.pairs.length && picks.every((p, i) => q.pairs[p]?.[1] === q.pairs[i][1]));
    }
    case 'predict-output':
      return result(normaliseOutput((r as { text: string }).text) === normaliseOutput(q.answer));
    case 'explain': {
      const { ticks } = r as { ticks: boolean[] };
      const score = q.checklist.length ? ticks.filter(Boolean).length / q.checklist.length : 0;
      return { correct: score >= 0.6, score };
    }
    case 'code': {
      const { passed, total } = r as { passed: number; total: number };
      return { correct: total > 0 && passed === total, score: total ? passed / total : 0 };
    }
  }
}

/** The response that the content file itself says is right. Used to self-check content. */
export function referenceResponse(q: Question): Response {
  switch (q.type) {
    case 'mcq': return { type: 'mcq', choice: q.answer };
    case 'multi': return { type: 'multi', choices: q.answers };
    case 'numeric': return { type: 'numeric', text: String(q.answer) };
    case 'expression': return { type: 'expression', text: q.answer };
    case 'order': return { type: 'order', order: q.items.map((_, i) => i) };
    case 'match': return { type: 'match', picks: q.pairs.map((_, i) => i) };
    case 'predict-output': return { type: 'predict-output', text: q.answer };
    case 'explain': return { type: 'explain', text: q.modelAnswer, ticks: matchChecklist(q.modelAnswer, q.checklist) };
    case 'code': return { type: 'code', passed: q.tests.length, total: q.tests.length };
  }
}

/** Fraction of questions answered correctly; the number compared against a mastery threshold. */
export const quizScore = (results: boolean[]) => (results.length ? results.filter(Boolean).length / results.length : 0);
