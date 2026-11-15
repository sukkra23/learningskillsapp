// Copies the Pyodide runtime into public/pyodide so it is served from this site
// (no CDN) and can be cached for offline use. Runs before `dev` and `build`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules/pyodide');
const dst = path.join(root, 'public/pyodide');
fs.mkdirSync(dst, { recursive: true });
for (const f of ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
  const from = path.join(src, f), to = path.join(dst, f);
  if (!fs.existsSync(to) || fs.statSync(to).size !== fs.statSync(from).size) fs.copyFileSync(from, to);
}
