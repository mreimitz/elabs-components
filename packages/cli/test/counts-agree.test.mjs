// counts-agree.test.mjs — RM-129: the three places an agent or a person reads a
// per-package component count (the brand-ui skill router, llms.txt and the README)
// print the same number, and it is `componentCounts` — one per component module.
// The skill once said "ui 405" next to the README's 132. Reads the committed,
// generated files (gen:check keeps them fresh), not a fixture.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findRepoRoot, loadManifest } from "../lib/core.mjs";
import { componentCounts, orderedPackages } from "../lib/render-docs.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = findRepoRoot(here);
const SCOPE = "@elabs-ai/components-";

const read = (rel) => readFileSync(join(repoRoot, rel), "utf8");
const short = (pkg) => pkg.slice(SCOPE.length);

function fromSkill(text) {
  const out = {};
  for (const [, name, n] of text.matchAll(/^- `@elabs-ai\/components-([a-z-]+)` \((\d+)\):/gm))
    out[name] = Number(n);
  return out;
}

function fromLlms(text) {
  const out = {};
  for (const [, name, n] of text.matchAll(
    /^- \[@elabs-ai\/components-([a-z-]+)\]\([^)]*\) — .*\((\d+) components\b/gm,
  ))
    out[name] = Number(n);
  return out;
}

function fromReadme(text) {
  const line = text.split("\n").find((l) => l.startsWith("**By the numbers:**")) ?? "";
  const list = line.split(" — ")[1]?.split(". ")[0] ?? "";
  const out = {};
  for (const [, name, n] of list.matchAll(/([a-z-]+) (\d+)/g)) out[name] = Number(n);
  return out;
}

test("the skill router, llms.txt and the README agree on every package's component count", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — generated files unavailable");
  const manifest = loadManifest(repoRoot);
  const expected = Object.fromEntries(
    orderedPackages(manifest).map((pkg) => [
      short(pkg),
      componentCounts(manifest.packages[pkg]).components,
    ]),
  );
  assert.ok(Object.keys(expected).length > 5, "the manifest lists the packages");
  assert.deepEqual(fromSkill(read("skills/brand-ui/SKILL.md")), expected, "skill router");
  assert.deepEqual(fromLlms(read("apps/docs/public/llms.txt")), expected, "llms.txt");
  assert.deepEqual(fromReadme(read("README.md")), expected, "README");
});
