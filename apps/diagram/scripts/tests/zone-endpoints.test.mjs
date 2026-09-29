import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const { checkText, ICON_NAMES } = (
  await runnerImport(`${root}src/server-surface.ts`, {
    root,
    configFile: false,
    logLevel: "error",
  })
).module;
const source = `diagram: "1"
zones:
  - id: sources
    owner: customer
    children:
      - {id: example}
      - id: nested
        owner: customer
        children: [{id: nested-example}]
  - id: targets
    owner: saas
    children: [{id: warehouse-example}]
nodes: [{id: producer}, {id: consumer}]
flows:
  - producer -> targets: Incoming
  - sources -> consumer: Outgoing
  - sources -> targets: Between zones
  - nested -> targets: Nested zone
`;
test("zones are ordinary endpoints, with one border flow and no diagnostic or child fan-out", () => {
  const result = checkText(source, ICON_NAMES);
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(
    result.spec.edges.map((edge) => [edge.source, edge.target]),
    [
      ["producer", "targets"],
      ["sources", "consumer"],
      ["sources", "targets"],
      ["nested", "targets"],
    ],
  );
  assert.ok(result.spec.edges.every((edge) => edge.data.floating === true));
});
test("misspelled zone IDs still produce an unknown endpoint error", () => {
  const result = checkText(source.replace("producer -> targets", "producer -> typo"), ICON_NAMES);
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === "unknown-endpoint" && issue.severity === "error"),
  );
});
