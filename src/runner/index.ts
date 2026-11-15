import { judge, type RawRun, type RunResult, type TestSpec } from './compare';

export type RunLang = 'python' | 'javascript';
export interface RunOptions { entry?: string; tests?: TestSpec[]; timeoutMs?: number }

const timedOut = (tests: TestSpec[], ms: number): RunResult => ({
  stdout: '', timedOut: true, error: `Stopped after ${ms / 1000} seconds. Look for a loop that never ends.`,
  tests: tests.map((t) => ({ pass: false, hidden: t.hidden, args: t.args, expected: t.expected, error: 'timed out' })),
});

function runJavaScript(code: string, entry: string | null, tests: TestSpec[], ms: number): Promise<RunResult> {
  return new Promise((resolve) => {
    const w = new Worker(new URL('./js.worker.ts', import.meta.url), { type: 'module' });
    // Terminating the worker is the only reliable way to stop an infinite loop.
    const t = setTimeout(() => { w.terminate(); resolve(timedOut(tests, ms)); }, ms);
    w.onmessage = (e: MessageEvent<RawRun>) => { clearTimeout(t); w.terminate(); resolve(judge(e.data, tests)); };
    w.onerror = (e) => { clearTimeout(t); w.terminate(); resolve({ stdout: '', error: e.message || 'The code could not be run.', tests: [] }); };
    w.postMessage({ code, entry, args: tests.map((x) => x.args) });
  });
}

let py: Worker | null = null;
let seq = 0;
const base = () => new URL(import.meta.env.BASE_URL, self.location.origin).href;

function pyCall(msg: object, ms: number | null): Promise<{ ready?: boolean; result?: RawRun } | 'timeout'> {
  py ??= new Worker(new URL('./py.worker.ts', import.meta.url), { type: 'module' });
  const w = py;
  const id = ++seq;
  return new Promise((resolve) => {
    const t = ms === null ? null : setTimeout(() => { w.terminate(); py = null; resolve('timeout'); }, ms);
    const on = (e: MessageEvent<{ id: number; ready?: boolean; result?: RawRun }>) => {
      if (e.data.id !== id) return;
      if (t) clearTimeout(t);
      w.removeEventListener('message', on);
      resolve(e.data);
    };
    w.addEventListener('message', on);
    w.postMessage({ id, base: base(), ...msg });
  });
}

/** Downloads and starts Python (about 12 MB the first time, then served from cache). */
export async function warmPython(): Promise<void> { await pyCall({}, null); }

async function runPython(code: string, entry: string | null, tests: TestSpec[], ms: number): Promise<RunResult> {
  await warmPython(); // loading time does not count against the run timeout
  const r = await pyCall({ code, entry, args: tests.map((x) => x.args) }, ms);
  if (r === 'timeout') return timedOut(tests, ms);
  return judge(r.result!, tests);
}

/** Runs learner code in a Web Worker and judges it against the given tests. */
export function runCode(lang: RunLang, code: string, opts: RunOptions = {}): Promise<RunResult> {
  const tests = opts.tests ?? [];
  const entry = opts.entry ?? null;
  return lang === 'python' ? runPython(code, entry, tests, opts.timeoutMs ?? 10000) : runJavaScript(code, entry, tests, opts.timeoutMs ?? 3000);
}
