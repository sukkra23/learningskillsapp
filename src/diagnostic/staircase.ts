/**
 * Deterministic adaptive placement: a one-up, one-down staircase over
 * difficulty levels 1-5. The whole test is a pure function of the item bank
 * and the answers so far, so the same answers always give the same test.
 */
export interface BankItem { id: string; nodeId: string; tier: 'basic' | 'advanced'; difficulty: number }
export interface Answer { itemId: string; correct: boolean }

export const CONFIG = { startLevel: 3, minLevel: 1, maxLevel: 5, minItems: 8, maxItems: 12, reversalsToStop: 4 } as const;

export interface StaircaseState {
  /** Level the next item should be drawn at. */
  level: number;
  /** Levels at which the direction changed (a right answer after a wrong one, or the reverse). */
  reversalLevels: number[];
  /** Level each answered item was presented at. */
  presented: number[];
}

/** Replays the answers to recover the current staircase state. */
export function replay(answers: Answer[]): StaircaseState {
  let level: number = CONFIG.startLevel;
  const reversalLevels: number[] = [];
  const presented: number[] = [];
  answers.forEach((a, i) => {
    presented.push(level);
    if (i > 0 && answers[i - 1].correct !== a.correct) reversalLevels.push(level);
    level = Math.min(CONFIG.maxLevel, Math.max(CONFIG.minLevel, level + (a.correct ? 1 : -1)));
  });
  return { level, reversalLevels, presented };
}

export function isDone(bank: BankItem[], answers: Answer[]): boolean {
  if (answers.length >= CONFIG.maxItems || answers.length >= bank.length) return true;
  return answers.length >= CONFIG.minItems && replay(answers).reversalLevels.length >= CONFIG.reversalsToStop;
}

/**
 * The next item: the unasked item closest in difficulty to the current level.
 * Ties go to the node asked about least so far, then to the earlier node in
 * `nodeOrder` (graph order), then to the lower item id.
 */
export function nextItem(bank: BankItem[], answers: Answer[], nodeOrder: string[]): BankItem | null {
  if (isDone(bank, answers)) return null;
  const asked = new Set(answers.map((a) => a.itemId));
  const perNode = new Map<string, number>();
  for (const it of bank) if (asked.has(it.id)) perNode.set(it.nodeId, (perNode.get(it.nodeId) ?? 0) + 1);
  const { level } = replay(answers);
  const rank = (it: BankItem) => [Math.abs(it.difficulty - level), perNode.get(it.nodeId) ?? 0, nodeOrder.indexOf(it.nodeId)];
  return bank.filter((it) => !asked.has(it.id)).sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return a.id.localeCompare(b.id);
  })[0] ?? null;
}

/** Ability on the 1-5 scale: the mean of the last four reversal levels, or the final level if there were fewer than two. */
export function ability(answers: Answer[]): number {
  const s = replay(answers);
  if (s.reversalLevels.length < 2) return s.level;
  const last = s.reversalLevels.slice(-CONFIG.reversalsToStop);
  return last.reduce((a, b) => a + b, 0) / last.length;
}
