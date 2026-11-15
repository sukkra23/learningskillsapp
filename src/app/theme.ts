import { create } from 'zustand';

export type ThemeChoice = 'light' | 'dark' | 'system';
const KEY = 'orbit-theme';

const read = (): ThemeChoice => {
  try { const v = localStorage.getItem(KEY); if (v === 'light' || v === 'dark') return v; } catch { /* ignore */ }
  return 'system';
};
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
export const resolveTheme = (c: ThemeChoice, sysDark: boolean): 'light' | 'dark' => (c === 'system' ? (sysDark ? 'dark' : 'light') : c);

function apply(choice: ThemeChoice) {
  const t = resolveTheme(choice, systemDark());
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t;
  return t;
}

interface ThemeState { choice: ThemeChoice; resolved: 'light' | 'dark'; set(c: ThemeChoice): void; cycle(): void }
export const useTheme = create<ThemeState>()((set, get) => ({
  choice: read(),
  resolved: apply(read()),
  set(choice) {
    try { if (choice === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice); } catch { /* ignore */ }
    set({ choice, resolved: apply(choice) });
  },
  cycle() { const order: ThemeChoice[] = ['light', 'dark', 'system']; get().set(order[(order.indexOf(get().choice) + 1) % 3]); },
}));

// Follow the OS setting live while the choice is "system".
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const { choice } = useTheme.getState();
  if (choice === 'system') useTheme.setState({ resolved: apply('system') });
});
