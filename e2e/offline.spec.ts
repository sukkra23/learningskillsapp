import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('works offline after the first visit, and never contacts another origin', async ({ page, context }) => {
  const foreign: string[] = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== 'http://localhost:4173' && u.protocol.startsWith('http')) foreign.push(r.url()); });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tracks' })).toBeVisible();
  // Wait until the service worker has installed, precached the app and taken control.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 30000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tracks' })).toBeVisible();
  // A lesson with maths (KaTeX fonts), a lazily loaded widget, and the 3D scene, all from cache.
  await page.goto('/learn/physics.kinematics?step=1');
  await expect(page.getByRole('img', { name: /Motion with starting position/ })).toBeVisible();
  await page.goto('/lab/vector-3d');
  await expect(page.getByRole('img', { name: /3D view of 2 vectors/ })).toBeVisible();
  await page.goto('/lab/circuit');
  await expect(page.getByRole('table')).toContainText('1.75 A');
  expect(foreign).toEqual([]);
});
