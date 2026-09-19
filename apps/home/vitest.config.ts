import { configDefaults, defineConfig } from "vitest/config";

// The fixtures are pure data generation (no DOM), so `node` is the fast, correct
// environment — mirrors packages/tokens/vitest.config.ts. `testTimeout` is raised because
// `fixtures.test.ts` deliberately re-runs `generateOrders(10_000)` and a 6,000-row aggregation
// several times over (determinism + MRR-consistency checks), not because any one assertion is
// slow on its own.
//
// `**/*.test.mjs` (e.g. `components/hero/copy.test.mjs`, RM-094) is excluded: it deliberately
// uses `node:test`, not Vitest — see its own header comment — so it is run with
// `node --test apps/home/components/hero/copy.test.mjs`, never picked up here (wave-1 swap
// follow-up, Refs #455 #456).
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    css: false,
    testTimeout: 20_000,
    exclude: [...configDefaults.exclude, "**/*.test.mjs"],
  },
});
