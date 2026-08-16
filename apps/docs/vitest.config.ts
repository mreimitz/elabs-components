import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

const dirName = dirname(fileURLToPath(import.meta.url));

// Runs every co-located `*.stories.tsx` across the workspace (globbed by
// `.storybook/main.ts`) as a browser test: each story renders in real Chromium
// and its `play` function, if any, executes as the test body. Selected with
// `vitest --project storybook`. Tailwind + token CSS arrive via main.ts's
// viteFinal and `.storybook/preview.tsx`, so computed styles are real.
export default defineConfig({
  plugins: [storybookTest({ configDir: join(dirName, ".storybook") })],
  // Force one shared React instance. Otherwise the Vitest browser optimizer can
  // pre-bundle Radix into a chunk that imports a *different* React copy than the
  // story source, leaving the hooks dispatcher null at render
  // ("Cannot read properties of null (reading 'useContext')"). Pre-bundling
  // React up front (instead of lazy discovery) also avoids the mid-run
  // "Vite unexpectedly reloaded a test" optimize/reload race.
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  test: {
    name: "storybook",
    // Cold Monaco story mounts need a first-wait budget beyond vitest's default
    // test timeout; healthy stories are bounded by their own waitFor budgets —
    // this ceiling is only what a genuinely hung story pays.
    testTimeout: 60_000,
    // No setup file needed: since Storybook 10.3 `@storybook/addon-vitest`
    // auto-applies the preview annotations (theme decorator + token/React Flow
    // CSS imports from `.storybook/preview.tsx`), so stories render fully styled.
    browser: {
      enabled: true,
      headless: true,
      provider: "playwright",
      // Don't litter the tree with PNGs when an assertion fails; the error
      // message is enough to diagnose.
      screenshotFailures: false,
      instances: [{ browser: "chromium" }],
    },
  },
});
