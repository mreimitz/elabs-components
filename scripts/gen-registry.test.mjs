/**
 * gen-registry.test.mjs — self-test for the derived-registry gate.
 * Run in CI: `node --test scripts/gen-registry.test.mjs` (`pnpm gen:registry:check:test`).
 *
 * The gate exists because a hand-written manifest drifted from the code it
 * described: `sidebar-02` shipped five fabricated `registryDependencies` and a
 * `registry:ui` `button` shadowed the upstream shadcn name with a stale fork.
 * A gate that can silently stop firing is worse than none (quality-gates.md,
 * "Self-tested gates"), so this plants each drift shape and asserts detection.
 *
 * Unit fixtures are INLINE; the last block asserts against the REAL repo, which
 * is what actually fails when someone edits a block without regenerating.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyImports,
  extractImports,
  packageRoot,
  withBrandPeers,
  renderRegistry,
} from "./gen-registry.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// ── import extraction ───────────────────────────────────────────────────────

test("extractImports: finds every specifier form", () => {
  const src = `
    import { A } from "@elabs/components-ui";
    import "./side-effect.css";
    const m = await import("@/components/shared/x");
    const r = require("topojson-client");
  `;
  assert.deepEqual(extractImports(src), [
    "@elabs/components-ui",
    "./side-effect.css",
    "@/components/shared/x",
    "topojson-client",
  ]);
});

test("packageRoot: scoped and unscoped subpaths collapse to the installable name", () => {
  assert.equal(packageRoot("@elabs/components-ui/lib/cn"), "@elabs/components-ui");
  assert.equal(packageRoot("lucide-react"), "lucide-react");
  assert.equal(packageRoot("topojson-client/dist/x"), "topojson-client");
});

// ── classification ──────────────────────────────────────────────────────────

const KNOWN = new Set(["stat-card-parts", "stat-card-area-01"]);

test("classifyImports: derives registryDependencies from the @/ alias", () => {
  const { registryDependencies } = classifyImports(
    ["@/components/stat-card-parts/trend-badge"],
    KNOWN,
    "stat-card-area-01",
  );
  assert.deepEqual(registryDependencies, ["stat-card-parts"]);
});

test("classifyImports: an item never depends on itself", () => {
  const { registryDependencies } = classifyImports(
    ["@/components/stat-card-area-01/x"],
    KNOWN,
    "stat-card-area-01",
  );
  assert.deepEqual(registryDependencies, []);
});

test("classifyImports: an alias naming an UNKNOWN item is not invented as a dependency", () => {
  // This is the #375-shaped failure the fabricated sidebar-02 list had: naming
  // items that do not exist here, which shadcn then resolves upstream.
  const { registryDependencies, dependencies } = classifyImports(
    ["@/components/does-not-exist/x"],
    KNOWN,
    "whatever",
  );
  assert.deepEqual(registryDependencies, []);
  assert.deepEqual(dependencies, []);
});

test("classifyImports: relative and node: specifiers are not dependencies", () => {
  const { dependencies } = classifyImports(["./sibling", "../up", "node:fs"], KNOWN, "x");
  assert.deepEqual(dependencies, []);
});

test("classifyImports: react/react-dom are ambient, everything else is declared", () => {
  const { dependencies } = classifyImports(
    ["react", "react-dom", "lucide-react", "@visx/curve"],
    KNOWN,
    "x",
  );
  assert.deepEqual(dependencies, ["@visx/curve", "lucide-react"]);
});

// ── peer closure ────────────────────────────────────────────────────────────

const PEERS = new Map([
  ["@elabs/components-editor", ["@elabs/components-ui", "monaco-editor", "react"]],
  ["@elabs/components-ui", ["@elabs/components-tokens", "react"]],
  ["@elabs/components-tokens", []],
]);

test("withBrandPeers: closes transitively over @elabs peers", () => {
  assert.deepEqual(withBrandPeers(["@elabs/components-editor"], PEERS), [
    "@elabs/components-editor",
    "@elabs/components-tokens",
    "@elabs/components-ui",
  ]);
});

test("withBrandPeers: a THIRD-PARTY peer is never auto-added — it is conditional", () => {
  // monaco-editor is a peer of -editor but only matters if the block renders an
  // editor, so it stays an authored `extraDependencies` judgment, not a fact.
  assert.ok(!withBrandPeers(["@elabs/components-editor"], PEERS).includes("monaco-editor"));
});

test("withBrandPeers: an authored extra dependency survives the closure", () => {
  assert.ok(
    withBrandPeers(["@elabs/components-editor", "monaco-editor"], PEERS).includes("monaco-editor"),
  );
});

// ── the real repo: the assertion that actually catches drift ────────────────

const authored = JSON.parse(readFileSync(join(REPO_ROOT, "registry/registry.items.json"), "utf8"));
const committed = JSON.parse(readFileSync(join(REPO_ROOT, "registry/registry.json"), "utf8"));

test("FRESH: the committed registry.json equals what the source derives", () => {
  assert.deepEqual(
    renderRegistry(authored),
    committed,
    "registry/registry.json is stale — run `pnpm gen:registry`.",
  );
});

test("FLAGS: a hand-added dependency that no file imports", () => {
  const tampered = structuredClone(committed);
  tampered.items[0].dependencies = [...(tampered.items[0].dependencies ?? []), "left-pad"];
  assert.notDeepEqual(renderRegistry(authored), tampered);
});

test("FLAGS: a fabricated registryDependency (the shipped sidebar-02 defect)", () => {
  const tampered = structuredClone(committed);
  const sidebar = tampered.items.find((i) => i.name === "sidebar-02");
  assert.ok(sidebar, "sidebar-02 must exist for this regression lock to mean anything");
  sidebar.registryDependencies = ["avatar", "button", "collapsible", "dropdown-menu", "sidebar"];
  assert.notDeepEqual(renderRegistry(authored), tampered);
});

test("FLAGS: a file dropped from an item (the sidebar-04 broken-install defect)", () => {
  const tampered = structuredClone(committed);
  const item = tampered.items.find((i) => i.files.length > 1);
  item.files = item.files.slice(0, 1);
  assert.notDeepEqual(renderRegistry(authored), tampered);
});

test("no item ships a story or a test file", () => {
  for (const item of committed.items) {
    for (const file of item.files) {
      assert.doesNotMatch(
        file.path,
        /\.(stories|test|spec)\./,
        `${item.name} ships ${file.path} — stories and tests are not installable code.`,
      );
    }
  }
});

test("the registry workspace can install every dependency the blocks declare", () => {
  // registry/ is a workspace member so Storybook can render the blocks in place
  // (a tree outside apps/docs cannot reach apps/docs/node_modules). That manifest
  // is a SECOND list of the same dependencies, so pin it to the derived one: any
  // dependency an item declares must be installable from registry/package.json.
  const workspace = JSON.parse(readFileSync(join(REPO_ROOT, "registry/package.json"), "utf8"));
  const installable = new Set([
    ...Object.keys(workspace.dependencies ?? {}),
    ...Object.keys(workspace.devDependencies ?? {}),
    // `geojson` ships no runtime package — the import is types-only.
    ...(workspace.devDependencies?.["@types/geojson"] ? ["geojson"] : []),
  ]);

  for (const item of committed.items) {
    for (const dep of item.dependencies ?? []) {
      assert.ok(
        installable.has(dep),
        `${item.name} declares "${dep}", which registry/package.json cannot install — ` +
          `add it there so the block still resolves when Storybook renders it.`,
      );
    }
  }
});

test("the source tree MIRRORS the install tree (what lets @/ cross-item imports work)", () => {
  for (const item of committed.items) {
    for (const file of item.files) {
      if (file.type === "registry:page") continue; // routes target the app dir
      const fromRoot = file.path.split("/").slice(-1)[0];
      assert.ok(
        file.target.startsWith(`components/${item.name}/`),
        `${item.name}: ${file.target} must live under components/${item.name}/`,
      );
      assert.ok(file.target.endsWith(fromRoot));
    }
  }
});
