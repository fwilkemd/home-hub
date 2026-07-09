import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

/**
 * Vertical-slice smoke (SPEC §15): boot → start scenario → debugcam tour of
 * five viewpoints saving PNGs to /screenshots → workstation opens → placing a
 * med order produces a MAR row after sim time passes → zero console errors.
 */

const VIEWPOINTS = ['bedside', 'monitor', 'vent', 'ultrasound', 'wide'] as const;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

test('vertical slice tour', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  fs.mkdirSync('screenshots', { recursive: true });

  await page.goto('/?debugcam');
  await page.waitForFunction(() => window.__nf?.ready === true);

  // start the tutorial scenario and wait until the room is live
  await page.evaluate(() => window.__nf!.startScenario('stable-night'));
  await page.waitForFunction(() => window.__nf!.getSnapshot().phase === 'running', undefined, {
    timeout: 60_000,
  });

  // the 3D canvas must exist
  await expect(page.locator('#app canvas')).toBeAttached();

  // sim time advances
  await page.waitForFunction(() => window.__nf!.getSnapshot().simTime > 1);

  // let the monitor sweep draw real traces before shooting close-ups
  await page.waitForTimeout(2500);

  for (const v of VIEWPOINTS) {
    await page.evaluate((vp) => window.__nf!.teleport(vp as never), v);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `screenshots/${v}.png` });
  }

  // workstation opens on the orders tab
  await page.evaluate(() => window.__nf!.openWorkstation('orders'));
  await expect(page.locator('.ws').first()).toBeVisible();
  await page.screenshot({ path: 'screenshots/emr.png' });

  // place a med bolus order via the command surface, fast-forward, expect MAR
  await page.evaluate(() => {
    const drugId = 'lactated-ringers';
    window.__nf!.dispatch({
      type: 'PlaceOrder',
      draft: {
        kind: 'med',
        drugId,
        mode: 'bolus',
        dose: 500,
        doseUnit: 'mL',
        route: 'iv_push',
        label: 'LR bolus 500 mL (smoke)',
      },
    });
  });
  await page.waitForFunction(() => window.__nf!.getSnapshot().orders.length > 0);
  await page.evaluate(() => window.__nf!.advanceSim(180));
  await page.waitForFunction(() => window.__nf!.getSnapshot().mar.length > 0, undefined, {
    timeout: 15_000,
  });

  // vitals mirror is live
  const snap = await page.evaluate(() => window.__nf!.getSnapshot());
  expect(snap.vitals).not.toBeNull();
  expect(snap.simTime).toBeGreaterThan(100);

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
