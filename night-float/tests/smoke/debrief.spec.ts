import { expect, test } from '@playwright/test';
import fs from 'node:fs';

/**
 * Debrief acceptance (SPEC §13/§18): the scenario ends, the debrief screen
 * renders outcome + rubric + the timeline canvas, and JSON export works.
 */
test('debrief renders after a scenario ends', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  fs.mkdirSync('screenshots', { recursive: true });

  await page.goto('/?debugcam');
  await page.waitForFunction(() => window.__nf?.ready === true);
  await page.evaluate(() => window.__nf!.startScenario('crashing'));
  await page.waitForFunction(() => window.__nf!.getSnapshot().phase === 'running');

  // untreated, the patient dies around t~1300; jump past it
  await page.evaluate(() => window.__nf!.advanceSim(1450));
  await page.waitForFunction(() => window.__nf!.getSnapshot().engineEnded === true);
  // the phase flip happens on the next animation frame
  await page.waitForFunction(() => window.__nf!.getSnapshot().phase === 'debrief', undefined, {
    timeout: 30_000,
  });

  const debrief = page.locator('.debrief-screen');
  await expect(debrief).toBeVisible();
  await expect(debrief).toContainText(/death/i);
  // rubric list + timeline canvas exist
  await expect(debrief.locator('canvas').first()).toBeAttached();
  await expect(debrief.locator('.rubric').first()).toBeAttached();

  // the real export path: click the button, read the downloaded JSON
  const downloadP = page.waitForEvent('download');
  await debrief.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadP;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
    scenarioId: string;
    log: unknown[];
  };
  expect(parsed.scenarioId).toBe('crashing');
  expect(parsed.log.length).toBeGreaterThan(50);

  await page.screenshot({ path: 'screenshots/debrief.png' });
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
