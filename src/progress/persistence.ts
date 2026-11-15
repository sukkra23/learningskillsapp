import { openDB, type IDBPDatabase } from 'idb';
import { PROGRESS_VERSION, ProgressData, emptyProgress } from './types';

const DB = 'orbit';
const STORE = 'kv';
const KEY = 'progress';
const LS_FALLBACK = 'orbit-progress';
const LS_PENDING = 'orbit-pending';

let dbPromise: Promise<IDBPDatabase> | null = null;
const db = () => (dbPromise ??= openDB(DB, 1, { upgrade(d) { d.createObjectStore(STORE); } }));

/** Upgrades older exports to the current shape. Add a case per version bump. */
export function migrate(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && !('version' in raw)) return { ...(raw as object), version: PROGRESS_VERSION };
  return raw;
}

/** Parses untrusted JSON (a stored value or an imported file) into progress, or explains why not. */
export function parseProgress(raw: unknown): { ok: true; data: ProgressData } | { ok: false; error: string } {
  const r = ProgressData.safeParse(migrate(raw));
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: r.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
}

/**
 * IndexedDB writes are asynchronous and can be cut off when a tab closes or
 * navigates. On page hide the latest state is therefore also written
 * synchronously to localStorage; the next load picks it up and clears it.
 */
export function savePendingSync(data: ProgressData): void {
  try { localStorage.setItem(LS_PENDING, JSON.stringify(data)); } catch { /* storage unavailable */ }
}
function takePending(): ProgressData | null {
  try {
    const text = localStorage.getItem(LS_PENDING);
    if (!text) return null;
    localStorage.removeItem(LS_PENDING);
    const r = parseProgress(JSON.parse(text));
    return r.ok ? r.data : null;
  } catch { return null; }
}

export async function loadProgress(): Promise<ProgressData> {
  const pending = takePending();
  if (pending) { await saveProgress(pending); return pending; }
  let raw: unknown;
  try { raw = await (await db()).get(STORE, KEY); }
  catch { try { raw = JSON.parse(localStorage.getItem(LS_FALLBACK) ?? 'null'); } catch { raw = null; } }
  if (raw == null) return emptyProgress();
  const r = parseProgress(raw);
  return r.ok ? r.data : emptyProgress();
}

export async function saveProgress(data: ProgressData): Promise<void> {
  try { await (await db()).put(STORE, data, KEY); }
  catch { try { localStorage.setItem(LS_FALLBACK, JSON.stringify(data)); } catch { /* storage unavailable */ } }
}

export const exportFile = (data: ProgressData) =>
  JSON.stringify({ app: 'orbit', exportedAt: new Date().toISOString(), progress: data }, null, 2);

export function importFile(text: string): { ok: true; data: ProgressData } | { ok: false; error: string } {
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { ok: false, error: 'That file is not valid JSON.' }; }
  const inner = json && typeof json === 'object' && 'progress' in json ? (json as { progress: unknown }).progress : json;
  const r = parseProgress(inner);
  return r.ok ? r : { ok: false, error: `That file is not an Orbit backup (${r.error}).` };
}
