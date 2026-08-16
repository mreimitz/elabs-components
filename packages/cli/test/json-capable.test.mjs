// json-capable.test.mjs — turns the CLI's own `--help` claim ("--json …
// supported by info, search, scan, map, audit, context and docs") into a
// CHECKED claim (#325), the way prose alone let it silently drift for `docs`.
// Every command the help text advertises as `--json`-capable must actually
// emit parseable JSON for a valid query — this test fails the same way it
// would have caught #325 before it was filed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

// NOTE: `context` is deliberately NOT in this list. The help text claims it
// supports `--json` too, but `cmdContext` never reads the `json` flag at all —
// `brand-ui context --check --json` prints the same plain-text banner as
// without the flag. That is a pre-existing, still-open version of exactly the
// #325 problem, scoped to a different command; it is out of scope for this
// fix (see the cli-flags unit result file) and flagged there for a follow-up
// issue rather than silently patched here.
const JSON_CAPABLE = [
  ["info", "--json"],
  ["search", "button", "--json"],
  ["docs", "Button", "--json"],
  ["audit", "packages/ui/src/components/button", "--json"],
];

for (const args of JSON_CAPABLE) {
  test(`brand-ui ${args.join(" ")} produces valid, parseable JSON on stdout`, (t) => {
    if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
    const res = run(args);
    assert.doesNotThrow(
      () => JSON.parse(res.stdout),
      `${args.join(" ")} → valid JSON on stdout:\n${res.stdout}`,
    );
  });
}

test("brand-ui scan --json / map <scan.json> --json both produce valid, parseable JSON", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const scanRes = run(["scan", "packages/ui", "--json"]);
  assert.doesNotThrow(
    () => JSON.parse(scanRes.stdout),
    `scan --json → valid JSON:\n${scanRes.stdout}`,
  );
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-json-flag-"));
  const scanFile = join(dir, "scan.json");
  writeFileSync(scanFile, scanRes.stdout);
  const mapRes = run(["map", scanFile, "--json"]);
  assert.doesNotThrow(
    () => JSON.parse(mapRes.stdout),
    `map --json → valid JSON:\n${mapRes.stdout}`,
  );
});
