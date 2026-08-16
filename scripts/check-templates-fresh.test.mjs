/**
 * check-templates-fresh.test.mjs — locks the generated-template stale-gate.
 * Run in CI: `node --test scripts/check-templates-fresh.test.mjs`.
 *
 * Hermetic: every test builds a MINIMAL temp repo root (a `packages/<pkg>/src/
 * templates-<name>.stories.tsx` fixture + a `package.json`), then drives the same
 * `computeTemplates` / `writeTemplates` / `staleTemplates` the gate uses — never
 * the real repo files. (Style mirrors check-gen.test.mjs / check-manifest.)
 *
 * Asserts the self-test contract:
 *   1. a freshly written set is reported FRESH (no false positives),
 *   2. a hand-edited generated file is flagged STALE (the #core gate),
 *   3. a changed STORY propagates → the stale-gate flags the derived template,
 *   4. an ORPHAN generated file (story deleted) is flagged stale,
 *   5. writeTemplates is idempotent (write → check clean → re-write no-op),
 *   6. the transform strips Storybook scaffolding + rewrites same-package imports.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeTemplates,
  writeTemplates,
  staleTemplates,
  transformStory,
} from "./gen-templates.mjs";

/** A minimal, self-contained template story (same-package relative import included). */
const STORY = `/**
 * Sample template — the canonical full-screen sample composition.
 * Verify across all three themes with globals=theme:<slug>.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@qlik-coe-emea/qlabs-components-ui";
import { Widget } from "./widget/widget";

function SampleTemplate() {
  return (
    <div>
      <Widget />
      <Button>Go</Button>
    </div>
  );
}

const meta = {
  title: "Patterns/Templates/Sample",
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <SampleTemplate /> };
`;

/** Build a temp repo with one story under packages/<pkg>/src; returns its root. */
function makeRepo({ pkg = "ui", name = "sample", story = STORY } = {}) {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-templates-"));
  const srcDir = join(root, "packages", pkg, "src");
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(
    join(root, "packages", pkg, "package.json"),
    JSON.stringify({ name: `@qlik-coe-emea/qlabs-components-${pkg}` }),
  );
  writeFileSync(join(srcDir, `templates-${name}.stories.tsx`), story);
  return root;
}

// ── 1. fresh write is reported fresh ─────────────────────────────────────────

test("PASSES: a freshly written set is fresh (no false positive)", async () => {
  const root = makeRepo();
  try {
    await writeTemplates(root);
    assert.deepEqual(await staleTemplates(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── 2. hand-edited generated file → stale (the core gate) ────────────────────

test("FLAGS: a hand-edited generated .tsx is stale", async () => {
  const root = makeRepo();
  try {
    await writeTemplates(root);
    const f = join(root, "docs/playbooks/templates/sample.tsx");
    writeFileSync(f, readFileSync(f, "utf8") + "\n// hand-edit\n");
    const stale = await staleTemplates(root);
    assert.ok(stale.includes("docs/playbooks/templates/sample.tsx"), "edited file flagged");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── 3. a changed STORY propagates → stale ────────────────────────────────────

test("FLAGS: a changed story makes the derived template stale", async () => {
  const root = makeRepo();
  try {
    await writeTemplates(root);
    // change the story (rename the button label) WITHOUT regenerating
    const storyPath = join(root, "packages/ui/src/templates-sample.stories.tsx");
    writeFileSync(storyPath, readFileSync(storyPath, "utf8").replace("Go", "Launch"));
    const stale = await staleTemplates(root);
    assert.ok(stale.includes("docs/playbooks/templates/sample.tsx"), "story change detected");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── 4. orphan generated file (story deleted) → stale ─────────────────────────

test("FLAGS: an orphaned generated file (story deleted) is stale", async () => {
  const root = makeRepo();
  try {
    await writeTemplates(root);
    // delete the story; the on-disk sample.tsx + index entry now have no source
    rmSync(join(root, "packages/ui/src/templates-sample.stories.tsx"));
    const stale = await staleTemplates(root);
    assert.ok(stale.includes("docs/playbooks/templates/sample.tsx"), "orphan flagged");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── 5. idempotent write ──────────────────────────────────────────────────────

test("writeTemplates is idempotent (write → check clean → re-write no-op)", async () => {
  const root = makeRepo();
  try {
    await writeTemplates(root);
    const snapshot = readFileSync(join(root, "docs/playbooks/templates/sample.tsx"), "utf8");
    await writeTemplates(root);
    assert.equal(
      readFileSync(join(root, "docs/playbooks/templates/sample.tsx"), "utf8"),
      snapshot,
      "second write is byte-identical",
    );
    assert.deepEqual(await staleTemplates(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── 6. the transform: scaffolding stripped, same-package import rewritten ─────

test("transform: strips Storybook scaffolding + rewrites same-package imports", () => {
  const { code, title, packages } = transformStory({
    src: STORY,
    pkgName: "@qlik-coe-emea/qlabs-components-ui",
    name: "sample",
    relFile: "packages/ui/src/templates-sample.stories.tsx",
  });
  assert.equal(title, "Patterns/Templates/Sample");
  // scaffolding gone
  assert.ok(!/@storybook\/react-vite/.test(code), "no storybook import");
  assert.ok(!/satisfies Meta/.test(code), "no meta declaration");
  assert.ok(!/export default meta/.test(code), "no default export of meta");
  assert.ok(!/type Story\s*=/.test(code), "no Story type alias");
  assert.ok(!/export const Default/.test(code), "no story export");
  // same-package relative import rewritten to the alias; cross-package untouched
  assert.ok(!/from "\.\/widget\/widget"/.test(code), "relative import rewritten");
  assert.ok(
    /import { Widget } from "@qlik-coe-emea\/qlabs-components-ui"/.test(code),
    "rewritten to @qlik-coe-emea/qlabs-components-ui",
  );
  assert.ok(
    /import { Button } from "@qlik-coe-emea\/qlabs-components-ui"/.test(code),
    "cross-package import kept",
  );
  // generated header present
  assert.ok(/GENERATED from packages\/ui\/src\/templates-sample\.stories\.tsx/.test(code));
  // the package list folds in the own-package alias (relative import was rewritten)
  assert.deepEqual(packages, ["@qlik-coe-emea/qlabs-components-ui"]);
});

// sanity: computeTemplates returns an index entry shaped for the manifest
test("computeTemplates emits an index.json entry with the documented shape", async () => {
  const root = makeRepo();
  try {
    const { index } = await computeTemplates(root);
    assert.equal(index.length, 1);
    const e = index[0];
    assert.equal(e.name, "sample");
    assert.equal(e.title, "Patterns/Templates/Sample");
    assert.equal(e.sourceStory, "packages/ui/src/templates-sample.stories.tsx");
    assert.equal(e.file, "templates/sample.tsx");
    assert.ok(Array.isArray(e.packages));
    assert.ok(typeof e.description === "string" && e.description.length > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
