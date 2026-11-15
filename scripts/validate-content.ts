/**
 * Build-time content check. Exits non-zero on any schema error, graph error
 * (cycle, missing id, ready-behind-stub), or a question whose stated answer
 * does not pass its own grader. Run by `npm run validate`, `npm run build` and CI.
 */
import { loadContentFromDisk } from './load-content';
import { selfCheckContent } from '../src/content/selfcheck';

const { catalog, errors } = loadContentFromDisk();
if (!errors.length) errors.push(...selfCheckContent(catalog));

const ready = catalog.nodes.filter((n) => n.status === 'ready').length;
if (errors.length) {
  console.error(`✗ Content validation failed with ${errors.length} error(s):\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ Content OK: ${catalog.nodes.length} nodes (${ready} ready, ${catalog.nodes.length - ready} coming soon) across ${catalog.tracks.length} tracks.`);
