/** Real JSON-RPC validation/write parity; removes only its unique fixtures. */
/* global process, fetch, console */
import { fileURLToPath, URL } from "node:url";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
const base = process.env.DIAGRAM_URL ?? "http://127.0.0.1:5441";
const workspace =
  process.env.DIAGRAM_WORKSPACE ?? fileURLToPath(new URL("../workspace", import.meta.url));
const evidence = process.env.VISUAL_EVIDENCE;
const folder = `visual-core-${process.pid}`;
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
const visual = {
  lanes: [{ id: "custom", role: "sources", title: "Custom" }],
  boxes: [
    { id: "a", title: "Input", lane: "custom", members: ["a"] },
    { id: "b", title: "Output", lane: "targets", members: ["b"] },
  ],
  controlPlane: ["a"],
  flows: [{ from: "a", to: "b", process: "elt" }],
};
try {
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "visual-core-proof", version: "1" },
  });
  const text = source + "visual: " + JSON.stringify(visual) + "\n";
  const valid = parsed(await tool("spec_validate", { text }));
  assert.equal(valid.ok, true, JSON.stringify(valid));
  results.push("typed visual accepted by real JSON-RPC");
  const created = await tool("diagram_create", { path: `${folder}/valid.yaml`, text });
  assert.notEqual(created.isError, true, JSON.stringify(created));
  assert.equal(await readFile(`${workspace}/${folder}/valid.yaml`, "utf8"), text);
  results.push("valid visual saved byte-for-byte");
  const cases = [
    { ...visual, hide: ["a"] },
    { ...visual, boxes: [{ ...visual.boxes[0], members: ["invented"] }] },
    { ...visual, boxes: [{ ...visual.boxes[0], processes: ["invented"] }] },
    {
      ...visual,
      boxes: [
        ...visual.boxes,
        { id: "duplicate", lane: "targets", title: "Duplicate", members: ["a"] },
      ],
    },
  ];
  for (let i = 0; i < cases.length; i++) {
    const invalid = source + "visual: " + JSON.stringify(cases[i]);
    const check = parsed(await tool("spec_validate", { text: invalid }));
    assert.equal(check.ok, false);
    assert.ok(
      check.issues.some((entry) => entry.code === "invalid-visual" && entry.line > 0),
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
