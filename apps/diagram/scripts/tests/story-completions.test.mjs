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
const {
  module: { storyFlowCompletions },
} = await runnerImport(`${root}/src/editor/story-completions.ts`, {
  root,
  configFile: false,
  logLevel: "error",
});
for (const [name, source, value] of [
  ["plain qualified target", "targets: [a, tenant.q@@] # keep", "tenant.qca"],
  ["quoted forward flow", 'targets: [a, "source -> tar@@", b] # keep', "source -> target"],
  ["single quoted back flow", "targets: ['source <- tar@@'] # keep", "source <- target"],
  ["block list", "targets:\n        - 'source <-> tar@@' # keep", "source <-> target"],
  ["empty item", "targets: [@@] # keep", "source -> target"],
  ["second empty item", "targets: [a, @@] # keep", "source -> target"],
])
  test(name, () => {
    const input = `story:\n  steps:\n    - title: A\n      ${source}`;
    const cursor = input.indexOf("@@"),
      text = input.replace("@@", "");
    const ctx = yamlContext(text, cursor);
    assert.equal(ctx?.key, "targets");
    assert.equal(ctx?.kind, "value");
    assert.deepEqual(ctx.path.slice(0, 4), ["story", "steps", 0, "targets"]);
    const changed = text.slice(0, ctx.from) + JSON.stringify(value) + text.slice(ctx.to);
    const doc = parseDocument(changed);
    assert.deepEqual(doc.errors, []);
    assert(doc.toJS().story.steps[0].targets.includes(value));
    assert(changed.endsWith("# keep"));
  });
test("flow suggestions retain direction and exclude ambiguous expressions", () => {
  const text =
    'diagram: "1"\nnodes: [{id: a}, {id: b}, {id: c}]\nflows:\n  - a <- b: Reverse\n  - b <-> c\n  - a -> c\n  - a -> c: Parallel\n';
  assert.deepEqual(storyFlowCompletions(text), [
    { value: "a <- b", label: "Reverse" },
    { value: "b <-> c", label: undefined },
  ]);
});
test("story text remains prose", () => {
  const text =
    "story:\n  steps:\n    - title: A\n      targets: [a]\n      text: |\n        targets: [a -> b]\n";
  assert.equal(yamlContext(text, text.indexOf("a -> b") + 4), null);
});

for (const source of [
  'targets: ["source -> tar@@',
  "targets:\n        - 'source -> tar@@",
  "targets: [sou@@",
])
  test(`incomplete target ${source}`, () => {
    const input = `story:\n  steps:\n    - title: A\n      ${source}`;
    const offset = input.indexOf("@@"),
      text = input.replace("@@", "");
    const ctx = yamlContext(text, offset);
    assert.equal(ctx?.key, "targets");
    assert.equal(ctx.to, text.length);
  });

test("suggest flows while the target quote or sequence is still open", () => {
  for (const partial of ['targets: ["a -> ', "targets:\n        - 'a -> "]) {
    const text = `diagram: "1"\nnodes: [{id: a}, {id: b}]\nflows: [a -> b]\nstory:\n  steps:\n    - title: A\n      ${partial}`;
    assert.deepEqual(storyFlowCompletions(text), [{ value: "a -> b", label: undefined }]);
  }
});
test("inverse spellings of the same flow are ambiguous too", () => {
  for (const flows of ["a -> b, b <- a", "a <-> b, b <-> a"]) {
    assert.deepEqual(
      storyFlowCompletions(`diagram: "1"\nnodes: [{id: a}, {id: b}]\nflows: [${flows}]`),
      [],
    );
  }
});

test("unfinished aliases do not throw from the completion provider", () => {
  assert.deepEqual(storyFlowCompletions('diagram: "1"\nflows: *unfinished'), []);
});
