import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

type Q = { id: string; type: string; answer?: number | string; answers?: number[]; choices?: string[] };
const node = (id: string) => JSON.parse(fs.readFileSync(`content/${id.replace('.', '/')}.json`, 'utf8')) as { checkpoint: Q[]; testOut: Q[]; steps: { kind: string }[] };

/** Answers the question on screen using the content file, correctly or (for wrong=true) incorrectly. */
async function answer(page: Page, q: Q, wrong = false) {
  const form = page.getByRole('form', { name: 'Question' });
  if (q.type === 'mcq') await form.getByRole('radio').nth(wrong ? ((q.answer as number) + 1) % q.choices!.length : (q.answer as number)).check();
  else if (q.type === 'numeric') await form.getByRole('textbox').first().fill(String(wrong ? (q.answer as number) + 1000 : q.answer));
  else if (q.type === 'expression') await form.getByRole('textbox').first().fill(wrong ? '12345' : String(q.answer));
  else throw new Error(`no e2e handler for ${q.type}`);
  await form.getByRole('button', { name: 'Check' }).click();
}

async function takeQuiz(page: Page, questions: Q[], wrong = 0) {
  for (let i = 0; i < questions.length; i++) {
    await expect(page.getByRole('heading', { name: `Question ${i + 1} of ${questions.length}` })).toBeVisible();
    await answer(page, questions[i], i < wrong);
    await page.getByRole('button', { name: i + 1 < questions.length ? 'Next question' : 'See result' }).click();
  }
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

test('theme: follows the system, toggles, persists, and is set before first paint', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage();
  // The attribute must already be present when the document has only just been parsed.
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: /Change theme/ }).click(); // system -> light
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload({ waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await ctx.close();
});

test('dashboard shows the four tracks, a next lesson and the review queue', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Orbit' })).toBeVisible();
  for (const t of ['Computer Science', 'Engineering', 'Mathematics', 'Physics']) await expect(page.getByRole('heading', { name: t, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Start/ })).toBeVisible();
});

test('locked lessons cannot be opened by URL and list their missing prerequisites', async ({ page }) => {
  for (const path of ['/learn/physics.newtons-laws', '/learn/physics.newtons-laws/checkpoint', '/learn/physics.newtons-laws/problems', '/node/physics.newtons-laws/test-out', '/learn/physics.rotation']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/node\/physics\.[a-z-]+\?locked=1$/);
  }
  await page.goto('/learn/physics.newtons-laws');
  await expect(page.getByRole('alert')).toContainText('locked');
  await expect(page.getByRole('status').getByRole('link', { name: 'Kinematics' })).toBeVisible();
  await page.goto('/learn/not.a-node');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('skill map marks locked nodes and explains the lock when one is selected', async ({ page }) => {
  await page.goto('/track/physics');
  await page.getByRole('button', { name: "Newton's laws. Locked" }).click();
  await expect(page.getByText('Locked. Master this first:')).toBeVisible();
  await expect(page.getByRole('status').getByRole('link', { name: 'Kinematics' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kinematics. Available' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rotation. Coming soon' })).toBeVisible();
});

test('lesson: steps, a question gate, hints, and progress that survives a reload', async ({ page }) => {
  await page.goto('/learn/physics.kinematics');
  await expect(page.getByRole('heading', { name: 'Where, how fast, which way' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Motion with starting position/ })).toBeVisible();
  await page.getByRole('button', { name: /Continue/ }).click();
  // A question step blocks Continue until it is answered.
  await expect(page.getByRole('button', { name: /Continue/ })).toBeDisabled();
  await page.getByRole('button', { name: /^Hint/ }).click();
  await expect(page.getByRole('list', { name: 'Hints' })).toContainText('slope');
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Not quite')).toBeVisible();
  await page.getByRole('radio').nth(0).check();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Correct.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Worked solution' })).toBeVisible();
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByRole('heading', { name: 'Acceleration: velocity that changes' })).toBeVisible();
  await page.waitForTimeout(400); // debounced save
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Continue' })).toBeVisible();
  await page.goto('/learn/physics.kinematics');
  await expect(page.getByRole('heading', { name: 'Acceleration: velocity that changes' })).toBeVisible();
});

test('checkpoint: failing keeps the next node locked, passing masters the node and unlocks it', async ({ page }) => {
  const cp = node('physics.kinematics').checkpoint;
  await page.goto('/learn/physics.kinematics/checkpoint');
  await takeQuiz(page, cp, 2); // 3 of 5 = 60%, below the 80% threshold
  await expect(page.getByRole('heading', { name: /Score: 60%/ })).toBeVisible();
  await expect(page.getByText(/Not yet/)).toBeVisible();
  await page.waitForTimeout(400);
  await page.goto('/learn/physics.newtons-laws');
  await expect(page).toHaveURL(/locked=1/);

  await page.goto('/learn/physics.kinematics/checkpoint');
  await takeQuiz(page, cp);
  await expect(page.getByRole('heading', { name: /Score: 100%/ })).toBeVisible();
  await expect(page.getByText('Mastered: Kinematics')).toBeVisible();
  await page.getByRole('link', { name: "Newton's laws" }).click();
  await page.getByRole('link', { name: /Start lesson/ }).click();
  await expect(page).toHaveURL(/\/learn\/physics\.newtons-laws$/);
  await expect(page.getByRole('heading', { name: 'The first law: no net force, no change' })).toBeVisible();
});

test('test-out: masters an available node, and a failed attempt is limited to one per day', async ({ page }) => {
  await page.goto('/node/math.algebra/test-out');
  await page.getByRole('button', { name: 'Start' }).click();
  await takeQuiz(page, node('math.algebra').testOut);
  await expect(page.getByText('Mastered: Arithmetic and algebra')).toBeVisible();
  await page.waitForTimeout(400);
  // Functions is now available, so it can be tested out of in turn. Fail it.
  await page.goto('/node/math.functions/test-out');
  await page.getByRole('button', { name: 'Start' }).click();
  await takeQuiz(page, node('math.functions').testOut, 5);
  await expect(page.getByText(/Not yet/)).toBeVisible();
  await page.waitForTimeout(400);
  await page.goto('/node/math.functions/test-out');
  await expect(page.getByText(/already tried to test out of this topic today/)).toBeVisible();
});

test('placement test: adapts, then shows a heatmap, a path and a starting point', async ({ page }) => {
  await page.goto('/diagnostic/engineering');
  await page.getByRole('button', { name: 'Begin' }).click();
  for (let i = 0; i < 12; i++) {
    const idk = page.getByRole('button', { name: "I don't know" });
    if (!(await idk.isVisible().catch(() => false))) break;
    await idk.click();
  }
  await expect(page.getByRole('heading', { name: 'Your Engineering placement' })).toBeVisible();
  await expect(page.getByText('Recommended starting point')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Skill heatmap' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ohm's law and simple circuits\. Available\. Estimated mastery \d+ percent/ })).toBeVisible();
  await expect(page.getByRole('list').filter({ hasText: 'Start here' })).toContainText("Ohm's law");
});

test('code runner: JavaScript tests run in a worker and an infinite loop is stopped', async ({ page }) => {
  await page.goto('/node/cs.logic-gates/test-out');
  await page.getByRole('button', { name: 'Start' }).click();
  await takeQuiz(page, node('cs.logic-gates').testOut.filter((q) => ['mcq', 'numeric'].includes(q.type)));
  await page.waitForTimeout(400);
  await page.goto('/learn/cs.logic-gates/problems');
  await page.getByRole('button', { name: /Problem 7/ }).click();
  await page.getByLabel('Language').selectOption('javascript');
  const editor = page.getByRole('textbox', { name: 'JavaScript code editor' });
  const type = async (src: string) => { await editor.click(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('Delete'); await page.keyboard.insertText(src); };
  await type('function majority(a, b, c) { return a; }');
  await page.getByRole('button', { name: /Submit/ }).click();
  await expect(page.getByText(/of 8 tests pass/)).toBeVisible();
  await type('function majority(a, b, c) { while (true) {} }');
  await page.getByRole('button', { name: 'Run examples' }).click();
  await expect(page.getByText(/Stopped after 3 seconds/)).toBeVisible({ timeout: 15000 });
  await type('function majority(a, b, c) { return a + b + c >= 2 ? 1 : 0; }');
  await page.getByRole('button', { name: /Submit/ }).click();
  await expect(page.getByText('Correct.')).toBeVisible();
});

test('Python runs in the browser through Pyodide', async ({ page }) => {
  test.slow();
  await page.goto('/node/cs.logic-gates/test-out');
  await page.getByRole('button', { name: 'Start' }).click();
  await takeQuiz(page, node('cs.logic-gates').testOut);
  await page.waitForTimeout(400);
  await page.goto('/node/cs.binary-alu/test-out');
  await page.getByRole('button', { name: 'Start' }).click();
  await takeQuiz(page, node('cs.binary-alu').testOut);
  await page.waitForTimeout(400);
  const tabsStep = node('cs.cpu-cycle').steps.findIndex((s) => s.kind === 'code-tabs') + 1;
  await page.goto(`/learn/cs.cpu-cycle?step=${tabsStep}`);
  await page.getByRole('tab', { name: 'Python' }).click();
  await page.getByRole('button', { name: 'Run this Python' }).click();
  await expect(page.locator('pre[aria-live]')).toHaveText('10', { timeout: 90000 });
  // The C tab shows a recorded trace that can be stepped.
  await page.getByRole('tab', { name: 'C', exact: true }).click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByText('The loop variable i is created')).toBeVisible();
});

test('lab, search, notes, bookmarks and backup', async ({ page }) => {
  await page.goto('/lab');
  await page.getByRole('link', { name: /Circuit builder/ }).click();
  await expect(page.getByRole('group', { name: /Circuit\. Select a branch/ })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('1.75 A');

  await page.goto('/search?q=derivative');
  await expect(page.getByRole('link', { name: 'Limits and derivatives' })).toBeVisible();

  await page.goto('/node/physics.kinematics');
  await page.getByLabel('Notes for Kinematics').fill('slope of x-t is v');
  await page.getByRole('button', { name: 'Save topic' }).click();
  await page.goto('/bookmarks');
  await expect(page.getByText('slope of x-t is v')).toBeVisible();

  await page.goto('/settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export progress' }).click()]);
  const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(backup.progress.notes['physics.kinematics']).toBe('slope of x-t is v');
  expect(backup.progress.bookmarks).toEqual(['physics.kinematics']);
  // Erase, then restore from the file.
  page.on('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Erase all progress' }).click();
  await page.goto('/bookmarks');
  await expect(page.getByText('Nothing saved yet')).toBeVisible();
  await page.goto('/settings');
  await page.getByLabel('Import progress').setInputFiles(await download.path());
  await expect(page.getByText('Backup restored.')).toBeVisible();
  await page.goto('/bookmarks');
  await expect(page.getByText('slope of x-t is v')).toBeVisible();
});
