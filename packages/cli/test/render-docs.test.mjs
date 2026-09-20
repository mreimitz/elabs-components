import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderInventory,
  renderLlmsHub,
  renderLlmsSpoke,
  renderContextBlock,
  packageRows,
  orderedPackages,
  renderReadmeCounts,
} from "../lib/render-docs.mjs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findRepoRoot, loadManifest } from "../lib/core.mjs";

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
  // Entry points lead with the HOSTED MCP: an agent reading this file from
  // https://elabs-ai.com/llms.txt has nothing to install, and the registry the
  // old copy pointed at ("GitHub Packages") no longer exists (2026-09-17 review).
  assert.match(hub, /https:\/\/elabs-ai\.com\/mcp/, "hosted MCP endpoint");
  assert.doesNotMatch(hub, /GitHub Packages/, "no dead private-registry instructions");
  // No local dev URL in a PUBLIC artifact (wave-3 ruling): the hosted endpoint
  // is the only MCP address this file names.
  assert.doesNotMatch(hub, /localhost/, "no local dev server address");
  // The hosted MCP line sits within the first 20 lines (RM-100 acceptance).
  const first20 = hub.split("\n").slice(0, 20).join("\n");
  assert.match(first20, /https:\/\/elabs-ai\.com\/mcp/, "hosted MCP within the first 20 lines");
  assert.match(hub, /npx -y @elabs-ai\/components-cli mcp/);
  assert.match(hub, /pnpm exec brand-ui info/);
  assert.match(hub, /tokens → ui\/icons → data/);
  // DEFAULT (no siteRoutes): the shape for a Storybook host, whose root IS Storybook and
  // which has no `/r` — so the docs-site link is the bare origin and the registry is the
  // authored `homepage`. On the public addresses the bare origin 308-redirects into
  // `/storybook/`, so this form resolves there too; `siteRoutes` below is the direct one.
  assert.match(
    hub,
    /- Docs site: https:\/\/elabs-ai\.com \(Storybook/,
    "docs site is the bare origin by default",
  );
  assert.doesNotMatch(hub, /elabs-ai\.com\/storybook\//, "no /storybook/ link by default");
  assert.match(
    hub,
    /npx shadcn@latest add https:\/\/elabs-ai\.com\/r\/<item>\.json/,
    "registry defaults to the published GitHub Pages registry",
  );
  assert.match(
    hub,
    /\/plugin marketplace add mreimitz\/elabs-components/,
    "the plugin marketplace command",
  );
});

test("renderLlmsHub's siteRoutes opts a real site's own /storybook/ and /r routes back in", () => {
  const hub = renderLlmsHub(FIXTURE, { siteRoutes: true });
  assert.match(
    hub,
    /- Docs site: https:\/\/elabs-ai\.com\/storybook\//,
    "docs site under /storybook/",
  );
  assert.match(
    hub,
    /npx shadcn@latest add https:\/\/elabs-ai\.com\/r\/<item>\.json/,
    "registry under the site's own /r",
  );
});

test("renderLlmsHub takes a siteOrigin override so a preview reports itself", () => {
  const hub = renderLlmsHub(FIXTURE, { siteOrigin: "https://rm-100.vercel.app" });
  assert.match(hub, /https:\/\/rm-100\.vercel\.app\/mcp/);
  // Still the default form (no siteRoutes) — a preview origin does not imply that origin
  // serves /storybook/ or /r.
  assert.match(hub, /- Docs site: https:\/\/rm-100\.vercel\.app \(Storybook/);
  // Every URL this file says about ITSELF is the preview's. The one exception is the
  // registry base: without `siteRoutes` the preview is not claimed to serve `/r`, so the
  // line names where the registry really is — the production website. Anything else
  // leaking the production origin is a bug, so assert on each line rather than on the blob.
  const leaks = hub
    .split("\n")
    .filter((line) => line.includes("elabs-ai.com"))
    .filter((line) => !line.includes("https://elabs-ai.com/r/"));
  assert.deepEqual(leaks, [], "no leftover production origin outside the registry base");
});

test("renderLlmsHub combines siteOrigin + siteRoutes for a real preview of the site", () => {
  const hub = renderLlmsHub(FIXTURE, {
    siteOrigin: "https://rm-100.vercel.app",
    siteRoutes: true,
  });
  assert.match(hub, /https:\/\/rm-100\.vercel\.app\/mcp/);
  assert.match(hub, /- Docs site: https:\/\/rm-100\.vercel\.app\/storybook\//);
  assert.match(hub, /npx shadcn@latest add https:\/\/rm-100\.vercel\.app\/r\/<item>\.json/);
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

test("README counts and llms.txt count components the same way (one definition)", (t) => {
  const root = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
  if (!root) return t.skip("not inside the monorepo");
  const manifest = loadManifest(root);
  const readme = renderReadmeCounts(manifest, root);
  const hub = renderLlmsHub(manifest);
  for (const name of orderedPackages(manifest)) {
    const short = name.replace(/^@elabs-ai\/components-/, "");
    const inReadme = readme.match(new RegExp(`(?:— | · )${short} (\\d+)`))?.[1];
    const inLlms = hub.match(new RegExp(`\\[${name}\\][^\\n]*\\((\\d+) components`))?.[1];
    assert.ok(inReadme && inLlms, `${short}: README ${inReadme}, llms ${inLlms}`);
    assert.equal(inReadme, inLlms, short);
  }
  assert.match(readme, /The theme token contract \(`THEME_TOKEN_NAMES`\) has \d+ tokens/);
});
