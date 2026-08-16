// check-variant-coverage.test.mjs — self-test for the cva variant
// story-coverage gate (#388). Locks: (1) a variant value mentioned ONLY in
// `argTypes.options` (the exact trap #388 documents) is stripped before
// scanning and so does NOT count as coverage; (2) a value rendered as a JSX
// attribute or an object-literal `args` key DOES count; (3) a default value is
// satisfied by any story that leaves the axis unset (the InputGroup
// precedent); (4) a PLANTED bad-fixture component (uncovered variant value) is
// caught end-to-end via findVariantGaps, and a fixed fixture is not;
// (5) the ratchet refuses to raise the baseline without --force;
// (6) the REAL repo currently passes the gate.
// Per quality-gates.md "Self-tested gates".
//
// Run: node --test scripts/check-variant-coverage.test.mjs  (pnpm variants:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  stripArgTypesBlock,
  valueRenderedInText,
  findStoryBlocks,
  hasDefaultOmittingStory,
  findStoryFilesFor,
  findVariantGaps,
  computeRatchetUpdate,
} from "./check-variant-coverage.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ── stripArgTypesBlock: the argTypes.options trap ──────────────────────────────

test("stripArgTypesBlock: removes a nested argTypes object, keeps the rest", () => {
  const text = [
    "const meta = {",
    "  argTypes: {",
    '    variant: { options: ["default", "success"], table: { category: "Appearance" } },',
    "  },",
    "};",
    'export const Info: Story = { args: { variant: "info" } };',
  ].join("\n");
  const stripped = stripArgTypesBlock(text);
  assert.equal(stripped.includes("options"), false);
  assert.equal(stripped.includes("success"), false);
  assert.ok(stripped.includes('export const Info: Story = { args: { variant: "info" } };'));
});

test("stripArgTypesBlock: a no-op when the text has no argTypes block", () => {
  const text = 'export const Default: Story = { args: { variant: "outline" } };';
  assert.equal(stripArgTypesBlock(text), text);
});

// ── valueRenderedInText: JSX attr / object-literal, word-boundary anchored ────

test('valueRenderedInText: finds a JSX attribute variant="success"', () => {
  assert.ok(valueRenderedInText('<Alert variant="success">', "variant", "success"));
});

test('valueRenderedInText: finds an object-literal args key variant: "success"', () => {
  assert.ok(
    valueRenderedInText(
      'export const S: Story = { args: { variant: "success" } };',
      "variant",
      "success",
    ),
  );
});

test("valueRenderedInText: does NOT match an unrelated identifier substring", () => {
  // `invariant` / `iconVariant` must never satisfy `variant`.
  assert.equal(valueRenderedInText('const invariant = "success";', "variant", "success"), false);
});

test("valueRenderedInText: false when the value never appears", () => {
  assert.equal(valueRenderedInText('<Alert variant="info">', "variant", "success"), false);
});

// ── findStoryBlocks / hasDefaultOmittingStory: the InputGroup precedent ───────

test("findStoryBlocks: splits per export, excludes a meta-shaped block", () => {
  const text = [
    "export const meta = { argTypes: {} };",
    'export const A: Story = { args: { variant: "outline" } };',
    'export const B: Story = { args: { variant: "surface" } };',
  ].join("\n");
  const blocks = findStoryBlocks(text);
  assert.deepEqual(
    blocks.map((b) => b.name),
    ["A", "B"],
  );
});

test("hasDefaultOmittingStory: true when a story never sets the axis at all", () => {
  const text = [
    'export const Search: Story = { render: () => <InputGroup className="max-w-sm" /> };',
    'export const Surface: Story = { args: { variant: "surface" } };',
  ].join("\n");
  assert.ok(hasDefaultOmittingStory(text, "variant"));
});

test("hasDefaultOmittingStory: false when every story sets the axis explicitly", () => {
  const text = [
    'export const A: Story = { args: { variant: "surface" } };',
    'export const B: Story = { args: { variant: "card" } };',
  ].join("\n");
  assert.equal(hasDefaultOmittingStory(text, "variant"), false);
});

// ── findStoryFilesFor: precise import/JSX matching (shared with sibling gates) ─

test("findStoryFilesFor: matches an import + JSX usage, ignores an unrelated prose string", () => {
  const dir = mkdtempSync(join(tmpdir(), "variant-coverage-storyfiles-"));
  try {
    writeFileSync(
      join(dir, "widget.stories.tsx"),
      'import { Widget } from "./widget";\nexport const Default = () => <Widget />;\n',
    );
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

// ── findVariantGaps: end-to-end via a planted fixture manifest + repo ──────────

function fixtureManifest(variants) {
  return {
    packages: {
      "@qlik-coe-emea/qlabs-components-fixture": {
        path: "pkg-fixture",
        components: [{ name: "Widget", module: "pkg-fixture/src/widget.tsx" }],
        variants: { Widget: variants },
      },
    },
  };
}

function writeFixtureRepo(storyContents) {
  const root = mkdtempSync(join(tmpdir(), "variant-coverage-e2e-"));
  mkdirSync(join(root, "pkg-fixture", "src"), { recursive: true });
  writeFileSync(join(root, "pkg-fixture", "src", "widget.tsx"), "export function Widget() {}\n");
  // findStoryFilesFor requires the file to actually import/render the
  // component (never a bare prose scan) — every fixture below gets this for
  // free so each test only has to author the part it's actually exercising.
  writeFileSync(
    join(root, "pkg-fixture", "src", "widget.stories.tsx"),
    'import { Widget } from "./widget";\n' + storyContents,
  );
  return root;
}

test("(1) an UNCOVERED variant value is FLAGGED", () => {
  const root = writeFixtureRepo(
    [
      "const meta = { argTypes: { variant: { options: ['default', 'success'] } } };",
      "export default meta;",
      'export const Default: Story = { args: { variant: "default" } };',
      "",
    ].join("\n"),
  );
  try {
    const manifest = fixtureManifest({
      variants: { variant: ["default", "success"] },
      defaultVariants: { variant: "default" },
    });
    const gaps = findVariantGaps(manifest, root);
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0].key, "@qlik-coe-emea/qlabs-components-fixture::Widget::variant=success");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("(2) a value mentioned ONLY in argTypes.options is FLAGGED, not laundered as coverage", () => {
  // The exact #388 trap: `success` is selectable in the controls panel but no
  // story ever renders `variant="success"`.
  const root = writeFixtureRepo(
    [
      "const meta = {",
      "  argTypes: {",
      "    variant: { options: ['default', 'info', 'success', 'warning', 'destructive'] },",
      "  },",
      "};",
      "export default meta;",
      'export const Info: Story = { args: { variant: "info" } };',
      "",
    ].join("\n"),
  );
  try {
    const manifest = fixtureManifest({
      variants: { variant: ["default", "info", "success"] },
      defaultVariants: { variant: "default" },
    });
    const gaps = findVariantGaps(manifest, root);
    const keys = gaps.map((g) => g.key);
    assert.ok(
      keys.includes("@qlik-coe-emea/qlabs-components-fixture::Widget::variant=success"),
      `expected success to be flagged, got: ${keys.join(", ")}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("(3) a PROPERLY RENDERED variant value PASSES", () => {
  const root = writeFixtureRepo(
    [
      "const meta = { argTypes: { variant: { options: ['default', 'success'] } } };",
      "export default meta;",
      'export const Default: Story = { args: { variant: "default" } };',
      'export const Success: Story = { args: { variant: "success" } };',
      "",
    ].join("\n"),
  );
  try {
    const manifest = fixtureManifest({
      variants: { variant: ["default", "success"] },
      defaultVariants: { variant: "default" },
    });
    const gaps = findVariantGaps(manifest, root);
    assert.deepEqual(gaps, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("(3b) a DEFAULT value is covered by a story that omits the prop", () => {
  const root = writeFixtureRepo(
    [
      "const meta = { argTypes: { variant: { options: ['outline', 'surface'] } } };",
      "export default meta;",
      'export const Bare: Story = { render: () => <Widget className="max-w-sm" /> };',
      'export const Surface: Story = { args: { variant: "surface" } };',
      "",
    ].join("\n"),
  );
  try {
    const manifest = fixtureManifest({
      variants: { variant: ["outline", "surface"] },
      defaultVariants: { variant: "outline" },
    });
    const gaps = findVariantGaps(manifest, root);
    assert.deepEqual(gaps, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a component with NO story file at all is out of scope (not this gate's job)", () => {
  const root = mkdtempSync(join(tmpdir(), "variant-coverage-nostory-"));
  try {
    mkdirSync(join(root, "pkg-fixture", "src"), { recursive: true });
    writeFileSync(join(root, "pkg-fixture", "src", "widget.tsx"), "export function Widget() {}\n");
    const manifest = fixtureManifest({
      variants: { variant: ["default", "success"] },
      defaultVariants: { variant: "default" },
    });
    assert.deepEqual(findVariantGaps(manifest, root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── computeRatchetUpdate: the ratchet refuses to raise without --force ────────

test("(4) --update refuses to ADD new gaps to the baseline without --force", () => {
  const result = computeRatchetUpdate(
    ["pkg::A::variant=x", "pkg::A::variant=y"],
    ["pkg::A::variant=x"],
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.added, ["pkg::A::variant=y"]);
});

test("(4b) --update --force allows raising the baseline", () => {
  const result = computeRatchetUpdate(
    ["pkg::A::variant=x", "pkg::A::variant=y"],
    ["pkg::A::variant=x"],
    true,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.next, ["pkg::A::variant=x", "pkg::A::variant=y"]);
});

test("(4c) --update always allows the baseline to SHRINK", () => {
  const result = computeRatchetUpdate(
    ["pkg::A::variant=x"],
    ["pkg::A::variant=x", "pkg::A::variant=y"],
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.next, ["pkg::A::variant=x"]);
});

// ── CLI: the REAL repo currently passes the gate (baseline covers pre-existing gaps) ──

test("(5) the REAL repo currently passes variants:check (CLI run)", () => {
  const out = execFileSync("node", [join(HERE, "check-variant-coverage.mjs")], {
    encoding: "utf8",
  });
  assert.match(out, /✔ variant-coverage/);
});
