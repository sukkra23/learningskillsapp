import { create } from 'zustand';
import type { TrackId } from '../content/schema';
import { loadProgress, savePendingSync, saveProgress } from './persistence';
import * as R from './reducers';
import { dayString } from './sm2';
import { emptyProgress, type DiagnosticRecord, type ProgressData } from './types';

interface Actions {
  completeStep(nodeId: string, stepId: string): void;
  recordAttempt(questionId: string, r: R.AttemptResult, opts?: { review?: boolean }): void;
  recordCheckpoint(nodeId: string, score: number, threshold: number): void;
  recordTestOut(nodeId: string, score: number, threshold: number): void;
  applyDiagnostic(track: TrackId, record: DiagnosticRecord, labels: Parameters<typeof R.applyDiagnostic>[3]): void;
  setNote(nodeId: string, text: string): void;
  toggleBookmark(nodeId: string): void;
  setScratch(questionId: string, text: string): void;
  setOnboarded(): void;
  replaceAll(data: ProgressData): void;
  reset(): void;
}
export type ProgressState = ProgressData & Actions;

const today = () => dayString(new Date());

export const useProgress = create<ProgressState>()((set) => ({
  ...emptyProgress(),
  completeStep: (n, s) => set((st) => R.completeStep(st, n, s, today())),
  recordAttempt: (q, r, opts) => set((st) => R.recordAttempt(st, q, r, today(), opts)),
  recordCheckpoint: (n, score, t) => set((st) => R.recordCheckpoint(st, n, score, t, today())),
  recordTestOut: (n, score, t) => set((st) => R.recordTestOut(st, n, score, t, today())),
  applyDiagnostic: (track, record, labels) => set((st) => R.applyDiagnostic(st, track, record, labels)),
  setNote: (n, text) => set((st) => ({ notes: { ...st.notes, [n]: text } })),
  toggleBookmark: (n) => set((st) => ({ bookmarks: st.bookmarks.includes(n) ? st.bookmarks.filter((b) => b !== n) : [...st.bookmarks, n] })),
  setScratch: (q, text) => set((st) => ({ scratch: { ...st.scratch, [q]: text } })),
  setOnboarded: () => set({ onboarded: true }),
  replaceAll: (data) => set(data),
  reset: () => set(emptyProgress()),
}));

/** Strips the action functions, leaving only the serialisable data. */
export function snapshot(s: ProgressState = useProgress.getState()): ProgressData {
  const { version, nodes, attempts, reviews, diagnostics, notes, bookmarks, scratch, xp, streak, lastNode, onboarded } = s;
  return { version, nodes, attempts, reviews, diagnostics, notes, bookmarks, scratch, xp, streak, lastNode, onboarded };
}

export const progressLookup = (s: ProgressData = useProgress.getState()) => (id: string) => s.nodes[id];

let timer: ReturnType<typeof setTimeout> | undefined;
/** Loads stored progress, then saves (debounced) on every change. Call once before rendering. */
export async function initProgress(): Promise<void> {
  useProgress.setState(await loadProgress());
  useProgress.subscribe((s) => {
    clearTimeout(timer);
    timer = setTimeout(() => void saveProgress(snapshot(s)), 250);
  });
  // Do not lose the last change if the tab is closed inside the debounce window.
  window.addEventListener('pagehide', () => savePendingSync(snapshot()));
}
