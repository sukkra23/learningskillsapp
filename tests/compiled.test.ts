/**
 * Verifies recorded traces and predict-the-output answers against real
 * compilers. C, C++, Java and Rust are not executed in the browser, so this is
 * the check that what the lessons claim those programs print is true. Each
 * language is skipped when its toolchain is not installed.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContentFromDisk } from '../scripts/load-content';
import { nodeQuestions } from '../src/content/schema';
import { normaliseOutput } from '../src/grading';
import { EXAMPLES } from '../src/widgets/MemoryTrace';

const has = (cmd: string) => spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0;
const TOOL = { c: has('gcc'), cpp: has('g++'), rust: has('rustc'), java: has('javac') && has('java') };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-compiled-'));
let n = 0;

function runProgram(language: string, code: string): string {
  const d = path.join(dir, String(n++));
  fs.mkdirSync(d);
  const exe = path.join(d, 'prog');
  if (language === 'c') { fs.writeFileSync(path.join(d, 'main.c'), code); execFileSync('gcc', ['-std=c11', '-Wall', '-Werror', '-o', exe, path.join(d, 'main.c')]); }
  else if (language === 'cpp') { fs.writeFileSync(path.join(d, 'main.cpp'), code); execFileSync('g++', ['-std=c++17', '-Wall', '-Werror', '-o', exe, path.join(d, 'main.cpp')]); }
  else if (language === 'rust') { fs.writeFileSync(path.join(d, 'main.rs'), code); execFileSync('rustc', ['-D', 'warnings', '-o', exe, path.join(d, 'main.rs')], { stdio: 'pipe' }); }
  else if (language === 'java') { fs.writeFileSync(path.join(d, 'Main.java'), code); execFileSync('javac', ['-d', d, path.join(d, 'Main.java')]); return execFileSync('java', ['-cp', d, 'Main'], { encoding: 'utf8' }); }
  else throw new Error(`no toolchain for ${language}`);
  return execFileSync(exe, { encoding: 'utf8' });
}

type Case = { name: string; language: string; code: string; expected: string };
const cases: Case[] = [];
const { catalog } = loadContentFromDisk();
for (const node of catalog.nodes) {
  for (const { question: q } of nodeQuestions(node))
    if (q.type === 'predict-output' && q.language in TOOL) cases.push({ name: `${node.id}/${q.id} (predict-output)`, language: q.language, code: q.code, expected: q.answer });
  for (const s of node.steps) if (s.kind === 'code-tabs') {
    const traced = s.tabs.find((t) => t.trace?.length);
    const out = traced?.trace?.[traced.trace.length - 1].stdout;
    // Every compiled-language tab in the step must print what the recorded trace ends with.
    if (out !== undefined) for (const t of s.tabs) if (t.language in TOOL) cases.push({ name: `${node.id}/${s.id} (${t.language} tab)`, language: t.language, code: t.code, expected: out });
  }
}
for (const items of Object.values(catalog.diagnostics)) for (const i of items) {
  const q = i.question;
  if (q.type === 'predict-output' && q.language in TOOL) cases.push({ name: `diagnostic/${q.id}`, language: q.language, code: q.code, expected: q.answer });
}
const LANG: Record<string, string> = { C: 'c', 'C++': 'cpp', Rust: 'rust' };
for (const [k, ex] of Object.entries(EXAMPLES)) cases.push({ name: `lab trace ${k}`, language: LANG[ex.language], code: ex.code, expected: ex.trace[ex.trace.length - 1].stdout });

describe('compiled-language content matches real compiler output', () => {
  it('finds programs to check', () => { expect(cases.length).toBeGreaterThanOrEqual(8); });
  for (const c of cases) {
    it.skipIf(!TOOL[c.language as keyof typeof TOOL])(`${c.name} [${c.language}]`, () => {
      expect(normaliseOutput(runProgram(c.language, c.code))).toBe(normaliseOutput(c.expected));
    });
  }
});
