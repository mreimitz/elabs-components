// search-cli-verbs.test.mjs — RM-088 follow-up 1, validator FAIL #1: a CLI verb
// GROUP is real, standalone tooling with no component/registry/playbook shape of
// its own, so — like the whole-screen templates fixed in #89 — it needs its OWN
// manifest arm (`manifest.cliVerbs` / `matchCliVerbs()`) to be reachable by
// `brand-ui search` at all. This locks both the CLI (`brand-ui search`) and the
// MCP `search` tool (the same engine, exercised without a process spawn) against
// the real, generated manifest.
//
// Written originally against `dashboard-spec`; retargeted at `a2ui` on 2026-09-22
// when the dashboard pack was parked (parked/README.md). `a2ui` is now the only
// group, so it is also the regression guard for the arm itself — if a future
// group is added, assert it here too rather than replacing this one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findRepoRoot, generateManifest, matchCliVerbs } from "../lib/core.mjs";
import { handleMessage } from "../lib/mcp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "bin", "brand-ui.mjs");
const repoRoot = findRepoRoot(here);

function run(args) {
  return spawnSync(process.execPath, [bin, ...args], {
    encoding: "utf8",
    cwd: repoRoot ?? here,
  });
}

const A2UI_VERBS = ["catalog", "schema", "validate", "example"];

test("manifest.cliVerbs carries all four a2ui verbs", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest generation unavailable");
  const manifest = generateManifest(repoRoot);
  assert.ok(Array.isArray(manifest.cliVerbs) && manifest.cliVerbs.length > 0);
  for (const verb of A2UI_VERBS) {
    const hits = matchCliVerbs(manifest, `a2ui ${verb}`);
    assert.ok(
      hits.some((h) => h.group === "a2ui" && h.verb === verb),
      `matchCliVerbs finds a2ui ${verb}`,
    );
  }
});

test('`brand-ui search "a2ui"` (CLI) surfaces all four a2ui verbs', (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["search", "a2ui"]);
  assert.equal(res.status, 0, `search exited cleanly:\n${res.stderr}`);
  assert.match(res.stdout, /CLI commands matching "a2ui":/);
  for (const verb of A2UI_VERBS) {
    assert.match(
      res.stdout,
      new RegExp(`brand-ui a2ui ${verb}`),
      `search a2ui prints "brand-ui a2ui ${verb}"`,
    );
  }
});

test("mcp__brand-ui__search surfaces all four a2ui verbs (same engine, no new tool)", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = handleMessage(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "search", arguments: { query: "a2ui" } },
    },
    { root: repoRoot },
  );
  const text = res.result.content[0].text;
  assert.match(text, /CLI commands matching "a2ui":/);
  for (const verb of A2UI_VERBS) {
    assert.match(text, new RegExp(`brand-ui a2ui ${verb}`));
  }
});
