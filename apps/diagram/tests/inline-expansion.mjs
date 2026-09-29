/** Expanded template copies and read-only referenced contents; original files stay byte-identical. */
/* global process, console, window, performance, URL, localStorage, fetch */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { createHash } from "node:crypto";
import { parseDocument, isMap, visit } from "yaml";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.DIAGRAM_URL ?? "http://127.0.0.1:5426";
const evidence = process.env.INLINE_EVIDENCE;
const folder = `inline-proof-${process.pid}`;
const root = new URL(`../workspace/${folder}/`, import.meta.url);
const template = new URL(
  "../workspace/templates/qlik-cloud-customer-landscape.yaml",
  import.meta.url,
);
const component = new URL("../workspace/components/qlik-cloud-tenant.yaml", import.meta.url);
const original = await readFile(template, "utf8");
const originalChild = await readFile(component, "utf8");
const hash = (text) => createHash("sha256").update(text).digest("hex");
const expanded = original.replace("expand: false", "expand: true");
assert.notEqual(expanded, original);
const manualDoc = parseDocument(expanded);
manualDoc.set("layout", "manual");
let position = 0;
visit(manualDoc, {
  Map(_key, node) {
    if (isMap(node) && node.has("id")) node.set("position", { x: position++ * 160, y: 80 });
  },
});
const manual = manualDoc.toString();
const browser = await chromium.launch();
const errors = [],
  writes = [],
  results = [];
let page;
const poll = async (fn, label) => {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (await fn()) return;
    await setTimeout(40);
  }
  throw Error(`Timed out: ${label}`);
};
const state = () =>
  page.evaluate(async () => {
    const { diagramStore } = await window.moduleFor("/src/state/diagram-store.ts");
    const state = diagramStore.get();
    return {
      path: state.path,
      text: state.text,
      spec: state.compiled.spec,
      graph: state.compiled.graph,
      view: state.compiled.view,
      issues: state.compiled.issues,
      origin: state.compiled.origin,
    };
  });
const shot = async (name) => {
  if (evidence) await page.screenshot({ path: `${evidence}/${name}.png` });
};
try {
  await mkdir(root, { recursive: true });
  if (evidence) await mkdir(evidence, { recursive: true });
  for (const [theme, width] of [
    ["light", 1440],
    ["dark", 1440],
    ["light", 390],
    ["dark", 390],
  ]) {
    const file = `${folder}/${theme}-${width}.yaml`;
    const disk = new URL(`${theme}-${width}.yaml`, root);
    await writeFile(disk, original);
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    page = await context.newPage();
    await page.addInitScript((theme) => {
      localStorage.setItem("brand-ui-theme", theme);
      performance.setResourceTimingBufferSize(10000);
      const modules = new Map();
      window.moduleFor = (path) => {
        if (!modules.has(path))
          modules.set(
            path,
            performance
              .getEntriesByType("resource")
              .findLast((entry) => new URL(entry.name).pathname === path)?.name,
          );
        if (!modules.get(path)) throw Error(`Missing loaded module ${path}`);
        return import(modules.get(path));
      };
    }, theme);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (
        ["PUT", "POST", "DELETE"].includes(request.method()) &&
        request.url().includes("/api/workspace/")
      )
        writes.push(request.url());
    });
    await page.goto(`${base}/#d/${file}`);
    await poll(async () => {
      try {
        const current = await state();
        return (
          current.path === file &&
          current.spec.nodes.find((node) => node.id === "tenant")?.data.count === 5
        );
      } catch {
        return false;
      }
    }, "resolved copy");
    const before = await state();
    await writeFile(disk, expanded);
    await poll(
      async () =>
        (await state()).spec.nodes.find((node) => node.id === "tenant")?.type === "arch/zone",
      "expanded instance",
    );
    const current = await state();
    const children = current.graph.nodes.filter((node) => node.data.inner === true);
    assert.equal(children.length, 5);
    assert.equal(current.graph.nodes.length, before.graph.nodes.length + 5);
    assert.equal(current.graph.edges.length, before.graph.edges.length + 2);
    assert.equal(current.graph.nodes.find((node) => node.id === "tenant").data.owner, "saas");
    for (const child of children) {
      assert.equal(child.draggable, false);
      assert.equal(child.deletable, false);
      assert.equal(
        current.origin[`nodes[${current.spec.nodes.findIndex((node) => node.id === child.id)}]`],
        undefined,
      );
    }
    const canvas = page.locator('[data-lens-pane="technical"]');
    const inner = canvas.locator('.react-flow__node[data-id="tenant.qtdi"]');
    await inner.waitFor();
    await poll(async () => {
      const box = await inner.boundingBox();
      return box && box.width > 0 && box.x >= 0 && box.y >= 0;
    }, "fitted inner node");
    await shot(`${theme}-${width}-expanded`);
    await page.getByRole("button", { name: /^Edit/ }).click();
    if (width < 768) {
      await page.getByRole("tab", { name: "Canvas", exact: true }).click();
    }
    await inner.click();
    await page.keyboard.press("Delete");
    await page.keyboard.press("Backspace");
    await inner.focus();
    await page.keyboard.press("ArrowRight");
    const transform = await inner.getAttribute("style");
    const box = await inner.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 30, { steps: 6 });
    await page.mouse.up();
    await setTimeout(200);
    assert.equal(await inner.getAttribute("style"), transform);
    assert.equal((await state()).text, expanded);
    assert.equal(await readFile(disk, "utf8"), expanded);
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.getByRole("textbox", { name: "Title", exact: true }).count(), 0);
    const mutations = await page.evaluate(async () => {
      const { editActions, diagramStore } = await window.moduleFor("/src/state/diagram-store.ts");
      const before = diagramStore.get().text;
      const edited = editActions.editEntry("tenant.qtdi", { title: "Forbidden" });
      const deleted = editActions.deleteElements(["tenant.qtdi"], []);
      const result = diagramStore.get().compiled;
      return {
        edited,
        deleted,
        same: before === diagramStore.get().text,
        innerEdges: result.graph.edges
          .filter((edge) => edge.data?.inner === true)
          .map((edge) => edge.deletable),
      };
    });
    assert.deepEqual(mutations, {
      edited: false,
      deleted: false,
      same: true,
      innerEdges: [false, false],
    });
    await shot(`${theme}-${width}-inner-readonly`);
    await writeFile(disk, manual);
    await poll(
      async () =>
        (await state()).issues.some((issue) => issue.code === "expand-ignored") &&
        (await state()).spec.nodes.find((node) => node.id === "tenant")?.type === "arch/composite",
      "manual collapsed",
    );
    await shot(`${theme}-${width}-manual`);
    const nestedName = `nested-${theme}-${width}.yaml`;
    await writeFile(
      new URL(nestedName, root),
      'diagram: "1"\nzones:\n  - id: area\n    owner: customer\n    children: [{id: inside}]\n',
    );
    const nestedParent = `diagram: "1"\nzones:\n  - id: own\n    owner: customer\n    children: [{id: outside}]\nnodes:\n  - id: t\n    ref: ws/${folder}/${nestedName.slice(0, -5)}\n    expand: true\n`;
    await writeFile(disk, nestedParent);
    await poll(
      async () => (await state()).graph.nodes.some((node) => node.id === "t.area"),
      "nested imported zone",
    );
    await poll(
      async () => (await canvas.locator('.react-flow__node[data-id="t.area"]').count()) === 1,
      "nested zone rendered",
    );
    const ownZone = canvas.locator('.react-flow__node[data-id="own"]');
    await ownZone.locator('[data-slot="arch-zone-header"]').click();
    await poll(
      async () => (await ownZone.locator(".react-flow__resize-control:visible").count()) > 0,
      "authored zone resizer positive control",
    );
    const innerZone = canvas.locator('.react-flow__node[data-id="t.area"]');
    await innerZone.locator('[data-slot="arch-zone-header"]').click();
    await poll(
      async () => (await innerZone.getAttribute("class")).includes("selected"),
      "inner zone selected",
    );
    assert.equal(await innerZone.locator(".react-flow__resize-control:visible").count(), 0);
    await page.keyboard.press("Delete");
    assert.equal((await state()).text, nestedParent);
    await shot(`${theme}-${width}-inner-zone-readonly`);
    results.push({
      theme,
      width,
      expandedNodes: current.graph.nodes.length,
      expandedEdges: current.graph.edges.length,
      innerReadOnly: true,
      innerZoneResizeBlocked: true,
      manualCollapsed: true,
    });
    await context.close();
  }
  let requestId = 0;
  const tool = async (name, args) => {
    const response = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++requestId,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    const body = await response.json();
    assert.equal(body.error, undefined);
    return body.result;
  };
  const value = (result) => JSON.parse(result.content[0].text);
  assert.equal(value(await tool("spec_validate", { text: expanded })).ok, true);
  const authored = value(await tool("spec_compile", { text: expanded })).diagram;
  assert.equal(
    authored.nodes.some((node) => node.id.includes(".")),
    false,
  );
  const created = await tool("diagram_create", {
    path: `${folder}/mcp-inline.yaml`,
    text: expanded,
  });
  assert.notEqual(created.isError, true, JSON.stringify(created));
  const blocked = await tool("compose_set", {
    path: `${folder}/mcp-inline.yaml`,
    target: "tenant.qtdi",
    patch: { title: "Forbidden" },
  });
  assert.equal(blocked.isError, true);
  assert.match(blocked.content[0].text, /edit that file/);
  assert.equal(await readFile(new URL("mcp-inline.yaml", root), "utf8"), expanded);
  const collapsed = await tool("compose_set", {
    path: `${folder}/mcp-inline.yaml`,
    target: "tenant",
    patch: { expand: false },
  });
  assert.notEqual(collapsed.isError, true, JSON.stringify(collapsed));
  const invalid = value(
    await tool("spec_validate", { text: expanded.replaceAll("tenant.qtdi", "tenant.invented") }),
  );
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some((issue) => issue.code === "unknown-endpoint"));
  results.push({
    mcp: "expanded validate/create, original AST compile, inner-write refusal, root toggle, invalid endpoint refusal",
  });
  assert.equal(hash(await readFile(template, "utf8")), hash(original));
  assert.equal(hash(await readFile(component, "utf8")), hash(originalChild));
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  if (evidence)
    await writeFile(
      `${evidence}/results.json`,
      JSON.stringify({ results, errors, writes }, null, 2),
    );
  console.log(JSON.stringify({ results, errors, writes }, null, 2));
} catch (error) {
  if (page && evidence) {
    await page.screenshot({ path: `${evidence}/failure.png` });
    await writeFile(
      `${evidence}/failure-state.json`,
      JSON.stringify(
        {
          state: await state(),
          errors,
          writes,
          html: await page.locator('[data-lens-pane="technical"]').innerHTML(),
        },
        null,
        2,
      ),
    );
  }
  throw error;
} finally {
  await browser.close();
  await rm(root, { recursive: true, force: true });
}
