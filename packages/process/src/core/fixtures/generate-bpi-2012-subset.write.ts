/**
 * Fixture writer for {@link generateBpi2012Subset} — RM-053.
 *
 * Invoked via `pnpm --filter @elabs-ai/components-process generate:fixtures`, which runs
 * `vitest run --config vitest.fixtures.config.ts` against exactly this file. Deliberately
 * NOT `tsx` (tried, then reverted — a fixtures change should not carry a repo-wide
 * `esbuild`/build-tool bump for a package's own dev script): `vitest` is already a
 * devDependency of this package and executes TypeScript directly, so it is the toolchain
 * already on hand for running one script.
 *
 * This file is a genuine vitest test (a `describe`/`it` pair, with a real assertion) so
 * `vitest run` accepts it as a normal test file — the write to disk is the test's side
 * effect. It is named `.write.ts`, not `.test.ts`/`.spec.ts`, so the package's real
 * `vitest.config.ts` (whose default `include` only matches `*.test.*`/`*.spec.*`) never
 * picks it up: `pnpm test` never runs this file, and `pnpm generate:fixtures` never runs
 * the package's real test suite. `vitest.fixtures.config.ts`'s `test.include` names this
 * file explicitly, which is what makes it reachable at all.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateBpi2012Subset } from "./generate-bpi-2012-subset";

/** Resolved path of the generated (git-ignored) fixture file, next to this module. */
export const BPI_2012_SUBSET_OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "bpi-2012-subset.json",
);

describe("generate:fixtures", () => {
  it("writes the BPI-2012-shaped 13k-case fixture to disk", () => {
    const log = generateBpi2012Subset({ cases: 13_000, seed: 1 });
    writeFileSync(BPI_2012_SUBSET_OUTPUT_PATH, JSON.stringify(log));
    console.log(
      `Wrote ${BPI_2012_SUBSET_OUTPUT_PATH} (${log.events.length} events across 13000 cases).`,
    );
    expect(log.events.length).toBeGreaterThan(0);
  });
});
