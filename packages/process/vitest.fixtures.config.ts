import { defineConfig } from "vitest/config";

/**
 * A SEPARATE vitest config used only by `pnpm generate:fixtures` (RM-053) — never by
 * `pnpm test`. Its `test.include` targets exactly the fixture-writer file, so running the
 * generator never runs (or is run by) the package's real test suite, and vice versa.
 * Reuses vitest (already a devDependency) rather than adding a new build-tool dependency
 * (`tsx`) just to execute one script.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/core/fixtures/generate-bpi-2012-subset.write.ts"],
  },
});
