// search-paging.test.mjs — RM-129: `search` pages with limit/offset over the CLI
// and the MCP tool, and a call that passes neither prints exactly what it always
// did (the cut-off lists keep their old wording). Asserts against the real
// committed manifest, like search-truncation.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findRepoRoot } from "../lib/core.mjs";
import { handleMessage, TOOLS } from "../lib/mcp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "bin", "brand-ui.mjs");
const repoRoot = findRepoRoot(here);

function run(args, opts = {}) {
  return spawnSync(process.execPath, [bin, ...args], {
    encoding: "utf8",
    cwd: repoRoot ?? here,
    ...opts,
  });
}

function mcpSearch(args) {
  const res = handleMessage(
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search", arguments: args } },
    { root: repoRoot },
  );
  return res.result;
}

/** The rows listed under one section heading, up to the next blank line. */
function section(text, heading) {
  const start = text.indexOf(heading);
  if (start === -1) return [];
  const body = text.slice(start + heading.length).split("\n\n")[0];
  return body.split("\n").filter((l) => /^ {2}\S/.test(l) && !l.startsWith("  …"));
}

test("CLI: --offset returns the next page and says how to ask for the one after", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const first = run(["search", "chart", "--limit", "10"]);
  const second = run(["search", "chart", "--limit", "10", "--offset", "10"]);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  const heading = 'Components/hooks matching "chart":';
  const a = section(first.stdout, heading);
  const b = section(second.stdout, heading);
  assert.equal(a.length, 10);
  assert.equal(b.length, 10);
  assert.ok(!b.some((l) => a.includes(l)), "page two repeats nothing from page one");
  assert.match(first.stdout, /… \d+ more — search "chart" --offset 10 --limit 10/);
  // The value is the flag's, never part of the query.
  assert.doesNotMatch(second.stdout, /matching "chart 10"/);
});

test("CLI: the default call keeps the old wording and cap", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["search", "chart"]);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(section(res.stdout, 'Components/hooks matching "chart":').length, 30);
  assert.match(res.stdout, /… \d+ more — narrow the query/);
  assert.doesNotMatch(res.stdout, /--offset|no more —/);
});

test("CLI: past the end, a paged call says so instead of printing an empty list", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["search", "chart", "--offset", "100000"]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /\(no more — \d+ in all\)/);
});

test("CLI: a bad --limit or --offset is refused with the reason", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  for (const args of [["--limit", "0"], ["--offset", "-1"], ["--offset", "two"], ["--offset"]]) {
    const res = run(["search", "chart", ...args]);
    assert.equal(res.status, 1, `exit 1 for ${args.join(" ")}`);
    assert.match(res.stderr, /--limit takes a whole number/);
  }
});

test("CLI --json: a paged call windows both lists and reports nextOffset", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["search", "chart", "--json", "--limit", "5", "--offset", "5"]);
  assert.equal(res.status, 0, res.stderr);
  const data = JSON.parse(res.stdout);
  assert.equal(data.components.length, 5);
  assert.ok(data.types.length <= 5);
  assert.equal(data.page.offset, 5);
  assert.equal(data.page.nextOffset, 10);
  assert.ok(data.page.totalComponents > 10);
  const unpaged = JSON.parse(run(["search", "chart", "--json"]).stdout);
  assert.equal(unpaged.page, undefined, "an unpaged call has no page block");
  assert.equal(unpaged.components.length, data.page.totalComponents);
});

test("MCP: offset pages the search tool and the answer names nextOffset", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const schema = TOOLS.find((tool) => tool.name === "search").inputSchema;
  assert.equal(schema.properties.offset.type, "integer");
  assert.equal(schema.properties.limit.type, "integer");
  assert.deepEqual(schema.required, ["query"], "both stay optional");

  const heading = 'Components/hooks matching "chart":';
  const first = mcpSearch({ query: "chart", limit: 10 }).content[0].text;
  const second = mcpSearch({ query: "chart", offset: 10, limit: 10 }).content[0].text;
  const a = section(first, heading);
  const b = section(second, heading);
  assert.equal(a.length, 10);
  assert.equal(b.length, 10);
  assert.ok(!b.some((l) => a.includes(l)), "page two repeats nothing from page one");
  assert.match(first, /nextOffset: 10 \(search \{ query, offset: 10, limit: 10 \}\)/);

  const plain = mcpSearch({ query: "chart" }).content[0].text;
  assert.equal(section(plain, heading).length, 40, "the default page is still 40");
  assert.doesNotMatch(plain, /nextOffset/);

  const bad = mcpSearch({ query: "chart", offset: -3 });
  assert.equal(bad.isError, true);
});

test("stdio MCP: the ready banner names every tool tools/list answers", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["mcp"], { input: "" });
  const banner = res.stderr.split("\n").find((l) => l.includes("MCP server ready")) ?? "";
  for (const { name } of TOOLS) assert.match(banner, new RegExp(`\\b${name}\\b`), name);
});
