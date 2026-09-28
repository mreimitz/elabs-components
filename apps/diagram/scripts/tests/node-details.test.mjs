import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const {
  module: { resolveNodeDetails, catalogNameOfNode, componentPathOf, safeHref },
} = await runnerImport(`${root}/src/interaction/node-details.ts`, {
  root,
  configFile: false,
  logLevel: "error",
});
const entry = {
  name: "aws/glue",
  vendor: "aws",
  slug: "glue",
  label: "AWS Glue",
  icon: "aws/glue",
  description: "Catalog description",
  docs: "https://example.org/catalog",
  docsUnverified: true,
  tags: [],
  aliases: [],
  curated: false,
};
const node = (data = {}, type = "arch/service") => ({
  id: "node",
  type,
  position: { x: 0, y: 0 },
  data: { title: "Customer ingestion", ...data },
});

test("catalog identity survives display icon overrides and excludes generic/composite icons", () => {
  assert.equal(
    catalogNameOfNode(node({ catalogEntry: "aws/glue", icon: "aws/lambda" })),
    "aws/glue",
  );
  assert.equal(catalogNameOfNode(node({ icon: "aws/glue" })), "aws/glue");
  assert.equal(catalogNameOfNode(node({ icon: "lucide/box" })), undefined);
  assert.equal(catalogNameOfNode(node({ icon: "aws/glue" }, "arch/composite")), undefined);
});
test("own description/docs then legacy href then live catalog; provenance matches selected docs", () => {
  const inherited = resolveNodeDetails(node(), entry);
  assert.equal(inherited.description, entry.description);
  assert.equal(inherited.docs, entry.docs);
  assert.equal(inherited.docsUnverified, true);
  assert.deepEqual(inherited.catalog, { vendor: "aws", entry: "glue" });
  const own = resolveNodeDetails(
    node({
      description: "Our words",
      docs: "https://example.org/own",
      href: "https://example.org/legacy",
    }),
    entry,
  );
  assert.equal(own.description, "Our words");
  assert.equal(own.docs, "https://example.org/own");
  assert.equal(own.docsUnverified, false);
  assert.equal(
    resolveNodeDetails(
      node({ docs: "javascript:alert(1)", href: "http://example.org/legacy" }),
      entry,
    ).docs,
    "http://example.org/legacy",
  );
});
test("part details inherit missing metadata from their source icon but keep their own catalog identity", () => {
  const part = {
    ...entry,
    name: "qlik/gateway-direct",
    vendor: "qlik",
    slug: "gateway-direct",
    label: "Direct gateway",
    part: {},
    description: undefined,
    docs: undefined,
    docsUnverified: undefined,
  };
  const details = resolveNodeDetails(node(), part, entry);
  assert.equal(details.description, entry.description);
  assert.equal(details.docs, entry.docs);
  assert.equal(details.docsUnverified, true);
  assert.deepEqual(details.catalog, { vendor: "qlik", entry: "gateway-direct" });
});
test("header keeps diagram name, differing product name, provider and explicit statuses", () => {
  for (const status of ["ok", "degraded", "down", "planned"])
    assert.equal(resolveNodeDetails(node({ status, provider: "AWS" }), entry).status, status);
  const details = resolveNodeDetails(node({ provider: "AWS" }), entry);
  assert.equal(details.eyebrow, "AWS · Service");
  assert.equal(details.name, "Customer ingestion");
  assert.equal(details.product, "AWS Glue");
  assert.equal(
    resolveNodeDetails(node({ title: "AWS Glue", status: "invented" }), entry).product,
    undefined,
  );
  assert.equal(resolveNodeDetails(node({ status: "invented" })).status, undefined);
});
test("only normalized nonbroken diagram paths link; composites get details while zones/notes do not", () => {
  const details = resolveNodeDetails(
    node({ component: "components/Team diagram.yaml", pending: true }, "arch/composite"),
  );
  assert.equal(details.eyebrow, "Diagram reference");
  assert.equal(details.componentPath, "components/Team diagram.yaml");
  assert.equal(details.icon, "lucide/layers");
  for (const component of [
    "../secret.yaml",
    "/tmp/file.yaml",
    "ws/components/x",
    "javascript:alert(1)",
    "components/x.yml",
    "components/x.yaml&present",
  ])
    assert.equal(componentPathOf({ component }), undefined);
  assert.equal(componentPathOf({ component: "components/x.yaml", broken: true }), undefined);
  for (const type of ["arch/note", "arch/zone", "unknown"])
    assert.equal(resolveNodeDetails(node({}, type)), undefined);
});
test("untrusted protocols never become links", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///private/a",
    "//example.org",
    "/local",
    "not a url",
    null,
    12,
  ])
    assert.equal(safeHref(url), undefined);
  assert.equal(safeHref("https://example.org/path?q=a#b"), "https://example.org/path?q=a#b");
});

test("explicit empty metadata clears inherited description and docs", () => {
  const details = resolveNodeDetails(
    node({ description: "", docs: "", href: "https://example.org/legacy" }),
    entry,
  );
  assert.equal(details.description, "");
  assert.equal(details.docs, undefined);
  assert.equal(details.docsUnverified, false);
});
