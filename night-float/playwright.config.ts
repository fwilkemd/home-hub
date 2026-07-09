import { defineConfig } from '@playwright/test';
import fs from 'node:fs';

// The remote environment pre-installs Chromium under /opt/pw-browsers. If the
// pinned @playwright/test expects a different browser build, fall back to the
// vendored executable instead of downloading.
function findChromium(): string | undefined {
  const candidates = [
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
    '/opt/pw-browsers/chromium',
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch {
      /* ignore */
    }
  }
  // scan chromium-*/chrome-linux/chrome
  try {
    const root = '/opt/pw-browsers';
    for (const dir of fs.readdirSync(root)) {
      if (!dir.startsWith('chromium')) continue;
      const p = `${root}/${dir}/chrome-linux/chrome`;
      if (fs.existsSync(p)) return p;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    viewport: { width: 1600, height: 900 },
    launchOptions: {
      executablePath: findChromium(),
      // Software WebGL for headless CI-like environments.
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5199 --strictPort',
    port: 5199,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
