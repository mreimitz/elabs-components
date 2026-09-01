// search-truncation.test.mjs — locks the fix-round-1 regression found by an
// independent validator against commit 05b6040 (the original #86/#89 fix):
// adding `type`/`export` rows to `flat()` (for #86) roughly doubled the row
// count for type-heavy packages, and `cmdSearch()`/`toolSearch()` truncated
// the COMBINED components+types list to a single cap (30 for the CLI, 40 for
// the MCP tool) in manifest order — so a query like "Button" could fill the
// cap entirely with `*ButtonProps` type rows and silently drop every real
// `@elabs-ai/components-ui` Button component, including `Button` itself. This
// violated the #89 brief's own "purely additive" acceptance criterion.
//
// The fix splits `flat()`'s matches into two independently-truncated
// buckets — component/hook rows vs type/export rows — in both `cmdSearch()`
// (packages/cli/bin/brand-ui.mjs) and `toolSearch()` (packages/cli/lib/mcp.mjs),
// so a type/otherExport match can never crowd a component/hook match out of
// its own section. This test asserts against the REAL committed manifest via
// the CLI binary and the MCP `handleMessage` dispatcher — never a fixture
// that could drift from it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findRepoRoot } from "../lib/core.mjs";
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

test("`brand-ui search Button` returns the real Button component, not just its type", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["search", "Button"]);
  assert.equal(res.status, 0, `search exited cleanly:\n${res.stderr}`);
  const componentsSection = res.stdout.split(/\n\nTypes\/other exports matching/)[0];
  assert.match(
    componentsSection,
    /^ {2}Button {2}\(@elabs-ai\/components-ui · component\)$/m,
    "the real Button component (not ButtonProps) is listed in the Components/hooks section",
  );
});

test("`brand-ui search Button` keeps the components/hooks and types sections separate", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["search", "Button"]);
  assert.equal(res.status, 0, `search exited cleanly:\n${res.stderr}`);
  assert.match(res.stdout, /^Components\/hooks matching "button":$/m);
  assert.match(res.stdout, /^Types\/other exports matching "button":$/m);
  // No `*Props`/`*Variants` type/export names leak into the components/hooks section.
  const componentsSection = res.stdout.split(/\n\nTypes\/other exports matching/)[0];
  assert.doesNotMatch(
    componentsSection,
    /ButtonProps|buttonVariants/,
    "type/export rows do not appear in the components/hooks section",
  );
});

test("`brand-ui search --json Button` splits `components` (component/hook only) from a new `types` key", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["search", "--json", "Button"]);
  assert.equal(res.status, 0, `search --json exited cleanly:\n${res.stderr}`);
  const data = JSON.parse(res.stdout);
  assert.ok(Array.isArray(data.components), "components is an array");
  assert.ok(Array.isArray(data.types), "types is a new, additive array");
  assert.ok(
    data.components.every((r) => r.kind === "component" || r.kind === "hook"),
    "every row in components is a component or hook",
  );
  assert.ok(
    data.types.every((r) => r.kind === "type" || r.kind === "export"),
    "every row in types is a type or otherExport",
  );
  assert.ok(
    data.components.some((r) => r.name === "Button"),
    "the real Button component is present in the components bucket",
  );
});

test('mcp__brand-ui__search "Button" (toolSearch) also keeps Button in its components/hooks section', (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = handleMessage(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "search", arguments: { query: "Button" } },
    },
    { root: repoRoot },
  );
  const text = res.result.content[0].text;
  const componentsSection = text.split(/\n\nTypes\/other exports matching/)[0];
  assert.match(
    componentsSection,
    /^ {2}Button {2}\(@elabs-ai\/components-ui · component\)$/m,
    "the real Button component is listed in toolSearch's Components/hooks section",
  );
});
