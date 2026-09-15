import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  isComponentName,
  kebabSlot,
  storyIdOf,
  findStoryBlocks,
  parseMetaHead,
  hasCustomRender,
  discoverCoverage,
  renderJsdomTest,
  renderBrowserTest,
} from "./gen-contract-tests.mjs";

test("isComponentName", () => {
  assert.equal(isComponentName("Button"), true);
  assert.equal(isComponentName("AgentTimeline"), true);
  assert.equal(isComponentName("useTheme"), false);
  assert.equal(isComponentName("CATEGORICAL_SOFT_CAP"), false);
  assert.equal(isComponentName(""), false);
});

test("kebabSlot", () => {
  assert.equal(kebabSlot("Button"), "button");
  assert.equal(kebabSlot("AgentTimeline"), "agent-timeline");
  assert.equal(kebabSlot("WorkspacePicker"), "workspace-picker");
  assert.equal(kebabSlot("MetricCard"), "metric-card");
});

test("storyIdOf", () => {
  assert.equal(storyIdOf("Core/Button", "Default"), "core-button--default");
  assert.equal(storyIdOf("AI/ChangeReview", "Default"), "ai-changereview--default");
  assert.equal(storyIdOf("Overlays/Dialog", "Default"), "overlays-dialog--default");
});

test("findStoryBlocks splits per-export, skips meta", () => {
  const text = `const meta = { component: Foo };\nexport default meta;\nexport const Default: Story = { args: {} };\nexport const Other: Story = { args: { x: 1 } };\n`;
  const blocks = findStoryBlocks(text);
  assert.deepEqual(
    blocks.map((b) => b.name),
    ["Default", "Other"],
  );
  assert.match(blocks[0].text, /Default/);
  assert.doesNotMatch(blocks[0].text, /Other/);
});

test("parseMetaHead reads component + title from the meta object", () => {
  const text = `const meta = { title: "Core/Button", component: Button, tags: ["autodocs"] } satisfies Meta<typeof Button>;\nexport default meta;\nexport const Default: Story = {};\n`;
  assert.deepEqual(parseMetaHead(text), { component: "Button", title: "Core/Button" });
});

test("parseMetaHead returns nulls when the meta object is absent", () => {
  assert.deepEqual(parseMetaHead("export const Default = {};"), { component: null, title: null });
});

test("hasCustomRender", () => {
  assert.equal(hasCustomRender("export const X: Story = { args: { a: 1 } };"), false);
  assert.equal(hasCustomRender("export const X: Story = { render: () => <div /> };"), true);
  assert.equal(hasCustomRender("export const X: Story = { render(args) { return null; } };"), true);
});

// ── discoverCoverage — a tiny on-disk fixture repo ──────────────────────────

function makeFixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), "contract-gen-"));
  const srcDir = join(root, "packages/demo/src");
  mkdirSync(join(srcDir, "components/widget"), { recursive: true });
  mkdirSync(join(srcDir, "components/gizmo"), { recursive: true });

  // Widget: co-located story, plain Default args -> covered.
  writeFileSync(
    join(srcDir, "components/widget/widget.tsx"),
    `export function Widget() { return null; }\nexport function WidgetHeader() { return null; }\n`,
  );
  writeFileSync(
    join(srcDir, "components/widget/widget.stories.tsx"),
    `const meta = { title: "Demo/Widget", component: Widget };\nexport default meta;\n` +
      `export const Default = { args: { label: "hi" } };\n` +
      `export const WithHeader = { render: () => null };\n`,
  );

  // Gizmo: story exists but Default uses a custom render -> skipped.
  writeFileSync(
    join(srcDir, "components/gizmo/gizmo.tsx"),
    `export function Gizmo() { return null; }\n`,
  );
  writeFileSync(
    join(srcDir, "components/gizmo/gizmo.stories.tsx"),
    `const meta = { title: "Demo/Gizmo", component: Gizmo };\nexport default meta;\n` +
      `export const Default = { render: () => null };\n`,
  );

  const manifest = {
    packages: {
      "@elabs-ai/components-demo": {
        path: "packages/demo",
        components: [
          {
            name: "Widget",
            kind: "value",
            module: "packages/demo/src/components/widget/widget.tsx",
          },
          {
            name: "WidgetHeader",
            kind: "value",
            module: "packages/demo/src/components/widget/widget.tsx",
          },
          { name: "Gizmo", kind: "value", module: "packages/demo/src/components/gizmo/gizmo.tsx" },
        ],
      },
    },
  };
  return { root, manifest };
}

test("discoverCoverage: co-located Default with plain args is covered", () => {
  const { root, manifest } = makeFixtureRepo();
  try {
    const { covered, skipped } = discoverCoverage(manifest, root);
    const widget = covered.find((c) => c.name === "Widget");
    assert.ok(widget, "Widget should be covered");
    assert.equal(widget.storyId, "demo-widget--default");
    assert.equal(widget.storyFile, "packages/demo/src/components/widget/widget.stories.tsx");

    const headerSkip = skipped.find((s) => s.name === "WidgetHeader");
    assert.ok(headerSkip, "WidgetHeader should be skipped (sub-part)");
    assert.match(headerSkip.reason, /sub-part|shared story file/);

    const gizmoSkip = skipped.find((s) => s.name === "Gizmo");
    assert.ok(gizmoSkip, "Gizmo should be skipped (custom render)");
    assert.match(gizmoSkip.reason, /custom render/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("renderJsdomTest emits a probe importing the discovered story file", () => {
  const { root, manifest } = makeFixtureRepo();
  try {
    const { covered } = discoverCoverage(manifest, root);
    const widget = covered.find((c) => c.name === "Widget");
    const { outFile, body } = renderJsdomTest(widget, root);
    assert.match(outFile, /__contract__\/widget\.contract\.test\.tsx$/);
    assert.match(body, /GENERATED by scripts\/gen-contract-tests\.mjs/);
    assert.match(body, /from "\.\.\/components\/widget\/widget\.stories"/);
    assert.match(body, /data-slot="widget"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("renderBrowserTest emits one block per component, sweeping themes x widths", () => {
  const { root, manifest } = makeFixtureRepo();
  try {
    const { covered } = discoverCoverage(manifest, root);
    const { outFile, body } = renderBrowserTest(
      "demo",
      covered.filter((c) => c.name === "Widget"),
      root,
    );
    assert.match(outFile, /apps\/docs\/contract\/demo\.contract\.test\.tsx$/);
    assert.match(body, /BUILT_IN_THEMES/);
    assert.match(body, /page\.viewport/);
    assert.match(body, /axe\.run/);
    assert.match(body, /demo-widget--default/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
