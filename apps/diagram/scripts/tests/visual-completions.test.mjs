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
  module: { visualIds },
} = await runnerImport(`${root}/src/editor/visual-completions.ts`, {
  root,
  configFile: false,
  logLevel: "error",
});
for (const body of [
  "hide: [tenant.q@@] # keep",
  "controlPlane:\n    - 'tenant.q@@' # keep",
  "boxes:\n    - id: service\n      members: [source, tenant.q@@] # keep",
  'boxes:\n    - id: service\n      sub: ["tenant.q@@"] # keep',
  "lanes:\n    - id: cloud\n      of: [tenant.q@@] # keep",
  "boxes:\n    - id: service\n      processes: [ing@@] # keep",
])
  test(`visual scalar completion ${body}`, () => {
    const input = `visual:\n  ${body}`;
    const at = input.indexOf("@@"),
      text = input.replace("@@", "");
    const ctx = yamlContext(text, at);
    assert.equal(ctx?.kind, "value");
    assert.equal(ctx.path[0], "visual");
    assert(["hide", "controlPlane", "members", "sub", "of", "processes"].includes(ctx.key));
    const next = text.slice(0, ctx.from) + '"tenant.qca"' + text.slice(ctx.to);
    assert.deepEqual(parseDocument(next).errors, []);
    assert(next.endsWith("# keep"));
  });
test("visual identifiers come from the current buffer and tolerate unfinished input", () => {
  const text =
    'visual:\n  lanes: [{id: cloud, title: Cloud}]\n  boxes: [{id: app, title: Application}, {id: app}]\n  flows:\n    - from: "';
  assert.deepEqual(visualIds(text, "lanes"), [{ id: "cloud", title: "Cloud" }]);
  assert.deepEqual(visualIds(text, "boxes"), [{ id: "app", title: "Application" }]);
  assert.deepEqual(visualIds("visual: *unfinished", "boxes"), []);
});
