import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { widgetSchemas } from './schemas';
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
