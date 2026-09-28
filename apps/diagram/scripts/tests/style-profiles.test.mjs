import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
import { parse } from "yaml";
const root = fileURLToPath(new URL("../../", import.meta.url));
const load = async (file) =>
  (await runnerImport(`${root}src/style/${file}`, { root, configFile: false, logLevel: "error" }))
    .module;
const { loadProfiles } = await load("load-profiles.ts");
const { resolveStyle, themeBindingFor, selectionIssues } = await load("resolve-style.ts");
const { parseStyleConfig, createStyleConfigStore } = await load("workspace-config.ts");
const texts = await Promise.all(
  ["atlas-clean", "qlik-marketecture"].map(async (id) => [
    id,
    await readFile(`${root}src/style/profiles/${id}.yaml`, "utf8"),
  ]),
);
const sources = new Map(texts);
const loaded = loadProfiles(sources);
const original = parse(sources.get("atlas-clean"));
function custom(...entries) {
  return loadProfiles(
    new Map([...sources, ...entries.map(([id, data]) => [id, JSON.stringify(data)])]),
  );
}
test("exactly two complete built-ins validate and neutral keeps semantic paint behavior", () => {
  assert.deepEqual(loaded.issues, []);
  assert.equal(loaded.profiles.size, 2);
  for (const name of ["light", "dark", "snowflake-light", "clickhouse-dark"]) {
    const resolved = resolveStyle({ theme: themeBindingFor(name), profiles: loaded.profiles });
    assert.equal(resolved.hero, null);
    assert.equal(resolved.visual.profile, "qlik-marketecture");
    assert.equal(resolved.visual.ground.followTheme, true);
    assert.equal(resolved.technical.ground.fill, "var(--background)");
  }
  const qlik = resolveStyle({ theme: themeBindingFor("qlik-dark"), profiles: loaded.profiles });
  assert.equal(qlik.hero, "qlik");
  assert.equal(qlik.visual.ground.followTheme, false);
  assert.equal(loaded.profiles.get("qlik-marketecture").ground.followTheme, false);
});
test("cascade tracks each lens independently and explicit inherit falls through", () => {
  const result = resolveStyle({
    theme: themeBindingFor("light"),
    profiles: loaded.profiles,
    workspace: { styles: { technical: "atlas-clean", visual: "qlik-marketecture" } },
    diagram: { technical: "inherit", visual: "qlik-marketecture" },
  });
  assert.equal(result.provenance.technical.level, "workspace");
  assert.equal(result.provenance.visual.level, "diagram");
  assert.deepEqual(result.issues, []);
  assert.equal(
    selectionIssues({ visual: "atlas-clean", technical: "qlik-marketecture", hero: "qlik" }).length,
    3,
  );
});
test("loader deep merges known atoms, replaces arrays, and preserves sources", () => {
  const child = {
    profile: "child",
    schemaVersion: 1,
    lens: "technical",
    extends: "atlas-clean",
    ground: { fill: "#123456" },
    layout: { lanes: ["sources"] },
  };
  const result = custom(["child", child]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.profiles.get("child").ground.followTheme, true);
  assert.deepEqual(result.profiles.get("child").layout.lanes, ["sources"]);
  assert.deepEqual(parse(sources.get("atlas-clean")), original);
});
test("loader rejects unsafe CSS, unknown atoms, missing bases, cross-lens inheritance and cycles", () => {
  for (const patch of [
    { ground: { fill: "url(https://bad.test/x)" } },
    { ground: { fill: "red;display:none" } },
    { boxes: { anatomy: "alien" } },
    { unknown: true },
    { extends: "missing" },
    { extends: "qlik-marketecture" },
  ]) {
    const result = custom([
      "child",
      { profile: "child", schemaVersion: 1, lens: "technical", extends: "atlas-clean", ...patch },
    ]);
    assert.ok(result.issues.length);
    assert.equal(result.profiles.has("child"), false);
  }
  const cycle = custom(
    ["a", { profile: "a", schemaVersion: 1, lens: "technical", extends: "b" }],
    ["b", { profile: "b", schemaVersion: 1, lens: "technical", extends: "a" }],
  );
  assert.ok(cycle.issues.some((issue) => issue.message.includes("cycle")));
});
test("inheritance depth bound is independent of source order and cached ancestors", () => {
  const chain = Array.from({ length: 9 }, (_, index) => [
    `p${index}`,
    {
      profile: `p${index}`,
      schemaVersion: 1,
      lens: "technical",
      extends: index ? `p${index - 1}` : "atlas-clean",
    },
  ]);
  for (const entries of [chain, [...chain].reverse()]) {
    const result = custom(...entries);
    assert.equal(result.profiles.has("p8"), false);
    assert.ok(result.issues.some((issue) => issue.message.includes("levels")));
  }
});
test("workspace config is styles-only and rejects malformed/aliased invalid values", () => {
  assert.deepEqual(parseStyleConfig("styles:\n  visual: inherit\n").config, {
    styles: { visual: "inherit" },
  });
  for (const text of [
    "styles: []",
    "hero: qlik",
    "styles: {visual: atlas-clean}",
    "styles: {visual: qlik-marketecture, visual: inherit}",
    "styles: &a {visual: *a}",
  ])
    assert.ok(parseStyleConfig(text).issues.length);
});
test("config refresh keeps last good on errors, latest request wins, deletion resets, disposal refuses late completion", async () => {
  const pending = [];
  const store = createStyleConfigStore(
    () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
  );
  let events = 0;
  const unsubscribe = store.subscribe(() => events++);
  const a = store.refresh();
  const b = store.refresh();
  pending[1].resolve("styles: {visual: qlik-marketecture}");
  await b;
  pending[0].resolve("styles: {visual: inherit}");
  await a;
  assert.equal(store.current().styles.visual, "qlik-marketecture");
  assert.equal(events, 1);
  const invalid = store.refresh();
  pending[2].resolve("styles: nope");
  await invalid;
  assert.equal(store.current().styles.visual, "qlik-marketecture");
  assert.ok(store.issues().length);
  const missing = store.refresh();
  pending[3].resolve(null);
  await missing;
  assert.deepEqual(store.current(), {});
  assert.deepEqual(store.issues(), []);
  const late = store.refresh();
  store.cancel();
  pending[4].resolve("styles: {visual: qlik-marketecture}");
  await late;
  assert.deepEqual(store.current(), {});
  unsubscribe();
});

test("diagram style schema and browser/MCP compiler agree on positioned rejection", async () => {
  const { module: api } = await runnerImport(`${root}src/server-surface.ts`, {
    root,
    configFile: false,
    logLevel: "error",
  });
  const { module: schema } = await runnerImport(`${root}src/spec/dialect/schema.ts`, {
    root,
    configFile: false,
    logLevel: "error",
  });
  const source = 'diagram: "1"\nnodes: [{id: a}]\n';
  const valid = api.checkText(
    source + "style: {technical: inherit, visual: qlik-marketecture}\n",
    api.ICON_NAMES,
  );
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.ast.style, { technical: "inherit", visual: "qlik-marketecture" });
  for (const style of [
    { visual: "atlas-clean" },
    { visual: "made-up" },
    { hero: "qlik" },
    null,
    "qlik-marketecture",
  ]) {
    const checked = api.checkText(source + `style: ${JSON.stringify(style)}\n`, api.ICON_NAMES);
    assert.equal(checked.ok, false);
    assert.ok(
      checked.issues.some((issue) => issue.code === "invalid-style" && issue.range),
      JSON.stringify(checked.issues),
    );
  }
  assert.deepEqual(schema.buildArchSchema().properties.style.properties.visual.enum, [
    "inherit",
    "qlik-marketecture",
  ]);
  assert.equal(schema.buildArchSchema().properties.style.additionalProperties, false);
});
test("bundled fixed palette satisfies normal text contrast and keeps accent green distinct", () => {
  const profile = loaded.profiles.get("qlik-marketecture");
  const luminance = (color) => {
    const values = color
      .slice(1)
      .match(/../g)
      .map((hex) => parseInt(hex, 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  };
  for (const paint of [
    profile.roles.hero,
    profile.roles.other,
    profile.roles.zone,
    profile.pills,
  ]) {
    const pair = [luminance(paint.fill), luminance(paint.text)].sort((a, b) => b - a);
    assert.ok((pair[0] + 0.05) / (pair[1] + 0.05) >= 4.5);
  }
  assert.equal(profile.zones.accents["vendor-cloud"], "#009845");
});

test("closed profile fields reject prototype names and colors allow exactly CSS hex lengths", () => {
  for (const patch of [
    { toString: {} },
    { roles: { toString: {} } },
    { ground: { fill: "#12345" } },
  ]) {
    const result = custom([
      "child",
      { profile: "child", schemaVersion: 1, lens: "technical", extends: "atlas-clean", ...patch },
    ]);
    assert.ok(result.issues.length);
    assert.equal(result.profiles.has("child"), false);
  }
  for (const fill of ["#123", "#1234", "#123456", "#12345678"]) {
    assert.deepEqual(
      custom([
        "child",
        {
          profile: "child",
          schemaVersion: 1,
          lens: "technical",
          extends: "atlas-clean",
          ground: { fill },
        },
      ]).issues,
      [],
    );
  }
  assert.equal(selectionIssues({ toString: {} }).length, 1);
});

test("visual profile drives markers, tag mapping, and inherited provider without tinting mixed boxes", async () => {
  const get = async (path) =>
    (await runnerImport(`${root}src/${path}`, { root, configFile: false, logLevel: "error" }))
      .module;
  const { resolveVisual } = await get("visual/resolve-visual.ts");
  const { checkArchYaml } = await get("spec/dialect/index.ts");
  const { layoutVisualLens } = await get("visual/lane-layout.ts");
  const { buildVisualGraph } = await get("visual/build-visual-graph.ts");
  const ast = checkArchYaml(
    'diagram: "1"\nzones: [{id: cloud, kind: cloud-region, provider: qlik, owner: saas}]\nnodes: [{id: a, parent: cloud}, {id: b}]\nflows: ["a <-> b"]\n',
    new Set(),
  ).ast;
  const qlik = loaded.profiles.get("qlik-marketecture");
  const lens = resolveVisual(ast, { hero: "qlik" }).lens;
  assert.equal(lens.boxes.find((b) => b.members.some((m) => m.id === "a")).provider, "qlik");
  assert.equal(lens.boxes.find((b) => b.members.some((m) => m.id === "b")).provider, undefined);
  const edge = buildVisualGraph(lens, layoutVisualLens(lens), qlik).edges[0];
  assert.equal(edge.markerEnd.color, qlik.flows.data.stroke);
  assert.equal(edge.markerStart.color, qlik.flows.data.stroke);
  const neutral = { ...qlik, ground: { ...qlik.ground, followTheme: true } };
  assert.equal(
    buildVisualGraph(lens, layoutVisualLens(lens), neutral).edges[0].markerEnd.color,
    "var(--muted-foreground)",
  );
  const noArrows = { ...qlik, flows: { ...qlik.flows, arrowheads: "none" } };
  assert.equal(
    buildVisualGraph(lens, layoutVisualLens(lens), noArrows).edges[0].markerEnd,
    undefined,
  );
  ast.nodes[0].catalogEntry = "qlik/a";
  const catalog = new Map([["qlik/a", { vendor: "qlik", tags: ["object-storage", "cdc"] }]]);
  const mapped = resolveVisual(ast, {
    catalog,
    pillFromTags: qlik.pills.fromTags,
    pillVocabulary: new Set(qlik.pills.vocabulary),
  }).lens;
  assert.deepEqual(mapped.boxes.find((b) => b.members.some((m) => m.id === "a")).processes, [
    "storage",
    "replication",
  ]);
});

test("a mixed-provider authored capability box has no hero provider", async () => {
  const get = async (path) =>
    (await runnerImport(`${root}src/${path}`, { root, configFile: false, logLevel: "error" }))
      .module;
  const { resolveVisual } = await get("visual/resolve-visual.ts");
  const { checkArchYaml } = await get("spec/dialect/index.ts");
  const ast = checkArchYaml(
    'diagram: "1"\nzones: [{id: cloud, kind: cloud-region, provider: qlik, owner: saas}]\nnodes: [{id: a, parent: cloud}, {id: b}]\nvisual:\n  lanes: [{id: shared, title: Shared, role: targets}]\n  boxes: [{id: mixed, title: Mixed, lane: shared, members: [a, b]}]\n',
    new Set(),
  ).ast;
  const box = resolveVisual(ast, { hero: "qlik" }).lens.boxes.find((box) => box.id === "box:mixed");
  assert.equal(box.provider, undefined);
});
