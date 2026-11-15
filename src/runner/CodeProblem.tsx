import { useState } from 'react';
import type { Question } from '../content/schema';
import { useProgress } from '../progress/store';
import { CodeEditor } from './CodeEditor';
import type { RunResult } from './compare';
import { runCode, type RunLang } from './index';

type CodeQ = Extract<Question, { type: 'code' }>;
const NAMES: Record<RunLang, string> = { python: 'Python', javascript: 'JavaScript' };
const show = (v: unknown) => JSON.stringify(v);

export function RunOutput({ result }: { result: RunResult }) {
  return (
    <div className="space-y-2 text-sm" aria-live="polite">
      {result.error && <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-danger p-3 font-mono text-danger">{result.error}</pre>}
      {result.stdout && <div><p className="text-muted">Output</p><pre className="overflow-x-auto rounded-xl bg-surface2 p-3 font-mono">{result.stdout}</pre></div>}
      {result.tests.length > 0 && (
        <ul className="space-y-1">
          {result.tests.map((t, i) => (
            <li key={i} className={`rounded-lg border px-3 py-1.5 ${t.pass ? 'border-success' : 'border-danger'}`}>
              <span className={`font-semibold ${t.pass ? 'text-success' : 'text-danger'}`}>{t.pass ? 'Pass' : 'Fail'}</span>{' '}
              {t.hidden ? <span className="text-muted">Hidden test {i + 1}</span> : (
                <span className="font-mono">({t.args.map(show).join(', ')}) &rarr; expected {show(t.expected)}{!t.pass && (t.error ? `, raised ${t.error}` : `, got ${show(t.got)}`)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Editor + runner for a coding question. Reports the pass count on every submission. */
export default function CodeProblem({ question: q, qkey, disabled, onResult }: { question: CodeQ; qkey: string; disabled: boolean; onResult(passed: number, total: number): void }) {
  const langs = (Object.keys(q.variants) as RunLang[]).filter((l) => q.variants[l]);
  const [lang, setLang] = useState<RunLang>(langs[0]);
  const saved = useProgress((s) => s.scratch[`${qkey}:${lang}`]);
  const code = saved ?? q.variants[lang]!.starter;
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const setCode = (v: string) => useProgress.getState().setScratch(`${qkey}:${lang}`, v);

  const go = async (submit: boolean) => {
    setBusy(lang === 'python' ? 'Starting Python (the first run downloads it, about 12 MB)…' : 'Running…');
    const tests = q.tests.filter((t) => submit || !t.hidden);
    const r = await runCode(lang, code, { entry: q.entry, tests });
    setResult(r);
    setBusy(null);
    if (submit) onResult(r.tests.filter((t) => t.pass).length, q.tests.length);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`lang-${qkey}`} className="text-sm text-muted">Language</label>
        <select id={`lang-${qkey}`} className="input py-1.5" value={lang} onChange={(e) => { setLang(e.target.value as RunLang); setResult(null); }} disabled={langs.length < 2}>
          {langs.map((l) => <option key={l} value={l}>{NAMES[l]}</option>)}
        </select>
        <span className="text-sm text-muted">Define <code className="font-mono">{q.entry}</code>. It is called once per test.</span>
      </div>
      <CodeEditor key={lang} value={code} onChange={setCode} language={lang} label={`${NAMES[lang]} code editor`} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" disabled={!!busy} onClick={() => void go(false)}>Run examples</button>
        <button type="button" className="btn btn-primary" disabled={!!busy || disabled} onClick={() => void go(true)}>Submit ({q.tests.length} tests)</button>
        <button type="button" className="btn" disabled={!!busy} onClick={() => { setCode(q.variants[lang]!.starter); setResult(null); }}>Reset code</button>
        {busy && <span role="status" className="text-sm text-muted">{busy}</span>}
      </div>
      {result && <RunOutput result={result} />}
    </div>
  );
}
