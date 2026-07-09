import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

/**
 * Procedures interaction layer (SPEC §9): start the crashing scenario, run a
 * central line end to end via the diegetic panel (watching the us_procedural
 * step auto-open the procedural ultrasound zoom), then intubate — the
 * laryngoscopy overlay appears on its overlay step and the tube step's depth
 * slider is driven by keyboard into the good band. Zero console errors.
 */

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

/** Wait for the step to be active, click Complete, wait for it to pass. */
async function completeStep(page: Page, stepId: string): Promise<void> {
  const active = page.locator(`.procactive[data-step="${stepId}"]`);
  await expect(active, `step ${stepId} should become active`).toBeAttached({ timeout: 30_000 });
  await page.locator('.procpanel button', { hasText: 'Complete step' }).click();
  await expect(active, `step ${stepId} should complete`).not.toBeAttached({ timeout: 30_000 });
}

test('procedures: central line + intubation interaction layer', async ({ page }) => {
  test.setTimeout(300_000); // headless swiftshader crawls; every wait is generous
  const errors = collectErrors(page);
  fs.mkdirSync('screenshots', { recursive: true });

  await page.goto('/?debugcam');
  await page.waitForFunction(() => window.__nf?.ready === true);
  await page.evaluate(() => window.__nf!.startScenario('crashing'));
  await page.waitForFunction(() => window.__nf!.getSnapshot().phase === 'running', undefined, {
    timeout: 60_000,
  });
  await expect(page.locator('#app canvas')).toBeAttached();
  await page.waitForFunction(() => window.__nf!.getSnapshot().simTime > 0.5, undefined, {
    timeout: 30_000,
  });

  // ---------------------------------------------------------- central line
  await page.evaluate(() => {
    window.__nf!.dispatch({ type: 'EquipTool', tool: 'cvl_kit' });
    window.__nf!.dispatch({ type: 'StartProcedure', procedureId: 'cvl', site: 'R IJ' });
  });
  await expect(page.locator('.procpanel')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.procpanel')).toContainText('Central venous line');
  await expect(page.locator('.procpanel')).toContainText('R IJ');

  await completeStep(page, 'position');
  await completeStep(page, 'prep_drape');
  await completeStep(page, 'gown_glove');

  // the us_align step auto-opens the ultrasound zoom in procedural mode
  await expect(page.locator('.procactive[data-step="us_align"]')).toBeAttached({
    timeout: 30_000,
  });
  await expect(page.locator('.zoom-veil')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.zoom-title')).toContainText('Ultrasound');
  await page.waitForTimeout(1200); // let the fade-in + first procedural frame land
  await page.screenshot({ path: 'screenshots/procedure-us.png' });
  // Esc closes the zoom without touching the running procedure
  await page.keyboard.press('Escape');
  await expect(page.locator('.zoom-veil')).toBeHidden();
  await expect(page.locator('.procpanel')).toBeVisible();

  await completeStep(page, 'us_align');
  await completeStep(page, 'needle');
  await completeStep(page, 'wire');
  await completeStep(page, 'dilate');
  await completeStep(page, 'thread');
  await completeStep(page, 'suture');

  // completion: panel gone (runtime cleared), zoom stays closed
  await expect(page.locator('.procpanel')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('.zoom-veil')).toBeHidden();

  // ---------------------------------------------------------- site picker
  // Drive the same store action the world's 'startProcedureFlow' uses. The
  // exact module URL the app loaded (HMR may add ?t=) comes from the
  // performance log so the import resolves to the live store instance.
  const openPicker = async () => {
    await page.evaluate(() => window.__nf!.openSitePicker('cvl'));
  };
  await openPicker();
  const picker = page.locator('.sitepicker');
  await expect(picker).toBeVisible();
  await expect(picker).toContainText('Central venous line');
  await expect(picker).toContainText('Central line kit');
  await page.keyboard.press('4'); // digits select a site
  await expect(picker.locator('.sitebtn.sel')).toContainText('R femoral');
  await page.keyboard.press('Escape'); // cancel: no procedure starts
  await expect(picker).toBeHidden();
  await expect(page.locator('.procpanel')).toBeHidden();

  await openPicker();
  await page.keyboard.press('2');
  await page.keyboard.press('Enter'); // start at the selected site
  await expect(picker).toBeHidden();
  await expect(page.locator('.procpanel')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.procpanel')).toContainText('L IJ');
  await page.locator('.procpanel button', { hasText: 'Abort' }).click();
  await expect(page.locator('.procpanel')).toBeHidden({ timeout: 30_000 });

  // ------------------------------------------------------------ intubation
  await page.evaluate(() => {
    window.__nf!.dispatch({ type: 'EquipTool', tool: 'ett_kit' });
    window.__nf!.dispatch({ type: 'StartProcedure', procedureId: 'ett' });
  });
  await expect(page.locator('.procpanel')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.procpanel')).toContainText('Endotracheal intubation');

  await completeStep(page, 'position');
  await completeStep(page, 'preoxygenate');

  // laryngoscopy overlay appears on its overlay step
  await expect(page.locator('.procactive[data-step="laryngoscopy"]')).toBeAttached({
    timeout: 30_000,
  });
  await expect(page.locator('.laryng-frame')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'screenshots/laryngoscopy.png' });

  // Esc lowers the view (does NOT abort); the reopen chip brings it back
  await page.keyboard.press('Escape');
  await expect(page.locator('.laryng-frame')).toBeHidden();
  await expect(page.locator('.procpanel')).toBeVisible();
  await page.locator('.laryng-reopen').click();
  await expect(page.locator('.laryng-frame')).toBeVisible();

  await completeStep(page, 'laryngoscopy');

  // tube step: drive the depth slider into the marked good band by keyboard
  await expect(page.locator('.procactive[data-step="tube"]')).toBeAttached({ timeout: 30_000 });
  const slider = page.locator('.laryng-slider input[type="range"]');
  await expect(slider).toBeVisible({ timeout: 30_000 });
  const advance = page.locator('.laryng-advance');
  await expect(advance).toBeDisabled(); // starts shallow, outside the band
  await slider.focus();
  for (let i = 0; i < 130; i++) {
    const v = Number(await slider.inputValue());
    if (v >= 64 && v <= 76) break;
    await slider.press(v < 64 ? 'ArrowRight' : 'ArrowLeft');
  }
  await expect(advance).toBeEnabled();
  await page.screenshot({ path: 'screenshots/laryngoscopy-tube.png' });
  await advance.click();

  // overlay drops once the step passes; confirm finishes the procedure
  await expect(page.locator('.procactive[data-step="confirm"]')).toBeAttached({
    timeout: 30_000,
  });
  await expect(page.locator('.laryng-frame')).toBeHidden();
  await completeStep(page, 'confirm');
  await expect(page.locator('.procpanel')).toBeHidden({ timeout: 30_000 });

  // payoff shot for the gallery: the vent is now DRIVING — curves on screen
  await page.evaluate(() => {
    window.__nf!.dispatch({ type: 'SetVent', settings: { fio2: 0.6, peep: 8 } });
    window.__nf!.advanceSim(10);
    window.__nf!.teleport('vent');
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/vent-running.png' });

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
