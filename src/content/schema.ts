import { z } from 'zod';
import { widgetSchemas } from '../widgets/schemas';

export const TRACKS = ['cs', 'engineering', 'math', 'physics'] as const;
export const TrackId = z.enum(TRACKS);
export type TrackId = z.infer<typeof TrackId>;

export const LANGS = ['python', 'javascript', 'java', 'cpp', 'c', 'rust'] as const;
export const Lang = z.enum(LANGS);
export type Lang = z.infer<typeof Lang>;

const Difficulty = z.number().int().min(1).max(5);
const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase letters, digits and dashes only');
const Markdown = z.string().min(1);

const QuestionBase = {
  id: Id,
  prompt: Markdown,
  difficulty: Difficulty,
  hints: z.array(Markdown).default([]),
  solution: Markdown,
};

export const McqQuestion = z.object({
  ...QuestionBase,
  type: z.literal('mcq'),
  choices: z.array(Markdown).min(2),
  answer: z.number().int().min(0),
}).strict().refine((q) => q.answer < q.choices.length, 'answer index out of range');

export const MultiQuestion = z.object({
  ...QuestionBase,
  type: z.literal('multi'),
  choices: z.array(Markdown).min(2),
  answers: z.array(z.number().int().min(0)).min(1),
}).strict().refine((q) => q.answers.every((a) => a < q.choices.length), 'answer index out of range');

export const NumericQuestion = z.object({
  ...QuestionBase,
  type: z.literal('numeric'),
  answer: z.number(),
  tolerance: z.object({ abs: z.number().min(0).optional(), rel: z.number().min(0).optional() }).strict().default({ rel: 0.01 }),
  unit: z.string().optional(),
}).strict();

export const ExpressionQuestion = z.object({
  ...QuestionBase,
  type: z.literal('expression'),
  answer: z.string().min(1),
  variables: z.array(z.string().regex(/^[a-zA-Z]\w*$/)).default([]),
  domain: z.tuple([z.number(), z.number()]).default([0.5, 3]),
  /** 'expanded' rejects answers that still contain brackets, so the prompt cannot be typed back. */
  form: z.enum(['any', 'expanded']).default('any'),
}).strict();

export const OrderQuestion = z.object({
  ...QuestionBase,
  type: z.literal('order'),
  /** Items listed in the correct order; the player shuffles them deterministically. */
  items: z.array(Markdown).min(2),
}).strict();

export const MatchQuestion = z.object({
  ...QuestionBase,
  type: z.literal('match'),
  pairs: z.array(z.tuple([Markdown, Markdown])).min(2),
}).strict();

export const PredictOutputQuestion = z.object({
  ...QuestionBase,
  type: z.literal('predict-output'),
  language: Lang,
  code: z.string().min(1),
  answer: z.string(),
}).strict();

export const CodeTest = z.object({
  /** Arguments passed to the entry function. */
  args: z.array(z.unknown()),
  expected: z.unknown(),
  hidden: z.boolean().default(true),
}).strict();

export const CodeVariant = z.object({
  starter: z.string(),
  reference: z.string().min(1),
}).strict();

export const CodeQuestion = z.object({
  ...QuestionBase,
  type: z.literal('code'),
  /** Name of the function the learner must define; called once per test. */
  entry: z.string().regex(/^[a-zA-Z_]\w*$/),
  variants: z.object({ python: CodeVariant.optional(), javascript: CodeVariant.optional() }).strict()
    .refine((v) => v.python || v.javascript, 'at least one language variant is required'),
  tests: z.array(CodeTest).min(2),
}).strict();

export const ExplainQuestion = z.object({
  ...QuestionBase,
  type: z.literal('explain'),
  modelAnswer: Markdown,
  /** Each point is auto-ticked when one keyword from every group appears in the text. */
  checklist: z.array(z.object({ point: z.string().min(1), keywords: z.array(z.array(z.string().min(1)).min(1)).min(1) }).strict()).min(1),
}).strict();

export const Question = z.union([
  McqQuestion, MultiQuestion, NumericQuestion, ExpressionQuestion, OrderQuestion,
  MatchQuestion, PredictOutputQuestion, CodeQuestion, ExplainQuestion,
]);
export type Question = z.infer<typeof Question>;
export type QuestionType = Question['type'];

/** Types that are graded without the learner's own judgement, synchronously. */
export const AUTO_GRADED: QuestionType[] = ['mcq', 'multi', 'numeric', 'expression', 'order', 'match', 'predict-output'];

export const WidgetRef = z.object({ type: z.string(), props: z.record(z.unknown()).default({}) }).strict()
  .superRefine((w, ctx) => {
    const schema = widgetSchemas[w.type];
    if (!schema) { ctx.addIssue({ code: 'custom', message: `unknown widget type "${w.type}"` }); return; }
    const r = schema.safeParse(w.props);
    if (!r.success) for (const i of r.error.issues) ctx.addIssue({ code: 'custom', message: `widget "${w.type}" props.${i.path.join('.')}: ${i.message}` });
  });
export type WidgetRef = z.infer<typeof WidgetRef>;

const TraceVar = z.object({
  name: z.string(),
  value: z.string(),
  /** pointer/borrow draw an arrow to `target` (a heap id or "frame.var"). */
  kind: z.enum(['value', 'pointer', 'borrow', 'moved', 'owner']).default('value'),
  target: z.string().optional(),
}).strict();
export const TraceFrame = z.object({
  line: z.number().int().min(1),
  note: z.string().optional(),
  stack: z.array(z.object({ name: z.string(), vars: z.array(TraceVar) }).strict()),
  heap: z.array(z.object({ id: z.string(), label: z.string().optional(), value: z.string(), freed: z.boolean().default(false) }).strict()).default([]),
  stdout: z.string().default(''),
}).strict();
export type TraceFrame = z.infer<typeof TraceFrame>;

export const CodeTab = z.object({
  language: Lang,
  code: z.string().min(1),
  note: Markdown.optional(),
  trace: z.array(TraceFrame).optional(),
  /** Python and JavaScript tabs can be run live. */
  runnable: z.boolean().default(false),
}).strict();

export const Step = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('explain'), id: Id, title: z.string().optional(), body: Markdown, widget: WidgetRef.optional() }).strict(),
  z.object({ kind: z.literal('question'), id: Id, question: Question }).strict(),
  z.object({ kind: z.literal('code-tabs'), id: Id, title: z.string().optional(), body: Markdown, tabs: z.array(CodeTab).min(1) }).strict(),
]);
export type Step = z.infer<typeof Step>;

export const SkillNode = z.object({
  id: z.string().regex(/^(cs|engineering|math|physics)\.[a-z0-9][a-z0-9-]*$/),
  track: TrackId,
  title: z.string().min(1),
  summary: z.string().min(1),
  status: z.enum(['ready', 'stub']),
  prerequisites: z.array(z.string()).default([]),
  masteryThreshold: z.number().min(0.5).max(1).default(0.8),
  estimatedMinutes: z.number().int().min(1),
  difficulty: Difficulty,
  strand: z.string().optional(),
  steps: z.array(Step).default([]),
  problems: z.array(Question).default([]),
  checkpoint: z.array(Question).default([]),
  testOut: z.array(Question).default([]),
}).strict();
export type SkillNode = z.infer<typeof SkillNode>;

export const Track = z.object({
  id: TrackId,
  title: z.string(),
  tagline: z.string(),
  description: z.string(),
  strands: z.array(z.string()).default([]),
}).strict();
export type Track = z.infer<typeof Track>;

export const DiagnosticItem = z.object({
  nodeId: z.string(),
  tier: z.enum(['basic', 'advanced']),
  question: Question,
}).strict();
export type DiagnosticItem = z.infer<typeof DiagnosticItem>;
export const DiagnosticBank = z.object({ track: TrackId, items: z.array(DiagnosticItem) }).strict();

export const MIN_QUESTIONS_PER_READY_NODE = 10;
export const MIN_CHECKPOINT = 4;
export const MIN_TEST_OUT = 4;
export const MIN_DIAGNOSTIC_ITEMS = 20;

/** Every question in a node with the section it came from. */
export function nodeQuestions(n: SkillNode): { section: 'step' | 'problem' | 'checkpoint' | 'testOut'; question: Question }[] {
  return [
    ...n.steps.flatMap((s) => (s.kind === 'question' ? [{ section: 'step' as const, question: s.question }] : [])),
    ...n.problems.map((question) => ({ section: 'problem' as const, question })),
    ...n.checkpoint.map((question) => ({ section: 'checkpoint' as const, question })),
    ...n.testOut.map((question) => ({ section: 'testOut' as const, question })),
  ];
}
export const qid = (nodeId: string, questionId: string) => `${nodeId}/${questionId}`;
