import { NavLink, Outlet, ScrollRestoration, useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { Icon } from '../ui/Icon';
import { useProgress } from '../progress/store';
import { dueReviews } from '../progress/reducers';
import { dayString } from '../progress/sm2';
import { useTheme } from './theme';

const THEME_LABEL = { light: 'Light', dark: 'Dark', system: 'System' } as const;
const THEME_ICON = { light: 'sun', dark: 'moon', system: 'system' } as const;

export function Layout() {
  const { choice, cycle } = useTheme();
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak.current);
  const due = useProgress((s) => dueReviews(s, dayString(new Date())).length);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const onSearch = (e: FormEvent) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}`); };
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-accent-soft text-fg' : 'text-muted hover:text-fg'}`;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
          <NavLink to="/" className="mr-1 flex items-center gap-2 text-lg font-bold" aria-label="Orbit home">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={26} height={26} /> Orbit
          </NavLink>
          <nav aria-label="Main" className="flex items-center gap-1">
            <NavLink to="/" end className={link}>Home</NavLink>
            <NavLink to="/review" className={link}>Review{due > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-xs text-accent-fg">{due}<span className="sr-only"> due</span></span>}</NavLink>
            <NavLink to="/lab" className={link}>Lab</NavLink>
            <NavLink to="/bookmarks" className={link}>Saved</NavLink>
          </nav>
          <form onSubmit={onSearch} role="search" className="ml-auto flex min-w-0 items-center">
            <label htmlFor="site-search" className="sr-only">Search lessons</label>
            <div className="relative">
              <Icon name="search" size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input id="site-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="input w-32 py-1.5 pl-8 text-sm sm:w-44" />
            </div>
          </form>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span title="Daily streak" className="flex items-center gap-1"><Icon name="flame" size={16} /><span className="font-semibold text-fg">{streak}</span><span className="sr-only">day streak</span></span>
            <span title="Experience points"><span className="font-semibold text-fg">{xp}</span> XP</span>
          </div>
          <button type="button" onClick={cycle} className="btn px-2.5 py-1.5" aria-label={`Theme: ${THEME_LABEL[choice]}. Change theme`} title={`Theme: ${THEME_LABEL[choice]}`}>
            <Icon name={THEME_ICON[choice]} /><span className="hidden text-xs sm:inline">{THEME_LABEL[choice]}</span>
          </button>
          <NavLink to="/settings" className={link}>Settings</NavLink>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none">
        <Outlet />
      </main>
      <footer className="border-t border-border py-4 text-center text-xs text-muted">
        Orbit runs entirely in your browser. Your progress is stored on this device only.
      </footer>
      <ScrollRestoration />
    </div>
  );
}
