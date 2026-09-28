/** Disposable real-MCP/live-picture proof. Run with DIAGRAM_URL and PLAYWRIGHT_MODULE. */
/* global process, URL, fetch, console, window, localStorage, location, EventSource */
import assert from "node:assert/strict";
import { mkdir, writeFile, rm, copyFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.DIAGRAM_URL ?? "http://127.0.0.1:5425";
const evidence = process.env.LIVE_EVIDENCE;
const folder = `live-proof-${process.pid}`;
const root = new URL(`../workspace/${folder}/`, import.meta.url);
const results = [],
  errors = [],
  writes = [];
let id = 0;
const rpc = async (name, args, host) => {
  const response = await fetch(host ? `http://${host}/mcp` : `${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(host ? { host } : {}) },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  assert.equal(response.ok, true);
  const body = await response.json();
  assert.equal(body.error, undefined, JSON.stringify(body));
  assert.notEqual(body.result.isError, true, JSON.stringify(body.result));
  return JSON.parse(body.result.content[0].text);
};
const poll = async (fn, label) => {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    if (await fn()) return;
    await setTimeout(40);
  }
  throw Error(`Timed out: ${label}`);
};
const doc = (title, nodes, flows = []) =>
  `diagram: "1"\ntitle: ${title}\nnodes:\n${nodes.map((n) => `  - ${JSON.stringify(n)}`).join("\n")}\nflows: ${JSON.stringify(flows)}\n`;
const browser = await chromium.launch();
let page;
const count = () => page.locator(".react-flow__node").count();
const ready = async (n) =>
  poll(
    async () =>
      (await count()) === n &&
      (await page.locator('[data-slot="live-canvas"]').getAttribute("data-ready")) === "true",
    `drawing ${n} nodes`,
  );
const text = () => page.locator("body").innerText();
const snap = async (name) => {
  if (evidence) await page.screenshot({ path: `${evidence}/${name}.png` });
};
try {
  await mkdir(root, { recursive: true });
  if (evidence) await mkdir(`${evidence}/video`, { recursive: true });
  for (const [theme, width] of [
    ["light", 1440],
    ["dark", 1440],
    ["light", 390],
    ["dark", 390],
  ]) {
    const start = Date.now();
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      ...(evidence && theme === "light" && width === 1440
        ? { recordVideo: { dir: `${evidence}/video`, size: { width: 1440, height: 900 } } }
        : {}),
    });
    page = await context.newPage();
    const video = page.video();
    await page.addInitScript((theme) => {
      localStorage.setItem("brand-ui-theme", theme === "light" ? "dark" : "light");
      const Native = EventSource;
      window.liveStreams = { active: 0, max: 0 };
      window.EventSource = class extends Native {
        constructor(...args) {
          super(...args);
          window.liveStreams.active++;
          window.liveStreams.max = Math.max(window.liveStreams.max, window.liveStreams.active);
          this.owned = true;
        }
        close() {
          if (this.owned) {
            this.owned = false;
            window.liveStreams.active--;
          }
          super.close();
        }
      };
    }, theme);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (["PUT", "POST", "DELETE"].includes(r.method()) && r.url().includes("/api/"))
        writes.push(r.url());
    });
    const name = `${theme}-${width}.yaml`,
      path = `${folder}/${name}`;
    const url = `${base}/#v/${path}&theme=${theme}`;
    let openStream;
    const streamGate = new Promise((resolve) => {
      openStream = resolve;
    });
    await page.route("**/api/workspace/events", async (route) => {
      await streamGate;
      await route.continue().catch(() => {}); // StrictMode may already have closed its first connection.
    });
    await page.goto(url);
    await page
      .getByRole("status")
      .filter({ hasText: `Waiting for ${path}` })
      .waitFor();
    assert.equal(
      await page
        .locator('[data-slot="sidebar"], [role="tablist"], .monaco-editor, [data-sonner-toaster]')
        .count(),
      0,
    );
    const created = await rpc("diagram_create", {
      path,
      text: doc("Live construction", [{ id: "source", title: "Source" }]),
    });
    assert.equal(created.view, `${base}/#v/${path}`);
    openStream();
    await ready(1);
    await page.unroute("**/api/workspace/events");
    if (video) await setTimeout(1600);
    const added = await rpc("compose_add_nodes", {
      path,
      nodes: [{ id: "target", title: "Target", icon: "aws/rds" }],
    });
    assert.equal(added.view, created.view);
    await ready(2);
    if (video) await setTimeout(1600);
    const flow = await rpc("compose_add_flows", {
      path,
      flows: [{ from: "source", to: "target", label: "Live data" }],
    });
    assert.equal(flow.view, created.view);
    await poll(async () => (await text()).includes("Live data"), "flow appears");
    if (video) await setTimeout(1600);
    const position = await page
      .locator('.react-flow__node[data-id="source"]')
      .evaluate((n) => n.style.transform);
    await rpc("compose_set", { path, target: "source", patch: { title: "Updated source" } });
    await poll(async () => (await text()).includes("Updated source"), "patch words");
    assert.equal(
      await page.locator('.react-flow__node[data-id="source"]').evaluate((n) => n.style.transform),
      position,
    );
    if (video) await setTimeout(1600);
    await snap(`${theme}-${width}-picture`);
    const controls = await page
      .locator('button:visible, input:visible, textarea:visible, [role="tab"]:visible')
      .count();
    assert.equal(controls, 0);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("brand-ui-theme")),
      theme === "light" ? "dark" : "light",
    );
    assert.equal(await page.locator('[data-slot="live-view"]').getAttribute("data-theme"), theme);
    const camera = await page.locator(".react-flow__viewport").getAttribute("style");
    for (const key of [
      "e",
      "p",
      "l",
      "/",
      "Delete",
      "Backspace",
      "Control+z",
      "Meta+z",
      "Tab",
      "Escape",
    ])
      await page.keyboard.press(key);
    await page.mouse.move(width / 2, 450);
    await page.mouse.wheel(0, 250);
    await page.mouse.down();
    await page.mouse.move(width / 2 + 40, 480);
    await page.mouse.up();
    await page.mouse.dblclick(width / 2, 450);
    assert.equal(await page.locator(".react-flow__viewport").getAttribute("style"), camera);
    assert.equal(page.url(), url);
    const good = (await rpc("diagram_read", { path })).text;
    await writeFile(new URL(name, root), "diagram: [");
    await poll(async () => (await text()).includes("not drawn:"), "invalid reason");
    await ready(2);
    await snap(`${theme}-${width}-invalid`);
    assert.equal(
      await page.locator('.react-flow__node[data-id="source"]').evaluate((n) => n.style.transform),
      position,
    );
    const invalid = await rpc("diagram_read", { path });
    const restored = await rpc("diagram_write", { path, text: good, base: invalid.mtime });
    assert.equal(restored.view, created.view);
    await poll(
      async () => (await page.locator('[data-slot="live-status"]').count()) === 0,
      "valid restoration",
    );
    const child = `${folder}/child-${theme}-${width}.yaml`;
    await writeFile(
      new URL(name, root),
      doc("Reference view", [{ id: "child", ref: `ws/${child.slice(0, -5)}` }]),
    );
    await poll(
      async () =>
        (await text()).includes("not drawn:") && (await text()).includes("does not exist"),
      "missing reference status",
    );
    await ready(2);
    await rpc("diagram_create", { path: child, text: doc("Created child", [{ id: "inside" }]) });
    await ready(1);
    await poll(async () => (await text()).includes("Created child"), "dependency created");
    const childRead = await rpc("diagram_read", { path: child });
    await rpc("diagram_write", {
      path: child,
      text: doc("Changed child", [{ id: "inside" }]),
      base: childRead.mtime,
    });
    await poll(async () => (await text()).includes("Changed child"), "dependency refreshed");
    await rm(new URL(name, root));
    await poll(async () => (await text()).includes(`Waiting for ${path}`), "deleted waits");
    await ready(1);
    await rpc("diagram_create", { path, text: good });
    await ready(2);
    const tree = await rpc("workspace_tree", {});
    assert.equal(tree.files.find((f) => f.path === path).view, created.view);
    const alternate = await rpc("diagram_read", { path }, `localhost:${new URL(base).port}`);
    assert.equal(new URL(alternate.view).host, `localhost:${new URL(base).port}`);
    const moved = await rpc("diagram_move", { from: path, to: `${folder}/Moved & ${name}` });
    assert.equal(moved.view, `${base}/#v/${folder}/Moved%20%26%20${name}`);
    await page.goto(`${moved.view}&theme=${theme}`);
    await ready(2);
    const slowPath = `${folder}/slow-${name}`;
    await rpc("diagram_create", {
      path: slowPath,
      text: doc("Obsolete slow picture", [{ id: "obsolete" }]),
    });
    let held = false,
      handled = false,
      release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const match = (url) =>
      new URL(url).pathname === "/api/workspace/file" &&
      new URL(url).searchParams.get("path") === slowPath;
    await page.route(match, async (route) => {
      const response = await route.fetch();
      held = true;
      await gate;
      await route.fulfill({ response });
      handled = true;
    });
    await page.evaluate((path) => {
      location.hash = `#v/${path}`;
    }, slowPath);
    await poll(() => held, "old live read held");
    await page.evaluate((url) => {
      location.hash = new URL(url).hash;
    }, `${moved.view}&theme=${theme}`);
    await ready(2);
    release();
    await poll(() => handled, "old live read released");
    await page.unroute(match);
    await setTimeout(100);
    assert.equal((await text()).includes("Obsolete slow picture"), false);
    const routeUrl = await page.evaluate(async () => {
      const { parseRoute, toHash } = await import("/src/routes/use-hash.ts");
      const route = parseRoute("#v/Team%20Space/%E9%8A%80%E8%A1%8C%20%26%20x%3D1.yaml&theme=dark");
      return { route, roundtrip: parseRoute(toHash(route)) };
    });
    assert.deepEqual(routeUrl.route, {
      kind: "view",
      path: "Team Space/銀行 & x=1.yaml",
      theme: "dark",
    });
    assert.deepEqual(routeUrl.roundtrip, routeUrl.route);
    const max = await page.evaluate(() => window.liveStreams.max);
    assert.equal(max, 1);
    if (theme === "light" && width === 1440 && video) {
      await setTimeout(Math.max(0, 21000 - (Date.now() - start)));
    }
    results.push({
      theme,
      width,
      name: "MCP construction, readonly inputs, invalid/restore, missing/create, dependency updates, request-port URLs, one SSE",
      milliseconds: Date.now() - start,
    });
    await context.close();
    if (video && evidence)
      await copyFile(await video.path(), `${evidence}/mcp-live-construction.webm`);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  const output = { results, errors, writes };
  if (evidence) await writeFile(`${evidence}/results.json`, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
} finally {
  await browser.close();
  await rm(root, { recursive: true, force: true });
}
