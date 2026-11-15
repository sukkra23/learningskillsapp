# Authoring guide

Everything a learner sees comes from JSON files under `content/`. No code changes are needed to
add a topic, and nothing in a content file can execute.

```
content/<track>/track.json         the track's title and description
content/<track>/<slug>.json        one topic (a "node")
content/<track>/diagnostic.json    the placement question bank
```

Tracks are `cs`, `engineering`, `math`, `physics`. A node's id is `<track>.<slug>` and must match
its path.

## Workflow

1. Scaffold a file. Add `--ready` for a lesson skeleton instead of a stub.

   ```bash
   npm run new-node -- physics rotation "Rotation" --prereq physics.energy-momentum --ready
   ```

2. Fill it in.
3. Validate. Fix everything it reports.

   ```bash
   npm run validate
   ```

4. Add a check for each numeric answer to `tests/answers.test.ts`, then run the tests.

   ```bash
   npm test
   ```

5. Read the lesson in the browser with `npm run dev`.

## A node

```json
{
  "id": "physics.rotation",
  "track": "physics",
  "title": "Rotation",
  "summary": "One sentence shown on cards and in search.",
  "status": "ready",
  "prerequisites": ["physics.energy-momentum"],
  "masteryThreshold": 0.8,
  "estimatedMinutes": 45,
  "difficulty": 3,
  "strand": "Classical mechanics",
  "steps": [],
  "problems": [],
  "checkpoint": [],
  "testOut": []
}
```

- `status: "stub"` shows the topic on the map as "coming soon". A stub has no steps or questions.
- `prerequisites` may point at other tracks.
- `masteryThreshold` defaults to 0.8.

### Rules the validator enforces

- No cycles, no unknown prerequisite ids, no duplicate ids.
- **A ready node may not depend on a stub.** It could never be unlocked.
- A ready node needs at least 3 steps, at least one interactive step, at least 10 questions across
  steps, problems and checkpoint, at least 4 checkpoint questions and at least 4 test-out questions.
- `problems` must be ordered from easy to hard by `difficulty`.
- Checkpoint, test-out and diagnostic questions must be auto-graded types (no `explain`, no `code`).
- Every question's stated answer must pass its own grader.
- A numeric tolerance may not be wider than 10% of the answer.
- An `explain` model answer must satisfy its own keyword checklist.
- Diagnostic items must point at ready nodes in the same track; a track with ready nodes needs at
  least 20 items.

## Text

Prose fields are Markdown. Maths is LaTeX between dollar signs: `$v = at$` inline, `$$ ... $$` for
a display line. In JSON every backslash is doubled: `"$\\frac{1}{2}mv^2$"`. Write a literal dollar
sign as `\\$`.

Keep steps short. A step is two or three sentences and one thing to do. If a step needs a fourth
paragraph, it is two steps.

## Steps

```json
{ "kind": "explain", "id": "intro", "title": "Optional heading", "body": "Markdown",
  "widget": { "type": "projectile", "props": { "speed": 20, "angle": 45 } } }
```

```json
{ "kind": "question", "id": "q-range", "question": { } }
```

```json
{ "kind": "code-tabs", "id": "languages", "body": "Markdown",
  "tabs": [
    { "language": "python", "code": "print(1 + 1)\n", "runnable": true },
    { "language": "c", "code": "...", "note": "Markdown", "trace": [] }
  ] }
```

Languages are `python`, `javascript`, `java`, `cpp`, `c`, `rust`. Only Python and JavaScript tabs
can be `runnable`.

### Widgets

Widget types and their props are defined in `src/widgets/schemas.ts`, and an unknown type or prop
fails validation. Every widget can be tried on the Lab page.

| Type | Main props |
|---|---|
| `function-plot` | `expr`, `compare`, `params[]`, `xRange`, `yRange`, `mode` (`plot`, `tangent`, `secant`) |
| `logic-gates` | `mode` (`gate`, `transistor`, `half-adder`, `full-adder`), `gates[]` |
| `alu` | `bits` (4 or 8) |
| `cpu-sim` | `program[]`, `memory` |
| `sort-visualizer` | `algorithm`, `data[]`, `target` |
| `backprop`, `truss`, `double-pendulum`, `orbit-sim`, `wave-interference`, `particle-in-box` | none |
| `memory-trace` | `example` |
| `circuit` | `preset`, `editable` |
| `force-diagram` | `mass`, `forces[]` as `[newtons, degrees]`, `gravity` |
| `projectile` | `speed`, `angle`, `height`, `g` |
| `motion-graphs` | `x0`, `v0`, `a` |
| `collision` | `m1`, `m2`, `v1`, `v2`, `elasticity` |
| `energy-ramp` | `height`, `mass` |
| `vector-3d` | `vectors[]` as `[x, y, z]` |

The teaching CPU's instructions are `LOADI Rn, value`, `LOAD Rn, address`, `STORE Rn, address`,
`ADD Rd, Rs`, `SUB Rd, Rs`, `JMP k`, `JZ k`, `JNZ k` and `HALT`. Registers are R0 to R3, 8 bits.

### Traces

A trace is a list of frames for the step-through viewer:

```json
{ "line": 6, "note": "What just happened, in a sentence.",
  "stack": [{ "name": "main", "vars": [
    { "name": "x", "value": "5" },
    { "name": "p", "value": "&x", "kind": "pointer", "target": "main.x" } ] }],
  "heap": [{ "id": "b1", "label": "block 0x1000", "value": "8", "freed": false }],
  "stdout": "" }
```

`kind` is `value`, `pointer`, `owner`, `borrow` or `moved`. `target` is a heap `id` or
`"<frame>.<variable>"`. `stdout` is the cumulative output so far.

Traces are written by hand, so check them:

- Compile and run the program with a real compiler. The last frame's `stdout` must match exactly.
  `npm test` does this for you when the compiler is installed (`tests/compiled.test.ts`).
- Every `line` must exist in the code, and every `target` must exist in the same frame.

## Questions

Every question has `id`, `type`, `prompt`, `difficulty` (1 to 5), `hints` (revealed one at a time)
and `solution` (a worked solution, shown after the learner solves it or gives up).

| `type` | Extra fields |
|---|---|
| `mcq` | `choices[]`, `answer` (index). Choices are shown in a shuffled order, so do not write "all of the above" |
| `multi` | `choices[]`, `answers[]` (indices) |
| `numeric` | `answer`, `tolerance` (`abs` and/or `rel`), optional `unit` (a label shown beside the box) |
| `expression` | `answer`, `variables[]`, optional `domain` `[lo, hi]`, optional `form: "expanded"` |
| `order` | `items[]` in the correct order |
| `match` | `pairs[]` of `[left, right]` |
| `predict-output` | `language`, `code`, `answer` |
| `code` | `entry`, `variants.python` and/or `variants.javascript` (each `starter` and `reference`), `tests[]` of `{ args, expected, hidden }` |
| `explain` | `modelAnswer`, `checklist[]` of `{ point, keywords }` |

Notes on particular types:

- **numeric.** State the unit and any constants (such as g = 9.8) in the prompt. Choose the
  tolerance so that sensible rounding passes and a wrong method does not. Use `{ "abs": 0 }` for
  exact integers.
- **expression.** Answers are compared as functions, by evaluating at fixed points in `domain`
  (default 0.5 to 3). Choose a domain on which the answer is defined. For "multiply out" or
  "simplify" prompts set `form: "expanded"`, otherwise typing the prompt back is accepted.
- **code.** `entry` is the function called once per test with `args` spread as arguments. Results
  are compared structurally, so return plain numbers, strings, lists and dictionaries. Give at
  least one test with `hidden: false` as a worked example.
- **explain.** Each `keywords` entry is a list of groups; a point is pre-ticked when one keyword
  from every group appears. The learner can change the ticks. These never count towards mastery.
- **predict-output.** Trailing spaces and blank lines at the end are ignored. Everything else must
  match exactly.

## The placement bank

```json
{ "track": "physics", "items": [
  { "nodeId": "physics.kinematics", "tier": "basic", "question": { } }
] }
```

- `tier` is `basic` or `advanced`. Basic questions alone can never place a learner past a topic,
  so every ready node needs at least one of each.
- The test walks up and down `difficulty`, so spread the items across all five levels.
- Keep diagnostic questions quick: one idea each, no long calculations.

## Checking answers

"All physics and math must be correct" is enforced by tests, not by care alone:

- `tests/answers.test.ts` has a table mapping each numeric question to either an independently
  computed value or a predicate that substitutes the answer back into its equation. A coverage
  test fails if you add a numeric question without an entry. Do not copy the content's number
  into the table; compute it.
- Derivative, inverse, composition and expansion answers have their own tables in the same file.
- Coding questions and compiled-language programs are checked automatically.
