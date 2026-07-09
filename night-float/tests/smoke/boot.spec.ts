import { expect, test } from '@playwright/test';

/**
 * Phase 0 smoke: app boots with ZERO console errors. The full tour
 * (viewpoints, screenshots, order->MAR) arrives with the vertical slice.
 */
test('boots clean', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/');
  await expect(page.locator('#ui')).toBeAttached();
  await page.waitForFunction(() => window.__nf?.ready === true);
  await page.waitForTimeout(500);

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
