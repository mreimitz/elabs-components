import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderInventory,
  renderLlmsHub,
  renderLlmsSpoke,
  renderContextBlock,
  packageRows,
  orderedPackages,
} from "../lib/render-docs.mjs";

/** A tiny fixture manifest covering the shapes the renderers must handle. */
const FIXTURE = {
  name: "brand-ui",
  themes: ["light (:root)", "dark", "light"],
  defaultTheme: "light",
  radius: "0.5rem",
  tokenCount: 42,
  registry: [{ name: "x", type: "registry:ui", title: "X", description: "" }],
  packages: {
    "@elabs-ai/components-ui": {
      path: "packages/ui",
      components: [
        { name: "Button", module: "packages/ui/src/button/button.tsx" },
        { name: "Card", module: "packages/ui/src/card/card.tsx" },
      ],
      hooks: [{ name: "useFoo", module: "packages/ui/src/use-foo.ts" }],
      types: [],
      otherExports: [],
      variants: {
        Button: {
          variants: { variant: ["default", "ghost"], size: ["sm", "lg"] },
          defaultVariants: { variant: "default", size: "sm" },
          source: "buttonVariants",
        },
      },
      intent: {
        Button: {
          purpose: "Primary action trigger.",
          category: "action",
          relationships: { avoidNextTo: ["another primary Button"] },
          antiPatterns: ["Button used for navigation — use a link."],
        },
      },
    },
    "@elabs-ai/components-editor": {
      path: "packages/editor",
      components: [{ name: "CodeEditor", module: "packages/editor/src/code-editor.tsx" }],
      hooks: [],
      types: [],
      otherExports: [],
      subpaths: {
        "@elabs-ai/components-editor/markdown/frontmatter": {
          components: [],
          hooks: [
            { name: "useFrontmatter", module: "packages/editor/src/markdown/frontmatter.ts" },
          ],
          types: [],
          otherExports: [],
        },
      },
    },
  },
};

test("orderedPackages puts known packages in dependency-ish order", () => {
  const order = orderedPackages(FIXTURE);
  assert.deepEqual(order, ["@elabs-ai/components-ui", "@elabs-ai/components-editor"]);
});

test("packageRows sorts, summarizes variants, and surfaces subpath imports", () => {
  const rows = packageRows(FIXTURE, "@elabs-ai/components-ui");
  assert.deepEqual(
    rows.map((r) => r.name),
    ["Button", "Card", "useFoo"],
    "sorted, components+hooks merged",
  );
  const button = rows.find((r) => r.name === "Button");
  assert.equal(button.variants, "variant=default*|ghost · size=sm*|lg", "default marked with *");

  const editorRows = packageRows(FIXTURE, "@elabs-ai/components-editor");
  const sub = editorRows.find((r) => r.name === "useFrontmatter");
  assert.equal(sub.importPath, "@elabs-ai/components-editor/markdown/frontmatter");
});

test("renderInventory is deterministic and lists every package + component", () => {
  const a = renderInventory(FIXTURE);
  const b = renderInventory(FIXTURE);
  assert.equal(a, b, "deterministic");
  assert.match(a, /## @elabs-ai\/components-ui/);
  assert.match(a, /Button/);
  assert.match(a, /CodeEditor/);
  assert.match(
    a,
    /\| `@elabs-ai\/components-ui` \| packages\/ui \| 2 \| 1 \|/,
    "package summary row",
  );
  assert.match(a, /Themes \(3\)/);
});

test("renderLlmsHub routes to per-package spokes and lists themes + entry points", () => {
  const hub = renderLlmsHub(FIXTURE);
  assert.match(hub, /# brand-ui/);
  assert.match(hub, /\[@elabs-ai\/components-ui\]\(\.\/llms\/ui\.txt\)/, "spoke link");
  assert.match(hub, /light \(default\)/);
  assert.match(hub, /pnpm add -D @elabs-ai\/components-cli/);
  assert.match(hub, /pnpm exec brand-ui docs/);
  assert.match(hub, /tokens → ui\/icons → data/);
});

test("renderLlmsSpoke shows a package's components, variants and anti-patterns", () => {
  const spoke = renderLlmsSpoke(FIXTURE, "@elabs-ai/components-ui");
  assert.match(spoke, /# @elabs-ai\/components-ui/);
  assert.match(
    spoke,
    /- Button \(variant=default\*\|ghost · size=sm\*\|lg\) — Primary action trigger\./,
  );
  assert.match(spoke, /avoid: Button used for navigation/);
  assert.match(spoke, /## Hooks/);
  assert.match(spoke, /- useFoo/);
});

test("renderLlmsSpoke lists subpath exports separately", () => {
  const spoke = renderLlmsSpoke(FIXTURE, "@elabs-ai/components-editor");
  assert.match(spoke, /## Subpath exports/);
  assert.match(spoke, /useFrontmatter \(`@elabs-ai\/components-editor\/markdown\/frontmatter`/);
});

test("renderContextBlock is a concise names-only catalogue (no prop tables)", () => {
  const ctx = renderContextBlock(FIXTURE);
  assert.match(ctx, /### @elabs-ai\/components-ui/);
  assert.match(ctx, /Button, Card, useFoo/, "names-only catalogue line");
  assert.doesNotMatch(ctx, /ButtonProps/, "no prop tables in the context block");
  assert.match(ctx, /brand-ui docs <Component>/, "points to the queryable surface");
});

test("renderers tolerate a manifest with empty/missing buckets", () => {
  const empty = {
    themes: [],
    packages: { "@elabs-ai/components-ui": { path: "packages/ui", components: [] } },
  };
  assert.doesNotThrow(() => renderInventory(empty));
  assert.doesNotThrow(() => renderLlmsHub(empty));
  assert.doesNotThrow(() => renderContextBlock(empty));
  assert.doesNotThrow(() => renderLlmsSpoke(empty, "@elabs-ai/components-ui"));
});
