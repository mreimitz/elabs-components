/** Real JSON-RPC validation/write parity; removes only its unique fixtures. */
/* global process, fetch, console */
import { fileURLToPath, URL } from "node:url";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
const base = process.env.DIAGRAM_URL ?? "http://127.0.0.1:5444";
const workspace =
  process.env.DIAGRAM_WORKSPACE ?? fileURLToPath(new URL("../workspace", import.meta.url));
const evidence = process.env.STYLE_EVIDENCE;
const folder = `style-core-${process.pid}`;
let id = 0;
const results = [];
const rpc = async (method, params) => {
  const r = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  assert.equal(r.ok, true);
  const b = await r.json();
  assert.equal(b.error, undefined, JSON.stringify(b));
  return b.result;
};
const tool = (name, args) => rpc("tools/call", { name, arguments: args });
const parsed = (r) => JSON.parse(r.content[0].text);
const source = 'diagram: "1"\nnodes: [{id: a}, {id: b}]\nflows: ["a -> b"]\n';
const style = { technical: "inherit", visual: "qlik-marketecture" };
try {
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "style-core-proof", version: "1" },
  });
  const text = source + "style: " + JSON.stringify(style) + "\n";
  const valid = parsed(await tool("spec_validate", { text }));
  assert.equal(valid.ok, true, JSON.stringify(valid));
  results.push("typed style accepted by real JSON-RPC");
  const created = await tool("diagram_create", { path: `${folder}/valid.yaml`, text });
  assert.notEqual(created.isError, true, JSON.stringify(created));
  assert.equal(await readFile(`${workspace}/${folder}/valid.yaml`, "utf8"), text);
  results.push("valid style saved byte-for-byte");
  const cases = [
    { visual: "atlas-clean" },
    { technical: "qlik-marketecture" },
    { visual: "invented" },
    { hero: "qlik" },
  ];
  for (let i = 0; i < cases.length; i++) {
    const invalid = source + "style: " + JSON.stringify(cases[i]);
    const check = parsed(await tool("spec_validate", { text: invalid }));
    assert.equal(check.ok, false);
    assert.ok(
      check.issues.some((entry) => entry.code === "invalid-style" && entry.line > 0),
      JSON.stringify(check),
    );
    const response = await tool("diagram_create", {
      path: `${folder}/rejected-${i}.yaml`,
      text: invalid,
    });
    assert.equal(response.isError, true);
    await assert.rejects(readFile(`${workspace}/${folder}/rejected-${i}.yaml`));
    results.push(`negative ${i}: positioned issue and write refused`);
  }
  console.log(JSON.stringify({ results, errors: [] }, null, 2));
  if (evidence) {
    await mkdir(evidence, { recursive: true });
    await writeFile(`${evidence}/mcp-core.json`, JSON.stringify({ results, errors: [] }, null, 2));
  }
} finally {
  await rm(`${workspace}/${folder}`, { recursive: true, force: true });
}
