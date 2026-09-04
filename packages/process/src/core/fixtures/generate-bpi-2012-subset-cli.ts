/**
 * CLI entry point for {@link generateBpi2012Subset} — RM-053.
 *
 * Split out of `generate-bpi-2012-subset.ts` on purpose: THIS file is the only place the
 * Node-only `node:fs`/`node:path`/`node:url` imports and `process.argv` read appear, so the
 * pure generator stays importable from a browser bundle (a Storybook story, a future
 * fixture-preview panel) where those built-ins are externalized and throw on access. Run via
 * `pnpm --filter @elabs-ai/components-process generate:fixtures` (wired to `tsx` in the
 * package's `package.json`).
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateBpi2012Subset } from "./generate-bpi-2012-subset";

/** Resolved path of the generated (git-ignored) fixture file, next to this module. */
export const BPI_2012_SUBSET_OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "bpi-2012-subset.json",
);

function isMainModule(): boolean {
  const entry = process.argv[1];
  return !!entry && resolve(entry) === fileURLToPath(import.meta.url);
}

// CLI entry point — `pnpm --filter @elabs-ai/components-process generate:fixtures`.
if (isMainModule()) {
  const log = generateBpi2012Subset({ cases: 13_000, seed: 1 });
  writeFileSync(BPI_2012_SUBSET_OUTPUT_PATH, JSON.stringify(log));
  console.log(
    `Wrote ${BPI_2012_SUBSET_OUTPUT_PATH} (${log.events.length} events across 13000 cases).`,
  );
}
