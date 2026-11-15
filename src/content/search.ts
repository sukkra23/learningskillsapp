import type { SkillNode } from './schema';

export interface SearchHit { node: SkillNode; score: number; snippet: string }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

function docText(n: SkillNode): string {
  return n.steps.map((s) => (s.kind === 'question' ? s.question.prompt : `${'title' in s && s.title ? s.title + '. ' : ''}${s.body}`)).join(' ');
}

/** Ranks nodes by how many query words appear in the title (x5), summary (x3), strand (x2) and lesson text (x1). */
export function search(nodes: SkillNode[], query: string): SearchHit[] {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  const hits: SearchHit[] = [];
  for (const node of nodes) {
    const title = norm(node.title), summary = norm(node.summary), strand = norm(node.strand ?? ''), body = docText(node), nbody = norm(body);
    let score = 0;
    let all = true;
    for (const w of words) {
      const s = (title.includes(w) ? 5 : 0) + (summary.includes(w) ? 3 : 0) + (strand.includes(w) ? 2 : 0) + (nbody.includes(w) ? 1 : 0);
      if (s === 0) { all = false; break; }
      score += s;
    }
    if (!all) continue;
    const at = nbody.indexOf(words[0]);
    const snippet = at >= 0 && !summary.includes(words[0]) ? '…' + body.slice(Math.max(0, at - 40), at + 100).replace(/\s+/g, ' ') + '…' : node.summary;
    hits.push({ node, score: score + (node.status === 'ready' ? 0.5 : 0), snippet });
  }
  return hits.sort((a, b) => b.score - a.score || a.node.title.localeCompare(b.node.title));
}
