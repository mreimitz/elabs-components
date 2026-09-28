import assert from "node:assert/strict";
import { test } from "node:test";
import { viewUrl } from "../../server/mcp/view-url.mjs";
import { refuseNonLocal } from "../../server/local-guard.mjs";

test("view URLs preserve request port and encode every path segment", () => {
  for (const origin of ["http://localhost:5425", "http://127.0.0.1:9999", "http://[::1]:8080"]) {
    const path = "Team Space/銀行 & x=1.yaml";
    const url = viewUrl({ origin }, path);
    assert.equal(new URL(url).origin, origin);
    assert.equal(decodeURIComponent(new URL(url).hash.slice(3)), path);
    assert.equal(url.includes("&"), false);
  }
  assert.equal(viewUrl({ origin: "http://localhost:5425" }, "a-folder"), undefined);
});
test("only local, same-origin requests can receive a view URL", () => {
  assert.equal(
    refuseNonLocal({ headers: { host: "localhost:5425", origin: "http://localhost:5425" } }),
    null,
  );
  assert.notEqual(refuseNonLocal({ headers: { host: "remote.example:5425" } }), null);
  assert.notEqual(
    refuseNonLocal({ headers: { host: "localhost:5425", origin: "http://remote.example" } }),
    null,
  );
});

test("compose appends to empty block-owned sequences without changing comments or siblings", async () => {
  const { runnerImport } = await import("vite");
  const root = new URL("../../", import.meta.url).pathname;
  const { module: api } = await runnerImport(`${root}src/server-surface.ts`, {
    root,
    configFile: false,
    logLevel: "error",
  });
  const { parse } = await import("yaml");
  for (const eol of ["\n", "\r\n"]) {
    const before = [
      'diagram: "1"',
      'title: "Preserved" # keep title',
      "nodes: [{id: a}, {id: b}]",
      "flows: [] # keep empty comment",
      "description: untouched",
      "",
    ].join(eol);
    const after = api.appendEntries(before, "flows", ["- a -> b\n"]);
    assert.ok(after);
    assert.match(after, /flows: {2}# keep empty comment/);
    assert.ok(after.includes('title: "Preserved" # keep title' + eol));
    assert.ok(after.includes("description: untouched" + eol));
    const { flows, ...rest } = parse(after);
    const { flows: empty, ...original } = parse(before);
    assert.deepEqual(empty, []);
    assert.deepEqual(flows, ["a -> b"]);
    assert.deepEqual(rest, original);
    if (eol === "\r\n") assert.equal(/(?<!\r)\n/.test(after), false);
  }
  const nested =
    'diagram: "1"\nzones:\n  - id: z\n    owner: customer\n    children: [] # retained\n';
  const appended = api.appendEntries(nested, "zones[0].children", ["- id: a\n"]);
  assert.deepEqual(parse(appended).zones[0].children, [{ id: "a" }]);
  for (const text of [
    'diagram: "1"\nflows: &shared []\nx-flows: *shared\n',
    '{diagram: "1", flows: []}\n',
  ])
    assert.equal(api.appendEntries(text, "flows", ["- a -> b\n"]), null);
});
