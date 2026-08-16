// check-loading-states.test.mjs — self-test for the loading/streaming
// story-coverage gate (#267). Locks: (1) the not-ready SIGNAL detector reads
// `loading`/`isStreaming`/chart-`status` out of manifest prop-info (including the
// DataTable-shaped "props folded into one blob" case) and ignores unrelated
// `status` props (StatusBadge, TestSuite, …); (2) the STORY detector recognizes a
// named `*Loading`/`*Streaming` export or a not-ready arg default, and does NOT
// false-positive on an unrelated prose match; (3) a PLANTED bad-fixture component
// (no story) is caught end-to-end via findMissingLoadingStories, and a fixed
// fixture (with the story) is not; (4) the REAL repo currently passes the gate.
// Per quality-gates.md "Self-tested gates".
//
// Run: node --test scripts/check-loading-states.test.mjs  (pnpm loading-states:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  notReadySignal,
  storyExercisesNotReady,
  findStoryFilesFor,
  findMissingLoadingStories,
} from "./check-loading-states.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ── notReadySignal: manifest prop-info → signal ────────────────────────────────

test("notReadySignal: flags a boolean `loading` prop", () => {
  const propInfo = { props: [{ name: "loading", optional: true, type: "boolean" }] };
  assert.equal(notReadySignal(propInfo), "loading");
});

test("notReadySignal: flags a boolean `isStreaming` prop", () => {
  const propInfo = { props: [{ name: "isStreaming", optional: true, type: "boolean" }] };
  assert.equal(notReadySignal(propInfo), "isStreaming");
});

test("notReadySignal: flags `status: ChartStatus` (the documented chart alias)", () => {
  const propInfo = { props: [{ name: "status", optional: true, type: "ChartStatus" }] };
  assert.equal(notReadySignal(propInfo), "status");
});

test("notReadySignal: does NOT flag a `status` prop of a DIFFERENT type", () => {
  // StatusBadge/TestSuite/ToolResultCard etc. — `status` means something else
  // entirely there; loading-states.md scopes the alias to charts only.
  for (const type of ['"complete" | "active" | "pending"', "TestStatus", "ChatStatus", "Status"]) {
    const propInfo = { props: [{ name: "status", optional: true, type }] };
    assert.equal(notReadySignal(propInfo), null, `type=${type}`);
  }
});

test("notReadySignal: catches the signal even when folded into ANOTHER prop's type blob", () => {
  // Mirrors DataTable: the manifest's generic-interface extraction sometimes
  // dumps the rest of the interface's members into one prop's `type` string.
  const propInfo = {
    props: [
      {
        name: "toolbar",
        optional: true,
        type: "(t: Table) => ReactNode; /** doc */ loading?: boolean; zebra?: boolean;",
      },
    ],
  };
  assert.equal(notReadySignal(propInfo), "loading");
});

test("notReadySignal: null for a component with neither signal", () => {
  const propInfo = { props: [{ name: "className", optional: true, type: "string" }] };
  assert.equal(notReadySignal(propInfo), null);
});

test("notReadySignal: null/safe for missing or malformed prop-info", () => {
  assert.equal(notReadySignal(null), null);
  assert.equal(notReadySignal({}), null);
  assert.equal(notReadySignal({ props: "not-an-array" }), null);
});

// ── storyExercisesNotReady: story source → boolean ─────────────────────────────

test("storyExercisesNotReady: a named *Loading export", () => {
  assert.ok(storyExercisesNotReady("export const Loading: Story = { args: { loading: true } };"));
});

test("storyExercisesNotReady: a named *Streaming export", () => {
  assert.ok(storyExercisesNotReady("export const Streaming: Story = {};"));
});

test("storyExercisesNotReady: a `loading: true` arg default without a named export", () => {
  assert.ok(storyExercisesNotReady("export const Default = { args: { loading: true } };"));
});

test('storyExercisesNotReady: a JSX `status="loading"` prop (chart alias)', () => {
  assert.ok(storyExercisesNotReady('<AreaChart status="loading" />'));
});

test("storyExercisesNotReady: false for a story with no not-ready state", () => {
  assert.equal(
    storyExercisesNotReady("export const Default: Story = { args: { loading: false } };"),
    false,
  );
});

// ── findStoryFilesFor: precise import/JSX matching (not a bare prose scan) ─────

test("findStoryFilesFor: matches an import + JSX usage, ignores an unrelated prose string", () => {
  const dir = mkdtempSync(join(tmpdir(), "loading-states-storyfiles-"));
  try {
    writeFileSync(
      join(dir, "widget.stories.tsx"),
      'import { Widget } from "./widget";\nexport const Default = () => <Widget />;\n',
    );
    // A DIFFERENT file's prose happens to whole-word-match the name (e.g. the
    // #267 "Terminal error" false-positive this gate must NOT fall for).
    writeFileSync(
      join(dir, "unrelated.stories.tsx"),
      'export const X = { name: "Widget error" };\n',
    );
    const found = findStoryFilesFor(dir, "Widget");
    assert.equal(found.length, 1);
    assert.match(found[0], /widget\.stories\.tsx$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── findMissingLoadingStories: end-to-end via a planted fixture manifest ───────

function fixtureManifest(overrides) {
  return {
    packages: {
      "@elabs/components-fixture": {
        path: "pkg-fixture",
        components: [{ name: "Widget", module: "pkg-fixture/src/widget.tsx" }],
        props: { Widget: { props: [{ name: "loading", optional: true, type: "boolean" }] } },
        ...overrides,
      },
    },
  };
}

test("PLANTED bad fixture (loading prop, no story) is caught end-to-end", () => {
  const root = mkdtempSync(join(tmpdir(), "loading-states-e2e-"));
  try {
    mkdirSync(join(root, "pkg-fixture", "src"), { recursive: true });
    writeFileSync(join(root, "pkg-fixture", "src", "widget.tsx"), "export function Widget() {}\n");
    writeFileSync(
      join(root, "pkg-fixture", "src", "widget.stories.tsx"),
      'import { Widget } from "./widget";\nexport const Default = () => <Widget />;\n',
    );
    const missing = findMissingLoadingStories(fixtureManifest(), root);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].key, "@elabs/components-fixture::Widget");
    assert.equal(missing[0].signal, "loading");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FIXED fixture (loading prop + *Loading story) is NOT flagged", () => {
  const root = mkdtempSync(join(tmpdir(), "loading-states-e2e-fixed-"));
  try {
    mkdirSync(join(root, "pkg-fixture", "src"), { recursive: true });
    writeFileSync(join(root, "pkg-fixture", "src", "widget.tsx"), "export function Widget() {}\n");
    writeFileSync(
      join(root, "pkg-fixture", "src", "widget.stories.tsx"),
      [
        'import { Widget } from "./widget";',
        "export const Default = () => <Widget />;",
        "export const Loading = { args: { loading: true } };",
        "",
      ].join("\n"),
    );
    const missing = findMissingLoadingStories(fixtureManifest(), root);
    assert.deepEqual(missing, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a component with NO not-ready prop is never considered", () => {
  const root = mkdtempSync(join(tmpdir(), "loading-states-e2e-none-"));
  try {
    mkdirSync(join(root, "pkg-fixture", "src"), { recursive: true });
    writeFileSync(join(root, "pkg-fixture", "src", "widget.tsx"), "export function Widget() {}\n");
    const manifest = fixtureManifest({
      props: { Widget: { props: [{ name: "className", optional: true, type: "string" }] } },
    });
    assert.deepEqual(findMissingLoadingStories(manifest, root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── CLI: the REAL repo currently passes the gate (baseline covers pre-existing gaps) ──

test("the REAL repo currently passes loading-states:check (CLI run)", () => {
  const out = execFileSync("node", [join(HERE, "check-loading-states.mjs")], {
    encoding: "utf8",
  });
  assert.match(out, /✔ loading-states/);
});
