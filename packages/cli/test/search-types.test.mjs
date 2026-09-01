// search-types.test.mjs — locks #86: `brand-ui search <name>` and
// `brand-ui docs <name>` (and the MCP tools built on the same engine) can
// never resolve a type-only export — every exported `interface`/`type` in
// every package, and every `otherExports` entry, is invisible even though the
// manifest correctly records them in each package's `types`/`otherExports`
// arrays. Root cause: `flat()` (packages/cli/lib/core.mjs) builds its row list
// from exactly `info.components`/`info.hooks` (+ subpaths) and never reads
// `info.types`/`info.otherExports`. This file asserts against the REAL
// committed manifest (via `generateManifest`), never a fixture that could
// drift from it, that a type-only export and an `otherExports` export both
// resolve — and that the fix isn't narrowly special-cased to one name.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findRepoRoot, generateManifest, flat } from "../lib/core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "bin", "brand-ui.mjs");
const repoRoot = findRepoRoot(here);

function run(args) {
  return spawnSync(process.execPath, [bin, ...args], {
    encoding: "utf8",
    cwd: repoRoot ?? here,
  });
}

test("flat(manifest) includes the newly-added type-only export DataTableColumnMeta", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest generation unavailable");
  const manifest = generateManifest(repoRoot);
  const rows = flat(manifest);
  const row = rows.find((r) => r.name === "DataTableColumnMeta");
  assert.ok(row, "DataTableColumnMeta is a row in flat(manifest)");
  assert.equal(row.kind, "type", 'DataTableColumnMeta is surfaced with kind "type"');
  assert.ok(row.module, "the row carries a source module path");
});

// Not narrowly special-cased to one name: a pre-existing, long-shipped type
// must resolve too.
test("flat(manifest) includes pre-existing types ButtonProps and DataTableProps", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest generation unavailable");
  const manifest = generateManifest(repoRoot);
  const rows = flat(manifest);
  for (const name of ["ButtonProps", "DataTableProps"]) {
    const row = rows.find((r) => r.name === name);
    assert.ok(row, `${name} is a row in flat(manifest)`);
    assert.equal(row.kind, "type", `${name} is surfaced with kind \"type\"`);
  }
});

// otherExports (plain functions/values that aren't components or hooks) must
// resolve too — proving the fix covers both buckets `flat()` was missing.
test("flat(manifest) includes an otherExports entry (createSelectionColumn)", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest generation unavailable");
  const manifest = generateManifest(repoRoot);
  const rows = flat(manifest);
  const row = rows.find((r) => r.name === "createSelectionColumn");
  assert.ok(row, "createSelectionColumn is a row in flat(manifest)");
  assert.equal(row.kind, "export", 'createSelectionColumn is surfaced with kind "export"');
  assert.ok(row.module, "the row carries a source module path");
});

test('`brand-ui search DataTableColumnMeta` returns a match, not "(none)"', (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["search", "DataTableColumnMeta"]);
  assert.equal(res.status, 0, `search exited cleanly:\n${res.stderr}`);
  assert.match(res.stdout, /DataTableColumnMeta/, "the type is found by search");
  assert.doesNotMatch(res.stdout, /\(none\)/, "search no longer reports no match");
});

test('`brand-ui docs DataTableColumnMeta` prints real content, not "not found"', (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["docs", "DataTableColumnMeta"]);
  assert.equal(res.status, 0, `docs exited cleanly:\n${res.stderr}`);
  assert.doesNotMatch(res.stdout, /not found/, "docs no longer reports not found");
  assert.match(res.stdout, /DataTableColumnMeta/, "docs prints the type's name");
  assert.match(res.stdout, /source:/, "docs prints the module path (source location)");
});
