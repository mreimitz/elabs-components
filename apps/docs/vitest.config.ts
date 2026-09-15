import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";

const dirName = dirname(fileURLToPath(import.meta.url));

// Force one shared React instance. Otherwise the Vitest browser optimizer can
// pre-bundle Radix into a chunk that imports a *different* React copy than the
// story source, leaving the hooks dispatcher null at render
// ("Cannot read properties of null (reading 'useContext')"). Pre-bundling
// React up front (instead of lazy discovery) also avoids the mid-run
// "Vite unexpectedly reloaded a test" optimize/reload race. Shared by every
// browser project below — each is its own mini Vite config, so this does not
// inherit across projects.
const REACT_DEDUPE = {
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
};

export default defineConfig({
  test: {
    projects: [
      {
        ...REACT_DEDUPE,
        // Runs every co-located `*.stories.tsx` across the workspace (globbed by
        // `.storybook/main.ts`) as a browser test: each story renders in real
        // Chromium and its `play` function, if any, executes as the test body.
        // Selected with `vitest --project storybook`. Tailwind + token CSS
        // arrive via main.ts's viteFinal and `.storybook/preview.tsx`, so
        // computed styles are real.
        plugins: [storybookTest({ configDir: join(dirName, ".storybook") })],
        test: {
          name: "storybook",
          // Cold Monaco story mounts need a first-wait budget beyond vitest's
          // default test timeout; healthy stories are bounded by their own
          // waitFor budgets — this ceiling is only what a genuinely hung story
          // pays.
          testTimeout: 60_000,
          // No setup file needed: since Storybook 10.3 `@storybook/addon-vitest`
          // auto-applies the preview annotations (theme decorator + token/React
          // Flow CSS imports from `.storybook/preview.tsx`), so stories render
          // fully styled.
          browser: {
            enabled: true,
            headless: true,
            provider: "playwright",
            // Don't litter the tree with PNGs when an assertion fails; the
            // error message is enough to diagnose.
            screenshotFailures: false,
            // Run the whole suite as a user who has asked for reduced motion.
            // `@vitest/browser` spreads `context` into Playwright's
            // `newContext()`, so this is what makes
            // `matchMedia("(prefers-reduced-motion: reduce)")` true in the
            // story runtime — without it the motion toolbar global writes
            // `data-motion-pref` but nothing puts the RUNTIME into a reduced
            // state, and every JS (Motion/rAF) entrance animation keeps
            // running under the a11y pass. axe then samples text part-way up
            // an opacity ramp and reports a blended, illegible ink (#125) —
            // or, worse, skips the node entirely while it sits at
            // `opacity: 0`, making the a11y assertion vacuous in BOTH
            // directions. Reduced motion removes the transient, so contrast is
            // measured on the resting colour every run.
            // `storybook-motion-harness.stories.tsx` asserts this flip
            // actually took, so it cannot silently stop working. A story that
            // needs full motion opts back in per-story
            // (`globals: { motionPref: "full" }` for the CSS gate).
            instances: [{ browser: "chromium", context: { reducedMotion: "reduce" } }],
          },
        },
      },
      {
        ...REACT_DEDUPE,
        // The generated per-component contract suite (S2,
        // scripts/gen-contract-tests.mjs): axe (wcag2a/wcag2aa) + no
        // horizontal overflow, swept over every built-in theme and the
        // phone/tablet/desktop widths. A plain vitest project (not the
        // storybook CSF transform above) — it renders each component's
        // `Default` story args directly via `react-dom/client`, so it needs
        // the real token/Tailwind CSS wired in itself.
        plugins: [tailwindcss()],
        test: {
          name: "contract",
          include: ["contract/**/*.contract.test.tsx"],
          testTimeout: 30_000,
          setupFiles: [join(dirName, "contract/setup.ts")],
          browser: {
            enabled: true,
            headless: true,
            provider: "playwright",
            screenshotFailures: false,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
