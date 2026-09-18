import { defineConfig } from "vitest/config";

// The fixtures are pure data generation (no DOM), so `node` is the fast, correct
// environment — mirrors packages/tokens/vitest.config.ts. `testTimeout` is raised because
// `fixtures.test.ts` deliberately re-runs `generateOrders(50_000)` and a 6,000-row aggregation
// several times over (determinism + MRR-consistency checks), not because any one assertion is
// slow on its own.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    css: false,
    testTimeout: 20_000,
  },
});
