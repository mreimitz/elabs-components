// search-cli-verbs.test.mjs — RM-088 follow-up 1, validator FAIL #1: the
// acceptance bullet for the dashboard sheet closure requires `brand-ui search
// "dashboard"` to return the sheet, the four registry blocks AND the
// `dashboard-spec` CLI verbs (schema/validate/kinds/layout, RM-086 #427). The
// verbs are real, standalone tooling with no component/registry/playbook shape
// of their own, so — like the whole-screen templates fixed in #89 — they need
// their OWN manifest arm (`manifest.cliVerbs` / `matchCliVerbs()`) to be
// reachable at all. This locks both the CLI (`brand-ui search`) and the MCP
// `search` tool (the same engine, exercised without a process spawn) against
// the real, generated manifest.
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

const DASHBOARD_SPEC_VERBS = ["schema", "validate", "kinds", "layout"];

test("manifest.cliVerbs carries all four dashboard-spec verbs", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest generation unavailable");
  const manifest = generateManifest(repoRoot);
  assert.ok(Array.isArray(manifest.cliVerbs) && manifest.cliVerbs.length > 0);
  for (const verb of DASHBOARD_SPEC_VERBS) {
    const hits = matchCliVerbs(manifest, `dashboard-spec ${verb}`);
    assert.ok(
      hits.some((h) => h.group === "dashboard-spec" && h.verb === verb),
      `matchCliVerbs finds dashboard-spec ${verb}`,
    );
  }
});

test('`brand-ui search "dashboard"` (CLI) surfaces all four dashboard-spec verbs', (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["search", "dashboard"]);
  assert.equal(res.status, 0, `search exited cleanly:\n${res.stderr}`);
  assert.match(res.stdout, /CLI commands matching "dashboard":/);
  for (const verb of DASHBOARD_SPEC_VERBS) {
    assert.match(
      res.stdout,
      new RegExp(`brand-ui dashboard-spec ${verb}`),
      `search dashboard prints "brand-ui dashboard-spec ${verb}"`,
    );
  }
});

test("mcp__brand-ui__search surfaces all four dashboard-spec verbs (same engine, no new tool)", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = handleMessage(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "search", arguments: { query: "dashboard-spec" } },
    },
    { root: repoRoot },
  );
  const text = res.result.content[0].text;
  assert.match(text, /CLI commands matching "dashboard-spec":/);
  for (const verb of DASHBOARD_SPEC_VERBS) {
    assert.match(text, new RegExp(`brand-ui dashboard-spec ${verb}`));
  }
});
