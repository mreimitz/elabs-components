/**
 * dev.test.mjs — the origin choice and the static server behind `pnpm --filter @elabs-ai/home dev`.
 * `node:test`, like components/hero/copy.test.mjs: run with `node --test apps/home/scripts/dev.test.mjs`.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { countMissing, createStaticServer, pickOrigin } from "./dev.mjs";

const stories = [
  { id: "a--default", alias: null },
  { id: "b-new--default", alias: "b-old--default" },
  { id: "c--default", alias: null },
];

test("an alias stands in for a retitled story", () => {
  assert.equal(countMissing(stories, new Set(["a--default", "b-old--default"])), 1);
  assert.equal(countMissing(stories, null), 3);
});

test("the Storybook missing fewer embedded stories wins; a tie goes to the local build", () => {
  const all = new Set(["a--default", "b-new--default", "c--default"]);
  const some = new Set(["a--default"]);
  assert.equal(pickOrigin({ stories, localIds: all, deployedIds: some }).use, "local");
  assert.equal(pickOrigin({ stories, localIds: some, deployedIds: all }).use, "deployed");
  assert.equal(pickOrigin({ stories, localIds: some, deployedIds: some }).use, "local");
  assert.equal(pickOrigin({ stories, localIds: null, deployedIds: some }).use, "deployed");
  assert.equal(pickOrigin({ stories, localIds: some, deployedIds: null }).use, "local");
});

test("the static server serves files and index.html, and never leaves its root", async () => {
  const root = mkdtempSync(join(tmpdir(), "sb-static-"));
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "index.html"), "<p>manager</p>");
  writeFileSync(join(root, "assets", "a.js"), "export {}");
  const server = createStaticServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type"), /text\/html/);
    const asset = await fetch(`${base}/assets/a.js?v=1`);
    assert.match(asset.headers.get("content-type"), /javascript/);
    assert.equal((await fetch(`${base}/missing.js`)).status, 404);
    assert.notEqual((await fetch(`${base}/%2e%2e/%2e%2e/etc/passwd`)).status, 200);
    assert.equal((await fetch(`${base}/`, { method: "POST" })).status, 405);
  } finally {
    server.close();
  }
});
