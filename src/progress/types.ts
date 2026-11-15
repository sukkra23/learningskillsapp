import { z } from 'zod';
import { TRACKS } from '../content/schema';

export const PROGRESS_VERSION = 1;

export const NodeProgress = z.object({
  stepsDone: z.array(z.string()).default([]),
  checkpointBest: z.number().min(0).max(1).default(0),
  mastery: z.enum(['none', 'placed', 'checkpoint', 'test-out']).default('none'),
  placement: z.object({ estimate: z.number(), label: z.enum(['mastered', 'review', 'queued']) }).optional(),
  lastTestOutDay: z.string().optional(),
});
export type NodeProgress = z.infer<typeof NodeProgress>;

export const Attempt = z.object({ tries: z.number().int(), correct: z.boolean(), gaveUp: z.boolean() });
export const ReviewCardSchema = z.object({ ease: z.number(), interval: z.number(), reps: z.number(), due: z.string() });

export const DiagnosticRecord = z.object({
  takenAt: z.string(),
  ability: z.number(),
  asked: z.number().int(),
  correct: z.number().int(),
  basic: z.object({ asked: z.number().int(), correct: z.number().int() }),
  advanced: z.object({ asked: z.number().int(), correct: z.number().int() }),
  estimates: z.record(z.number()),
  path: z.array(z.string()),
  recommended: z.string().nullable(),
});
export type DiagnosticRecord = z.infer<typeof DiagnosticRecord>;

export const ProgressData = z.object({
  version: z.literal(PROGRESS_VERSION),
  nodes: z.record(NodeProgress).default({}),
  attempts: z.record(Attempt).default({}),
  reviews: z.record(ReviewCardSchema).default({}),
  diagnostics: z.record(z.enum(TRACKS), DiagnosticRecord).default({}),
  notes: z.record(z.string()).default({}),
  bookmarks: z.array(z.string()).default([]),
  scratch: z.record(z.string()).default({}),
  xp: z.number().default(0),
  streak: z.object({ current: z.number().int(), best: z.number().int(), lastActiveDay: z.string() }).default({ current: 0, best: 0, lastActiveDay: '' }),
  lastNode: z.string().nullable().default(null),
  onboarded: z.boolean().default(false),
});
export type ProgressData = z.infer<typeof ProgressData>;

export const emptyProgress = (): ProgressData => ProgressData.parse({ version: PROGRESS_VERSION });
export const emptyNode = (): NodeProgress => NodeProgress.parse({});

export const XP = { step: 5, correct: 10, checkpoint: 50, review: 5 } as const;

/** One free test-out attempt per node per calendar day. */
export const canAttemptTestOut = (n: NodeProgress | undefined, today: string) => n?.lastTestOutDay !== today;
