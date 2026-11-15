import { z } from 'zod';
import { checkGraph, topoOrder } from '../graph/graph';
import {
  AUTO_GRADED, DiagnosticBank, MIN_CHECKPOINT, MIN_DIAGNOSTIC_ITEMS, MIN_QUESTIONS_PER_READY_NODE, MIN_TEST_OUT,
  SkillNode, TRACKS, Track, nodeQuestions, type DiagnosticItem, type TrackId,
} from './schema';

export interface Catalog {
  tracks: Track[];
  /** All nodes in topological order (prerequisites first). */
  nodes: SkillNode[];
  byId: Map<string, SkillNode>;
  diagnostics: Record<TrackId, DiagnosticItem[]>;
}

const fmt = (e: z.ZodError) => e.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');

/**
 * Turns raw JSON files (keyed by a path ending in `<track>/<file>.json`) into a
 * catalog, collecting every schema and graph error instead of stopping at the first.
 */
export function buildCatalog(files: Record<string, unknown>): { catalog: Catalog; errors: string[] } {
  const errors: string[] = [];
  const tracks: Track[] = [];
  let nodes: SkillNode[] = [];
  const diagnostics = Object.fromEntries(TRACKS.map((t) => [t, [] as DiagnosticItem[]])) as Record<TrackId, DiagnosticItem[]>;

  for (const path of Object.keys(files).sort()) {
    const m = path.match(/([^/]+)\/([^/]+)\.json$/);
    if (!m) { errors.push(`${path}: unexpected location`); continue; }
    const [, dir, name] = m;
    const raw = files[path];
    if (name === 'track') {
      const r = Track.safeParse(raw);
      if (!r.success) errors.push(`${path}: ${fmt(r.error)}`);
      else if (r.data.id !== dir) errors.push(`${path}: track id "${r.data.id}" does not match folder "${dir}"`);
      else tracks.push(r.data);
    } else if (name === 'diagnostic') {
      const r = DiagnosticBank.safeParse(raw);
      if (!r.success) errors.push(`${path}: ${fmt(r.error)}`);
      else if (r.data.track !== dir) errors.push(`${path}: track "${r.data.track}" does not match folder "${dir}"`);
      else diagnostics[r.data.track] = r.data.items;
    } else {
      const r = SkillNode.safeParse(raw);
      if (!r.success) { errors.push(`${path}: ${fmt(r.error)}`); continue; }
      const node = r.data;
      if (node.track !== dir) errors.push(`${path}: track "${node.track}" does not match folder "${dir}"`);
      if (node.id !== `${dir}.${name}`) errors.push(`${path}: id "${node.id}" should be "${dir}.${name}"`);
      nodes.push(node);
    }
  }

  tracks.sort((a, b) => TRACKS.indexOf(a.id) - TRACKS.indexOf(b.id));
  for (const t of TRACKS) if (!tracks.some((x) => x.id === t)) errors.push(`content/${t}/track.json is missing`);

  errors.push(...checkGraph(nodes));
  for (const node of nodes) errors.push(...checkNode(node));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (const t of TRACKS) {
    const items = diagnostics[t];
    const hasReady = nodes.some((n) => n.track === t && n.status === 'ready');
    if (hasReady && items.length < MIN_DIAGNOSTIC_ITEMS)
      errors.push(`content/${t}/diagnostic.json: ${items.length} items, need at least ${MIN_DIAGNOSTIC_ITEMS}`);
    const ids = new Set<string>();
    for (const item of items) {
      const where = `content/${t}/diagnostic.json [${item.question.id}]`;
      if (ids.has(item.question.id)) errors.push(`${where}: duplicate question id`);
      ids.add(item.question.id);
      const target = byId.get(item.nodeId);
      if (!target) errors.push(`${where}: unknown node "${item.nodeId}"`);
      else if (target.track !== t) errors.push(`${where}: node "${item.nodeId}" belongs to another track`);
      else if (target.status !== 'ready') errors.push(`${where}: node "${item.nodeId}" is a stub; diagnostic items must target ready nodes`);
      if (!AUTO_GRADED.includes(item.question.type)) errors.push(`${where}: type "${item.question.type}" cannot be used in a diagnostic`);
    }
  }

  // Order nodes: by track, then topologically. Falls back to input order if the graph is broken.
  nodes.sort((a, b) => TRACKS.indexOf(a.track) - TRACKS.indexOf(b.track) || a.difficulty - b.difficulty || a.id.localeCompare(b.id));
  try { nodes = topoOrder(nodes); } catch { /* cycle already reported */ }

  return { catalog: { tracks, nodes, byId: new Map(nodes.map((n) => [n.id, n])), diagnostics }, errors };
}

function checkNode(node: SkillNode): string[] {
  const errors: string[] = [];
  const at = `${node.id}`;
  const qs = nodeQuestions(node);
  const ids = new Set<string>();
  for (const s of node.steps) { if (ids.has(s.id)) errors.push(`${at}: duplicate step id "${s.id}"`); ids.add(s.id); }
  const qids = new Set<string>();
  for (const { question } of qs) { if (qids.has(question.id)) errors.push(`${at}: duplicate question id "${question.id}"`); qids.add(question.id); }

  if (node.status === 'stub') {
    if (node.steps.length || qs.length) errors.push(`${at}: a stub must not contain steps or questions`);
    return errors;
  }
  if (node.steps.length < 3) errors.push(`${at}: a ready node needs at least 3 steps`);
  if (!node.steps.some((s) => (s.kind === 'explain' && s.widget) || s.kind === 'code-tabs')) errors.push(`${at}: a ready node needs at least one interactive step`);
  const countable = qs.filter((q) => q.section !== 'testOut').length;
  if (countable < MIN_QUESTIONS_PER_READY_NODE) errors.push(`${at}: ${countable} questions in steps, problems and checkpoint; need at least ${MIN_QUESTIONS_PER_READY_NODE}`);
  if (node.checkpoint.length < MIN_CHECKPOINT) errors.push(`${at}: checkpoint needs at least ${MIN_CHECKPOINT} questions`);
  if (node.testOut.length < MIN_TEST_OUT) errors.push(`${at}: testOut needs at least ${MIN_TEST_OUT} questions`);
  for (const section of ['checkpoint', 'testOut'] as const)
    for (const q of node[section]) if (!AUTO_GRADED.includes(q.type)) errors.push(`${at}: ${section} question "${q.id}" has type "${q.type}", which cannot gate mastery`);
  for (let i = 1; i < node.problems.length; i++)
    if (node.problems[i].difficulty < node.problems[i - 1].difficulty) errors.push(`${at}: problems must be ordered easy to hard ("${node.problems[i].id}")`);
  return errors;
}
