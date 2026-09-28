import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
import { parse } from "yaml";
const root = fileURLToPath(new URL("../../", import.meta.url));
const load = async (path) =>
  (await runnerImport(`${root}src/${path}`, { root, configFile: false, logLevel: "error" })).module;
const api = await load("server-surface.ts");
const { resolveVisual } = await load("visual/resolve-visual.ts");
const { materializeVisual } = await load("visual/materialize.ts");
const { checkArchYaml } = await load("spec/dialect/index.ts");
const { buildArchSchema } = await load("spec/dialect/schema.ts");
const simple =
  'diagram: "1"\nzones: [{id: z, owner: customer, kind: on-prem}]\nnodes: [{id: a, parent: z}, {id: b, parent: z}, {id: c, type: actor}]\nflows: ["a -> c"]\n';
const visual = {
  lanes: [{ id: "named", role: "sources", title: "Inputs", of: ["z"] }],
  boxes: [
    {
      id: "ab",
      lane: "named",
      title: "Things",
      members: ["a", "b"],
      sub: ["a"],
      processes: ["storage"],
    },
  ],
  controlPlane: ["a"],
};
const check = (text, sources = {}) => api.checkText(text, api.ICON_NAMES, sources);
const errors = (result) => result.issues.filter((i) => i.severity === "error");
const text = (v) => `${simple}visual: ${JSON.stringify(v)}\n`;
const resolve = (yaml, sources = {}) => {
  const c = check(yaml, sources);
  assert.deepEqual(errors(c), []);
  return resolveVisual(c.ast, { catalog: sources.catalog, components: c.components });
};
test("typed visual, named lanes, control plane and subsets retain technical graph", () => {
  const checked = check(text(visual));
  assert.deepEqual(errors(checked), []);
  const result = resolveVisual(checked.ast);
  assert.deepEqual(result.issues, []);
  const box = result.lens.boxes.find((b) => b.id === "box:ab");
  assert.equal(box.lane, "named");
  assert.equal(box.controlPlane, true);
  assert.deepEqual(box.sub, ["a"]);
  assert.equal(result.lens.boxes.flatMap((b) => b.members).length, 3);
  assert.equal(checked.ast.nodes.length, 3);
  assert.equal(buildArchSchema().properties.visual.additionalProperties, false);
});
test("malformed visual and cross references produce positioned errors", () => {
  for (const v of [
    { boxes: "bad" },
    { boxes: [{ id: "a", lane: "x", title: "A", members: ["unknown"] }] },
    { ...visual, hide: ["a"] },
    {
      ...visual,
      boxes: [...visual.boxes, { id: "other", lane: "named", title: "Other", members: ["a"] }],
    },
    { ...visual, boxes: [{ ...visual.boxes[0], sub: ["c"] }] },
    { ...visual, boxes: [{ ...visual.boxes[0], processes: ["invented"] }] },
    { ...visual, lanes: [{ ...visual.lanes[0], of: ["missing"] }] },
    { flows: [{ from: "missing", to: "unknown" }] },
    { ...visual, controlPlane: ["a", "a"] },
  ]) {
    const result = check(text(v));
    assert.ok(errors(result).length, JSON.stringify(v));
    assert.ok(errors(result).every((i) => i.range?.start.line > 0));
  }
});
test("partial structure, hide, zone roles and hero derive without invented metadata", () => {
  const a = resolve(text({ hide: ["b"], lanes: visual.lanes })).lens;
  assert.equal(
    a.boxes.flatMap((b) => b.members).some((m) => m.id === "b"),
    false,
  );
  assert.equal(a.boxes.find((b) => b.members.some((m) => m.id === "a")).lane, "named");
  const ast = check(simple.replace("kind: on-prem", "kind: on-prem, role: targets")).ast;
  assert.equal(
    resolveVisual(ast).lens.boxes.find((b) => b.members.some((m) => m.id === "a")).lane,
    "targets",
  );
  const hero = check(
    simple.replace("owner: customer, kind: on-prem", "owner: saas, provider: qlik"),
  ).ast;
  assert.equal(
    resolveVisual(hero, { hero: "qlik" }).lens.boxes.find((b) =>
      b.members.some((m) => m.id === "a"),
    ).lane,
    "vendor-cloud",
  );
});
test("flow aggregation preserves kind and direction with per-pair metadata overrides", () => {
  const yaml =
    'diagram: "1"\nnodes: [{id: a}, {id: b}]\nflows:\n - a -> b\n - b -> a: {kind: control}\nvisual: ' +
    JSON.stringify({
      boxes: [
        { id: "left", lane: "sources", title: "Left", members: ["a"] },
        { id: "right", lane: "targets", title: "Right", members: ["b"] },
      ],
      flows: [{ from: "left", to: "right", label: "VPN", process: "elt" }],
    });
  const { lens } = resolve(yaml);
  assert.equal(lens.flows.length, 2);
  assert.deepEqual(
    lens.flows.map((f) => [f.kind, f.from, f.to, f.bidirectional]),
    [
      ["data", "box:left", "box:right", false],
      ["other", "box:right", "box:left", false],
    ],
  );
  assert.equal(lens.flows[0].label, "VPN");
  assert.equal(lens.flows[1].label, "VPN");
  const both = resolve(yaml.replace("kind: control", "kind: data")).lens.flows;
  assert.equal(both.length, 1);
  assert.equal(both[0].bidirectional, true);
});
test("bounded qualified members accept inner nodes and reject catalog-leaf traversal", () => {
  const files = new Map([
    [
      "child.yaml",
      {
        mtime: 1,
        text: 'diagram: "1"\nnodes: [{id: inner}, {id: cat, ref: catalog/generic/users}]\n',
      },
    ],
  ]);
  const head = 'diagram: "1"\nnodes: [{id: ref, ref: ws/child}]\n';
  const v = {
    boxes: [{ id: "innerbox", lane: "sources", title: "Inner", members: ["ref.inner"] }],
  };
  const good = checkArchYaml(head + "visual: " + JSON.stringify(v), api.ICON_NAMES, { files });
  assert.deepEqual(errors(good), []);
  assert.equal(
    resolveVisual(good.ast, { components: good.components }).lens.boxes[0].members[0].id,
    "ref.inner",
  );
  for (const id of ["ref.missing", "ref.cat.invented", "ref.inner.x"])
    assert.ok(
      errors(
        check(
          head + "visual: " + JSON.stringify({ ...v, boxes: [{ ...v.boxes[0], members: [id] }] }),
          { files },
        ),
      ).length,
      id,
    );
});
test("materialize preserves comments, scalars, aliases, CRLF and nonvisual semantics", () => {
  const lens = resolve(simple).lens;
  const cases = [
    simple + "# footer\n",
    simple + "visual:\n  hide: [b] # old comment\n# after\ntitle: Keep\n",
    simple + "visual: &v { hide: [b] } # old\nextra: *v\n",
    simple + "extra: &v {hide: [b]}\nvisual: *v # alias\n",
    '{diagram: "1", nodes: [{id: a}], title: "Keep"}\n',
    simple + "description: |\n  hello\n  world\n",
  ];
  for (const source of cases)
    for (const eol of ["\n", "\r\n"]) {
      const input = source.replaceAll("\n", eol);
      const actualLens = input.startsWith("{") ? resolve(input).lens : lens;
      const result = materializeVisual(input, actualLens);
      assert.equal(result.ok, true, result.reason + " " + input);
      const before = parse(input),
        after = parse(result.text);
      delete before.visual;
      delete after.visual;
      assert.deepEqual(after, before);
      assert.deepEqual(errors(check(result.text)), []);
      assert.equal(materializeVisual(result.text, actualLens).text, result.text);
      for (const comment of ["# footer", "# old comment", "# after", "# alias"])
        if (input.includes(comment)) assert.ok(result.text.includes(comment), comment);
    }
});
test("all shipped templates retain valid typed visual structures", async () => {
  for (const file of await readdir(`${root}workspace/templates`)) {
    if (!file.endsWith(".yaml")) continue;
    const result = check(await readFile(`${root}workspace/templates/${file}`, "utf8"));
    assert.deepEqual(
      errors(result).filter((i) => i.path.startsWith("visual")),
      [],
      file,
    );
  }
});
test("authored component visuals inherit once, parent membership wins and materialize remains equivalent", () => {
  const child =
    'diagram: "1"\nnodes: [{id: a}, {id: b}, {id: hidden}]\nflows: ["a -> b"]\nvisual: ' +
    JSON.stringify({
      hide: ["hidden"],
      boxes: [
        { id: "input", lane: "sources", title: "Input", members: ["a"] },
        { id: "output", lane: "targets", title: "Output", members: ["b"] },
      ],
    });
  const files = new Map([["child.yaml", { mtime: 1, text: child }]]);
  const source =
    'diagram: "1"\nnodes: [{id: child, ref: ws/child}, {id: end, type: actor}]\nflows: ["child.b -> end"]\n';
  const checked = checkArchYaml(source, api.ICON_NAMES, { files });
  assert.deepEqual(errors(checked), []);
  const before = JSON.stringify(checked.ast);
  const result = resolveVisual(checked.ast, { components: checked.components });
  assert.deepEqual(result.issues, []);
  assert.equal(JSON.stringify(checked.ast), before);
  const members = result.lens.boxes.flatMap((box) => box.members.map((m) => m.id));
  assert.deepEqual(members.sort(), ["child.a", "child.b", "end"]);
  assert.equal(result.lens.flows.length, 2);
  assert.deepEqual(result.lens.hidden, ["child.hidden"]);
  const output = materializeVisual(source, result.lens);
  assert.equal(output.ok, true, output.reason);
  const after = checkArchYaml(output.text, api.ICON_NAMES, { files });
  assert.deepEqual(errors(after), []);
  const again = resolveVisual(after.ast, { components: after.components });
  assert.deepEqual(again.issues, []);
  assert.equal(again.lens.boxes.length, result.lens.boxes.length);
  assert.equal(again.lens.lanes.length, result.lens.lanes.length);
  assert.equal(again.lens.flows.length, 2);
  const overridden = checkArchYaml(
    source +
      "visual: " +
      JSON.stringify({
        boxes: [{ id: "mine", lane: "targets", title: "Override", members: ["child.a"] }],
      }),
    api.ICON_NAMES,
    { files },
  );
  const lens = resolveVisual(overridden.ast, { components: overridden.components }).lens;
  assert.equal(lens.boxes.filter((box) => box.members.some((m) => m.id === "child.a")).length, 1);
  assert.equal(
    lens.boxes.find((box) => box.members.some((m) => m.id === "child.a")).title,
    "Override",
  );
});
test("capability and supported catalog tags are explicit grouping signals", () => {
  const source =
    'diagram: "1"\nnodes: [{id: a, icon: aws/lambda}, {id: b, icon: aws/rds}, {id: c, icon: aws/s3}]';
  const catalog = new Map([
    [
      "aws/lambda",
      {
        name: "aws/lambda",
        vendor: "aws",
        icon: "aws/lambda",
        label: "Lambda",
        capability: "Compute",
        tags: ["transform", "unknown"],
      },
    ],
    [
      "aws/rds",
      {
        name: "aws/rds",
        vendor: "aws",
        icon: "aws/rds",
        label: "RDS",
        capability: "Compute",
        tags: ["storage"],
      },
    ],
  ]);
  const lens = resolveVisual(check(source).ast, { catalog }).lens;
  const compute = lens.boxes.find((box) => box.title === "Compute");
  assert.deepEqual(
    compute.members.map((m) => m.id),
    ["a", "b"],
  );
  assert.deepEqual(compute.processes, ["transform", "storage"]);
  assert.equal(compute.provider, "aws");
  assert.equal(lens.boxes.length, 2);
});
test("inherited expansion budget is deterministic for a repeated DAG", () => {
  const leaf = checkArchYaml(
    'diagram: "1"\nnodes: [{id: a}, {id: b}]\nvisual: {}',
    api.ICON_NAMES,
  ).ast;
  const table = new Map();
  let previous = leaf;
  for (let depth = 7; depth >= 0; depth--) {
    const path = `c${depth}.yaml`;
    table.set(path, {
      status: "ok",
      path,
      mtime: 1,
      ast: previous,
      title: path,
      count: previous.nodes.length,
    });
    previous = {
      ...leaf,
      nodes: Array.from({ length: 4 }, (_, i) => ({
        ...leaf.nodes[0],
        id: `r${i}`,
        ref: `ws/c${depth}`,
      })),
    };
  }
  const before = JSON.stringify(previous);
  const result = resolveVisual(previous, { components: table });
  assert.ok(result.issues.some((i) => /budget/.test(i.message)));
  assert.ok(result.lens.boxes.flatMap((b) => b.members).length <= 1000);
  assert.equal(JSON.stringify(previous), before);
});

test("materialized parallel annotated flows remain valid without duplicate overrides", () => {
  const yaml =
    'diagram: "1"\nnodes: [{id: a}, {id: b}]\nflows: ["a -> b", {from: b, to: a, kind: control}]\nvisual: ' +
    JSON.stringify({
      boxes: [
        { id: "a", lane: "sources", title: "A", members: ["a"] },
        { id: "b", lane: "targets", title: "B", members: ["b"] },
      ],
      flows: [{ from: "a", to: "b", label: "VPN" }],
    });
  const lens = resolve(yaml).lens;
  const written = materializeVisual(yaml, lens);
  assert.equal(written.ok, true, written.reason);
  assert.deepEqual(errors(check(written.text)), []);
  assert.equal(resolve(written.text).lens.flows.length, 2);
});

test("invalid parent cycles return positioned diagnostics without hanging visual validation", () => {
  for (const owner of ["customer", "saas"]) {
    const result = check(
      'diagram: "1"\nzones: [{id: a, parent: b, owner: ' +
        owner +
        "}, {id: b, parent: a}, {id: unrelated, owner: saas}]\nnodes: [{id: n, parent: a}, {id: m, parent: unrelated}]\nvisual: {}",
    );
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "parent-cycle" && i.range?.start.line > 0));
  }
});

test("qualified lane assignments override child lanes and hiding ancestors rejects control descendants", () => {
  const files = new Map([
    [
      "child.yaml",
      {
        mtime: 1,
        text: 'diagram: "1"\nzones: [{id: z, owner: customer}]\nnodes: [{id: x, parent: z}]\nvisual: {}',
      },
    ],
  ]);
  const source = 'diagram: "1"\nnodes: [{id: child, ref: ws/child}]\n';
  const result = checkArchYaml(
    source +
      "visual: " +
      JSON.stringify({
        lanes: [{ id: "custom", role: "sources", title: "Custom", of: ["child.z"] }],
      }),
    api.ICON_NAMES,
    { files },
  );
  assert.deepEqual(errors(result), []);
  const lens = resolveVisual(result.ast, { components: result.components }).lens;
  assert.equal(
    lens.boxes.find((box) => box.members.some((m) => m.id === "child.x")).lane,
    "custom",
  );
  const hidden = checkArchYaml(
    source + "visual: " + JSON.stringify({ hide: ["child"], controlPlane: ["child.x"] }),
    api.ICON_NAMES,
    { files },
  );
  assert.ok(errors(hidden).some((i) => i.path === "visual.controlPlane[0]"));
});

test("visual overrides cannot invent technical connectivity", () => {
  const source =
    'diagram: "1"\nnodes: [{id: a}, {id: b}]\nvisual: ' +
    JSON.stringify({
      boxes: [
        { id: "a", lane: "sources", title: "A", members: ["a"] },
        { id: "b", lane: "targets", title: "B", members: ["b"] },
      ],
      flows: [{ from: "a", to: "b", label: "Invented" }],
    });
  const result = check(source);
  assert.ok(errors(result).some((i) => i.path === "visual.flows[0]" && i.range?.start.line > 0));
});

test("authored boxes retain technical ownership even when default grouping folds a network aside", () => {
  const yaml =
    'diagram: "1"\nzones: [{id: outer, owner: customer, children: [{id: inner, kind: on-prem, children: [{id: a}]}]}]\nnodes: [{id: b}]\nflows: [{from: a, to: b, kind: network}]\nvisual: {lanes: [{id: source, role: sources, title: Sources}], boxes: [{id: source, lane: source, title: Authored source, members: [a]}]}\n';
  const result = resolve(yaml);
  assert.equal(result.lens.boxes.find((box) => box.id === "box:source").owner, "customer");
});

test("nested qualified ownership follows the immediate reference instance's containing zone", () => {
  const files = new Map([
    [
      "child.yaml",
      {
        mtime: 1,
        text: 'diagram: "1"\nzones: [{id: managed, owner: saas, children: [{id: inner, ref: ws/leaf}]}]\n',
      },
    ],
    ["leaf.yaml", { mtime: 1, text: 'diagram: "1"\nnodes: [{id: x}]\n' }],
  ]);
  const yaml =
    'diagram: "1"\nzones: [{id: outer, owner: customer, children: [{id: child, ref: ws/child}]}]\nvisual: {boxes: [{id: x, lane: sources, title: X, members: [child.inner.x]}]}\n';
  const checked = checkArchYaml(yaml, api.ICON_NAMES, { files });
  assert.deepEqual(errors(checked), []);
  const result = resolveVisual(checked.ast, { components: checked.components });
  assert.equal(result.lens.boxes.find((box) => box.id === "box:x").owner, "saas");
});
