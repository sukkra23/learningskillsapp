import { parse, simplify, type MathNode } from 'mathjs';

const FUNCTIONS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'exp', 'log', 'ln', 'sqrt', 'abs', 'cbrt', 'log10', 'log2'];
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };
const SCOPE_FUNCS = { ln: Math.log };

export type ParseResult = { ok: true; node: MathNode } | { ok: false; error: string };

/** Parses an expression, allowing only the declared variables and a fixed set of functions. */
export function parseExpression(input: string, variables: string[]): ParseResult {
  const src = input.trim().replace(/[−–]/g, '-').replace(/×|·/g, '*').replace(/π/g, 'pi').replace(/\*\*/g, '^');
  if (!src) return { ok: false, error: 'Type an expression.' };
  if (/[=<>!;:\[\]{}"'`]/.test(src)) return { ok: false, error: 'Enter an expression only, without "=" or other symbols.' };
  let node: MathNode;
  try { node = parse(src); } catch { return { ok: false, error: 'That expression could not be read. Check brackets and operators.' }; }
  let error = '';
  node.traverse((n: MathNode, _path: string, parent: MathNode) => {
    const t = n.type;
    if (t === 'SymbolNode') {
      const name = (n as unknown as { name: string }).name;
      const isFn = parent?.type === 'FunctionNode' && (parent as unknown as { fn: MathNode }).fn === n;
      if (isFn) { if (!FUNCTIONS.includes(name)) error ||= `"${name}" is not a function Orbit knows.`; }
      else if (!variables.includes(name) && !(name in CONSTANTS)) {
        error ||= name.length > 1 && [...name].every((c) => variables.includes(c))
          ? `Write "${[...name].join('*')}" with a multiplication sign instead of "${name}".`
          : `Unknown symbol "${name}". Use only: ${variables.join(', ') || 'numbers'}.`;
      }
    } else if (!['OperatorNode', 'ConstantNode', 'ParenthesisNode', 'FunctionNode'].includes(t)) {
      error ||= 'That expression uses notation Orbit cannot check.';
    }
  });
  return error ? { ok: false, error } : { ok: true, node };
}

/** mulberry32: a tiny deterministic PRNG, so the sample points never change between runs. */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLES = 24;
const MIN_VALID = 8;
const SEED = 0x0b17;

function evalAt(node: MathNode, scope: Record<string, number>): number | null {
  try {
    const v = node.evaluate({ ...CONSTANTS, ...SCOPE_FUNCS, ...scope });
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch { return null; }
}

export type EquivResult = { equivalent: boolean; error?: string };

/**
 * Decides whether two expressions are equal as functions of `variables`.
 * A symbolic simplification of the difference is tried first as a fast path;
 * the decision is made by comparing values at fixed pseudo-random points.
 */
export function equivalent(input: string, answer: string, variables: string[], domain: [number, number] = [0.5, 3]): EquivResult {
  const a = parseExpression(input, variables);
  if (!a.ok) return { equivalent: false, error: a.error };
  const b = parseExpression(answer, variables);
  if (!b.ok) throw new Error(`Reference answer "${answer}" is invalid: ${b.error}`);

  try {
    const diff = simplify(`(${a.node.toString()}) - (${b.node.toString()})`);
    if (diff.type === 'ConstantNode' && (diff as unknown as { value: number }).value === 0) return { equivalent: true };
  } catch { /* fall through to numeric comparison */ }

  const rand = prng(SEED);
  const [lo, hi] = domain;
  let valid = 0;
  for (let i = 0; i < SAMPLES * 3 && valid < SAMPLES; i++) {
    const scope = Object.fromEntries(variables.map((v) => [v, lo + (hi - lo) * rand()]));
    const x = evalAt(a.node, scope), y = evalAt(b.node, scope);
    if (y === null) continue;            // reference undefined here: not a usable point
    if (x === null) return { equivalent: false };
    if (Math.abs(x - y) > 1e-9 * Math.max(1, Math.abs(x), Math.abs(y))) return { equivalent: false };
    valid++;
  }
  return valid >= MIN_VALID ? { equivalent: true } : { equivalent: false, error: 'That expression could not be checked.' };
}
