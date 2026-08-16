import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findRepoRoot, generateManifest, flat } from "../lib/core.mjs";

// End-to-end coverage for the #79 anti-hallucination guarantee: the OTHER
// variant tests parse a *synthetic* cva source string, so they can't catch a
// regression where the parser breaks against REAL component syntax or where
// `button.tsx` drifts. These tests run the actual `docs` command path and the
// real `generateManifest` against the on-disk `button.tsx`, locking the promise
// that `brand-ui docs Button` shows the real `variant`/`size` values an agent
// would otherwise have to read source for.

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "bin", "brand-ui.mjs");
const repoRoot = findRepoRoot(here);

test("`brand-ui docs Button` prints the real expanded cva variant + size values", () => {
  const res = spawnSync(process.execPath, [bin, "docs", "Button"], {
    encoding: "utf8",
    cwd: repoRoot ?? here,
  });
  assert.equal(res.status, 0, `docs exited cleanly:\n${res.stderr}`);
  const stdout = res.stdout;

  // The acceptance criterion: the agent sees real values, not the literal
  // `VariantProps<typeof buttonVariants>`.
  assert.match(stdout, /variants \(expanded from cva/, "expanded-variants section is printed");
  assert.match(
    stdout,
    /variant:.*\bdestructive\b/,
    "variant union expanded — includes `destructive`",
  );
  assert.match(stdout, /size:.*\bicon\b/, "size union expanded — includes `icon`");
  // The default is flagged so an agent knows the implicit value.
  assert.match(stdout, /default \(default\)/, "the cva default value is flagged");
});

test("generateManifest resolves Button's variants from the REAL button.tsx", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest generation unavailable");
  const manifest = generateManifest(repoRoot);
  const button = flat(manifest).find((r) => r.name === "Button");
  assert.ok(button, "Button is in the generated manifest");
  assert.ok(button.variants?.variants, "Button carries expanded cva variant data");

  assert.ok(
    button.variants.variants.variant.includes("destructive"),
    "real button.tsx → variant includes `destructive`",
  );
  assert.ok(
    button.variants.variants.size.includes("icon"),
    "real button.tsx → size includes `icon`",
  );
  assert.equal(button.variants.defaultVariants.variant, "default", "default variant resolved");
  assert.equal(button.variants.defaultVariants.size, "default", "default size resolved");
});
