// `brand-ui dashboard-spec` (RM-086, #427): the four verbs, run through the real bin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { layoutSpec, validateSpec } from "../lib/dashboard-spec.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const bin = join(here, "..", "bin", "brand-ui.mjs");
const fixture = (name) => join(here, "fixtures", "dashboard-spec", name);

const run = (...argv) =>
  spawnSync(process.execPath, [bin, "dashboard-spec", ...argv], { encoding: "utf8" });

test("schema prints the JSON Schema that pnpm gen writes to packages/charts/schemas", () => {
  const r = run("schema");
  assert.equal(r.status, 0, r.stderr);
  const printed = JSON.parse(r.stdout);
  const onDisk = JSON.parse(
    readFileSync(join(repoRoot, "packages/charts/schemas/dashboard-spec.v1.schema.json"), "utf8"),
  );
  assert.deepEqual(printed, onDisk);
  assert.equal(printed.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.match(printed.$id, /dashboard-spec\.v1\.schema\.json$/);
});

test("validate <bad> exits 1 and lists every error as path, code, message", () => {
  const r = run("validate", fixture("bad.json"));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /5 errors/);
  for (const [path, code] of [
    ["$.version", "version"],
    ["$.grid", "missing"],
    ["$.tiles[0].layout.w", "type"],
    ["$.tiles[1]", "duplicate-id"],
    ["$.tiles[2].kind", "missing"],
  ]) {
    assert.match(r.stdout, new RegExp(`\\${path.replace(/[[\].]/g, "\\$&")}\\s+${code}\\s`));
  }
});

test("validate --json carries the structured errors", () => {
  const r = run("validate", fixture("bad.json"), "--json");
  assert.equal(r.status, 1);
  const body = JSON.parse(r.stdout);
  assert.equal(body.ok, false);
  assert.ok(body.errors.some((e) => e.code === "duplicate-id" && e.path === "$.tiles[1]"));
});

test("validate on a missing file or broken JSON exits 1 on stderr", () => {
  assert.equal(run("validate", fixture("nope.json")).status, 1);
  const dir = mkdtempSync(join(tmpdir(), "dashboard-spec-"));
  writeFileSync(join(dir, "broken.json"), "{ not json");
  const r = run("validate", join(dir, "broken.json"));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not valid JSON/);
});

test("kinds lists the nine built-in tile kinds with sizes", () => {
  const r = run("kinds");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^9 built-in tile kinds/);
  for (const kind of [
    "chart",
    "metric",
    "text",
    "heading",
    "divider",
    "image",
    "button",
    "variable",
    "filter",
  ])
    assert.match(r.stdout, new RegExp(`^  ${kind}\\s+default \\d+×\\d+\\s+min \\d+×\\d+`, "m"));
  const json = JSON.parse(run("kinds", "--json").stdout);
  assert.equal(json.kinds.length, 9);
  assert.deepEqual(json.kinds.find((k) => k.kind === "metric").defaultSize, { w: 4, h: 2 });
});

test("layout <positionless> prints a spec that validates, every tile placed, metrics on row 0", () => {
  const r = run("layout", fixture("minimal-positionless.json"));
  assert.equal(r.status, 0, r.stderr);
  const spec = JSON.parse(r.stdout);
  assert.ok(
    spec.tiles.every((t) => t.layout),
    "every tile has a layout",
  );
  assert.deepEqual(
    spec.tiles.filter((t) => t.kind === "metric").map((t) => t.layout.y),
    [0, 0],
  );
  assert.deepEqual(validateSpec(spec), { ok: true, errors: [] });

  // …and the printed file round-trips through `validate`.
  const dir = mkdtempSync(join(tmpdir(), "dashboard-spec-"));
  writeFileSync(join(dir, "laid-out.json"), r.stdout);
  assert.equal(run("validate", join(dir, "laid-out.json")).status, 0);
});

test("layout honours --strategy in both spellings and rejects an unknown one", () => {
  const eq = JSON.parse(
    run("layout", fixture("minimal-positionless.json"), "--strategy=reading-order").stdout,
  );
  const sp = JSON.parse(
    run("layout", fixture("minimal-positionless.json"), "--strategy", "reading-order").stdout,
  );
  assert.deepEqual(eq, sp);
  assert.notDeepEqual(eq, JSON.parse(run("layout", fixture("minimal-positionless.json")).stdout));
  const bad = run("layout", fixture("minimal-positionless.json"), "--strategy=zigzag");
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown --strategy/);
});

test("layoutSpec keeps existing layouts and is deterministic", () => {
  const spec = JSON.parse(readFileSync(fixture("minimal-positionless.json"), "utf8"));
  spec.tiles[3].layout = { x: 12, y: 8, w: 12, h: 4 };
  const a = layoutSpec(spec);
  assert.deepEqual(a.tiles[3].layout, { x: 12, y: 8, w: 12, h: 4 });
  assert.deepEqual(a, layoutSpec(spec));
});

test("no verb, or an unknown one, prints usage and exits 1; --help exits 0", () => {
  assert.equal(run().status, 1);
  assert.match(run("bogus").stderr, /usage: brand-ui dashboard-spec/);
  const help = run("--help");
  assert.equal(help.status, 0);
  assert.match(help.stdout, /usage: brand-ui dashboard-spec/);
});
