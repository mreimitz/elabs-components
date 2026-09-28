/** Run from apps/diagram: node --test scripts/tests/yaml-context.test.mjs */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
import { parseDocument } from "yaml";
const root = fileURLToPath(new URL("../../", import.meta.url));
const {
  module: { yamlContext },
} = await runnerImport(`${root}/src/editor/yaml-context.ts`, {
  root,
  configFile: false,
  logLevel: "error",
});
function at(source) {
  const offset = source.indexOf("@@");
  assert.notEqual(offset, -1);
  const text = source.replace("@@", "");
  return { text, context: yamlContext(text, offset) };
}
const cases = [
  [
    "plain reference",
    "nodes:\n  - id: a\n    ref: catalog/aws/rd@@ # retained",
    "catalog/aws/rds",
    "catalog/aws/rd",
    "nodes",
  ],
  [
    "double-quoted reference",
    'nodes:\n  - id: a\n    ref: "catalog/aws/rd@@" # retained',
    '"catalog/aws/rds"',
    '"catalog/aws/rd"',
    "nodes",
  ],
  [
    "single-quoted reference",
    "nodes:\n  - id: a\n    ref: 'catalog/aws/rd@@' # retained",
    "'catalog/aws/rds'",
    "'catalog/aws/rd'",
    "nodes",
  ],
  [
    "wrapped flow mapping",
    "nodes: [{id: a,\n  ref: catalog/aws/rd@@}] # retained",
    "catalog/aws/rds",
    "catalog/aws/rd",
    "nodes",
  ],
  [
    "flow mapping neighbours",
    "nodes: [{id: a, ref: catalog/aws/rd@@, title: Preserved}] # retained",
    "catalog/aws/rds",
    "catalog/aws/rd",
    "nodes",
  ],
  [
    "workspace punctuation",
    "nodes:\n  - id: a\n    ref: ws/Customer's landscape@@ # retained",
    '"ws/Customer\'s landscape"',
    "ws/Customer's landscape",
    "nodes",
  ],
  ["flow source", "flows:\n  - sou@@ -> target: retained", "source", "sou", "flows"],
  ["flow target", "flows:\n  - source -> tar@@: retained", "target", "tar", "flows"],
  ["empty arrow target", "flows:\n  - source -> @@", "target", "", "flows"],
];
for (const [name, input, insert, replaced, ancestor] of cases)
  test(name, () => {
    const { text, context } = at(input);
    assert(context);
    assert(context.path.includes(ancestor));
    assert.equal(text.slice(context.from, context.to), replaced);
    const changed = text.slice(0, context.from) + insert + text.slice(context.to);
    assert.equal(changed, text.replace(replaced || /$/, insert));
    assert.deepEqual(parseDocument(changed).errors, []);
  });
for (const input of [
  "# ref: catalog/@@",
  "nodes:\n  - id: a # ref: catalog/@@",
  "description: |\n  ref: catalog/@@",
  "description: >-\n  ref: catalog/@@",
  "description: |\r\n  ref: catalog/@@",
])
  test(`prose does not complete: ${JSON.stringify(input)}`, () =>
    assert.equal(at(input).context, null));
test("flow key preserves following fields and excludes existing sibling keys", () => {
  const { text, context } = at("nodes: [{id: a, ti@@: Preserved, ref: catalog/aws/rds}]");
  assert.equal(context.kind, "key");
  assert.deepEqual(context.path, ["nodes", 0]);
  assert(context.siblings.includes("ref"));
  const changed = text.slice(0, context.from) + "title" + text.slice(context.to);
  assert.equal(parseDocument(changed).toJS().nodes[0].title, "Preserved");
  assert.equal(parseDocument(changed).toJS().nodes[0].ref, "catalog/aws/rds");
});
test("nested child key keeps its exact structural path", () => {
  const { context } = at("zones:\n  - id: outer\n    children:\n      - id: child\n        sta@@");
  assert.equal(context.kind, "key");
  assert.deepEqual(context.path, ["zones", 0, "children", 0]);
});
for (const [input, path] of [
  ["legend: [ow@@]", ["legend", 0]],
  ["legend:\n  - ow@@", ["legend", 0]],
  ["story:\n  steps:\n    - targets: [a, b@@]", ["story", "steps", 0, "targets", 1]],
  ["story:\n  steps:\n    - targets:\n        - b@@", ["story", "steps", 0, "targets", 0]],
])
  test(`sequence context ${JSON.stringify(path)}`, () =>
    assert.deepEqual(at(input).context.path, path));
const {
  module: { schemasAt },
} = await runnerImport(`${root}/src/editor/yaml-schema.ts`, {
  root,
  configFile: false,
  logLevel: "error",
});
for (const layout of ["auto", "manual"]) {
  for (const path of [
    ["nodes", 0],
    ["zones", 0, "children", 0],
  ])
    test(`${layout} schema keys at ${path.join(".")}`, () => {
      const schemas = schemasAt(path, `diagram: "1"\nlayout: ${layout}`);
      const keys = schemas.flatMap((schema) => Object.keys(schema.properties ?? {}));
      assert(keys.includes("status"));
      assert(keys.includes("ref"));
      assert.equal(keys.includes("position"), layout === "manual");
      assert(!keys.includes("use"));
    });
  test(`${layout} node type and nested status enums`, () => {
    const text = `diagram: "1"\nlayout: ${layout}`;
    assert(
      schemasAt(["nodes", 0, "type"], text)
        .flatMap((s) => s.enum ?? [])
        .includes("queue"),
    );
    assert(
      schemasAt(["zones", 0, "children", 0, "status"], text)
        .flatMap((s) => s.enum ?? [])
        .includes("planned"),
    );
  });
}
test("missing layout uses automatic schema", () =>
  assert(!schemasAt(["nodes", 0]).some((s) => s.properties?.position)));
test("flow shorthand attributes use canonical schema", () =>
  assert(
    schemasAt(["flows", 0, "a -> b", "kind"])
      .flatMap((s) => s.enum ?? [])
      .includes("data"),
  ));
