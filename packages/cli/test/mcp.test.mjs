import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { handleMessage, runMcpServer, TOOLS, SERVER_INFO } from "../lib/mcp.mjs";
import { findRepoRoot } from "../lib/core.mjs";

// WP-03 #81 — the persistent `brand-ui mcp` server. These exercise the PURE
// protocol handler (no process spawn) plus one end-to-end stdio round-trip.

const here = dirname(fileURLToPath(import.meta.url));
const root = findRepoRoot(here);

function call(method, params, id = 1) {
  return handleMessage({ jsonrpc: "2.0", id, method, params }, { root });
}

test("initialize advertises the brand-ui server + tools capability", () => {
  const res = call("initialize", {});
  assert.equal(res.result.serverInfo.name, "brand-ui");
  assert.equal(res.result.serverInfo.name, SERVER_INFO.name);
  assert.ok(res.result.protocolVersion, "a protocol version is returned");
  assert.ok(res.result.capabilities.tools, "the tools capability is advertised");
});

test("tools/list returns the five read tools, each with an input schema", () => {
  const res = call("tools/list", {});
  const names = res.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["audit", "docs", "info", "search", "tokens"]);
  for (const t of res.result.tools) {
    assert.ok(t.description, `${t.name} has a description`);
    assert.equal(t.inputSchema.type, "object", `${t.name} has an object input schema`);
  }
  assert.equal(res.result.tools.length, TOOLS.length);
});

test("notifications get no response (null), unknown methods/tools error", () => {
  // A notification (no id) is not answered.
  assert.equal(
    handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, { root }),
    null,
  );
  // Unknown method WITH an id → JSON-RPC method-not-found.
  const m = call("does/not/exist", {});
  assert.equal(m.error.code, -32601);
  // Unknown tool → invalid-params.
  const t = call("tools/call", { name: "nope", arguments: {} });
  assert.equal(t.error.code, -32602);
  // Malformed request.
  assert.equal(handleMessage(null).error.code, -32600);
});

test("tools/call info|search|docs|tokens read real ground truth from the engine", (t) => {
  if (!root) return t.skip("not inside the brand-ui monorepo");
  const info = call("tools/call", { name: "info", arguments: {} });
  assert.match(info.result.content[0].text, /packages \(\d+\)/, "info lists the package count");

  const search = call("tools/call", { name: "search", arguments: { query: "button" } });
  assert.match(search.result.content[0].text, /Button/, "search finds Button");

  const docs = call("tools/call", { name: "docs", arguments: { component: "Button" } });
  const text = docs.result.content[0].text;
  assert.match(text, /# Button/, "docs renders the component heading");
  assert.match(text, /variants/, "docs renders the expanded cva variants");

  const tokens = call("tools/call", { name: "tokens", arguments: {} });
  assert.match(tokens.result.content[0].text, /themes \(\d+\)/, "tokens summarizes the themes");
});

test("search with no query is a tool-level error (isError), not a protocol error", () => {
  const res = call("tools/call", { name: "search", arguments: {} });
  assert.ok(res.result.isError, "missing query → isError result, not a JSON-RPC error");
});

test("end-to-end stdio: newline-delimited JSON-RPC round-trips over the transport", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let out = "";
  output.on("data", (c) => (out += c.toString()));

  const done = runMcpServer({ root, input, output });
  input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
  input.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
  input.end();
  await done;

  const responses = out
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  // Two requests answered; the notification produced NO line.
  assert.equal(responses.length, 2, "exactly two responses (the notification is silent)");
  assert.equal(responses[0].id, 1);
  assert.equal(responses[0].result.serverInfo.name, "brand-ui");
  assert.equal(responses[1].id, 2);
  assert.ok(Array.isArray(responses[1].result.tools), "tools/list returns a tools array");
});

// Fix round 1 (#89 finding 2, flagged by an independent validator): the
// original #89 fix wired whole-screen templates into the CLI's `cmdSearch()`
// but never into `toolSearch()` here, so `mcp__brand-ui__search` — the
// persistent, recommended MCP path (see storybook-mcp.md) — still returned
// "(none)" for `screen-states`/`object-detail-hub` with no Templates section
// at all. Locks that `toolSearch()` now calls the same `matchTemplates()` the
// CLI uses, against the REAL committed manifest.
test("tools/call search reaches whole-screen templates (screen-states, object-detail-hub)", (t) => {
  if (!root) return t.skip("not inside the brand-ui monorepo");
  for (const name of ["screen-states", "object-detail-hub"]) {
    const res = call("tools/call", { name: "search", arguments: { query: name } });
    const text = res.result.content[0].text;
    assert.match(
      text,
      new RegExp(`Templates matching "${name}":`),
      `${name} has a Templates section`,
    );
    assert.match(
      text,
      new RegExp(`templates/${name}\\.tsx`),
      `${name} lists its template file path`,
    );
  }
});
