// check-state-coverage.test.mjs — self-test for the state-story coverage ratchet
// (#247). Locks: (1) the STATE detector recognizes a named story export whose
// identifier signals Loading/Empty/Error/Disabled/Skeleton/FirstRun and does NOT
// false-positive on a plain `Default`/`Variants`-only story file; (2) the story
// FINDER matches only files that actually import/render the component (not an
// unrelated prose string); (3) a PLANTED bad-fixture allowlisted component (no
// state story) is caught end-to-end via findMissingStateStories, and a fixed
// fixture (with the state story) is not; (4) a non-allowlisted component is never
// considered; (5) the REAL repo currently passes the gate (baseline covers the
// pre-existing §G7 gaps). Per quality-gates.md "Self-tested gates".
//
// Run: node --test scripts/check-state-coverage.test.mjs  (pnpm states:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  hasStateStory,
  findStoryFilesFor,
  findMissingStateStories,
  STATEFUL_COMPONENTS,
} from "./check-state-coverage.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ── hasStateStory: story source → boolean ──────────────────────────────────────

test("hasStateStory: a named *Loading export", () => {
  assert.ok(hasStateStory("export const Loading: Story = {};"));
});

test("hasStateStory: a named *Empty export", () => {
  assert.ok(hasStateStory("export const EmptyResults: Story = {};"));
});

test("hasStateStory: a named *Error export", () => {
  assert.ok(hasStateStory("export const ErrorState: Story = {};"));
});

test("hasStateStory: a named *Disabled export", () => {
  assert.ok(hasStateStory("export const Disabled: Story = {};"));
});

test("hasStateStory: a named *Skeleton export", () => {
  assert.ok(hasStateStory("export const SkeletonRows: Story = {};"));
});

test("hasStateStory: a named *FirstRun export", () => {
  assert.ok(hasStateStory("export const FirstRunOnboarding: Story = {};"));
});

test("hasStateStory: false for Default/Variants-only stories", () => {
  assert.equal(
    hasStateStory(
      "export const Default: Story = {};\nexport const Palette: Story = {};\nexport const Groups: Story = {};",
    ),
    false,
  );
});

test("hasStateStory: false for empty source", () => {
  assert.equal(hasStateStory(""), false);
});

// ── findStoryFilesFor: precise import/JSX matching (not a bare prose scan) ─────

test("findStoryFilesFor: matches an import + JSX usage, ignores an unrelated prose string", () => {
  const dir = mkdtempSync(join(tmpdir(), "state-coverage-storyfiles-"));
  try {
    writeFileSync(
      join(dir, "widget.stories.tsx"),
      'import { Widget } from "./widget";\nexport const Default = () => <Widget />;\n',
    );
    writeFileSync(
      join(dir, "unrelated.stories.tsx"),
      'export const X = { name: "Widget error state" };\n',
    );
    const found = findStoryFilesFor(dir, "Widget");
    assert.equal(found.length, 1);
    assert.match(found[0], /widget\.stories\.tsx$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── findMissingStateStories: end-to-end via a planted fixture manifest ─────────

function fixtureManifest(components) {
  return {
    packages: {
      "@elabs/components-fixture": {
        path: "pkg-fixture",
        components,
      },
    },
  };
}

test("PLANTED bad fixture (allowlisted component, no state story) is caught end-to-end", () => {
  const root = mkdtempSync(join(tmpdir(), "state-coverage-e2e-"));
  try {
    mkdirSync(join(root, "pkg-fixture", "src"), { recursive: true });
    writeFileSync(join(root, "pkg-fixture", "src", "widget.tsx"), "export function Widget() {}\n");
    writeFileSync(
      join(root, "pkg-fixture", "src", "widget.stories.tsx"),
      'import { Widget } from "./widget";\nexport const Default = () => <Widget />;\n',
    );
    const manifest = fixtureManifest([{ name: "Widget", module: "pkg-fixture/src/widget.tsx" }]);
    const missing = findMissingStateStories(manifest, root, undefined, ["Widget"]);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].key, "@elabs/components-fixture::Widget");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FIXED fixture (allowlisted component + *Empty story) is NOT flagged", () => {
  const root = mkdtempSync(join(tmpdir(), "state-coverage-e2e-fixed-"));
  try {
    mkdirSync(join(root, "pkg-fixture", "src"), { recursive: true });
    writeFileSync(join(root, "pkg-fixture", "src", "widget.tsx"), "export function Widget() {}\n");
    writeFileSync(
      join(root, "pkg-fixture", "src", "widget.stories.tsx"),
      [
        'import { Widget } from "./widget";',
        "export const Default = () => <Widget />;",
        "export const Empty = () => <Widget items={[]} />;",
        "",
      ].join("\n"),
    );
    const manifest = fixtureManifest([{ name: "Widget", module: "pkg-fixture/src/widget.tsx" }]);
    const missing = findMissingStateStories(manifest, root, undefined, ["Widget"]);
    assert.deepEqual(missing, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a component NOT on the allowlist is never considered, even with no story", () => {
  const root = mkdtempSync(join(tmpdir(), "state-coverage-e2e-none-"));
  try {
    mkdirSync(join(root, "pkg-fixture", "src"), { recursive: true });
    writeFileSync(join(root, "pkg-fixture", "src", "widget.tsx"), "export function Widget() {}\n");
    const manifest = fixtureManifest([{ name: "Widget", module: "pkg-fixture/src/widget.tsx" }]);
    // Widget is NOT in the allowlist passed here.
    assert.deepEqual(findMissingStateStories(manifest, root, undefined, ["SomethingElse"]), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── STATEFUL_COMPONENTS sanity ──────────────────────────────────────────────────

test("STATEFUL_COMPONENTS is non-empty and includes the §G7-named components", () => {
  for (const name of ["ChatShell", "Conversation", "Tool", "Combobox", "Command", "DatePicker"]) {
    assert.ok(STATEFUL_COMPONENTS.includes(name), `expected ${name} on the allowlist`);
  }
});

// ── CLI: the REAL repo currently passes the gate (baseline covers pre-existing gaps) ──

test("the REAL repo currently passes states:check (CLI run)", () => {
  const out = execFileSync("node", [join(HERE, "check-state-coverage.mjs")], { encoding: "utf8" });
  assert.match(out, /✔ state-coverage/);
});
