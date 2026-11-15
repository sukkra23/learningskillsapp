import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from '../src/content/catalog';

export const CONTENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content');

/** Reads every JSON file under /content from disk (the Node twin of src/content/index.ts). */
export function loadContentFromDisk(dir = CONTENT_DIR) {
  const files: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const track of fs.readdirSync(dir).sort()) {
    const sub = path.join(dir, track);
    if (!fs.statSync(sub).isDirectory()) continue;
    for (const f of fs.readdirSync(sub).filter((x) => x.endsWith('.json')).sort()) {
      const key = `content/${track}/${f}`;
      try { files[key] = JSON.parse(fs.readFileSync(path.join(sub, f), 'utf8')); }
      catch (e) { errors.push(`${key}: invalid JSON (${(e as Error).message})`); }
    }
  }
  const built = buildCatalog(files);
  return { catalog: built.catalog, errors: [...errors, ...built.errors] };
}
