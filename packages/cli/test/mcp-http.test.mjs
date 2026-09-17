import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createMcpHttpHandler } from "../lib/mcp-http.mjs";
import { handleMessage } from "../lib/mcp.mjs";
import { findRepoRoot, loadManifest } from "../lib/core.mjs";

// The hosted brand-ui MCP (Streamable HTTP, stateless). The server gets an
// INJECTED manifest and no repo root — exactly how the Vercel function runs it.

const here = dirname(fileURLToPath(import.meta.url));
const root = findRepoRoot(here);
const manifest = root ? loadManifest(root) : null;
const handler = createMcpHttpHandler({ manifest });

const post = (body) =>
  handler(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const rpc = (method, params = {}, id = 1) => ({ jsonrpc: "2.0", id, method, params });

test("initialize negotiates a supported protocol version and falls back otherwise", async () => {
  const res = await post(rpc("initialize", { protocolVersion: "2025-06-18" }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/json/);
  const body = await res.json();
  assert.equal(body.result.protocolVersion, "2025-06-18");
  assert.equal(body.result.serverInfo.name, "brand-ui");

  const old = await (await post(rpc("initialize", { protocolVersion: "1999-01-01" }))).json();
  assert.equal(old.result.protocolVersion, "2024-11-05");
});

test("hosted tools/list leaves out audit, which needs the caller's disk", async () => {
  const body = await (await post(rpc("tools/list"))).json();
  const names = body.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["chart_for", "docs", "info", "search", "tokens"]);
});

test("hosted audit call is a tool-level error that points at the local server", async () => {
  const body = await (
    await post(rpc("tools/call", { name: "audit", arguments: { path: "." } }))
  ).json();
  assert.ok(body.result.isError);
  assert.match(body.result.content[0].text, /npx @elabs-ai\/components-cli mcp/);
});

test("hosted lookups answer from the injected manifest without a repo root", async (t) => {
  if (!manifest) return t.skip("not inside the brand-ui monorepo");
  const search = await (
    await post(rpc("tools/call", { name: "search", arguments: { query: "button" } }))
  ).json();
  assert.match(search.result.content[0].text, /Button/);

  const docs = await (
    await post(rpc("tools/call", { name: "docs", arguments: { component: "Button" } }))
  ).json();
  assert.match(docs.result.content[0].text, /# Button/);

  const info = await (await post(rpc("tools/call", { name: "info" }))).json();
  assert.match(info.result.content[0].text, /packages \(\d+\)/);
  assert.match(info.result.content[0].text, /hosted server/);
});

test("notifications get 202 with no body; batches get an array of the answers", async () => {
  const note = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(note.status, 202);
  assert.equal(await note.text(), "");

  const batch = await (
    await post([
      rpc("ping", {}, 1),
      { jsonrpc: "2.0", method: "notifications/initialized" },
      rpc("tools/list", {}, 2),
    ])
  ).json();
  assert.deepEqual(
    batch.map((r) => r.id),
    [1, 2],
  );
});

test("bad JSON is a 400 parse error; GET is 405; OPTIONS is a CORS preflight", async () => {
  const bad = await post("{not json");
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, -32700);

  const get = await handler(new Request("http://localhost/mcp"));
  assert.equal(get.status, 405);
  assert.match(get.headers.get("allow"), /POST/);

  const pre = await handler(new Request("http://localhost/mcp", { method: "OPTIONS" }));
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), "*");
});

test("local (non-hosted) mode still lists audit", () => {
  const res = handleMessage(rpc("tools/list"), { root });
  assert.ok(res.result.tools.some((t) => t.name === "audit"));
});
