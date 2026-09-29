import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { parseRoute, toHash } = (
  await runnerImport(`${root}/src/routes/use-hash.ts`, {
    root,
    configFile: false,
    logLevel: "error",
  })
).module;

test("legacy catalog and icon links enter the same browser collection", () => {
  for (const hash of ["#catalog", "#catalog/aws", "#catalog/aws/lambda", "#icons/aws"]) {
    const route = parseRoute(hash);
    assert.equal(route.kind, "catalog");
    assert.equal(route.browser.collection, "catalog");
  }
  assert.equal(parseRoute("#catalog/aws/lambda").entry, "lambda");
  assert.equal(parseRoute("#catalog/aws/lambda").vendor, "aws");
  assert.equal(toHash({ kind: "catalog", vendor: "aws", entry: "lambda" }), "#catalog/aws/lambda");
});

test("browser hash retains collection, folder, query, vendor, sort, and page", () => {
  const hash =
    "#home&collection=components&folder=team%2Fshared&q=fraud+api&vendor=aws&sort=name&page=3";
  const route = parseRoute(hash);
  assert.equal(route.kind, "home");
  assert.deepEqual(
    {
      collection: route.browser.collection,
      folder: route.browser.folder,
      query: route.browser.query,
      vendor: route.browser.vendor,
      sort: route.browser.sort,
      page: route.browser.page,
    },
    {
      collection: "components",
      folder: "team/shared",
      query: "fraud api",
      vendor: "aws",
      sort: "name",
      page: 3,
    },
  );
  assert.equal(toHash(route), hash);
});
