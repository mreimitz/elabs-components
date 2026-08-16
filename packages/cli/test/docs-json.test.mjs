// docs-json.test.mjs — locks #325: `brand-ui docs <Component> --json` emits
// STRUCTURED JSON carrying the same fields the markdown card shows (purpose,
// relationships, stateTokens, antiPatterns, props, variants), instead of
// silently ignoring `--json` and printing markdown regardless. The markdown
// path (no `--json`) must stay byte-for-byte the same as before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findRepoRoot } from "../lib/core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "bin", "brand-ui.mjs");
const repoRoot = findRepoRoot(here);

function run(args) {
  return spawnSync(process.execPath, [bin, ...args], {
    encoding: "utf8",
    cwd: repoRoot ?? here,
  });
}

test("`brand-ui docs Button --json` emits valid JSON carrying the fields the markdown shows", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["docs", "Button", "--json"]);
  assert.equal(res.status, 0, `exits cleanly:\n${res.stderr}`);
  let data;
  assert.doesNotThrow(() => {
    data = JSON.parse(res.stdout);
  }, "stdout is valid JSON");
  assert.equal(data.name, "Button");
  assert.equal(data.pkg, "@elabs-ai/components-ui");
  assert.ok(data.purpose, "purpose carried");
  assert.ok(data.relationships, "relationships carried");
  assert.ok(
    data.stateTokens && Object.keys(data.stateTokens).length,
    "stateTokens carried (state → token map)",
  );
  assert.ok(
    Array.isArray(data.antiPatterns) && data.antiPatterns.length,
    "antiPatterns carried — the highest-value field for an agent",
  );
  assert.ok(data.props, "props carried");
  assert.ok(
    data.variants?.variants?.variant?.includes("destructive"),
    "expanded cva variants carried",
  );
});

test("`brand-ui docs Button` (no --json) still prints the markdown card, unaffected", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["docs", "Button"]);
  assert.equal(res.status, 0);
  assert.match(
    res.stdout,
    /^# Button {2}\(@elabs-ai\/components-ui\)/,
    "markdown header unchanged",
  );
  assert.throws(() => JSON.parse(res.stdout), "markdown output is not JSON");
});

test("`brand-ui docs Button Badge --json` emits an array, one record per queried component", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["docs", "Button", "Badge", "--json"]);
  assert.equal(res.status, 0, `exits cleanly:\n${res.stderr}`);
  const data = JSON.parse(res.stdout);
  assert.ok(Array.isArray(data), "multiple queries → a JSON array");
  assert.equal(data.length, 2);
  assert.equal(data[0].name, "Button");
  assert.equal(data[1].name, "Badge");
});

test("`brand-ui docs <unknown> --json` still emits valid JSON (not-found is not a crash)", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["docs", "TotallyNotARealComponentXYZ", "--json"]);
  let data;
  assert.doesNotThrow(() => {
    data = JSON.parse(res.stdout);
  }, "stdout is valid JSON even for a not-found component");
  assert.equal(data.found, false);
  assert.equal(data.name, "TotallyNotARealComponentXYZ");
});
