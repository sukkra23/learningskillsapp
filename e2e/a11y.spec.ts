import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Automated WCAG 2.1 A/AA scan (axe-core) of the main screens in both themes. */
const PAGES = ['/', '/track/cs', '/node/physics.newtons-laws', '/learn/physics.kinematics?step=1', '/learn/physics.kinematics?step=2', '/learn/physics.kinematics/problems',
  '/learn/math.algebra?step=3', '/learn/engineering.ohms-law?step=1', '/learn/cs.logic-gates?step=4', '/diagnostic/math', '/lab', '/lab/truss', '/lab/backprop', '/lab/force-diagram', '/review', '/search?q=energy', '/settings'];

for (const scheme of ['light', 'dark'] as const) {
  test(`no WCAG A/AA violations (${scheme})`, async ({ browser }) => {
    test.slow();
    const ctx = await browser.newContext({ colorScheme: scheme });
    const page = await ctx.newPage();
    const problems: string[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      await page.locator('main h1, main h2').first().waitFor();
      await page.waitForTimeout(400); // lazy widgets
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      for (const v of violations) problems.push(`${path} [${v.id}] ${v.help}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    }
    expect(problems).toEqual([]);
    await ctx.close();
  });
}

test('keyboard: skip link, focus order and operating a question without a mouse', async ({ page }) => {
  await page.goto('/learn/physics.kinematics?step=2');
  await page.getByRole('heading', { name: 'Check your understanding' }).waitFor();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  // Reach the first radio, choose with the arrow keys / space, submit with Enter.
  const radios = page.getByRole('radio');
  await radios.first().focus();
  await page.keyboard.press('Space');
  await expect(radios.first()).toBeChecked();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('form', { name: 'Question' }).getByText(/Correct\.|Not quite/)).toBeVisible();
});

test('mobile width: no horizontal page scroll on the main screens', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  for (const path of ['/', '/track/physics', '/learn/physics.kinematics?step=1', '/learn/engineering.ohms-law?step=1', '/learn/cs.cpu-cycle?step=1', '/lab', '/settings']) {
    await page.goto(path);
    await page.locator('main h1, main h2').first().waitFor();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
  }
  await ctx.close();
});
