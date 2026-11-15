import { useState } from 'react';
import type { TraceFrame } from '../content/schema';
import { TraceView } from '../runner/TraceView';

type Raw = Omit<TraceFrame, 'heap' | 'stdout' | 'stack'> & { heap?: { id: string; label?: string; value: string; freed?: boolean }[]; stdout?: string; stack: { name: string; vars: { name: string; value: string; kind?: 'value' | 'pointer' | 'borrow' | 'moved' | 'owner'; target?: string }[] }[] };
const norm = (frames: Raw[]): TraceFrame[] => frames.map((f) => ({ ...f, stdout: f.stdout ?? '', heap: (f.heap ?? []).map((h) => ({ freed: false, ...h })), stack: f.stack.map((s) => ({ ...s, vars: s.vars.map((v) => ({ kind: 'value' as const, ...v })) })) }));

/** Recorded executions. Each program's real output is noted in docs/AUTHORING.md's trace checklist. */
export const EXAMPLES: Record<string, { title: string; language: string; blurb: string; code: string; trace: TraceFrame[] }> = {
  'c-pointers': {
    title: 'C: pointers, malloc and free', language: 'C',
    blurb: 'A pointer is a variable that holds an address. Watch p point at a stack variable, then at heap memory that must be freed by hand.',
    code: '#include <stdio.h>\n#include <stdlib.h>\n\nint main(void) {\n    int x = 5;\n    int *p = &x;\n    *p = 7;\n    int *h = malloc(sizeof(int));\n    *h = x + 1;\n    printf("%d %d\\n", x, *h);\n    free(h);\n    h = NULL;\n    return 0;\n}\n',
    trace: norm([
      { line: 5, note: 'x lives in main\'s stack frame and holds 5.', stack: [{ name: 'main', vars: [{ name: 'x', value: '5' }] }] },
      { line: 6, note: 'p holds the address of x. The arrow shows where it points.', stack: [{ name: 'main', vars: [{ name: 'x', value: '5' }, { name: 'p', value: '&x', kind: 'pointer', target: 'main.x' }] }] },
      { line: 7, note: '*p = 7 writes through the pointer, so x itself changes.', stack: [{ name: 'main', vars: [{ name: 'x', value: '7' }, { name: 'p', value: '&x', kind: 'pointer', target: 'main.x' }] }] },
      { line: 8, note: 'malloc reserves room for one int on the heap. Its contents are not initialised.', stack: [{ name: 'main', vars: [{ name: 'x', value: '7' }, { name: 'p', value: '&x', kind: 'pointer', target: 'main.x' }, { name: 'h', value: '0x1000', kind: 'pointer', target: 'b1' }] }], heap: [{ id: 'b1', label: 'block 0x1000', value: '?' }] },
      { line: 9, note: '*h = x + 1 stores 8 in the heap block.', stack: [{ name: 'main', vars: [{ name: 'x', value: '7' }, { name: 'p', value: '&x', kind: 'pointer', target: 'main.x' }, { name: 'h', value: '0x1000', kind: 'pointer', target: 'b1' }] }], heap: [{ id: 'b1', label: 'block 0x1000', value: '8' }] },
      { line: 10, note: 'printf reads x directly and the heap block through h.', stack: [{ name: 'main', vars: [{ name: 'x', value: '7' }, { name: 'p', value: '&x', kind: 'pointer', target: 'main.x' }, { name: 'h', value: '0x1000', kind: 'pointer', target: 'b1' }] }], heap: [{ id: 'b1', label: 'block 0x1000', value: '8' }], stdout: '7 8\n' },
      { line: 11, note: 'free gives the block back. h still holds the old address: it is now a dangling pointer, and using it would be a bug.', stack: [{ name: 'main', vars: [{ name: 'x', value: '7' }, { name: 'p', value: '&x', kind: 'pointer', target: 'main.x' }, { name: 'h', value: '0x1000', kind: 'pointer', target: 'b1' }] }], heap: [{ id: 'b1', label: 'block 0x1000', value: '8', freed: true }], stdout: '7 8\n' },
      { line: 12, note: 'Setting h to NULL makes the mistake impossible to miss: it no longer points anywhere.', stack: [{ name: 'main', vars: [{ name: 'x', value: '7' }, { name: 'p', value: '&x', kind: 'pointer', target: 'main.x' }, { name: 'h', value: 'NULL' }] }], heap: [{ id: 'b1', label: 'block 0x1000', value: '8', freed: true }], stdout: '7 8\n' },
    ]),
  },
  'rust-ownership': {
    title: 'Rust: ownership and borrowing', language: 'Rust',
    blurb: 'Every value has exactly one owner. Assigning moves ownership; a reference borrows without taking it. The heap block is freed automatically when its owner goes out of scope.',
    code: 'fn length(s: &String) -> usize {\n    s.len()\n}\n\nfn main() {\n    let a = String::from("hi");\n    let b = a;\n    let n = length(&b);\n    println!("{} {}", b, n);\n}\n',
    trace: norm([
      { line: 6, note: 'a owns a String. The text itself lives on the heap.', stack: [{ name: 'main', vars: [{ name: 'a', value: 'String', kind: 'owner', target: 's1' }] }], heap: [{ id: 's1', label: 'String data', value: '"hi"' }] },
      { line: 7, note: 'let b = a moves ownership to b. a can no longer be used: the compiler rejects any later use of it.', stack: [{ name: 'main', vars: [{ name: 'a', value: 'String', kind: 'moved' }, { name: 'b', value: 'String', kind: 'owner', target: 's1' }] }], heap: [{ id: 's1', label: 'String data', value: '"hi"' }] },
      { line: 8, note: '&b creates a reference. length will borrow the String without owning it.', stack: [{ name: 'main', vars: [{ name: 'a', value: 'String', kind: 'moved' }, { name: 'b', value: 'String', kind: 'owner', target: 's1' }] }], heap: [{ id: 's1', label: 'String data', value: '"hi"' }] },
      { line: 2, note: 'Inside length, s borrows b (dashed arrow). b still owns the data.', stack: [{ name: 'main', vars: [{ name: 'a', value: 'String', kind: 'moved' }, { name: 'b', value: 'String', kind: 'owner', target: 's1' }] }, { name: 'length', vars: [{ name: 's', value: '&b', kind: 'borrow', target: 'main.b' }] }], heap: [{ id: 's1', label: 'String data', value: '"hi"' }] },
      { line: 8, note: 'length returns 2 and the borrow ends. Nothing was freed, because s never owned the String.', stack: [{ name: 'main', vars: [{ name: 'a', value: 'String', kind: 'moved' }, { name: 'b', value: 'String', kind: 'owner', target: 's1' }, { name: 'n', value: '2' }] }], heap: [{ id: 's1', label: 'String data', value: '"hi"' }] },
      { line: 9, note: 'b is still valid after being borrowed, so it can be printed.', stack: [{ name: 'main', vars: [{ name: 'a', value: 'String', kind: 'moved' }, { name: 'b', value: 'String', kind: 'owner', target: 's1' }, { name: 'n', value: '2' }] }], heap: [{ id: 's1', label: 'String data', value: '"hi"' }], stdout: 'hi 2\n' },
      { line: 10, note: 'main ends. b goes out of scope, and because it is the owner, Rust frees the heap data here. No free call, no garbage collector.', stack: [{ name: 'main', vars: [] }], heap: [{ id: 's1', label: 'String data', value: '"hi"', freed: true }], stdout: 'hi 2\n' },
    ]),
  },
  'cpp-new-delete': {
    title: 'C++: new, delete and references', language: 'C++',
    blurb: 'C++ adds references (another name for an existing variable) to C\'s pointers, and pairs new with delete.',
    code: '#include <iostream>\n\nvoid bump(int &r) {\n    r += 10;\n}\n\nint main() {\n    int x = 1;\n    bump(x);\n    int *p = new int(x * 2);\n    std::cout << x << " " << *p << "\\n";\n    delete p;\n    return 0;\n}\n',
    trace: norm([
      { line: 8, note: 'x is a local variable holding 1.', stack: [{ name: 'main', vars: [{ name: 'x', value: '1' }] }] },
      { line: 4, note: 'bump takes its parameter by reference: r is another name for main\'s x, not a copy.', stack: [{ name: 'main', vars: [{ name: 'x', value: '1' }] }, { name: 'bump', vars: [{ name: 'r', value: 'ref', kind: 'borrow', target: 'main.x' }] }] },
      { line: 5, note: 'r += 10 changed x in main.', stack: [{ name: 'main', vars: [{ name: 'x', value: '11' }] }, { name: 'bump', vars: [{ name: 'r', value: 'ref', kind: 'borrow', target: 'main.x' }] }] },
      { line: 10, note: 'new allocates an int on the heap, initialised to 22, and returns its address.', stack: [{ name: 'main', vars: [{ name: 'x', value: '11' }, { name: 'p', value: '0x2000', kind: 'pointer', target: 'n1' }] }], heap: [{ id: 'n1', label: 'int 0x2000', value: '22' }] },
      { line: 11, note: 'Both values are printed.', stack: [{ name: 'main', vars: [{ name: 'x', value: '11' }, { name: 'p', value: '0x2000', kind: 'pointer', target: 'n1' }] }], heap: [{ id: 'n1', label: 'int 0x2000', value: '22' }], stdout: '11 22\n' },
      { line: 12, note: 'Every new needs a matching delete, or the memory leaks. Modern C++ usually wraps this in std::unique_ptr so it happens automatically.', stack: [{ name: 'main', vars: [{ name: 'x', value: '11' }, { name: 'p', value: '0x2000', kind: 'pointer', target: 'n1' }] }], heap: [{ id: 'n1', label: 'int 0x2000', value: '22', freed: true }], stdout: '11 22\n' },
    ]),
  },
};

export default function MemoryTrace({ example }: { example: keyof typeof EXAMPLES }) {
  const [key, setKey] = useState<string>(example);
  const ex = EXAMPLES[key];
  return (
    <div className="space-y-3">
      <div role="group" aria-label="Example" className="flex flex-wrap gap-1">
        {Object.entries(EXAMPLES).map(([k, e]) => <button key={k} type="button" aria-pressed={k === key} className={`btn px-3 py-1 ${k === key ? 'btn-primary' : ''}`} onClick={() => setKey(k)}>{e.language}</button>)}
      </div>
      <h3 className="text-lg">{ex.title}</h3>
      <p className="text-sm text-muted">{ex.blurb}</p>
      <TraceView key={key} code={ex.code} trace={ex.trace} language={ex.language} />
      <p className="text-xs text-muted">Solid arrows are pointers and owners; dashed arrows are references (borrows). Struck-through variables have been moved from; faded heap cells have been freed. These are recordings: {ex.language} is not compiled in the browser.</p>
    </div>
  );
}
