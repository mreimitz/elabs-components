/** Run from apps/diagram: node --test scripts/tests/home-browser.test.mjs */
import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const plugins = [
  {
    name: "browser-model-test-stores",
    enforce: "pre",
    resolveId(id) {
      if (id.endsWith("workspace-store")) return "\0test-workspace-store";
      if (id.endsWith("catalog-service")) return "\0test-catalog-service";
    },
    load(id) {
      if (id === "\0test-workspace-store")
        return "export const workspaceStore={get:()=>({recents:[],tree:null}),subscribe:()=>()=>{}};export const useWorkspace=()=>null";
      if (id === "\0test-catalog-service")
        return "export const useCatalog=()=>({entries:new Map(),loaded:true,problems:[]})";
    },
  },
];
async function imported(path) {
  return (
    await runnerImport(`${root}/src/${path}`, {
      root,
      configFile: false,
      logLevel: "silent",
      plugins,
    })
  ).module;
}
const model = await imported("home/browser-model.ts");
const history = await imported("home/browser-history.ts");
const state = await imported("home/browser-state.ts");
const index = await imported("workspace/search-index.ts");

function file(path, title, kind = "diagram") {
  return { path, title, kind, mtime: 100, size: 200, hasThumb: false };
}
function catalog(name, label, more = {}) {
  const [vendor, slug] = name.split("/");
  return {
    name,
    vendor,
    slug,
    label,
    icon: name,
    aliases: [],
    tags: [],
    curated: true,
    ...more,
  };
}
function view(patch = {}) {
  return { ...state.DEFAULT_BROWSER_STATE, ...patch };
}

test("migrated recents keep their order and unknown timestamps; corrupt storage is safe", () => {
  const old = ["customers/cafe.yaml", "components/icon.yaml", "customers/cafe.yaml"];
  assert.deepEqual(history.parseOpenedHistory("broken json", old), [
    { id: "workspace:customers/cafe.yaml", openedAt: null },
    { id: "workspace:components/icon.yaml", openedAt: null },
  ]);
  const raw = JSON.stringify([
    { id: "catalog:aws/lambda", openedAt: 123 },
    { id: "workspace:bad.yaml", openedAt: "yesterday" },
  ]);
  assert.deepEqual(
    history.parseOpenedHistory(raw, old).map((item) => item.id),
    ["catalog:aws/lambda", "workspace:customers/cafe.yaml", "workspace:components/icon.yaml"],
  );
});

test("recent contains opened existing workspace and catalog items only", () => {
  const items = model.buildBrowseItems(
    { folders: [], files: [file("a.yaml", "A"), file("b.yaml", "B")] },
    [catalog("aws/lambda", "Lambda")],
  );
  const opened = [
    { id: "catalog:aws/lambda", openedAt: 200 },
    { id: "workspace:gone.yaml", openedAt: 150 },
    { id: "workspace:a.yaml", openedAt: null },
  ];
  const result = model.browseResults(items, view(), opened);
  assert.deepEqual(
    result.items.map((hit) => hit.item.id),
    ["catalog:aws/lambda", "workspace:a.yaml"],
  );
  assert.equal(result.items[1].openedAt, null);
  assert.equal(result.total, 2);
});

test("accent, indexed content, catalog alias/capability/description use AND words with explanations", () => {
  const tree = { folders: ["customers"], files: [file("customers/cafe.yaml", "Café Integration")] };
  const indexed = [
    {
      path: "customers/cafe.yaml",
      fileName: "cafe.yaml",
      stem: "cafe",
      folder: "customers",
      title: "Café Integration",
      description: "Connects internal services",
      mtime: 100,
      boxes: [{ id: "nebula", title: "NebulaContentNeedle", ref: "catalog/qlik/data-gateway" }],
    },
  ];
  const items = model.buildBrowseItems(
    tree,
    [
      catalog("aws/lambda", "Lambda", {
        aliases: ["Cloud Function"],
        capability: "Compute",
        description: "Event-driven execution",
      }),
    ],
    indexed,
  );
  assert.equal(model.searchBrowseItems(items, "cafe")[0].item.id, "workspace:customers/cafe.yaml");
  const content = model.searchBrowseItems(items, "nebulaContentNeedle");
  assert.equal(content[0].item.id, "workspace:customers/cafe.yaml");
  assert.equal(content[0].match.reasons[0].text, "NebulaContentNeedle");
  assert.equal(
    model.searchBrowseItems(items, "cafe.yaml")[0].item.id,
    "workspace:customers/cafe.yaml",
  );
  assert.equal(
    model.searchBrowseItems(items, "data-gateway")[0].item.id,
    "workspace:customers/cafe.yaml",
  );
  assert.equal(model.searchBrowseItems(items, "cloud compute")[0].match.reasons.length, 2);
  assert.equal(
    model.searchBrowseItems(items, "compute execution")[0].item.id,
    "catalog:aws/lambda",
  );
  assert.equal(
    model.searchBrowseItems(items, "catalog/aws/lambda")[0].item.id,
    "catalog:aws/lambda",
  );
  assert.equal(model.searchBrowseItems(items, "cloud missing").length, 0);
});

test("1,000 mixed items page at 48, with scoped folders and catalog facets", () => {
  const files = Array.from({ length: 500 }, (_, n) =>
    file(`customers/team-${n % 10}/diagram-${n}.yaml`, `Diagram ${n}`),
  );
  files.push(file("components/shared.yaml", "Shared", "component"));
  files.push(file("templates/start.yaml", "Starter"));
  const entries = Array.from({ length: 500 }, (_, n) =>
    catalog(`vendor/item-${n}`, `Product ${n}`, {
      kind: n % 2 ? "service" : "database",
      tags: n % 2 ? ["serverless"] : ["storage"],
    }),
  );
  const items = model.buildBrowseItems(
    { folders: ["customers", "components", "templates"], files },
    entries,
  );
  assert.equal(items.length, 1002);
  const diagrams = model.browseResults(
    items,
    view({ collection: "diagrams" }),
    [],
    ["customers", "components", "templates"],
  );
  assert.equal(diagrams.total, 500);
  assert.equal(diagrams.items.length, 48);
  const oversizedPage = model.browseResults(items, view({ collection: "catalog", page: 999 }), []);
  assert.equal(oversizedPage.page, 11);
  assert.equal(oversizedPage.pageCount, 11);
  assert.equal(oversizedPage.items.length, 20);
  assert.deepEqual(diagrams.folders, ["customers"]);
  const nestedFolders = model.browseResults(
    items,
    view({ collection: "diagrams", folder: "customers" }),
    [],
  );
  assert.deepEqual(
    nestedFolders.folders,
    Array.from({ length: 10 }, (_, n) => `customers/team-${n}`),
  );
  const folder = model.browseResults(
    items,
    view({ collection: "diagrams", folder: "customers/team-1" }),
    [],
  );
  assert.equal(folder.total, 50);
  const catalogResult = model.browseResults(
    items,
    view({ collection: "catalog", catalogKind: "service", tag: "serverless", page: 2 }),
    [],
  );
  assert.equal(catalogResult.total, 250);
  assert.equal(catalogResult.items.length, 48);
  assert.equal(catalogResult.workspaceCount, 0);
  assert.equal(catalogResult.catalogCount, 250);
  const warmStart = performance.now();
  const searched = model.browseResults(items, view({ query: "diagram" }), []);
  const warmMs = performance.now() - warmStart;
  assert.equal(searched.total, 500);
  assert.equal(searched.items.length, 48);
  assert.ok(warmMs < 200, `warm 1,002-item search took ${warmMs.toFixed(1)}ms`);
  console.log(`Warm browseResults (1,002 items): ${warmMs.toFixed(1)}ms`);
});

test("browser params restore collection, scope, sort, facets and page; layout stays local", () => {
  const expected = view({
    collection: "catalog",
    query: "café",
    vendor: "aws",
    catalogKind: "service",
    tag: "analytics",
    sort: "name",
    page: 3,
  });
  const actual = state.parseBrowserParams(`#home${state.browserParams(expected)}`);
  assert.deepEqual(actual, expected);
  assert.equal(state.parseBrowserParams("#catalog/aws").vendor, "aws");
  assert.equal(state.parseBrowserParams("#icons/aws").vendor, "aws");
  assert.equal(state.parseBrowserParams("#icons/aws").collection, "catalog");
  assert.equal(state.parseBrowserParams("#home&page=NaN&collection=bogus").page, 1);
});

test("content reads use at most eight concurrent workers and preserve tree order", async () => {
  const tree = {
    folders: [],
    files: Array.from({ length: 64 }, (_, n) => file(`bounded-${n}.yaml`, `Bounded ${n}`)),
  };
  let active = 0;
  let peak = 0;
  const read = async (path) => {
    active++;
    peak = Math.max(active, peak);
    await delay(2);
    active--;
    return { text: `description: ${path}`, mtime: 100 };
  };
  const entries = await index.buildIndex(tree, read);
  assert.equal(entries.length, 64);
  assert.ok(peak <= 8, `peak concurrency ${peak}`);
  assert.deepEqual(
    entries.map((entry) => entry.path),
    tree.files.map((entry) => entry.path),
  );
});
