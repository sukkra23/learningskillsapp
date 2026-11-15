import { grade, referenceResponse } from '../grading';
import { parseExpression } from '../grading/expression';
import type { Catalog } from './catalog';
import { nodeQuestions, type Question } from './schema';

/** Problems with a single question that the schema cannot express. */
export function selfCheckQuestion(q: Question): string[] {
  const errors: string[] = [];
  try {
    if (q.type === 'expression') {
      const p = parseExpression(q.answer, q.variables);
      if (!p.ok) return [`reference answer cannot be parsed: ${p.error}`];
    }
    const r = grade(q, referenceResponse(q));
    if (r.invalid) errors.push(`stated answer is unreadable by its own grader: ${r.invalid}`);
    else if (!r.correct) errors.push(q.type === 'explain' ? 'the model answer does not satisfy its own keyword checklist' : 'stated answer does not pass its own grader');
    if (q.type === 'numeric') {
      const span = Math.max(q.tolerance.abs ?? 0, (q.tolerance.rel ?? 0) * Math.abs(q.answer));
      if (grade(q, { type: 'numeric', text: String(q.answer + 3 * span + 1e-6) }).correct) errors.push('tolerance accepts values far from the answer');
      if (q.answer !== 0 && span > Math.abs(q.answer) * 0.1) errors.push('tolerance is wider than 10% of the answer');
    }
    if (q.type === 'mcq' && new Set(q.choices).size !== q.choices.length) errors.push('duplicate choices');
    if (q.type === 'match' && new Set(q.pairs.map((p) => p[0])).size !== q.pairs.length) errors.push('duplicate left-hand items');
    if (q.type === 'code') for (const lang of ['python', 'javascript'] as const) {
      const v = q.variants[lang];
      if (v && !v.reference.includes(q.entry)) errors.push(`${lang} reference does not define "${q.entry}"`);
    }
  } catch (e) { errors.push((e as Error).message); }
  return errors;
}

/** Checks that every question's own stated answer is accepted by the grader. */
export function selfCheckContent(catalog: Catalog): string[] {
  const out: string[] = [];
  for (const node of catalog.nodes)
    for (const { question } of nodeQuestions(node))
      for (const e of selfCheckQuestion(question)) out.push(`${node.id} [${question.id}]: ${e}`);
  for (const [track, items] of Object.entries(catalog.diagnostics))
    for (const item of items)
      for (const e of selfCheckQuestion(item.question)) out.push(`content/${track}/diagnostic.json [${item.question.id}]: ${e}`);
  return out;
}
