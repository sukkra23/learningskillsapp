import { z, type ZodTypeAny } from 'zod';

/**
 * Prop schemas for every widget. Kept free of React so the content validator
 * (a Node script) can import it. The components live in ./registry.tsx.
 */
const range = z.tuple([z.number(), z.number()]);
const param = z.object({
  name: z.string().regex(/^[a-zA-Z]\w*$/),
  label: z.string().optional(),
  min: z.number(), max: z.number(), step: z.number().positive(), value: z.number(),
}).strict();

export const widgetSchemas: Record<string, ZodTypeAny> = {
  'function-plot': z.object({
    /** math.js expression in x and the declared params. */
    expr: z.string(),
    /** Optional second curve, drawn dashed. */
    compare: z.string().optional(),
    params: z.array(param).default([]),
    xRange: range.default([-5, 5]),
    yRange: range.default([-5, 5]),
    /** tangent: draggable point with tangent line; secant: second point at x+h with slope readout. */
    mode: z.enum(['plot', 'tangent', 'secant']).default('plot'),
    caption: z.string().optional(),
  }).strict(),
  'logic-gates': z.object({
    mode: z.enum(['gate', 'transistor', 'half-adder', 'full-adder']).default('gate'),
    gates: z.array(z.enum(['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'])).default(['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR']),
  }).strict(),
  alu: z.object({ bits: z.union([z.literal(4), z.literal(8)]).default(4) }).strict(),
  'cpu-sim': z.object({ program: z.array(z.string()).min(1), memory: z.record(z.number()).default({}) }).strict(),
  'sort-visualizer': z.object({
    algorithm: z.enum(['bubble', 'insertion', 'selection', 'binary-search']).default('bubble'),
    data: z.array(z.number()).min(2).default([5, 2, 8, 1, 9, 3]),
    target: z.number().optional(),
  }).strict(),
  backprop: z.object({}).strict(),
  circuit: z.object({
    preset: z.enum(['empty', 'series', 'parallel', 'divider', 'two-loop', 'thevenin']).default('series'),
    editable: z.boolean().default(true),
  }).strict(),
  truss: z.object({}).strict(),
  'force-diagram': z.object({
    mass: z.number().positive().default(2),
    /** Preset forces as [magnitude N, angle degrees]. */
    forces: z.array(z.tuple([z.number(), z.number()])).default([]),
    gravity: z.boolean().default(false),
  }).strict(),
  projectile: z.object({ speed: z.number().default(20), angle: z.number().default(45), height: z.number().default(0), g: z.number().default(9.8) }).strict(),
  'motion-graphs': z.object({ x0: z.number().default(0), v0: z.number().default(2), a: z.number().default(1) }).strict(),
  collision: z.object({ m1: z.number().default(1), m2: z.number().default(1), v1: z.number().default(2), v2: z.number().default(0), elasticity: z.number().min(0).max(1).default(1) }).strict(),
  'energy-ramp': z.object({ height: z.number().default(5), mass: z.number().default(1) }).strict(),
  'vector-3d': z.object({ vectors: z.array(z.tuple([z.number(), z.number(), z.number()])).min(1).max(3).default([[2, 1, 0], [0, 1, 2]]) }).strict(),
  'double-pendulum': z.object({}).strict(),
  'orbit-sim': z.object({}).strict(),
  'wave-interference': z.object({}).strict(),
  'particle-in-box': z.object({}).strict(),
};
export const widgetTypes = Object.keys(widgetSchemas);
