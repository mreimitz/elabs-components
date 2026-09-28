/** Real workspace, SSE, navigation-race and JSON-RPC regression; removes only its own fixtures. */
/* global window, performance, process, URL, fetch, localStorage, location, console */
import { setTimeout } from "node:timers";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.DIAGRAM_URL ?? "http://127.0.0.1:5422";
const evidence = process.env.COMPONENT_EVIDENCE;
const folder = `reference-proof-${process.pid}`;
const root = new URL(`../workspace/${folder}/`, import.meta.url);
const doc = (nodes, extra = "") =>
  `diagram: "1"\n${extra}\nnodes:\n${nodes.map((n) => `  - ${JSON.stringify(n)}`).join("\n")}\n`;
const ref = (file, id = "child") => ({ id, ref: `ws/${folder}/${file}` });
const leaf = (title) =>
  doc(
    [{ id: "inside", ref: "catalog/aws/rds" }],
    `title: ${title}\ncomponent: {icon: aws/rds, description: Referenced details}`,
  );
const parentText = doc(
  [ref("Team Space/leaf"), { id: "out" }],
  'title: Parent\nflows: ["child.inside -> out"]',
);
const results = [],
  errors = [],
  writes = [];
let page;
const browser = await chromium.launch();
const save = (path, text) => writeFile(new URL(path, root), text);
const poll = async (fn, label) => {
  const until = Date.now() + 15000;
  let last;
  while (Date.now() < until) {
    last = await fn();
    if (last) return;
    await new Promise((r) => setTimeout(r, 35));
  }
  throw Error(`Timed out: ${label}; last=${JSON.stringify(last)}`);
};
const state = () =>
  page.evaluate(async () => {
    const { diagramStore } = await window.moduleFor("/src/state/diagram-store.ts");
    const { workspaceStore } = await window.moduleFor("/src/workspace/workspace-store.ts");
    const { currentComponentFiles } = await window.moduleFor("/src/state/component-files.ts");
    const { historyCounts } = await window.moduleFor("/src/state/history.ts");
    const s = diagramStore.get();
    return {
      history: historyCounts(),
      path: s.path,
      text: s.text,
      loaded: s.loadedText,
      loadCount: s.loadCount,
      data: s.compiled.spec?.nodes.find((n) => n.id === "child")?.data,
      issues: s.compiled.issues,
      dirty: workspaceStore.get().dirty,
      cache: [...currentComponentFiles()].map(([p, f]) => [p, f?.text]),
    };
  });
const go = async (file) => {
  await page.evaluate((path) => {
    window.location.hash = `#d/${path}`;
  }, `${folder}/${file}`);
  await poll(async () => (await state()).path === `${folder}/${file}`, `open ${file}`);
};
const screenshot = async (name) => {
  if (evidence) {
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: `${evidence}/${name}.png` });
  }
};
let rpcId = 0;
const rpc = async (method, params) => {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  assert.equal(response.ok, true);
  const body = await response.json();
  assert.equal(body.error, undefined, JSON.stringify(body));
  return body.result;
};
const tool = (name, args) => rpc("tools/call", { name, arguments: args });
const parsed = (result) => JSON.parse(result.content[0].text);
try {
  await mkdir(new URL("Team Space/", root), { recursive: true });
  await save("Team Space/leaf.yaml", leaf("Resolved child"));
  await save("parent.yaml", parentText);
  await save("missing.yaml", doc([ref("missing-child")]));
  await save("cycle.yaml", doc([ref("cycle-child")]));
  await save("cycle-child.yaml", doc([ref("cycle-child")]));
  await save("invalid.yaml", doc([ref("invalid-child")]));
  await save("invalid-child.yaml", 'diagram: "1"\nnodes: [{id: x, type: nonsense}]');
  await save(
    "unknown.yaml",
    doc([ref("Team Space/leaf"), { id: "out" }], 'flows: ["child.nope -> out"]'),
  );
  await save("b.yaml", doc([ref("b-child")], "title: Delayed B"));
  await save("b-child.yaml", leaf("B only"));
  for (let i = 0; i < 9; i++)
    await save(`depth-${i}.yaml`, i === 8 ? leaf("Deep leaf") : doc([ref(`depth-${i + 1}`)]));
  await save("depth.yaml", doc([ref("depth-0")]));
  for (const [theme, width] of [
    ["light", 1440],
    ["dark", 1440],
    ["light", 390],
    ["dark", 390],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    page = await context.newPage();
    await page.addInitScript((theme) => {
      localStorage.setItem("brand-ui-theme", theme);
      performance.setResourceTimingBufferSize(10000);
      window.moduleFor = async (path) => {
        const url = performance
          .getEntriesByType("resource")
          .findLast((e) => new URL(e.name).pathname === path)?.name;
        if (!url) throw Error(`No application module ${path}`);
        return import(url);
      };
    }, theme);
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("request", (r) => {
      if (["PUT", "POST", "DELETE"].includes(r.method()) && r.url().includes("/api/workspace/file"))
        writes.push(r.url());
    });
    await page.goto(`${base}/#d/${folder}/parent.yaml`);
    await poll(async () => {
      try {
        return (await state()).data?.title === "Resolved child";
      } catch {
        return false;
      }
    }, "resolved first draw");
    assert.equal((await state()).data.icon, "aws/rds");
    assert.equal((await state()).data.count, 1);
    await page.locator('.react-flow__node[data-id="child"]').first().waitFor();
    await screenshot(`${theme}-${width}-resolved`);
    const before = await state();
    const start = Date.now();
    await save("Team Space/leaf.yaml", leaf("Live child"));
    await poll(
      async () => (await state()).data?.title === "Live child",
      "SSE metadata propagation",
    );
    const after = await state();
    assert.equal(after.text, parentText);
    assert.equal(after.loaded, parentText);
    assert.equal(after.dirty, false);
    assert.equal(after.loadCount, before.loadCount);
    assert.deepEqual(after.history, before.history);
    results.push({ theme, width, name: "live propagation", latencyMs: Date.now() - start });
    assert.equal(await readFile(new URL("parent.yaml", root), "utf8"), parentText);
    for (const [file, code] of [
      ["missing.yaml", "ref-missing"],
      ["cycle.yaml", "ref-cycle"],
      ["depth.yaml", "ref-depth"],
      ["invalid.yaml", "ref-invalid"],
      ["unknown.yaml", "unknown-endpoint"],
    ]) {
      await go(file);
      await poll(async () => (await state()).issues.some((i) => i.code === code), code);
      results.push({ theme, width, name: code });
    }
    await go("missing.yaml");
    await screenshot(`${theme}-${width}-missing`);
    await save("missing-child.yaml", leaf("Created later"));
    await poll(
      async () => (await state()).data?.title === "Created later",
      "missing becomes created",
    );
    await rm(new URL("missing-child.yaml", root));
    await poll(
      async () => (await state()).issues.some((i) => i.code === "ref-missing"),
      "deleted becomes missing",
    );
    results.push({ theme, width, name: "creation and deletion refresh" });
    await go("parent.yaml");
    let held,
      release,
      handled = false;
    const gate = new Promise((r) => {
      release = r;
    });
    const match = (url) =>
      new URL(url).pathname === "/api/workspace/file" &&
      new URL(url).searchParams.get("path") === `${folder}/b-child.yaml`;
    await page.route(match, async (route) => {
      held = true;
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
      handled = true;
    });
    await page.evaluate((path) => {
      location.hash = `#d/${path}`;
    }, `${folder}/b.yaml`);
    await poll(() => held, "B dependency held");
    await go("parent.yaml");
    release();
    await poll(() => handled, "released B response");
    await page.unroute(match);
    await page.waitForTimeout(150);
    const canceled = await state();
    assert.equal(canceled.path, `${folder}/parent.yaml`);
    assert.equal(
      canceled.cache.some(([path]) => path === `${folder}/b-child.yaml`),
      false,
      "canceled preload must not publish its cache",
    );
    results.push({ theme, width, name: "A-B-A canceled dependency snapshot" });
    let staleHeld,
      releaseStale,
      staleHandled = false;
    const staleGate = new Promise((r) => {
      releaseStale = r;
    });
    let first = true;
    const leafMatch = (url) =>
      new URL(url).pathname === "/api/workspace/file" &&
      new URL(url).searchParams.get("path") === `${folder}/Team Space/leaf.yaml`;
    await page.route(leafMatch, async (route) => {
      const response = await route.fetch();
      const heldThis = first;
      if (first) {
        first = false;
        staleHeld = true;
        await staleGate;
      }
      await route.fulfill({ response });
      if (heldThis) staleHandled = true;
    });
    await save("Team Space/leaf.yaml", leaf("Old held child"));
    await poll(() => staleHeld, "older live dependency held");
    await save("Team Space/leaf.yaml", leaf("Latest child"));
    await poll(
      async () => (await state()).data?.title === "Latest child",
      "newer live response applied",
    );
    releaseStale();
    await poll(() => staleHandled, "released old live response");
    await page.unroute(leafMatch);
    await page.waitForTimeout(150);
    assert.equal((await state()).data.title, "Latest child");
    results.push({ theme, width, name: "older live response cannot overwrite newer metadata" });
    await save("Team Space/leaf.yaml", leaf("Resolved child"));
    await context.close();
  }
  page = await browser.newPage();
  await page.goto(`${base}/#dev/spec-check`);
  const summary = page.getByText(/\d+ of \d+ checks pass/);
  await summary.waitFor();
  const [, passCount, totalCount] = (await summary.innerText()).match(/(\d+) of (\d+) checks pass/);
  assert.equal(Number(passCount), Number(totalCount));
  assert.equal(await page.locator('[data-pass="false"]').count(), 0);
  results.push({ name: "spec-check", passed: Number(passCount), total: Number(totalCount) });
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "component-reference-test", version: "1" },
  });
  assert.equal(parsed(await tool("spec_validate", { text: parentText })).ok, true);
  const missing = doc([ref("absent")]);
  assert.equal(
    parsed(await tool("spec_validate", { text: missing })).issues[0].code,
    "ref-missing",
  );
  const rejected = await tool("diagram_create", { path: `${folder}/rejected.yaml`, text: missing });
  assert.equal(rejected.isError, true);
  await assert.rejects(readFile(new URL("rejected.yaml", root)));
  const created = await tool("diagram_create", {
    path: `${folder}/mcp.yaml`,
    text: doc([{ id: "out" }]),
  });
  assert.notEqual(created.isError, true, JSON.stringify(created));
  const added = await tool("compose_add_nodes", {
    path: `${folder}/mcp.yaml`,
    nodes: [ref("Team Space/leaf")],
  });
  assert.notEqual(added.isError, true, JSON.stringify(added));
  const inner = await tool("compose_set", {
    path: `${folder}/mcp.yaml`,
    target: "child.inside",
    patch: { title: "No" },
  });
  assert.equal(inner.isError, true);
  assert.match(inner.content[0].text, /edit that file/);
  const flow = await tool("compose_set", {
    path: `${folder}/parent.yaml`,
    target: "flow:child.inside->out",
    patch: { label: "Updated" },
  });
  assert.notEqual(flow.isError, true, JSON.stringify(flow));
  const syntax = await tool("diagram_create", {
    path: `${folder}/syntax.yaml`,
    text: "diagram: [",
  });
  assert.equal(syntax.isError, true);
  assert.doesNotMatch(syntax.content[0].text, /at \)/);
  results.push({
    name: "MCP validate, create refusal, compose ref insertion, inner refusal, dotted flow edit, syntax error",
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  const output = { results, errors, writes };
  if (evidence) await writeFile(`${evidence}/results.json`, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
} finally {
  await browser.close();
  await rm(root, { recursive: true, force: true });
}
