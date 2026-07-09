import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

/**
 * Ultrasound acceptance (SPEC §18): every view renders, and views visibly
 * change when USFindings change (crashing's pathological findings vs
 * stable-night's normal ones). Reads the zoom overlay's 2D canvas directly.
 */

const ALL_VIEWS = [
  'plax',
  'psax',
  'a4c',
  'subxiphoid',
  'ivc',
  'lung_ant_l',
  'lung_ant_r',
  'lung_post_l',
  'lung_post_r',
  'ruq',
  'luq',
  'pelvis',
] as const;

/** coarse 6x6 mean-luminance signature of the zoom canvas */
async function signature(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.zoom-canvas');
    if (!canvas) throw new Error('no zoom canvas');
    const ctx = canvas.getContext('2d')!;
    const { width: w, height: h } = canvas;
    const img = ctx.getImageData(0, 0, w, h).data;
    const grid = 6;
    const sig: number[] = [];
    for (let gy = 0; gy < grid; gy++) {
      for (let gx = 0; gx < grid; gx++) {
        let sum = 0;
        let n = 0;
        const x0 = Math.floor((gx * w) / grid);
        const y0 = Math.floor((gy * h) / grid);
        const x1 = Math.floor(((gx + 1) * w) / grid);
        const y1 = Math.floor(((gy + 1) * h) / grid);
        for (let y = y0; y < y1; y += 4) {
          for (let x = x0; x < x1; x += 4) {
            const i = (y * w + x) * 4;
            sum += 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
            n++;
          }
        }
        sig.push(sum / Math.max(n, 1));
      }
    }
    return sig;
  });
}

function dist(a: number[], b: number[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  return d / a.length;
}

function variance(sig: number[]): number {
  const mean = sig.reduce((x, y) => x + y, 0) / sig.length;
  return sig.reduce((x, y) => x + (y - mean) ** 2, 0) / sig.length;
}

async function boot(page: Page, scenario: string): Promise<void> {
  await page.goto('/?debugcam');
  await page.waitForFunction(() => window.__nf?.ready === true);
  await page.evaluate((id) => window.__nf!.startScenario(id), scenario);
  await page.waitForFunction(() => window.__nf!.getSnapshot().phase === 'running', undefined, {
    timeout: 60_000,
  });
  await page.evaluate(() => {
    window.__nf!.dispatch({ type: 'EquipTool', tool: 'us_probe' });
  });
}

async function openView(page: Page, view: string): Promise<void> {
  await page.evaluate((v) => {
    window.__nf!.dispatch({ type: 'UsSetView', view: v as never });
  }, view);
  await page.waitForTimeout(700); // several 30fps screen redraw windows
}

test('all ultrasound views render and react to findings', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  fs.mkdirSync('screenshots/us', { recursive: true });

  await boot(page, 'crashing');
  await page.evaluate(() => window.__nf!.openZoom('us_machine'));
  await expect(page.locator('.zoom-canvas')).toBeAttached();

  const crashingSigs: Record<string, number[]> = {};
  for (const v of ALL_VIEWS) {
    await openView(page, v);
    const sig = await signature(page);
    crashingSigs[v] = sig;
    expect(variance(sig), `${v} should render non-flat imagery`).toBeGreaterThan(4);
    await page.locator('.zoom-canvas').screenshot({ path: `screenshots/us/${v}.png` });
  }

  // distinct views must not be identical renders
  expect(dist(crashingSigs.plax, crashingSigs.ivc)).toBeGreaterThan(2);
  expect(dist(crashingSigs.lung_ant_l, crashingSigs.ruq)).toBeGreaterThan(2);

  // scripted setUsFinding changes the SAME view mid-scenario (2 -> 5 B-lines)
  await page.evaluate(() => window.__nf!.advanceSim(600));
  await openView(page, 'plax'); // force a view flip so the lung redraw is fresh
  await openView(page, 'lung_ant_l');
  const lungLate = await signature(page);
  expect(
    dist(lungLate, crashingSigs.lung_ant_l),
    'scripted B-line escalation should visibly change the lung view',
  ).toBeGreaterThan(0.8);

  // normal-findings comparison: key views must visibly differ from crashing
  await boot(page, 'stable-night');
  await page.evaluate(() => window.__nf!.openZoom('us_machine'));
  await expect(page.locator('.zoom-canvas')).toBeAttached();
  // per-view sensitivity: plax pathology is mostly wall MOTION (weak in a
  // static signature); ivc diameter/collapse and lung B-lines shift pixels hard
  // floors are regression tripwires (0 = findings not wired), not similarity
  // science: capture timing vs breath/beat phase adds run-to-run variance
  const minDist: Record<string, number> = { plax: 0.35, ivc: 0.45 };
  for (const v of ['plax', 'ivc'] as const) {
    await openView(page, v);
    const sig = await signature(page);
    expect(
      dist(sig, crashingSigs[v]),
      `${v} should look different with normal vs pathological findings`,
    ).toBeGreaterThan(minDist[v]);
  }

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
