import assert from "node:assert/strict";
import { test } from "node:test";
import { runnerImport } from "vite";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const { module: api } = await runnerImport(`${root}src/server-surface.ts`, {
  root,
  configFile: false,
  logLevel: "error",
});
const { module: resolver } = await runnerImport(`${root}src/spec/compose/resolver.ts`, {
  root,
  configFile: false,
  logLevel: "error",
});
const doc = (nodes, extra = "") =>
  `diagram: "1"\n${extra}\nnodes:\n${nodes.map((n) => `  - ${JSON.stringify(n)}`).join("\n")}\n`;
const ref = (path, id = "child") => ({ id, ref: `ws/${path}` });
const file = (text) => ({ text, mtime: 1 });
const leaf = doc(
  [{ id: "inside", ref: "catalog/aws/rds" }],
  "title: Child\ncomponent: {icon: aws/rds, description: Child details}",
);
const entries = [{ name: "aws/rds", vendor: "aws", label: "RDS inherited", icon: "aws/rds" }];
const check = (text, files) =>
  api.checkDiagramResolved(text, async (path) => files.get(path) ?? null, entries);

test("resolved metadata and catalog-filled child AST; authored overrides survive", async () => {
  const files = new Map([["Team Space/leaf.yaml", file(leaf)]]);
  const checked = await check(doc([ref("Team Space/leaf")]), files);
  assert.equal(checked.ok, true, JSON.stringify(checked.issues));
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(checked.spec.nodes[0].data).filter(([k]) =>
        ["title", "icon", "description", "count", "pending"].includes(k),
      ),
    ),
    { title: "Child", icon: "aws/rds", description: "Child details", count: 1 },
  );
  const table = resolver.buildComponentTable(checked.ast, files, {
    catalog: api.catalogLookupOf(entries),
    iconNames: api.ICON_NAMES,
  });
  assert.equal(table.get("Team Space/leaf.yaml").ast.nodes[0].title, "RDS inherited");
  const authored = await check(
    doc([{ ...ref("Team Space/leaf.yaml"), title: "Own", icon: "aws/lambda", description: "" }]),
    files,
  );
  assert.equal(authored.spec.nodes[0].data.title, "Own");
  assert.equal(authored.spec.nodes[0].data.icon, "aws/lambda");
  assert.equal(authored.spec.nodes[0].data.description, "");
});
test("missing, invalid, newer dialect and recursive aliases become positioned failures", async () => {
  for (const [value, code] of [
    [null, "ref-missing"],
    [file("diagram: ["), "ref-invalid"],
    [file(doc([{ id: "x", type: "nonsense" }])), "ref-invalid"],
    [file('diagram: "99"'), "ref-invalid"],
    [file('diagram: "1"\nx: &a [*a]'), "ref-invalid"],
    [{ error: "offline" }, "ref-invalid"],
  ]) {
    const checked = await check(doc([ref("bad")]), new Map([["bad.yaml", value]]));
    assert.equal(checked.ok, false);
    const issue = checked.issues.find((i) => i.code === code);
    assert.ok(issue?.range, JSON.stringify(checked.issues));
    assert.equal(checked.spec.nodes[0].data.broken, true);
  }
});
test("cycles, self references, and depth limits do not depend on shared dependency order", async () => {
  for (const self of [true, false]) {
    const files = new Map([
      ["a.yaml", file(doc([ref(self ? "a" : "b")]))],
      ["b.yaml", file(doc([ref("a")]))],
    ]);
    assert.ok((await check(doc([ref("a")]), files)).issues.some((i) => i.code === "ref-cycle"));
  }
  const files = new Map(
    Array.from({ length: 9 }, (_, i) => [
      `n${i}.yaml`,
      file(i === 8 ? doc([{ id: "leaf" }]) : doc([ref(`n${i + 1}`)])),
    ]),
  );
  for (const nodes of [
    [ref("n8", "short"), ref("n0", "long")],
    [ref("n0", "long"), ref("n8", "short")],
  ]) {
    const checked = await check(doc(nodes), files);
    assert.equal(checked.issues.filter((i) => i.code === "ref-depth").length, 1);
    assert.equal(checked.spec.nodes.find((n) => n.id === "short").data.broken, undefined);
    assert.equal(checked.spec.nodes.find((n) => n.id === "long").data.broken, true);
  }
});
test("inner endpoints traverse nested refs; broken children do not cascade endpoint errors", async () => {
  const files = new Map([
    ["a.yaml", file(doc([ref("b", "nested")]))],
    ["b.yaml", file(doc([{ id: "inside" }]))],
  ]);
  for (const [end, ok] of [
    ["child.nested.inside", true],
    ["child.nested.nope", false],
    ["child.nope", false],
    ["child.nested.inside.again", false],
  ]) {
    const checked = await check(doc([ref("a"), { id: "out" }], `flows: ["${end} -> out"]`), files);
    assert.equal(checked.ok, ok, JSON.stringify(checked.issues));
  }
  files.set("b.yaml", null);
  const checked = await check(
    doc([ref("a"), { id: "out" }], 'flows: ["child.nested.nope -> out"]'),
    files,
  );
  assert.equal(
    checked.issues.some((i) => i.code === "unknown-endpoint"),
    false,
  );
});
test("loads once per dependency; missing and errors remain terminal until invalidated", async () => {
  const ast = api.checkDiagram(
    doc([ref("missing"), ref("missing", "again"), ref("bad", "bad")]),
  ).ast;
  const calls = [];
  const loaded = await resolver.loadComponentFiles(ast, async (path) => {
    calls.push(path);
    if (path === "bad.yaml") throw Error("offline");
    return null;
  });
  assert.deepEqual(calls.sort(), ["bad.yaml", "missing.yaml"]);
  assert.deepEqual(resolver.neededFiles(ast, loaded), []);
  loaded.delete("missing.yaml");
  assert.deepEqual(resolver.neededFiles(ast, loaded), ["missing.yaml"]);
});
test("file identity includes content, not only mtime; resolved state has no stale cache", async () => {
  const files = new Map([["leaf.yaml", file(doc([{ id: "first" }], "title: First"))]]);
  const parent = doc([ref("leaf")]);
  assert.equal((await check(parent, files)).spec.nodes[0].data.title, "First");
  files.set("leaf.yaml", file(doc([{ id: "second" }], "title: Second")));
  assert.equal((await check(parent, files)).spec.nodes[0].data.title, "Second");
  files.delete("leaf.yaml");
  assert.equal((await check(parent, files)).spec.nodes[0].data.broken, true);
});

test("invalid inner endpoints inside a referenced file are invalid diagrams", async () => {
  const files = new Map([
    ["a.yaml", file(doc([ref("b", "nested"), { id: "out" }], 'flows: ["nested.nope -> out"]'))],
    ["b.yaml", file(doc([{ id: "inside" }]))],
  ]);
  const result = await check(doc([ref("a")]), files);
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((i) => i.code === "ref-invalid" && i.message.includes('no id "nope"')),
  );
});

test("dotted endpoints cannot descend into catalog items", async () => {
  const files = new Map([["leaf.yaml", file(leaf)]]);
  const checked = await check(
    doc([ref("leaf"), { id: "out" }], 'flows: ["child.inside.invented -> out"]'),
    files,
  );
  assert.equal(checked.ok, false);
  const issue = checked.issues.find((issue) => issue.code === "unknown-endpoint");
  assert.ok(issue?.range);
  assert.match(issue.message, /does not reference a diagram/);
});
