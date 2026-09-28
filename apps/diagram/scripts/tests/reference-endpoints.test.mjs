import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const {
  module: { referenceEndpoints },
} = await runnerImport(`${root}src/editor/reference-endpoints.ts`, {
  root,
  configFile: false,
  logLevel: "error",
});
const catalog = new Map([
  [
    "aws/rds",
    {
      name: "aws/rds",
      vendor: "aws",
      label: "Database",
      icon: "aws/rds",
      kind: "datastore",
      description: "Managed database",
    },
  ],
]);
const icons = new Set(["aws/rds"]);
const doc = (nodes, extra = "") =>
  `diagram: "1"\n${extra}\nnodes:\n${nodes.map((node) => `  - ${JSON.stringify(node)}`).join("\n")}\n`;
const file = (text) => ({ text, mtime: 1 });
const files = new Map([
  [
    "child.yaml",
    file(
      doc(
        [
          { id: "db", ref: "catalog/aws/rds" },
          { id: "nested", ref: "ws/inner" },
        ],
        "title: Child\ncomponent: {icon: aws/rds, description: Child details}",
      ),
    ),
  ],
  ["inner.yaml", file(doc([{ id: "leaf", title: "Inner leaf" }]))],
]);
const parent = doc([{ id: "tenant", ref: "ws/child", expand: false }]);
const get = (text = parent, snapshot = files) => referenceEndpoints(text, catalog, snapshot, icons);
test("collapsed references expose qualified nested IDs and inherited metadata", () => {
  const rows = get();
  assert.deepEqual(
    rows.map((row) => row.id),
    ["tenant", "tenant.db", "tenant.nested", "tenant.nested.leaf"],
  );
  assert.equal(rows[0].title, "Child");
  assert.equal(rows[0].description, "Child details");
  assert.equal(rows[1].title, "Database");
  assert.equal(rows[1].kind, "datastore");
  assert.equal(rows[1].description, "Managed database");
});
test("current-buffer ref edits and updated snapshots discard previous inner IDs", () => {
  assert.deepEqual(
    get(parent.replace("ws/child", "ws/inner")).map((row) => row.id),
    ["tenant", "tenant.leaf"],
  );
  const changed = new Map(files);
  changed.set("child.yaml", file(doc([{ id: "replacement" }])));
  assert.deepEqual(
    get(parent, changed).map((row) => row.id),
    ["tenant", "tenant.replacement"],
  );
});
test("authored empty metadata wins and null metadata inherits", () => {
  const empty = get(
    doc([{ id: "tenant", ref: "ws/child", title: "", description: "", icon: "" }]),
  )[0];
  assert.deepEqual([empty.title, empty.description, empty.icon], ["", "", ""]);
  const inherited = get(doc([{ id: "tenant", ref: "ws/child", title: null, icon: null }]))[0];
  assert.deepEqual([inherited.title, inherited.icon], ["Child", "aws/rds"]);
});
test("malformed, missing and cyclic references never fabricate endpoints", () => {
  assert.deepEqual(get("nodes: ["), []);
  assert.deepEqual(
    get(parent, new Map()).map((row) => row.id),
    [],
  );
  const cyclic = new Map([["child.yaml", file(doc([{ id: "again", ref: "ws/child" }]))]]);
  assert.deepEqual(
    get(parent, cyclic).map((row) => row.id),
    ["tenant"],
  );
  assert.deepEqual(
    get(parent.replace("ws/child", "ws/missing")).map((row) => row.id),
    ["tenant"],
  );
});
test("partially typed flow endpoints still resolve collapsed children", () => {
  assert.ok(get(`${parent}flows:\n  - source -> tenant.q`).some((row) => row.id === "tenant.db"));
});

test("repeated instances are bounded while qualified queries reach later branches", () => {
  const repeated = new Map(
    Array.from({ length: 7 }, (_, depth) => [
      `level${depth}.yaml`,
      file(
        doc(
          depth === 6
            ? [{ id: "leaf", title: "Leaf" }]
            : Array.from({ length: 10 }, (_, index) => ({
                id: `n${index}`,
                ref: `ws/level${depth + 1}`,
              })),
        ),
      ),
    ]),
  );
  const text = doc([{ id: "tenant", ref: "ws/level0" }]);
  assert.equal(referenceEndpoints(text, catalog, repeated, icons).length, 1000);
  const target = `tenant.${Array(6).fill("n9").join(".")}.leaf`;
  assert.deepEqual(
    referenceEndpoints(text, catalog, repeated, icons, target).map((row) => row.id),
    [target],
  );
});
