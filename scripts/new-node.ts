/**
 * Scaffolds a new skill node.
 *   npm run new-node -- <track> <slug> "<Title>" [--prereq id]... [--ready]
 * Creates content/<track>/<slug>.json as a stub, or with --ready as a lesson
 * skeleton that you must fill in before validation passes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { TRACKS } from '../src/content/schema';
import { CONTENT_DIR } from './load-content';

const args = process.argv.slice(2);
const prereqs: string[] = [];
let ready = false;
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--prereq') prereqs.push(args[++i]);
  else if (args[i] === '--ready') ready = true;
  else positional.push(args[i]);
}
const [track, slug, title] = positional;
const fail = (msg: string): never => { console.error(msg + '\nUsage: npm run new-node -- <track> <slug> "<Title>" [--prereq id]... [--ready]'); process.exit(1); };
if (!track || !slug || !title) fail('Missing arguments.');
if (!(TRACKS as readonly string[]).includes(track)) fail(`Unknown track "${track}". Use one of: ${TRACKS.join(', ')}.`);
if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail('The slug may contain only lowercase letters, digits and dashes.');
const file = path.join(CONTENT_DIR, track, `${slug}.json`);
if (fs.existsSync(file)) fail(`${file} already exists.`);

const q = (id: string, difficulty: number) => ({
  id, type: 'mcq', difficulty, prompt: 'TODO: write the question.', choices: ['TODO: correct choice', 'TODO: distractor'], answer: 0,
  hints: ['TODO: a first nudge.'], solution: 'TODO: a worked solution.',
});
const node: Record<string, unknown> = {
  id: `${track}.${slug}`, track, title, summary: 'TODO: one sentence on what this node teaches.',
  status: ready ? 'ready' : 'stub', prerequisites: prereqs, estimatedMinutes: 30, difficulty: 2, strand: 'TODO',
};
if (ready) {
  node.steps = [
    { kind: 'explain', id: 'intro', title: 'TODO', body: 'TODO: two or three short sentences, then let the widget do the work.', widget: { type: 'function-plot', props: { expr: 'a * x', params: [{ name: 'a', min: -3, max: 3, step: 0.1, value: 1 }] } } },
    { kind: 'question', id: 'check-1', question: q('s1', 1) },
    { kind: 'explain', id: 'next', body: 'TODO' },
  ];
  node.problems = [q('p1', 1), q('p2', 2), q('p3', 3)];
  node.checkpoint = [q('c1', 2), q('c2', 2), q('c3', 3), q('c4', 3), q('c5', 3), q('c6', 4)];
  node.testOut = [q('t1', 3), q('t2', 3), q('t3', 4), q('t4', 4)];
}
fs.writeFileSync(file, JSON.stringify(node, null, 2) + '\n');
console.log(`Created ${path.relative(process.cwd(), file)}. Run \`npm run validate\` when you have filled it in.`);
