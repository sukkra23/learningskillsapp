/// <reference lib="webworker" />
import { runJs } from './jsHarness';

// Remove network and storage access before any learner code runs. This is a
// guard against accidents, not a security boundary: the code is the learner's own.
for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'Worker', 'SharedWorker', 'BroadcastChannel']) {
  try { Object.defineProperty(self, name, { value: undefined, writable: false, configurable: false }); } catch { /* not present */ }
}

self.onmessage = (e: MessageEvent<{ code: string; entry: string | null; args: unknown[][] }>) => {
  const { code, entry, args } = e.data;
  self.postMessage(runJs(code, entry, args));
};
