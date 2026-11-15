import { nodeQuestions, qid, type Question, type SkillNode } from './schema';
import { buildCatalog } from './catalog';

// Vite inlines the content at build time; nothing is fetched at runtime.
const files = import.meta.glob('/content/**/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const { catalog, errors } = buildCatalog(files);
if (errors.length) console.error('Content errors (run `npm run validate`):\n' + errors.join('\n'));

export { catalog };
export const getNode = (id: string) => catalog.byId.get(id);
export const trackNodes = (track: string) => catalog.nodes.filter((n) => n.track === track);

const questionIndex = new Map<string, { node: SkillNode; question: Question }>();
for (const node of catalog.nodes)
  for (const { question } of nodeQuestions(node)) questionIndex.set(qid(node.id, question.id), { node, question });
/** Looks up a question by its global key "<nodeId>/<questionId>". */
export const findQuestion = (key: string) => questionIndex.get(key);
