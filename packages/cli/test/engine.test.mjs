import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  planScaffold,
  resolveTemplateFile,
  scanRepo,
  mapComponents,
  planCodemod,
  ARCHETYPES,
  MAP_CLASSES,
  CODEMOD_MODES,
  CODEMOD_TOOL,
  BASE_PACKAGES,
  PKG_SCOPE,
} from "../lib/engine.mjs";
import { findRepoRoot } from "../lib/core.mjs";

const root = findRepoRoot();

// ---- exported contracts (the enums VP-02/03 build against) ------------------

test("engine exports stable enums + tool name", () => {
  assert.equal(ARCHETYPES.length, 6, "six archetypes");
  assert.deepEqual(MAP_CLASSES, ["direct", "props", "compose", "gap", "drop"]);
  assert.deepEqual(CODEMOD_MODES, ["generate", "dry-run", "apply"]);
  assert.equal(CODEMOD_TOOL, "jscodeshift", "OSS, no paid deps");
});

// ---- scaffold --------------------------------------------------------------

test("planScaffold: happy path returns a plan shape (accepts an object spec)", () => {
  const r = planScaffold({ archetype: "dashboard", theme: "dark", title: "Sales Pulse" }, { root });
  assert.equal(r.command, "scaffold");
  assert.equal(r.status, "planned");
  assert.equal(r.implemented, true, "scaffold is implemented (#123) — not a skeleton");
  assert.equal(r.spec.archetype, "dashboard");
  assert.equal(r.spec.theme, "dark");
  assert.equal(r.spec.title, "Sales Pulse");
  assert.equal(r.template.name, "dashboard");
  assert.equal(typeof r.template.inManifest, "boolean");
  assert.ok(Array.isArray(r.gates) && r.gates.length, "gates listed");
  assert.equal(
    r.contextFile,
    "brand-ui-context.md",
    "the manifest-derived context file (#123 AC2)",
  );
  assert.deepEqual(
    r.contextFiles,
    ["CLAUDE.md", "AGENTS.md", "brand-ui-context.md"],
    "both agent contracts AND the context file",
  );
  assert.ok(Array.isArray(r.files), "files array present");
  assert.ok(Array.isArray(r.notes) && r.notes.length, "notes present");
});

test("planScaffold: theme + title default when omitted", () => {
  const r = planScaffold({ archetype: "settings" }, { root });
  assert.equal(r.status, "planned");
  assert.equal(r.theme, "light");
  assert.equal(r.spec.title, "settings");
});

test("planScaffold: unknown archetype is a structured error (no throw)", () => {
  const r = planScaffold({ archetype: "bogus" });
  assert.equal(r.status, "error");
  assert.match(r.error, /archetype must be one of/);
});

test("planScaffold: missing input is a structured error", () => {
  const r = planScaffold(undefined);
  assert.equal(r.status, "error");
  assert.match(r.error, /missing spec/);
});

// ---- scaffold: the app-spec.md contract (#123) ------------------------------

test("planScaffold: reads the fenced json Machine-spec block out of an app-spec.md", () => {
  const r = planScaffold(join(root, "skills/brand-ui-new-app/reference/app-spec.example.md"), {
    root,
  });
  assert.equal(r.status, "planned", r.error);
  assert.equal(r.spec.archetype, "dashboard");
  assert.equal(r.spec.title, "Sales Pulse");
  assert.equal(r.spec.theme, "dark");
  assert.equal(r.spec.entities[0].name, "Deal", "entities survive the extraction");
});

test("planScaffold: an app-spec.md whose json block violates the schema is an error", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-spec-"));
  const file = join(dir, "app-spec.md");
  writeFileSync(
    file,
    '# x\n\n```json\n{ "archetype": "dashboard", "theme": "neon", "title": "X" }\n```\n',
  );
  const r = planScaffold(file, { root });
  assert.equal(r.status, "error");
  assert.match(r.error, /theme/);
  rmSync(dir, { recursive: true, force: true });
});

test("planScaffold: an app-spec.md with no json block is a structured error", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-spec-"));
  const file = join(dir, "app-spec.md");
  writeFileSync(file, "# just prose, no machine spec\n");
  const r = planScaffold(file, { root });
  assert.equal(r.status, "error");
  assert.match(r.error, /json spec block/);
  rmSync(dir, { recursive: true, force: true });
});

// ---- scaffold: the standalone install handoff (#263) ------------------------

/** The `@elabs-ai/*` specifiers a template ACTUALLY imports, read from source. */
function templatePkgsFromSource(archetype) {
  const src = readFileSync(join(root, `docs/playbooks/templates/${archetype}.tsx`), "utf8");
  const hits = [...src.matchAll(/^import\s[\s\S]*?from\s+["']([^"']+)["'];?\s*$/gm)]
    .map((m) => m[1])
    .filter((s) => s.startsWith(PKG_SCOPE));
  return [...new Set(hits)].sort();
}

for (const archetype of ["data-app", "flow-workspace"]) {
  test(`planInstall(${archetype}): deps === template imports === @source lines`, () => {
    const r = planScaffold(
      { archetype, theme: "light", title: "X", standalone: true, release: "2.0.0" },
      { root },
    );
    assert.equal(r.status, "planned", r.error);

    // The invariant that keeps "installed but renders unstyled" impossible: the
    // dependency set is derived from the template's real imports (plus the tokens+ui
    // floor), and the @source lines are generated from that SAME array.
    const expected = [...new Set([...templatePkgsFromSource(archetype), ...BASE_PACKAGES])].sort();
    assert.deepEqual(r.install.packages, expected, "deps === template imports ∪ {tokens, ui}");
    assert.deepEqual(
      r.install.css.sources,
      expected.map((p) => `@source "../node_modules/${p}/dist";`),
      "@source lines === the dependency set",
    );
    // The engine stylesheet FIRST, then the two reference themes as separate
    // opt-in imports (ADR 0029 — styles.css alone carries no selectable theme,
    // so a scaffold that imported only it would render the neutral `:root` base
    // and its theme switcher would have nothing to switch to).
    assert.equal(
      r.install.css.import,
      [
        `@import "${PKG_SCOPE}tokens/styles.css";`,
        `@import "${PKG_SCOPE}tokens/themes/light.css";`,
        `@import "${PKG_SCOPE}tokens/themes/dark.css";`,
      ].join("\n"),
    );
  });
}

test("planInstall: standalone resolves from public npm and emits no .npmrc", () => {
  const r = planScaffold(
    { archetype: "data-app", theme: "light", title: "X", standalone: true, release: "2.0.0" },
    { root },
  );
  assert.equal(r.install.standalone, true);
  // The scope is PUBLIC on npmjs.org, so an ordinary `pnpm add` resolves it and
  // the generated `.npmrc` stays empty. An `_authToken` line leaking back in is
  // what would hand every generated app a secret it can never provision.
  assert.equal(r.install.registry, "https://registry.npmjs.org/");
  assert.equal(r.install.npmrc, "");
  assert.match(r.install.addCommand, /^pnpm add /);
  assert.match(r.install.addCommand, /@\^2\.0\.0/, "real semver range, not workspace:*");
  assert.doesNotMatch(JSON.stringify(r.install), /npm\.pkg\.github\.com|_authToken/);
});

test("planInstall: flow needs @xyflow/react + its stylesheet; ai needs the `ai` peer", () => {
  const flow = planScaffold(
    { archetype: "flow-workspace", theme: "light", title: "X", standalone: true },
    { root },
  );
  assert.ok(flow.install.peers.includes("@xyflow/react"), "xyflow is a peer the app installs");
  assert.ok(
    flow.install.extras.includes('import "@xyflow/react/dist/style.css";'),
    "the one-time stylesheet import is handed over",
  );

  const ai = planScaffold(
    { archetype: "ai-assistant", theme: "light", title: "X", standalone: true },
    { root },
  );
  assert.ok(ai.install.peers.includes("ai"), "the app owns the model calls (D5)");
  // …-ai peers @xyflow/react too (the in-chat workspace canvas, ADR 0018). A
  // hand-kept peer table missed it; deriving from the package cannot.
  assert.ok(
    ai.install.peers.includes("@xyflow/react"),
    "every peer the ai package declares is installed, not just the ones someone remembered",
  );
  assert.ok(
    ai.install.extras.includes('import "@xyflow/react/dist/style.css";'),
    "the engine's stylesheet follows the engine, whichever package pulled it in",
  );
});

// #263 AC3: the emitted range is the range the PACKAGE declares — never `"*"` on
// a context-singleton engine (a wildcard resolves a version the library never
// supported and breaks at RUNTIME, not at install).
for (const [archetype, pkgDir, peer] of [
  ["flow-workspace", "flow", "@xyflow/react"],
  ["ai-assistant", "ai", "ai"],
]) {
  test(`planInstall(${archetype}): ${peer} is pinned to the range packages/${pkgDir} declares`, () => {
    const declared = JSON.parse(readFileSync(join(root, `packages/${pkgDir}/package.json`), "utf8"))
      .peerDependencies[peer];
    const r = planScaffold(
      { archetype, theme: "light", title: "X", standalone: true, release: "2.0.0" },
      { root },
    );
    assert.equal(r.install.peerRanges[peer], declared, "the declared range, verbatim");
    assert.ok(
      r.install.peerCommand.includes(`${peer}@${declared}`),
      `the copy-pasteable install line pins it: ${r.install.peerCommand}`,
    );
    assert.doesNotMatch(JSON.stringify(r.install.peerRanges), /"\*"/, "no wildcard peer range");
  });
}

// The blocker this replaced: an unreachable template used to yield `[]` imports,
// so the plan silently degraded to {tokens, ui} — a standalone ai-assistant that
// installs neither …-ai nor the `ai` SDK, with no warning.
test("planScaffold: an unreachable template is a hard error, never a {tokens,ui} default", () => {
  const empty = mkdtempSync(join(tmpdir(), "brand-ui-no-templates-"));
  try {
    for (const opts of [
      { root: empty, bundledDir: empty }, // a checkout that never ran gen:templates
      { bundledDir: empty }, // consumer mode with the bundle missing
    ]) {
      const r = planScaffold(
        { archetype: "ai-assistant", theme: "light", title: "X", standalone: true },
        opts,
      );
      assert.equal(r.status, "error", JSON.stringify(r.install ?? {}));
      assert.match(r.error, /cannot derive the package set/);
      assert.equal(r.install, undefined, "no half-derived install block escapes");
    }
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test("resolveTemplateFile: every archetype resolves from a checkout", () => {
  for (const archetype of ARCHETYPES) {
    assert.ok(resolveTemplateFile(archetype, { root }), `${archetype} template resolves`);
  }
});

test("planInstall: standalone:false keeps workspace:* and names no registry", () => {
  const r = planScaffold({ archetype: "data-app", theme: "light", title: "X" }, { root });
  assert.equal(r.install.standalone, false);
  assert.equal(r.install.dependencyRange, "workspace:*");
  assert.equal(r.install.addCommand, undefined, "no install command for an in-monorepo app");
  assert.doesNotMatch(JSON.stringify(r), /npm\.pkg\.github\.com/);
});

test("planInstall: entities pull in the data package (the ColumnDef the scaffold emits)", () => {
  const spec = {
    archetype: "dashboard",
    theme: "light",
    title: "X",
    entities: [{ name: "Deal", fields: [{ name: "value", type: "number" }] }],
  };
  const { entities: _drop, ...noEntities } = spec;
  const withEntities = planScaffold(spec, { root });
  const without = planScaffold(noEntities, { root });
  assert.ok(withEntities.install.packages.includes(`${PKG_SCOPE}data`));
  assert.ok(!without.install.packages.includes(`${PKG_SCOPE}data`));
  // Still one code path: the @source lines follow the deps either way.
  assert.equal(withEntities.install.css.sources.length, withEntities.install.packages.length);
});

// ---- scan ------------------------------------------------------------------

test("scanRepo: profiles a fixture repo deterministically", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-scan-"));
  try {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: {
          react: "19",
          "@elabs-ai/components-ui": "1",
          tailwindcss: "4",
          vite: "5",
        },
      }),
    );
    mkdirSync(join(dir, "src"));
    writeFileSync(
      join(dir, "src", "App.tsx"),
      `export function App() { return (<Card><Button/><Button/><DataGridPro/></Card>); }`,
    );
    const r = scanRepo(dir);
    assert.equal(r.command, "scan");
    assert.equal(r.status, "ok");
    assert.equal(r.implemented, false);
    assert.equal(r.project, "fixture-app");
    assert.equal(r.framework, "vite");
    assert.equal(r.uiLibrary.primary, "brand-ui");
    assert.equal(r.styling.primary, "tailwind");
    assert.equal(r.components.filesScanned, 1);
    const button = r.components.top.find((c) => c.name === "Button");
    assert.equal(button.count, 2, "JSX usage frequency counted");
    assert.equal(button.files, 1, "file spread counted");
    assert.ok(Array.isArray(r.components.byFile), "per-file usage present");
    assert.ok(r.components.props && typeof r.components.props === "object", "prop usage present");
    assert.ok(r.imports && Array.isArray(r.imports.sources), "import graph present");
    assert.ok(r.tokens && typeof r.tokens.hardcodedColors === "number", "token debt counted");
    assert.ok(Array.isArray(r.notes) && r.notes.length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scanRepo: nonexistent path is a structured error", () => {
  const r = scanRepo(join(tmpdir(), "brand-ui-does-not-exist-xyz"));
  assert.equal(r.status, "error");
  assert.match(r.error, /not found/);
});

// ---- map -------------------------------------------------------------------

test("map: classifies known→direct, unknown→gap; summary covers every class", () => {
  const scan = {
    components: {
      top: [
        { name: "Button", count: 3 },
        { name: "ZzNotARealComponent", count: 1 },
      ],
    },
  };
  const r = mapComponents(scan, { root });
  assert.equal(r.command, "map");
  assert.equal(r.status, "ok");
  assert.deepEqual(r.classes, MAP_CLASSES);
  assert.equal(r.mappings.length, 2);

  const button = r.mappings.find((m) => m.source === "Button");
  assert.equal(button.class, "direct", "Button resolves to a brand-ui component via the manifest");
  assert.equal(button.target, "Button");

  const gap = r.mappings.find((m) => m.source === "ZzNotARealComponent");
  assert.equal(gap.class, "gap");
  assert.equal(gap.target, null);

  // Summary has a numeric count for every class in MAP_CLASSES, plus the
  // usage-weighted coverage estimate (#124).
  for (const cls of MAP_CLASSES) assert.equal(typeof r.summary[cls], "number", `${cls} counted`);
  assert.equal(r.summary.direct, 1);
  assert.equal(r.summary.gap, 1);
  assert.equal(r.summary.coveragePct, 75, "3 of 4 usages are covered by the direct match");
  assert.deepEqual(r.summary.coverage, { mappedUsages: 3, totalUsages: 4 });
});

test("map: missing input is a structured error", () => {
  const r = mapComponents(undefined);
  assert.equal(r.status, "error");
  assert.match(r.error, /missing scan/);
});

// ---- codemod ---------------------------------------------------------------

const FIXTURE_MAP = {
  mappings: [
    { source: "Btn", target: "Button", pkg: "@elabs-ai/components-ui", class: "direct" },
    { source: "Grid", target: null, class: "gap" },
  ],
};

test("codemod: generate emits a phased plan (read-only; jscodeshift)", () => {
  const r = planCodemod(FIXTURE_MAP);
  assert.equal(r.command, "codemod");
  assert.equal(r.status, "planned");
  assert.equal(r.implemented, false);
  assert.equal(r.tool, "jscodeshift");
  assert.equal(r.mode, "generate");
  const direct = r.phases.find((p) => p.name === "direct-renames");
  assert.ok(direct, "a direct-renames phase exists");
  assert.equal(direct.transforms.length, 1, "only the actionable (direct+target) mapping");
  assert.equal(direct.apply, false, "never applies in the skeleton");
});

test("codemod: apply is blocked (migration stays read-only until VP-03)", () => {
  const r = planCodemod(FIXTURE_MAP, { mode: "apply" });
  assert.equal(r.status, "blocked");
  assert.equal(r.mode, "apply");
});

test("codemod: invalid mode is a structured error", () => {
  const r = planCodemod(FIXTURE_MAP, { mode: "nuke" });
  assert.equal(r.status, "error");
  assert.match(r.error, /mode must be one of/);
});

test("codemod: missing input is a structured error", () => {
  const r = planCodemod(undefined);
  assert.equal(r.status, "error");
  assert.match(r.error, /missing map/);
});
