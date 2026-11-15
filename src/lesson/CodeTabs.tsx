import { useId, useState } from 'react';
import type { Lang, Step } from '../content/schema';
import type { RunResult } from '../runner/compare';
import { TraceView } from '../runner/TraceView';
import { Markdown } from '../ui/Markdown';

export const LANG_NAME: Record<Lang, string> = { python: 'Python', javascript: 'JavaScript', java: 'Java', cpp: 'C++', c: 'C', rust: 'Rust' };
type TabsStep = Extract<Step, { kind: 'code-tabs' }>;

const LANG_KEY = 'orbit-lang';
const preferred = () => { try { return localStorage.getItem(LANG_KEY); } catch { return null; } };

/** The same concept in several languages, behind a tab switcher that remembers your language. */
export function CodeTabs({ step }: { step: TabsStep }) {
  const id = useId();
  const [lang, setLang] = useState<Lang>(() => step.tabs.find((t) => t.language === preferred())?.language ?? step.tabs[0].language);
  const tab = step.tabs.find((t) => t.language === lang) ?? step.tabs[0];
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = (l: Lang) => { setLang(l); setResult(null); try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ } };
  const onKey = (e: React.KeyboardEvent) => {
    const i = step.tabs.findIndex((t) => t.language === lang);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const next = step.tabs[(i + d + step.tabs.length) % step.tabs.length].language;
    pick(next);
    document.getElementById(`${id}-${next}`)?.focus();
  };
  const run = async () => {
    setBusy(true);
    const { runCode } = await import('../runner');
    setResult(await runCode(tab.language as 'python' | 'javascript', tab.code));
    setBusy(false);
  };
  const canRun = tab.runnable && (tab.language === 'python' || tab.language === 'javascript');

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Programming language" className="flex flex-wrap gap-1" onKeyDown={onKey}>
        {step.tabs.map((t) => (
          <button key={t.language} id={`${id}-${t.language}`} role="tab" type="button" aria-selected={t.language === lang} aria-controls={`${id}-panel`} tabIndex={t.language === lang ? 0 : -1}
            onClick={() => pick(t.language)} className={`rounded-t-lg border-b-2 px-3 py-1.5 text-sm font-medium ${t.language === lang ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'}`}>
            {LANG_NAME[t.language]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${lang}`} className="space-y-3">
        {tab.trace?.length ? <TraceView key={lang} code={tab.code} trace={tab.trace} language={LANG_NAME[lang]} /> : (
          <pre className="overflow-x-auto rounded-xl bg-surface2 p-3 font-mono text-sm"><code>{tab.code}</code></pre>
        )}
        {tab.note && <Markdown className="text-sm text-muted">{tab.note}</Markdown>}
        {canRun ? (
          <div className="space-y-2">
            <button type="button" className="btn" onClick={() => void run()} disabled={busy}>{busy ? 'Running…' : `Run this ${LANG_NAME[lang]}`}</button>
            {result && <pre className="overflow-x-auto rounded-xl bg-surface2 p-3 font-mono text-sm" aria-live="polite">{result.error ?? result.stdout ?? ''}</pre>}
          </div>
        ) : !tab.trace?.length && (lang !== 'python' && lang !== 'javascript') ? (
          <p className="text-xs text-muted">{LANG_NAME[lang]} is not run in the browser. Orbit teaches it with recorded step-throughs and predict-the-output questions.</p>
        ) : null}
      </div>
    </div>
  );
}
