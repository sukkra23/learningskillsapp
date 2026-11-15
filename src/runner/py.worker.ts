/// <reference lib="webworker" />
import { PY_HARNESS } from './pyHarness';

interface Pyodide { runPython(code: string): unknown; globals: { get(name: string): (...a: unknown[]) => string } }
let ready: Promise<Pyodide> | null = null;

function boot(base: string): Promise<Pyodide> {
  return (ready ??= (async () => {
    // Loaded from this site's own /pyodide folder; never from a CDN.
    const mod = (await import(/* @vite-ignore */ `${base}pyodide/pyodide.mjs`)) as { loadPyodide(o: { indexURL: string }): Promise<Pyodide> };
    const py = await mod.loadPyodide({ indexURL: `${base}pyodide/` });
    py.runPython(PY_HARNESS);
    return py;
  })());
}

self.onmessage = async (e: MessageEvent<{ id: number; base: string; code?: string; entry?: string | null; args?: unknown[][] }>) => {
  const { id, base, code, entry, args } = e.data;
  try {
    const py = await boot(base);
    if (code === undefined) { self.postMessage({ id, ready: true }); return; }
    const json = py.globals.get('__orbit_run')(code, entry ?? null, JSON.stringify(args ?? []));
    self.postMessage({ id, result: JSON.parse(json) });
  } catch (err) {
    self.postMessage({ id, result: { stdout: '', error: `Python could not start: ${err instanceof Error ? err.message : String(err)}`, tests: [] } });
  }
};
