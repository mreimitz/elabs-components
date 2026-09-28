import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const load = async (path) =>
  (await runnerImport(join(root, path), { root, configFile: false, logLevel: "error" })).module;
const api = await load("src/server-surface.ts");
const { resolveDrillTarget } = await load("src/interaction/drill-target.ts");
const { parseRoute, toHash } = await load("src/routes/use-hash.ts");
const catalog = new Map();
const ast = (text) => api.checkDiagram(text).ast;
const parent = ast('diagram: "1"\nnodes:\n  - id: tenant\n    ref: ws/components/tenant\n');
const child =
  'diagram: "1"\ntitle: Tenant\nnodes:\n  - id: leaf\n    title: Leaf\n  - id: nested\n    ref: ws/components/nested\n';
const nested = 'diagram: "1"\ntitle: Nested\nnodes:\n  - id: service\n    title: Service\n';
const files = new Map([
  ["components/tenant.yaml", { text: child, mtime: 1 }],
  ["components/nested.yaml", { text: nested, mtime: 1 }],
]);
test("inspection hash roundtrips parent identity and existing flags", () => {
  const route = {
    kind: "doc",
    path: "diagrams/parent one.yaml",
    into: ["tenant", "nested"],
    lens: "visual",
    present: true,
    step: 2,
  };
  assert.deepEqual(parseRoute(toHash(route)), route);
  assert.match(toHash(route), /^#d\/diagrams\/parent%20one.yaml&into=tenant.nested/);
  for (const invalid of ["../bad", "a..b", "a-", "1bad", Array(9).fill("a").join(".")])
    assert.equal(parseRoute(`#d/a.yaml&into=${encodeURIComponent(invalid)}`).into, undefined);
});
test("nested drill target follows actual instance refs without changing source snapshots", () => {
  const before = JSON.stringify([...files]);
  const target = resolveDrillTarget(parent, files, catalog, api.ICON_NAMES, ["tenant", "nested"]);
  assert.equal(target.path, "components/nested.yaml");
  assert.equal(target.text, nested);
  assert.deepEqual(
    target.crumbs.map((crumb) => crumb.title),
    ["Tenant", "Nested"],
  );
  assert.equal(JSON.stringify([...files]), before);
});
test("unknown instance, leaf traversal and deleted references fail locally", () => {
  for (const chain of [["unknown"], ["tenant", "leaf"], ["tenant", "nested", "service"]])
    assert.ok(resolveDrillTarget(parent, files, catalog, api.ICON_NAMES, chain).error);
  const missing = new Map(files);
  missing.set("components/tenant.yaml", null);
  assert.match(
    resolveDrillTarget(parent, missing, catalog, api.ICON_NAMES, ["tenant"]).error,
    /unavailable/,
  );
});
test("ref changes resolve to current target and malformed/cyclic children cannot be entered", () => {
  const changed = ast('diagram: "1"\nnodes:\n  - id: tenant\n    ref: ws/components/nested\n');
  assert.equal(
    resolveDrillTarget(changed, files, catalog, api.ICON_NAMES, ["tenant"]).path,
    "components/nested.yaml",
  );
  const cyclic = new Map(files);
  cyclic.set("components/tenant.yaml", {
    text: 'diagram: "1"\nnodes:\n  - id: loop\n    ref: ws/components/tenant\n',
    mtime: 2,
  });
  assert.match(
    resolveDrillTarget(parent, cyclic, catalog, api.ICON_NAMES, ["tenant"]).error,
    /cycle/,
  );
  const broken = new Map(files);
  broken.set("components/tenant.yaml", { text: 'diagram: "1"\nnodes: [', mtime: 3 });
  assert.match(
    resolveDrillTarget(parent, broken, catalog, api.ICON_NAMES, ["tenant"]).error,
    /invalid/,
  );
});
