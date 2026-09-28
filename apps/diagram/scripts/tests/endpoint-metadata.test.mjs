import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const {
  module: { endpointMetadata },
} = await runnerImport(`${root}/src/editor/endpoint-metadata.ts`, {
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
      label: "Amazon RDS",
      icon: "aws/rds",
      kind: "datastore",
      description: "Managed database",
    },
  ],
  [
    "aws/part",
    { name: "aws/part", vendor: "aws", label: "Database part", icon: "aws/rds", part: {} },
  ],
]);
test("reference-first endpoints inherit the same metadata as catalog-backed nodes", () => {
  assert.deepEqual(endpointMetadata("nodes:\n  - id: db\n    ref: catalog/aws/rds\n", catalog), [
    {
      id: "db",
      title: "Amazon RDS",
      kind: "datastore",
      icon: "aws/rds",
      description: "Managed database",
    },
  ]);
});
test("catalog parts inherit kind and description from their mark", () => {
  assert.deepEqual(
    endpointMetadata("nodes:\n  - id: db\n    ref: catalog/aws/part\n", catalog)[0],
    {
      id: "db",
      title: "Database part",
      kind: "datastore",
      icon: "aws/rds",
      description: "Managed database",
    },
  );
});
test("explicit overrides including empty strings win over all supplied fields", () => {
  assert.deepEqual(
    endpointMetadata(
      'nodes:\n  - id: db\n    ref: catalog/aws/rds\n    title: ""\n    type: queue\n    icon: lucide/box\n    description: Custom queue\n',
      catalog,
    )[0],
    { id: "db", title: "", kind: "queue", icon: "lucide/box", description: "Custom queue" },
  );
});
test("YAML null supplied fields inherit, while explicit empty strings do not", () => {
  const inherited = endpointMetadata(
    "nodes:\n  - id: db\n    ref: catalog/aws/rds\n    title:\n    icon: null\n    type: ~\n",
    catalog,
  )[0];
  assert.deepEqual(
    [inherited.title, inherited.icon, inherited.kind],
    ["Amazon RDS", "aws/rds", "datastore"],
  );
  const empty = endpointMetadata(
    'nodes:\n  - id: db\n    ref: catalog/aws/rds\n    title: ""\n    icon: ""\n    type: ""\n',
    catalog,
  )[0];
  assert.deepEqual([empty.title, empty.icon, empty.kind], ["", "", ""]);
});
test("an empty mixed child zone is classified by zone-only keys", () => {
  const rows = endpointMetadata(
    "zones:\n  - id: parent\n    children:\n      - id: network\n        kind: vnet\n",
    catalog,
  );
  assert.equal(rows.find((row) => row.id === "network").kind, "zone");
});
test("only actual entries are endpoints; nested metadata IDs are not", () => {
  const rows = endpointMetadata(
    "zones:\n  - id: region\n    children:\n      - id: db\n        ref: catalog/aws/rds\n        metadata:\n          id: invented\n",
    catalog,
  );
  assert.deepEqual(
    rows.map((row) => [row.id, row.title, row.kind]),
    [
      ["region", "region", "zone"],
      ["db", "Amazon RDS", "datastore"],
    ],
  );
});
test("current buffer edits and missing refs never reuse another node's catalog metadata", () => {
  const rows = endpointMetadata(
    "nodes:\n  - id: db\n    ref: catalog/aws/missing\n  - id: custom\n    title: Current edit\n",
    catalog,
  );
  assert.deepEqual(
    rows.map((row) => [row.id, row.title, row.icon]),
    [
      ["db", "db", undefined],
      ["custom", "Current edit", undefined],
    ],
  );
});
test("qualified compiled endpoints require a still-existing parent", () => {
  const compiled = [
    { id: "part.child", type: "arch/datastore", data: { title: "Database", icon: "aws/rds" } },
    { id: "removed.child", type: "arch/service", data: { title: "Stale" } },
  ];
  assert.deepEqual(
    endpointMetadata("nodes:\n  - id: part\n    ref: ws/components/part\n", catalog, compiled).map(
      (row) => [row.id, row.title],
    ),
    [
      ["part", "part"],
      ["part.child", "Database"],
    ],
  );
});
