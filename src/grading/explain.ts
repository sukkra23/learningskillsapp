/** Light, deterministic text matching for "explain it in words" checklists. */
const SUFFIXES = ['ation', 'ing', 'ed', 'es', 'ly', 's'];
export function stem(word: string): string {
  if (word.length > 5 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  for (const suf of SUFFIXES) if (word.length - suf.length >= 4 && word.endsWith(suf)) return word.slice(0, -suf.length);
  // "force" and "forces" should meet at the same stem.
  return word.length > 4 && word.endsWith('e') ? word.slice(0, -1) : word;
}
export const tokens = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/[\s-]+/).filter(Boolean).map(stem);

function hasKeyword(textTokens: string[], keyword: string): boolean {
  const k = tokens(keyword);
  if (!k.length) return false;
  for (let i = 0; i + k.length <= textTokens.length; i++) if (k.every((w, j) => textTokens[i + j] === w)) return true;
  return false;
}

export interface ChecklistPoint { point: string; keywords: string[][] }

/** For each point: true when at least one keyword from every group appears in the text. */
export function matchChecklist(text: string, checklist: ChecklistPoint[]): boolean[] {
  const t = tokens(text);
  return checklist.map((c) => c.keywords.every((group) => group.some((kw) => hasKeyword(t, kw))));
}
