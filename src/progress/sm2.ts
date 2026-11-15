/** SM-2 spaced repetition (Wozniak, 1990). Pure and deterministic. */
export interface ReviewCard { ease: number; interval: number; reps: number; due: string }

export const dayString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayString(new Date(y, m - 1, d + n));
}
export function daysBetween(a: string, b: string): number {
  const p = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(b) - p(a)) / 86400000);
}

export const newCard = (today: string): ReviewCard => ({ ease: 2.5, interval: 0, reps: 0, due: today });

/** quality: 0-5. Below 3 the card is relearned from tomorrow. */
export function sm2(card: ReviewCard, quality: number, today: string): ReviewCard {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  const ease = Math.max(1.3, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  if (q < 3) return { ease, reps: 0, interval: 1, due: addDays(today, 1) };
  const reps = card.reps + 1;
  const interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(card.interval * ease);
  return { ease, reps, interval, due: addDays(today, interval) };
}

/** Maps what happened on a question to an SM-2 quality, with no judgement calls. */
export function qualityFor(a: { correct: boolean; tries: number; hintsUsed: number; gaveUp: boolean }): number {
  if (a.gaveUp || !a.correct) return 1;
  if (a.tries > 1) return 3;
  return a.hintsUsed > 0 ? 4 : 5;
}
