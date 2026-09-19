import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices, firefox, webkit } from "@playwright/test";

/**
 * The site gates (RM-104, ADR 0038): Playwright against the BUILT site (`next start`), or
 * `next dev` with `E2E_DEV=1`. The port comes from `E2E_PORT` (default 4620) so a builder, a
 * validator and CI never collide. `pnpm --filter @elabs-ai/home build` first.
 *
 * Smoke runs in Chromium, Firefox and WebKit; everything else in Chromium at 1440×900, and the
 * render-only specs again at 390×844. On CI all three engines are required (a missing install
 * fails loudly); locally an engine whose binary is not installed is left out.
 *
 * Screenshots (ruling 28): baselines live per platform under `__screenshots__/<platform>/`.
 * A spec compares only where a same-platform baseline exists; elsewhere it attaches the actual
 * image (uploaded as a CI artifact) and the VALUE assertions carry the failure. See
 * `docs/GATES.md` "Site gates".
 */
const HOME = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.E2E_PORT ?? 4620);
const BASE_URL = `http://localhost:${PORT}`;
const CI = !!process.env.CI;

const installed = (engine: { executablePath(): string }) => {
  try {
    return existsSync(engine.executablePath());
  } catch {
    return false;
  }
};

const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };
const phone = { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } };
const SMOKE = /smoke\.spec\.ts$/;
const RENDER_ONLY = /(smoke|js-off|reduced-motion)\.spec\.ts$/;

const smokeEngines = [
  { name: "smoke-firefox", engine: firefox, device: devices["Desktop Firefox"] },
  { name: "smoke-webkit", engine: webkit, device: devices["Desktop Safari"] },
].filter(({ engine }) => CI || installed(engine));

export default defineConfig({
  testDir: ".",
  outputDir: "test-results",
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : 4,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled" },
  },
  reporter: CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium-1440", use: desktop, testIgnore: SMOKE },
    { name: "chromium-390", use: phone, testMatch: RENDER_ONLY },
    { name: "smoke-chromium", use: desktop, testMatch: SMOKE },
    ...smokeEngines.map(({ name, device }) => ({
      name,
      use: { ...device, viewport: { width: 1440, height: 900 } },
      testMatch: SMOKE,
    })),
  ],
  webServer: {
    command: process.env.E2E_DEV
      ? `pnpm exec next dev -p ${PORT}`
      : `pnpm exec next start -p ${PORT}`,
    cwd: HOME,
    url: `${BASE_URL}/`,
    reuseExistingServer: !CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
