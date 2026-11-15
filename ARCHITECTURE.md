# Orbit — Architecture

Orbit is a self-paced, offline-first learning site covering computer science, engineering,
mathematics, and physics. Lessons are short interactive steps; every answer is graded
deterministically in the browser. There is no backend and no AI at runtime.

Status: **proposal, awaiting approval.** Nothing below is built yet.

---

## 1. Decisions that differ from, or narrow, the brief

These are the choices worth a veto before code is written.

| # | Decision | Why |
|---|----------|-----|
| D1 | **Content is JSON, not MDX.** One file per node, prose fields are Markdown + KaTeX strings. | Zod can validate every field, the validator and scaffolder stay simple, and no content can execute code. MDX would let lesson files import arbitrary components, which defeats schema validation. |
| D2 | **Python and JavaScript execute for real; C, C++, Java, and Rust do not.** Those four are taught with a step-through trace visualizer and graded with predicted-output questions. | See §7. A WASM Clang is 30–100 MB, there is no practical in-browser `rustc`, and browser JVMs depend on a hosted runtime. None fit "works offline" at a sane download size. |
| D3 | **math.js** for symbolic checking (not Algebrite). | Maintained, typed, tree-shakeable. Equivalence does not rely on `simplify` alone (§5.3). |
| D4 | **CodeMirror 6** (not Monaco). | ~10x smaller, works on touch devices, no worker/CDN setup to break offline. |
| D5 | **PWA service worker** (`vite-plugin-pwa`) precaches the app shell, content, and KaTeX fonts. Pyodide and Three.js are self-hosted in the build and cached on first use. | This is what makes "offline" true after the first visit. No CDN is ever contacted. |
| D6 | **Seed nodes sit at the root of each track.** An authored node may never depend on a stub (validator rule). | A "coming soon" prerequisite could never be satisfied, so anything behind it would be permanently locked. |
| D7 | **Test-out has a one-attempt-per-day limit per node.** | Without it, a lock can be brute-forced by retrying multiple choice questions. |

---

## 2. Stack

- **App:** Vite, React 18, TypeScript (strict), React Router (data router), Zustand.
- **Styling:** Tailwind CSS with CSS-variable colour tokens (`--bg`, `--fg`, `--accent`, ...) so
  both themes share one class vocabulary.
- **Math:** KaTeX (fonts bundled). **Symbolic:** math.js.
- **Visuals:** SVG + D3 (scales, shapes, zoom) for plots and graphs, Canvas for particle and wave
  simulations, Three.js (lazy-loaded) for 3D.
- **Code:** CodeMirror 6; Pyodide in a Web Worker; JavaScript in a sandboxed Web Worker.
- **Storage:** IndexedDB via `idb`; `localStorage` for the theme only.
- **Validation:** Zod. **Tests:** Vitest (logic, content), Playwright (smoke).
- **CI:** GitHub Actions — typecheck, lint, content validation, unit tests, build, smoke test.

### Directory layout

```
content/
  <track>/track.json            track title, description, node ordering hints
  <track>/<node>.json           one skill node (authored or stub)
  <track>/diagnostic.json       placement question bank
src/
  app/            router, layout, route guards, theme
  content/        schema (Zod), loader, search index
  graph/          skill-graph engine: validation, topo order, lock state
  grading/        one pure grader per question type
  diagnostic/     staircase engine, mastery estimator, path generator
  progress/       Zustand stores, IndexedDB persistence, export/import, SM-2, XP/streak
  lesson/         lesson player, step renderers, question components
  widgets/        registry of interactive widgets (plots, sims, visualizers)
  runner/         code execution workers and the trace visualizer
  pages/          dashboard, track map, node, lesson, review, diagnostic, search, settings
scripts/
  validate-content.ts           fails CI on schema or graph errors
  new-node.ts                   scaffolds a node file
tests/            cross-checks of every numeric answer; Playwright smoke test
docs/AUTHORING.md               content authoring guide
```

Rule of thumb: `graph/`, `grading/`, `diagnostic/`, and the SM-2 code are pure TypeScript with no
React or browser imports, so they are trivially unit-testable and reusable from scripts.

---

## 3. Data schema

All shapes are Zod schemas in `src/content/schema.ts`; TypeScript types are inferred from them.

### 3.1 Skill node

```ts
Node = {
  id: string                 // globally unique, "<track>.<slug>", e.g. "physics.kinematics"
  track: "cs" | "engineering" | "math" | "physics"
  title: string
  summary: string
  status: "ready" | "stub"   // stub = "coming soon"; has no steps or questions
  prerequisites: string[]    // node ids, may cross tracks
  masteryThreshold: number   // default 0.8
  estimatedMinutes: number
  difficulty: 1 | 2 | 3 | 4 | 5
  strand?: string            // grouping on the map, e.g. "Hardware tour", "DSA"
  steps: Step[]              // the lesson
  problems: Question[]       // problem set, ordered easy -> hard
  checkpoint: Question[]     // mastery quiz; a pass unlocks dependents
  testOut: Question[]        // harder set used for the test-out challenge
}
```

A `ready` node must have at least 10 questions across steps, problems, and checkpoint.

### 3.2 Steps

```ts
Step =
  | { kind: "explain",  id, title?, body: Markdown, widget?: WidgetRef }
  | { kind: "question", id, question: Question }
  | { kind: "code-tabs", id, body: Markdown,          // language tab switcher
      tabs: { language: Lang, code: string, trace?: TraceFrame[] }[] }

WidgetRef = { type: string, props: Record<string, unknown> }
```

`WidgetRef.type` must exist in the widget registry, and `props` is validated against that
widget's own Zod schema, so a typo in content fails the build, not the lesson.

### 3.3 Questions

Common fields: `id`, `prompt` (Markdown), `difficulty` 1–5, `hints: Markdown[]` (revealed one at
a time), `solution: Markdown` (shown after submit or give-up), `tags?`.

| `type` | Answer spec | Grader |
|--------|-------------|--------|
| `mcq` | `choices[]`, `answer: index` | exact |
| `multi` | `choices[]`, `answers: index[]` | set equality |
| `numeric` | `answer`, `tolerance: {abs?, rel?}`, `unit?` | tolerance check (§5.2) |
| `expression` | `answer: string`, `variables: string[]`, `domain?` | symbolic equivalence (§5.3) |
| `order` | `items[]` in correct order | sequence equality (drag-and-drop) |
| `match` | `pairs: [left, right][]` | pairing equality (drag-and-drop) |
| `predict-output` | `language`, `code`, `answer: string` | normalised string equality |
| `code` | `language: "python" \| "javascript"`, `starter`, `tests[]`, `reference` | hidden test cases (§7) |
| `explain` | `modelAnswer`, `checklist: { point, keywords: string[][] }[]` | keyword match + self-grade (§5.4) |

### 3.4 Diagnostic bank

```ts
DiagnosticItem = { nodeId: string, tier: "basic" | "advanced", question: Question }
// question.difficulty (1–5) drives the staircase
```

At least 20 items per track; only auto-gradable question types are allowed.

### 3.5 Progress (persisted)

```ts
Progress = {
  version: number                       // for migrations on import
  nodes: Record<NodeId, {
    stepsDone: string[]
    checkpointBest: number              // 0..1
    mastery: "none" | "placed" | "checkpoint" | "test-out"
    placement?: { estimate: number, label: "mastered" | "review" | "queued" }
    lastTestOutAt?: string
  }>
  attempts: Record<QuestionId, { tries: number, correct: boolean, gaveUp: boolean }>
  reviews: Record<QuestionId, { ease: number, interval: number, reps: number, due: string }>
  diagnostics: Record<Track, DiagnosticResult>
  notes: Record<NodeId, string>
  bookmarks: NodeId[]
  scratch: Record<QuestionId, string>   // "show your working"
  xp: number
  streak: { current: number, best: number, lastActiveDay: string }
}
```

Stored in IndexedDB (one object store, keyed by slice, written with debounce). Export produces
one JSON file; import validates it with Zod, runs migrations, and asks before overwriting.

---

## 4. Skill graph and lock logic

### 4.1 Build-time validation (`npm run validate`, runs in CI and before `build`)

Fails with a non-zero exit code on any of:

- a file that does not match the schema, or a duplicate id;
- a prerequisite id that does not exist;
- a cycle (detected with Kahn's algorithm; the error prints the cycle);
- a `ready` node that depends on a `stub` (D6);
- a `ready` node with fewer than 10 questions, a missing checkpoint, or a missing test-out set;
- a diagnostic item that points at an unknown node, or a bank with fewer than 20 items;
- an unknown widget type or invalid widget props;
- a question whose own stated answer does not pass its own grader.

### 4.2 Lock state

A single pure function is the only source of truth; the map, the node page, and the route guards
all call it.

```
verified(n)  = n.mastery in {placed, checkpoint, test-out}
               (checkpoint means checkpointBest >= n.masteryThreshold)

state(n) =
  "coming-soon"  if n.status == "stub"
  "mastered"     if verified(n)
  "locked"       if any prerequisite p has !verified(p)   -> also returns the missing list
  "available"    otherwise        (shown as "review" or "in progress" where applicable)
```

- **Map view:** locked nodes show a lock icon. Selecting one opens a panel that lists exactly the
  missing prerequisites, each as a link.
- **Route guards:** `/learn/:nodeId/*` loaders call `state(n)`. Anything other than `available`
  or `mastered` redirects to the node's overview page, which shows the missing prerequisites.
  Typing a URL cannot open a locked lesson.
- **Test-out:** the only bypass. Offered when the node is locked *or* available, but it only
  starts if every prerequisite is verified (so you test out of a chain from the bottom up).
  Passing requires the node's threshold on the `testOut` set. One attempt per node per day.
- Progress lives on the learner's own machine, so someone can always edit IndexedDB by hand.
  The guards are about preventing accidental skipping, not about security.

---

## 5. Grading engine

`grade(question, response) -> { correct: boolean, score: number, feedback?: string }` — a pure,
synchronous function for every type except `code`. No randomness, no network, no clocks.

### 5.1 Choice, order, match, predict-output
Exact comparison. `predict-output` trims trailing whitespace and normalises line endings.

### 5.2 Numeric
Input is parsed by a small strict parser that accepts decimals, scientific notation, fractions
(`3/4`), and simple constants (`pi`, `e`). Correct when
`|x - answer| <= max(abs, rel * |answer|)`. If the question declares a unit, the learner picks or
types it separately and it is compared after conversion through a fixed unit table.

### 5.3 Symbolic expression
1. Parse both sides with math.js using a whitelist of functions and the question's declared
   variables. Anything else is rejected as "couldn't read that", not marked wrong.
2. Try `simplify(a - b)`; if it reduces to `0`, accept.
3. Otherwise evaluate both at 24 sample points drawn from a **fixed-seed** PRNG over the
   declared domain (so the result is identical on every run), skipping points where either side
   is undefined. Accept if all agree within a relative 1e-9; reject on any disagreement.

Step 3 is the real decision procedure. `simplify` is only a fast path, because computer algebra
simplification alone gives false negatives on things like trig identities.

### 5.4 "Explain it in words"
Deterministic and transparent. Each checklist point has keyword groups (synonyms). The text is
lowercased and stemmed lightly; a point is auto-ticked when one keyword from each of its groups
appears. The learner then sees the model answer, the checklist with the auto-ticks, and can
correct any tick themselves. The score is ticks / points. These never gate mastery: they are
excluded from checkpoints, test-outs, and the diagnostic.

### 5.5 Correctness of content
- Every question's stated answer must pass its own grader (validator, §4.1).
- `tests/answers/<track>.test.ts` recomputes every numeric answer in the seed content
  independently in code (for example integrating the projectile equations numerically) and
  compares against the content file.
- Every `code` question's `reference` solution is run against its hidden tests in Vitest.

---

## 6. Placement diagnostic and path generator

Runs on first launch (learner picks a track, or skips) and can be retaken per track.

### 6.1 Staircase

```
level = 3
repeat:
  pick the unasked item with difficulty closest to level;
    ties -> the node with the fewest items asked so far, then graph order, then id
  correct -> level = min(5, level + 1);  wrong -> level = max(1, level - 1)
until 12 items asked,
   or (at least 8 asked and at least 4 reversals),
   or the bank is exhausted
ability = mean of the level at the last 4 reversals (or of all levels if fewer)
```

A reversal is a change of direction. No randomness: the same answers always produce the same
test and the same result. "I don't know" is offered on every item and counts as wrong, which
discourages guessing.

### 6.2 Per-node mastery estimate

For each node, from the items actually asked about it:

- both tiers seen: `m = 0.5 * basicAccuracy + 0.5 * advancedAccuracy`
- basic only: `m = 0.7 * basicAccuracy` (basic questions alone can never reach "mastered")
- advanced only: `m = advancedAccuracy`

Nodes with no direct evidence are inferred through the graph, then from ability:

- a prerequisite of a directly mastered node is treated as mastered, unless there is a wrong
  answer on it;
- a dependent of a directly failed node (`m < 0.4`) is treated as not known;
- anything still unknown gets `m = clamp(0.5 + 0.25 * (ability - node.difficulty), 0, 0.75)`,
  capped below the mastery line so ability alone suggests "review" at most.

### 6.3 Labels and path

- `m >= 0.8` -> **mastered**: marked complete (`mastery: "placed"`).
- `0.4 <= m < 0.8` -> **review**.
- `m < 0.4` -> **queued**.

A consistency pass walks the graph in topological order and demotes any "mastered" node that has
a non-mastered prerequisite to "review", so placement can never produce an unlocked node behind
a locked one. The path is every non-mastered `ready` node in topological order (review nodes
first among ties). The **recommended start** is the first node on the path whose state is
`available`.

The results screen shows the skill map coloured by `m` (the heatmap), the basic versus advanced
accuracy, the recommended start, and the generated path. Colour is never the only signal; each
node also carries a text label.

---

## 7. Code execution

| Language | How | Graded by |
|----------|-----|-----------|
| Python | Pyodide in a Web Worker, self-hosted (~12 MB, fetched on first use, then cached by the service worker) | hidden test cases |
| JavaScript | A dedicated Web Worker with no DOM; `fetch`, `importScripts`, and nested workers are removed before user code runs | hidden test cases |
| C, C++, Java, Rust | Not executed. Pre-authored execution traces drive a step-through visualizer | predicted-output questions |

Both runners enforce a wall-clock timeout by terminating the worker (the only reliable way to
stop an infinite loop) and cap captured output. Tests are `{ call, expected }` or
`{ stdin, stdout }` pairs; hidden tests show pass/fail only, visible examples show a diff.

**Tradeoff for the four trace-only languages.** A trace is a recorded list of frames (current
line, stack frames, heap cells, pointers/ownership state, stdout). It shows exactly what the
brief asks for — the C/C++ memory layout, Rust moves and borrows — and it works offline at zero
download cost. The cost is that learners cannot edit and run that code, and every trace must be
authored and checked by hand. To keep traces honest, each trace's source is kept alongside it
and the authoring guide requires generating the expected output with a real compiler. If you
later accept an online-only mode, a real compiler backend can be plugged in behind the same
runner interface without touching content.

---

## 8. Widgets

A registry maps `type -> { component (lazy), propsSchema }`. Planned set:

- **General:** function plotter with sliders, vector field, drag-and-drop sorter, number line.
- **CS:** logic-gate sandbox, ALU, CPU fetch/decode/execute stepper with registers and memory,
  cache simulator, memory-layout viewer (stack/heap/pointers), algorithm step-through (sorting,
  search, graph traversal), backpropagation visualizer, rasteriser.
- **Engineering:** circuit canvas (DC solver using modified nodal analysis; digital logic mode),
  truss solver (method of joints as a linear system), free-body diagram builder.
- **Physics:** projectile sandbox, orbit simulator, double pendulum, wave interference,
  particle in a box.
- **Math:** derivative/tangent explorer, Riemann sums, linear-transformation grid.

Simulations use fixed-timestep integrators (symplectic where energy matters) so they are
reproducible, respect `prefers-reduced-motion`, and all have keyboard-operable controls and a
text readout of the key values.

---

## 9. Learning systems

- **Lesson player:** one step on screen at a time, progress bar, keyboard navigation. A question
  step must be answered (or given up on) before continuing.
- **Hints and solutions:** hints reveal one by one; the worked solution appears after a correct
  answer or a give-up. Giving up counts as incorrect.
- **Spaced repetition:** SM-2. Each question answered in a lesson enters the review deck.
  Quality is derived deterministically: correct first try with no hints = 5, with hints = 4,
  correct after retries = 3, gave up or wrong = 1.
- **XP and streak:** small fixed XP per step and per correct answer; a streak counts days with
  at least one completed step. Displayed quietly in the header and dashboard only.
- **Search:** an in-memory index over node titles, summaries, and step text, built at load.
- **Notes, bookmarks, scratchpad:** stored per node / per question in progress.

## 10. Theming and accessibility

- An inline script in `index.html` runs before first paint: it reads the stored choice, falls
  back to `prefers-color-scheme`, and sets `data-theme` on `<html>`. That prevents the flash.
  The header toggle cycles light / dark / system and persists.
- Colour tokens are checked by a unit test that computes WCAG contrast ratios for every
  text/background token pair in both themes and fails under 4.5:1 (3:1 for large text and UI
  borders).
- Semantic landmarks, visible focus rings, skip link, all drag-and-drop interactions have a
  keyboard alternative, the skill map is also available as a plain list.

## 11. Routes

```
/                         dashboard: continue, tracks, review queue
/track/:track             skill map + list view
/node/:nodeId             overview: status, prerequisites, test-out   (never guarded)
/learn/:nodeId            lesson player                               (guarded)
/learn/:nodeId/problems   problem set                                 (guarded)
/learn/:nodeId/checkpoint mastery quiz                                (guarded)
/node/:nodeId/test-out    test-out challenge       (requires verified prerequisites)
/diagnostic/:track        placement test and results
/review                   spaced-repetition session
/search  /bookmarks  /settings (theme, export/import, reset)
```

## 12. Seed content plan

Three complete nodes at the root of each track, all other nodes present as stubs so the full
graph and its locks are visible.

| Track | Seed nodes | Approx. stubs |
|-------|-----------|---------------|
| CS | Transistors and logic gates -> Binary and the ALU -> The CPU cycle | ~35 |
| Engineering | Ohm's law and circuits -> Kirchhoff's laws -> Thevenin equivalents | ~25 |
| Mathematics | Algebra foundations -> Functions -> Limits and derivatives | ~20 |
| Physics | Kinematics -> Newton's laws -> Energy and momentum | ~18 |

Each seed node: a full lesson with at least one widget, a problem set, a checkpoint, a test-out
set, and 10+ questions. Each track: a diagnostic bank of 20+ items.

## 13. Delivery phases

1. Scaffold, theming, routing, schema and validator, graph engine with locking, progress storage.
2. Lesson player, question types, graders, unit tests.
3. Adaptive diagnostic and path generator.
4. Widgets and code runner.
5. Seed content for all four tracks.
6. Polish, accessibility, README, tests.

After each phase: tests run, a summary of what works, and local run instructions.
