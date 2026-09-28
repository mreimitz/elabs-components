import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const load = async (path) =>
  (await runnerImport(`${root}src/${path}`, { root, configFile: false, logLevel: "error" })).module;
const api = await load("server-surface.ts");
const { upgradeText } = await load("spec/dialect/upgrade.ts");
const { buildArchSchema } = await load("spec/dialect/schema.ts");
const { resolveStory } = await load("story/resolve-story.ts");
const check = (text, sources = {}) => api.checkText(text, api.ICON_NAMES, sources);
const base =
  'diagram: "1"\nnodes: [{id: a}, {id: b}, {id: c}]\nflows:\n  - a -> b: {step: 3, label: Forward}\n  - a <- c: {step: 1, label: Backward}\n';
const doc = (steps, extra = {}) => `${base}\nstory: ${JSON.stringify({ steps, ...extra })}\n`;
const step = (targets = ["a"]) => ({ title: "First", targets });
const errors = (result) => result.issues.filter((i) => i.severity === "error");

test("explicit story types/defaults and empty suppression preserve implicit grouped ordering", () => {
  const implicit = check(base);
  assert.deepEqual(
    implicit.view.story.steps.map((s) => s.id),
    ["step:1", "step:3"],
  );
  const grouped = check(base.replace("step: 3", "step: 1"));
  assert.equal(grouped.view.story.steps.length, 1);
  assert.equal(grouped.view.story.steps[0].edgeIds.length, 2);
  const empty = check(doc([]));
  assert.deepEqual(empty.view.story.steps, []);
  assert.equal(empty.view.story.explicit, true);
  const explicit = check(
    doc([{ ...step(), text: "**Narration**", callouts: [{ at: "b", text: "A label" }] }], {
      autoplay: true,
    }),
  );
  assert.deepEqual(errors(explicit), []);
  assert.equal(explicit.ast.story.steps[0].duration, 8);
  assert.equal(explicit.view.story.steps[0].duration, 8);
  assert.deepEqual(explicit.view.story.steps[0].nodeIds, ["a", "b"]);
  assert.equal(
    explicit.issues.find((i) => i.code === "story-autoplay-reserved").path,
    "story.autoplay",
  );
});

test("schema and normalization reject malformed stories as a whole with positioned issues", () => {
  for (const steps of [
    [{ ...step(), title: "   " }],
    [{ ...step(), targets: [] }],
    [{ ...step(), targets: [" "] }],
    [{ ...step(), duration: 0 }],
    [{ ...step(), duration: 301 }],
    [{ ...step(), duration: "8" }],
    [{ ...step(), callouts: [{ at: "a", text: " " }] }],
    [step(), { title: "Bad", targets: 4 }],
  ]) {
    const result = check(doc(steps));
    assert.ok(errors(result).length, JSON.stringify(steps));
    assert.ok(errors(result).every((i) => i.range?.start.line > 0));
    assert.deepEqual(result.view.story.steps, []);
    assert.equal(result.view.story.explicit, true);
  }
  for (const duration of [".nan", ".inf", "-.inf"]) {
    const result = check(
      `${base}\nstory:\n  steps:\n    - title: Bad\n      targets: [a]\n      duration: ${duration}\n`,
    );
    assert.ok(errors(result).some((i) => i.path === "story.steps[0].duration"));
  }
  const schema = buildArchSchema().properties.story;
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.steps.maxItems, 100);
  assert.equal(schema.properties.steps.items.properties.duration.maximum, 300);
});

test("story limits reject oversized lists without partial playback", () => {
  for (const steps of [
    Array.from({ length: 101 }, () => step()),
    [{ ...step(), targets: Array(101).fill("a") }],
    [{ ...step(), callouts: Array.from({ length: 21 }, () => ({ at: "a", text: "x" })) }],
  ]) {
    const checked = check(doc(steps));
    assert.ok(errors(checked).length);
    assert.deepEqual(checked.view.story.steps, []);
  }
  assert.deepEqual(
    errors(
      check(
        doc([
          { ...step(), duration: 1 },
          { ...step(), duration: 300 },
        ]),
      ),
    ),
    [],
  );
});

test("flow targets resolve semantic arrows, written sequence and reverse direction", () => {
  const result = check(doc([step(["a -> b", "a <- c"])]));
  assert.deepEqual(errors(result), []);
  assert.deepEqual(result.view.story.steps[0].follow, [
    { edgeId: "a->b", reverse: false },
    { edgeId: "a->c", reverse: true },
  ]);
  const reversed = check(doc([step(["c -> a"])]));
  assert.deepEqual(reversed.view.story.steps[0].edgeIds, ["a->c"]);
  assert.equal(reversed.view.story.steps[0].follow[0].reverse, true);
  const both = check(doc([step(["b <-> a"])]).replace("a -> b:", "a <-> b:"));
  assert.deepEqual(errors(both), []);
  assert.equal(both.view.story.steps[0].follow[0].reverse, false);
});

test("unknown, ambiguous, malformed flow and callout targets are positioned errors", () => {
  for (const targets of [["missing"], ["a -> c"], ["a => b"], ["a.extra"]]) {
    const result = check(doc([step(targets)]));
    assert.ok(
      errors(result).some(
        (i) => i.code === "unknown-story-target" && i.path === "story.steps[0].targets[0]",
      ),
    );
    assert.deepEqual(result.view.story.steps, []);
  }
  const duplicate = check(
    doc([step(["a -> b"])]).replace("  - a <- c:", "  - a -> b: Duplicate\n  - a <- c:"),
  );
  assert.ok(errors(duplicate).some((i) => i.code === "ambiguous-story-target"));
  const callout = check(doc([{ ...step(), callouts: [{ at: "a -> b", text: "No" }] }]));
  assert.ok(errors(callout).some((i) => i.path === "story.steps[0].callouts[0].at"));
});

test("qualified targets follow bounded diagram references but never catalog leaves", () => {
  const child =
    'diagram: "1"\nnodes: [{id: x}, {id: y}, {id: catalog, ref: catalog/aws/rds}]\nflows: ["x -> y"]\n';
  const files = new Map([["child.yaml", { text: child, mtime: 1 }]]);
  const parent =
    'diagram: "1"\nnodes: [{id: t, ref: ws/child}]\nstory: ' +
    JSON.stringify({ steps: [step(["t.x -> t.y", "t"])] });
  const result = check(parent, { files });
  assert.deepEqual(errors(result), []);
  assert.deepEqual(result.view.story.steps[0].edgeIds, ["t.x->t.y"]);
  assert.deepEqual(result.view.story.steps[0].expand, ["t"]);
  for (const target of ["t.missing", "t.catalog.fake", "t.x.fake"]) {
    const bad = check(parent.replace('"t.x -> t.y"', JSON.stringify(target)), { files });
    assert.ok(
      errors(bad).some((i) => i.code === "unknown-story-target"),
      target,
    );
  }
  const pending = check(parent);
  assert.deepEqual(errors(pending), []);
  const missing = check(parent, { files: new Map([["child.yaml", null]]) });
  assert.ok(errors(missing).length);
  const cycleText = 'diagram: "1"\nnodes: [{id: t, ref: ws/child}]\n';
  const cyc = check(parent.replace('"t.x -> t.y"', '"t.t.t"'), {
    files: new Map([["child.yaml", { text: cycleText, mtime: 1 }]]),
  });
  assert.ok(errors(cyc).length);
});

test("resolution is pure and a read-only story never changes authored expansion", () => {
  const result = check(doc([step(["a -> b"])]));
  const before = JSON.stringify(result.ast);
  Object.freeze(result.ast);
  const first = resolveStory(result.ast);
  const second = resolveStory(result.ast);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(result.ast), before);
});

test("shipped story templates stay valid and dialect upgrade preserves authored story bytes", async () => {
  const files = new Map();
  const walk = async (folder) => {
    for (const entry of await readdir(new URL(folder, new URL(`file://${root}`)), {
      withFileTypes: true,
    })) {
      const path = `${folder}${entry.name}`;
      if (entry.isDirectory()) await walk(`${path}/`);
      else if (path.endsWith(".yaml"))
        files.set(path.slice("workspace/".length), {
          text: await readFile(`${root}${path}`, "utf8"),
          mtime: 1,
        });
    }
  };
  await walk("workspace/");
  for (const path of [
    "templates/qlik-cloud-customer-landscape.yaml",
    "templates/qlik-talend-cloud-pipeline.yaml",
    "examples/clickhouse-cloud-stack.yaml",
  ]) {
    const text = files.get(path).text;
    const checked = check(text, { files });
    assert.deepEqual(errors(checked), [], path);
    assert.ok(checked.view.story.steps.length);
    const old = text.replace('diagram: "1"', 'diagram: "0"');
    const upgraded = upgradeText(old);
    assert.equal(
      upgraded.text.slice(upgraded.text.indexOf("story:")),
      text.slice(text.indexOf("story:")),
    );
  }
});

test("qualified flow ids share compiler counters across containing reference scopes", () => {
  const child = 'diagram: "1"\nnodes: [{id: a}, {id: b}]\nflows: ["a -> b"]\n';
  const text =
    'diagram: "1"\nnodes: [{id: t, ref: ws/child, expand: true}]\nflows: ["t.a <- t.b"]\nstory: ' +
    JSON.stringify({ steps: [step(["t.a -> t.b"])] });
  const checked = check(text, { files: new Map([["child.yaml", { text: child, mtime: 1 }]]) });
  assert.deepEqual(errors(checked), []);
  const id = checked.view.story.steps[0].follow[0].edgeId;
  assert.equal(id, "t.a->t.b#2");
  assert.equal(checked.spec.edges.find((edge) => edge.id === id).data.direction, "forward");
});

test("implicit back-arrow captions preserve human titles and actual direction", () => {
  const text =
    'diagram: "1"\nnodes: [{id: a, title: Alpha}, {id: b, title: Beta}]\nflows: [{from: a, to: b, direction: back, step: 1}]\n';
  const checked = check(text);
  assert.equal(checked.view.story.steps[0].title, "Beta → Alpha");
  assert.deepEqual(checked.view.story.steps[0].follow, [{ edgeId: "a->b", reverse: true }]);
});

test("camera mode distinguishes authored all-flow targets from mixed targets and callouts", () => {
  const flow = check(doc([{ ...step(["a -> b"]), callouts: [{ at: "c", text: "Context" }] }])).view
    .story.steps[0];
  assert.equal(flow.camera, "follow");
  assert.equal(check(doc([step(["a", "a -> b"])])).view.story.steps[0].camera, "fit");
  assert.equal(check(base).view.story.steps[0].camera, "follow");
});
