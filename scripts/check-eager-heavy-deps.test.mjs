/**
 * check-eager-heavy-deps.test.mjs — locks the eager-heavy-dependency ratchet.
 * Run in CI: `node --test scripts/check-eager-heavy-deps.test.mjs`.
 *
 * Fixtures are INLINE source strings; the final test asserts the real committed
 * tree matches the committed baseline.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectViolations,
  findStaticHeavyImports,
  findStaticRelativeImports,
  isLazyBoundary,
} from "./check-eager-heavy-deps.mjs";

// ── The exact regression this gate exists for ────────────────────────────────
test("FAILS: the original eager mermaid import", () => {
  const src = `import { mermaid } from "@streamdown/mermaid";\nconst plugins = { mermaid };`;
  assert.deepEqual(findStaticHeavyImports(src), ["@streamdown/mermaid"]);
});

test("PASSES: the lazy replacement (dynamic import)", () => {
  const src = `
    import type { DiagramPlugin } from "@streamdown/mermaid";
    const load = () => import("mermaid").then((m) => m.default);
  `;
  assert.deepEqual(
    findStaticHeavyImports(src),
    [],
    "import type erases and import() is dynamic — neither is an eager edge",
  );
});

// ── Type-only imports are never violations ───────────────────────────────────
test("PASSES: `import type { X } from` a heavy package", () => {
  assert.deepEqual(
    findStaticHeavyImports(`import type { RiveParameters } from "@rive-app/react-webgl2";`),
    [],
  );
});

test("FAILS: a MIXED import that also pulls a value", () => {
  // `import { type T, useRive }` still emits a runtime edge.
  const src = `import { type RiveParameters, useRive } from "@rive-app/react-webgl2";`;
  assert.deepEqual(findStaticHeavyImports(src), ["@rive-app/react-webgl2"]);
});

// ── Other eager forms ────────────────────────────────────────────────────────
test("FAILS: a bare side-effect import", () => {
  assert.deepEqual(findStaticHeavyImports(`import "@xterm/xterm";`), ["@xterm/xterm"]);
});

test("FAILS: a re-export, which keeps the edge too", () => {
  assert.deepEqual(findStaticHeavyImports(`export { Terminal } from "@xterm/xterm";`), [
    "@xterm/xterm",
  ]);
});

test("PASSES: `export type … from` erases", () => {
  assert.deepEqual(findStaticHeavyImports(`export type { ITheme } from "@xterm/xterm";`), []);
});

test("FAILS: a subpath of a heavy package", () => {
  assert.deepEqual(
    findStaticHeavyImports(`import { MediaController } from "media-chrome/react";`),
    ["media-chrome/react"],
  );
});

test("catches a multi-line import block", () => {
  const src = `import {\n  useRive,\n  Layout,\n} from "@rive-app/react-webgl2";`;
  assert.deepEqual(findStaticHeavyImports(src), ["@rive-app/react-webgl2"]);
});

// ── Things that must NOT trip it ─────────────────────────────────────────────
test("PASSES: unrelated packages and lookalike names", () => {
  const src = `
    import { cn } from "@elabs-ai/components-ui/lib/cn";
    import { code } from "@streamdown/code";
    import { mermaidHelper } from "./mermaid-utils";
    import { thing } from "mermaid-lookalike";
  `;
  assert.deepEqual(
    findStaticHeavyImports(src),
    [],
    "a prefix match must require a package boundary, and relative paths are ours",
  );
});

test("PASSES: the specifier only appearing inside a comment or string", () => {
  const src = `
    // A drop-in replacement for @streamdown/mermaid's plugin.
    const name = "mermaid";
  `;
  assert.deepEqual(findStaticHeavyImports(src), []);
});

// ── Lazy boundaries ──────────────────────────────────────────────────────────
test("recognises the @lazy-boundary marker", () => {
  assert.equal(isLazyBoundary("/**\n * @lazy-boundary only via import()\n */"), true);
  assert.equal(isLazyBoundary("// a normal module"), false);
  assert.equal(isLazyBoundary("// mentions lazy-boundaries in prose"), false);
});

test("finds the static relative imports that would defeat a boundary", () => {
  const src = `
    import PersonaRive from "./_persona-rive";
    export { thing } from "./other";
    import type { T } from "./types";
    const lazy = () => import("./_persona-rive");
  `;
  assert.deepEqual(
    findStaticRelativeImports(src),
    ["./_persona-rive", "./other"],
    "import type erases and import() is dynamic — neither keeps the edge",
  );
});

// ── A watched package's optional peers are heavy for that package ────────────
test("FAILS: a static import of a package's own OPTIONAL peer", () => {
  // `streamdown` is not on HEAVY_DEPS — it is heavy for `viewer` only because
  // `viewer` declares it optional, which is what makes a static edge a BUILD
  // error for every consumer who skipped it.
  const src = `import { Streamdown } from "streamdown";`;
  assert.deepEqual(findStaticHeavyImports(src), [], "not heavy on its own");
  assert.deepEqual(findStaticHeavyImports(src, ["streamdown"]), ["streamdown"]);
});

test("the optional peers are read off the real package manifest", async () => {
  const { fileURLToPath } = await import("node:url");
  const { dirname } = await import("node:path");
  const { optionalPeersOf } = await import("./check-eager-heavy-deps.mjs");
  const root = dirname(dirname(fileURLToPath(import.meta.url)));

  const peers = optionalPeersOf(root, "viewer");
  assert.ok(peers.includes("shiki"), `viewer's optional peers were ${JSON.stringify(peers)}`);
  assert.ok(peers.includes("streamdown"));
  assert.deepEqual(
    optionalPeersOf(root, "no-such-package"),
    [],
    "an unreadable manifest must not throw — the gate still has to run",
  );
});

// ── The real tree matches the committed baseline ─────────────────────────────
test("the committed baseline matches the real packages/ai source tree", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));

  const baseline = JSON.parse(readFileSync(join(here, "eager-heavy-deps-baseline.json"), "utf8"));
  const current = collectViolations().map((v) => `${v.file}::${v.rule}::${v.specifier}`);
  const added = current.filter((k) => !baseline.includes(k));

  assert.deepEqual(added, [], `new eager heavy imports: ${JSON.stringify(added)}`);
});

test("mermaid is no longer eagerly imported anywhere in packages/ai/src", () => {
  const mermaidSites = collectViolations().filter((v) => /mermaid/.test(v.specifier));
  assert.deepEqual(
    mermaidSites,
    [],
    "the #7 fix must stay in place — mermaid loads via dynamic import only",
  );
});

test("nothing statically imports a @lazy-boundary module", () => {
  const leaks = collectViolations().filter((v) => v.rule === "static-import-of-lazy-boundary");
  assert.deepEqual(leaks, [], "a static import of a boundary puts its engine back in the entry");
});

test("the Rive runtime is behind a lazy boundary, not eager in persona.tsx", () => {
  const eagerRive = collectViolations().filter(
    (v) => v.rule === "eager-heavy-import" && /rive-app/.test(v.specifier),
  );
  assert.deepEqual(eagerRive, [], "the #5b fix must stay in place");
});
