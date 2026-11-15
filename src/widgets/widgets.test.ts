import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { widgetSchemas } from './schemas';
import { EXAMPLES } from './MemoryTrace';
import { steps } from './SortVisualizer';
import { fmt } from './ui';

describe('widget registry', () => {
  it('registers a component for every schema, and nothing else', () => {
    const src = fs.readFileSync(new URL('./all.ts', import.meta.url), 'utf8');
    const registered = [...src.matchAll(/register\('([\w-]+)'/g)].map((m) => m[1]).sort();
    expect(registered).toEqual(Object.keys(widgetSchemas).sort());
  });
  it('every schema accepts empty props where defaults exist, except those with required fields', () => {
    for (const [type, schema] of Object.entries(widgetSchemas)) {
      if (['function-plot', 'cpu-sim'].includes(type)) expect(schema.safeParse({}).success, type).toBe(false);
      else expect(schema.safeParse({}).success, type).toBe(true);
    }
  });
});

describe('recorded memory traces', () => {
  it.each(Object.entries(EXAMPLES))('%s is internally consistent', (_k, ex) => {
    const lines = ex.code.split('\n').length;
    let out = '';
    for (const f of ex.trace) {
      expect(f.line).toBeLessThanOrEqual(lines);
      expect(f.stdout.startsWith(out)).toBe(true); // output only ever grows
      out = f.stdout;
      const anchors = new Set([...f.heap.map((h) => h.id), ...f.stack.flatMap((s) => s.vars.map((v) => `${s.name}.${v.name}`))]);
      for (const s of f.stack) for (const v of s.vars) if (v.target) expect(anchors.has(v.target), `${v.name} -> ${v.target}`).toBe(true);
    }
  });
  it('ends with the output the real programs print', () => {
    const last = (k: string) => EXAMPLES[k].trace[EXAMPLES[k].trace.length - 1].stdout;
    expect(last('c-pointers')).toBe('7 8\n');
    expect(last('rust-ownership')).toBe('hi 2\n');
    expect(last('cpp-new-delete')).toBe('11 22\n');
  });
});

describe('algorithm steps', () => {
  const data = [5, 2, 8, 1, 9, 3];
  it.each(['bubble', 'insertion', 'selection'] as const)('%s sort ends sorted', (algo) => {
    const s = steps(algo, data);
    expect(s[s.length - 1].arr).toEqual([1, 2, 3, 5, 8, 9]);
    expect(s[0].arr).toEqual(data);
  });
  it('binary search finds a present value in at most log2(n)+1 probes and reports a missing one', () => {
    const found = steps('binary-search', data, 8);
    expect(found[found.length - 1].note).toMatch(/found it at position 4/);
    expect(found.length - 1).toBeLessThanOrEqual(3);
    expect(steps('binary-search', data, 4).pop()!.note).toMatch(/not in the list/);
  });
});


describe('fmt', () => {
  it('trims trailing decimal zeros but never integer digits', () => {
    expect(fmt(100, 0)).toBe('100');
    expect(fmt(0, 0)).toBe('0');
    expect(fmt(10)).toBe('10');
    expect(fmt(2.5)).toBe('2.5');
    expect(fmt(1.25)).toBe('1.25');
    expect(fmt(-0.0000000001)).toBe('0');
    expect(fmt(NaN)).toBe('n/a');
  });
});
