import { buildCatalog } from './catalog';

// Vite inlines the content at build time; nothing is fetched at runtime.
const files = import.meta.glob('/content/**/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const { catalog, errors } = buildCatalog(files);
if (errors.length) console.error('Content errors (run `npm run validate`):\n' + errors.join('\n'));

export { catalog };
export const getNode = (id: string) => catalog.byId.get(id);
export const trackNodes = (track: string) => catalog.nodes.filter((n) => n.track === track);
