# Orbit

A self-paced learning site for computer science, engineering, mathematics and physics. Lessons are
short interactive steps: a visual you can manipulate, then a question, then the next idea.

- **No AI at runtime.** All content is static JSON. All grading is deterministic.
- **Local-first and offline.** No backend, no accounts, no CDN. Progress lives in your browser
  (IndexedDB) and can be exported and imported as a JSON file.
- **Light and dark themes**, following the system by default.

## Run it

Requires Node 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

To try the production build, which is what enables offline use:

```bash
npm run build
```

```bash
npm run preview
```

Then open http://localhost:4173. After the first visit the site works with the network off.

## What is in it

| | |
|---|---|
| Tracks | Computer Science, Engineering, Mathematics, Physics |
| Skill graph | 112 topics with prerequisites, 12 fully written, 100 marked "coming soon" |
| Written lessons | CS: logic gates, binary and the ALU, the CPU cycle. Engineering: Ohm's law, Kirchhoff's laws, Thevenin. Maths: algebra, functions, limits and derivatives. Physics: kinematics, Newton's laws, energy and momentum |
| Questions | 346 (262 in topics, 84 in placement banks) across lessons, problem sets, checkpoints, test-outs |
| Interactives | 19, all also available on the Lab page |

Each written topic has a lesson, a problem set ordered easy to hard, a checkpoint quiz and a
harder test-out set.

### How progression works

- A topic unlocks when every prerequisite is **mastered**: by scoring 80% on its checkpoint,
  by passing its test-out, or by being placed past it by the placement test.
- Locked topics are visible on the skill map. Selecting one lists exactly what is missing.
- A locked lesson cannot be opened by typing its URL.
- You can test out of a topic once its prerequisites are verified. One attempt per topic per day.
- The placement test is adaptive: harder after a right answer, easier after a wrong one. It marks
  topics complete, for review, or queued, and recommends where to start.
- Questions you answer return in the Review queue on an SM-2 spaced-repetition schedule.

### Code execution

| Language | In the browser |
|---|---|
| Python | Runs for real (Pyodide in a Web Worker). About 12 MB, downloaded on first use, then cached |
| JavaScript | Runs for real (sandboxed Web Worker, 3 second timeout) |
| C, C++, Java, Rust | **Not executed.** Taught with recorded step-through traces and predict-the-output questions |

Compiling C, C++, Java or Rust in the browser needs toolchains of tens to hundreds of megabytes,
which does not fit an offline-first site. The recordings are checked against real compilers by
`tests/compiled.test.ts`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Validates content, typechecks, builds to `dist/` |
| `npm run preview` | Serves the production build |
| `npm run validate` | Checks all content: schema, graph (cycles, missing ids), and that every stated answer passes its own grader. Exits non-zero on any error |
| `npm test` | Unit and content tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright): smoke, accessibility, offline |
| `npm run typecheck` | TypeScript only |
| `npm run new-node -- <track> <slug> "<Title>"` | Scaffolds a new topic file |

The first `npm run test:e2e` on a new machine needs a browser:

```bash
npx playwright install chromium
```

## Tests

- **Graders, graph, diagnostic, progress, simulations:** unit tests next to the code in `src/`.
- **`tests/answers.test.ts`:** recomputes every numeric answer independently (circuit answers with
  the circuit solver, CPU answers with the CPU simulator, mechanics with the formulas) and checks
  every derivative, inverse and expansion numerically. A coverage test fails if a numeric question
  has no check.
- **`tests/code-questions.test.ts`:** runs every coding problem's reference solutions in JavaScript
  and in Python (Pyodide) against the hidden tests, and confirms the starter code does not pass.
- **`tests/compiled.test.ts`:** compiles and runs every C, C++, Java and Rust program shown in the
  content and compares the output. Skips a language whose compiler is not installed.
- **`tests/contrast.test.ts`:** WCAG AA contrast for every text and surface colour, both themes.
- **`e2e/`:** locking by URL, lesson flow, checkpoint unlock, test-out limit, placement, the code
  runner (including stopping an infinite loop), backup and restore, an axe-core WCAG scan in both
  themes, keyboard operation, mobile width, and offline use.

## Adding content

See [docs/AUTHORING.md](docs/AUTHORING.md). In short: one JSON file per topic under
`content/<track>/`, validated by `npm run validate`.

## Design

See [ARCHITECTURE.md](ARCHITECTURE.md) for the data schema, grading engine, placement algorithm
and lock logic.

## Known limits

- Progress is per browser. Use Settings, Export progress to move it or back it up.
- Lock checks run on your own device, so they prevent accidental skipping, not deliberate editing
  of your own stored data.
- Two tabs open at once each hold their own copy of progress; the last one to save wins.
- The main JavaScript bundle is about 1.5 MB before compression, mostly the maths libraries. It is
  cached after the first load.
- Symbolic answers are compared numerically at fixed sample points. That is reliable for the
  expressions used here but is not a proof of equivalence.
- 100 of the 112 topics are stubs. Several interactives for those topics (double pendulum, orbits,
  wave interference, particle in a box, truss solver, backpropagation, sorting, memory traces)
  already exist and are on the Lab page.
