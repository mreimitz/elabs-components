import assert from "node:assert/strict";
import { test } from "node:test";
import { runnerImport } from "vite";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const load = async (path) =>
  (await runnerImport(`${root}src/${path}`, { root, configFile: false, logLevel: "error" })).module;
const api = await load("server-surface.ts");
const { checkArchYaml } = await load("spec/dialect/index.ts");
const { compileArch } = await load("spec/compile/compile-arch.ts");
const { expandInstances, MAX_INLINE_ELEMENTS } = await load("spec/compose/inline.ts");
const { entryOf, pathsToDelete } = await load("state/entries.ts");
const { manualEdit } = await load("layout/layout-edits.ts");
const file = (text) => ({ text, mtime: 1 });
const doc = (nodes, extra = "") =>
  `diagram: "1"\n${extra}\nnodes:\n${nodes.map((node) => `  - ${JSON.stringify(node)}`).join("\n")}\n`;
const ref = (id, path = "leaf", expand = true) => ({ id, ref: `ws/${path}`, expand });
const leaf = doc(
  [{ id: "x" }, { id: "y" }],
  'title: Leaf\ncomponent: {description: Child diagram details}\nflows: ["x -> y"]',
);
const files = new Map([["leaf.yaml", file(leaf)]]);
const checked = (text, sources = {}) => api.checkText(text, api.ICON_NAMES, { files, ...sources });
const frozen = (value) => {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const item of Object.values(value)) frozen(item);
  }
  return value;
};
const type = (result, id) => result.spec.nodes.find((node) => node.id === id)?.type;

test("expanded instance owns real endpoints; synthetic origins are absent while wrapper stays authored", () => {
  const text = doc([ref("t"), { id: "a" }], 'flows: ["a -> t.x", "a -> t"]');
  const result = checked(text);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.deepEqual(result.spec.nodes.map((node) => node.id).sort(), ["a", "t", "t.x", "t.y"]);
  assert.equal(type(result, "t"), "arch/zone");
  assert.equal(
    result.spec.nodes.find((node) => node.id === "t").data.description,
    "Child diagram details",
  );
  assert.equal(result.spec.edges.length, 3);
  for (const node of result.spec.nodes.filter((node) => node.id.startsWith("t."))) {
    assert.equal(node.parent, "t");
    assert.equal(node.data.inner, true);
    assert.equal(entryOf(result, node.id), null);
  }
  assert.equal(entryOf(result, "t").kind, "node");
  const direct = result.spec.edges.find((edge) => edge.source === "a" && edge.target === "t.x");
  assert.ok(direct);
  assert.equal(direct.data.innerTarget, undefined);
  assert.equal(result.spec.edges.find((edge) => edge.target === "t").data.floating, true);
  assert.deepEqual(result.view.inner["t.x"], { component: "leaf.yaml", id: "x" });
  assert.deepEqual(pathsToDelete(result, ["t.x"], ["t.x->t.y"]), []);
  assert.deepEqual(pathsToDelete(result, ["t"], []), ["nodes[0]", "flows[0]", "flows[1]"]);
  assert.equal(result.ast.nodes.length, 2);
});
test("override expand and collapse are ephemeral, collapse wins, and source objects are immutable", () => {
  for (const authored of [false, true]) {
    const parsed = checkArchYaml(doc([ref("t", "leaf", authored)]), api.ICON_NAMES, { files });
    const before = JSON.stringify(parsed.ast);
    frozen(parsed.ast);
    for (const entry of parsed.components.values()) frozen(entry);
    const result = compileArch(parsed.ast, parsed.components, { expand: new Set(["t"]) });
    assert.equal(type(result, "t"), "arch/zone");
    const closed = compileArch(parsed.ast, parsed.components, {
      expand: new Set(["t"]),
      collapse: new Set(["t"]),
    });
    assert.equal(type(closed, "t"), "arch/composite");
    assert.equal(closed.spec.nodes.length, 1);
    assert.equal(JSON.stringify(parsed.ast), before);
  }
  assert.equal(type(checked(doc([ref("t")]), { collapse: new Set(["t"]) }), "t"), "arch/composite");
});
test("manual layout ignores authored or temporary expansion and retains positions", () => {
  for (const authored of [false, true]) {
    const text = doc(
      [{ ...ref("t", "leaf", authored), position: { x: 120, y: 40 } }],
      "layout: manual",
    );
    const result = checked(text, { expand: new Set(["t"]) });
    assert.equal(result.ok, true);
    assert.equal(type(result, "t"), "arch/composite");
    assert.deepEqual(result.spec.nodes[0].position, { x: 120, y: 40 });
    assert.equal(result.issues.filter((issue) => issue.code === "expand-ignored").length, 1);
    assert.ok(result.issues.find((issue) => issue.code === "expand-ignored").range);
  }
});
test("nested instances, zones, shared references and duplicate flow keys retain separate provenance", () => {
  const branch = doc(
    [ref("nested"), { id: "own", parent: "area" }],
    'zones: [{id: area, owner: partner}]\nflows: ["nested.x -> own"]',
  );
  const text = doc(
    [ref("left", "branch"), ref("right", "branch")],
    'flows: ["left.nested.x -> left.nested.y", "left.nested.x -> right.own"]',
  );
  const result = checked(text, { files: new Map([...files, ["branch.yaml", file(branch)]]) });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.equal(result.spec.nodes.find((node) => node.id === "left.own").parent, "left.area");
  assert.equal(result.spec.nodes.find((node) => node.id === "left.nested").data.inner, true);
  assert.deepEqual(result.view.inner["left.nested"], { component: "branch.yaml", id: "nested" });
  assert.deepEqual(result.view.inner["left.nested.x"], { component: "leaf.yaml", id: "x" });
  assert.equal(result.view.inner["left.nested.x->left.nested.y"], undefined); // outer authored flow
  assert.deepEqual(result.view.inner["left.nested.x->left.nested.y#2"], {
    component: "leaf.yaml",
    id: "x->y",
  });
  assert.ok(entryOf(result, "left.nested.x->left.nested.y"));
  assert.equal(entryOf(result, "left.nested.x->left.nested.y#2"), null);
  assert.equal(
    result.issues.some((issue) => issue.code === "inner-flow"),
    false,
  );
  const closed = checked(text, {
    files: new Map([...files, ["branch.yaml", file(branch)]]),
    collapse: new Set(["left.nested"]),
  });
  assert.equal(type(closed, "left.nested"), "arch/composite");
  assert.ok(
    closed.spec.edges.some(
      (edge) => edge.source === "left.nested" && edge.data.innerSource === "x",
    ),
  );
});
test("catalog inheritance, source styles and nodeStyle stay local; copied manual positions and notes do not leak", () => {
  const child = doc(
    [
      { id: "x", ref: "catalog/aws/rds", class: ["emphasis"] },
      { id: "empty", ref: "catalog/aws/rds", title: "", badges: [] },
    ],
    "nodeStyle: card\nstyles: {emphasis: {tone: success, badge: Child}}\nnotes: [{at: x, text: not imported}]",
  );
  const catalog = api.catalogLookupOf([
    { name: "aws/rds", vendor: "aws", label: "RDS", icon: "aws/rds" },
  ]);
  const result = checked(
    doc([ref("t")], "styles: {emphasis: {tone: destructive, badge: Parent}}"),
    { files: new Map([["leaf.yaml", file(child)]]), catalog },
  );
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  const data = result.spec.nodes.find((node) => node.id === "t.x").data;
  assert.equal(data.title, "RDS");
  assert.equal(data.variant, "card");
  assert.equal(data.tone, "success");
  assert.deepEqual(data.badges, ["Child"]);
  assert.equal(result.spec.nodes.find((node) => node.id === "t.empty").data.title, "");
  assert.equal(result.spec.nodes.length, 3);
  const manual = checked(doc([ref("t")]), {
    files: new Map([
      ["leaf.yaml", file(doc([{ id: "x", position: { x: 999, y: 888 } }], "layout: manual"))],
    ]),
  });
  assert.equal(manual.spec.nodes.find((node) => node.id === "t.x").position, undefined);
});
test("bounded shared expansion preserves whole source diagrams and reports a positioned limit", () => {
  const sources = new Map(
    Array.from({ length: 8 }, (_, level) => [
      `n${level}.yaml`,
      file(
        level === 7
          ? leaf
          : doc(Array.from({ length: 8 }, (_, i) => ref(`r${i}`, `n${level + 1}`))),
      ),
    ]),
  );
  const text = doc([ref("root", "n0")]);
  const result = checked(text, { files: sources });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.ok(result.spec.nodes.length + result.spec.edges.length <= MAX_INLINE_ELEMENTS + 1);
  assert.ok(result.issues.some((issue) => issue.code === "expand-limit" && issue.range));
  const nodeIds = new Set(result.spec.nodes.map((node) => node.id));
  for (const node of result.spec.nodes.filter((node) => node.type === "arch/zone")) {
    const own = result.spec.nodes.filter((child) => child.parent === node.id);
    assert.ok(own.length === 8 || own.length === 2, `${node.id} incomplete: ${own.length}`);
  }
  for (const edge of result.spec.edges)
    assert.ok(nodeIds.has(edge.source) && nodeIds.has(edge.target));
});
test("pure expander defends against cycles and depth even with an unchecked table", () => {
  const ast = checkArchYaml(doc([ref("t", "cycle")]), api.ICON_NAMES).ast;
  const child = checkArchYaml(doc([ref("again", "cycle")]), api.ICON_NAMES).ast;
  const table = new Map([
    [
      "cycle.yaml",
      { status: "ok", path: "cycle.yaml", ast: child, count: 1, title: "cycle", mtime: 1 },
    ],
  ]);
  const result = expandInstances(ast, table);
  assert.equal(result.ast.zones.length, 1);
  assert.equal(result.ast.nodes.length, 1);
  assert.equal(result.issues[0].code, "expand-limit");
});
test("manual write paths refuse synthetic moves and dropping into instance boundaries", () => {
  const text = doc([ref("t"), { id: "a" }]);
  const result = checked(text);
  assert.equal(
    manualEdit(
      [{ id: "a", position: { x: 10, y: 20 } }],
      [{ id: "a", into: "t", position: { x: 10, y: 20 } }],
      false,
    )(text, result),
    null,
  );
  assert.equal(
    manualEdit(
      [{ id: "t.x", position: { x: 10, y: 20 } }],
      [{ id: "t.x", into: null, position: { x: 10, y: 20 } }],
      false,
    )(text, result),
    null,
  );
  assert.equal(
    manualEdit([{ id: "t.x", position: { x: 10, y: 20 } }], [], false)(text, result),
    text,
  );
});
