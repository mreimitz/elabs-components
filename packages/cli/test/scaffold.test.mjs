/**
 * scaffold.test.mjs — locks `brand-ui scaffold --write` (VP-02 #123 / #55 / #263).
 *
 * The scaffold's whole promise is "spec → born-compliant app", so these tests emit
 * into real temp directories and assert on the BYTES that land there: the file set,
 * that the spec actually reached the source, that nothing the spec left unanswered
 * was invented (every gap is a `TODO(spec):`), that the emitted app is token-clean,
 * and that plan-only mode writes nothing at all.
 *
 * Run in CI via `pnpm --filter @elabs/components-cli test` (node --test).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  emitScaffold,
  planScaffold,
  SCAFFOLD_FILES,
  ARCHETYPES,
  PKG_SCOPE,
} from "../lib/engine.mjs";
import { scanText } from "../lib/audit.mjs";
import { findRepoRoot } from "../lib/core.mjs";

const root = findRepoRoot();

const tmp = () => mkdtempSync(join(tmpdir(), "brand-ui-scaffold-"));

/** A spec that answers most of the interview — the "happy" fixture. */
const specFor = (archetype, extra = {}) => ({
  archetype,
  theme: "dark",
  title: `Fixture ${archetype}`,
  surfaces: [
    { id: "overview", navLabel: "Overview" },
    { id: "deals", navLabel: "Deals" },
  ],
  entities: [
    {
      name: "Deal",
      fields: [
        { name: "name", type: "text" },
        { name: "value", type: "number" },
        { name: "stage", type: "status" },
      ],
    },
  ],
  ...extra,
});

// ---- the emitted file set --------------------------------------------------

for (const archetype of ["dashboard", "data-app"]) {
  test(`emitScaffold(${archetype}): writes the whole file set with the spec applied`, () => {
    const dir = tmp();
    const r = emitScaffold(specFor(archetype), { root, target: dir });
    assert.equal(r.status, "written", r.error);
    assert.equal(r.implemented, true);

    for (const rel of SCAFFOLD_FILES) {
      assert.ok(existsSync(join(dir, rel)), `${rel} exists`);
    }
    assert.deepEqual(r.written, SCAFFOLD_FILES, "every planned file was written");
    assert.deepEqual(r.skipped, [], "nothing skipped in a fresh directory");

    const app = readFileSync(join(dir, "src/App.tsx"), "utf8");
    assert.match(app, /Fixture /, "the spec's title reached the source");
    assert.match(app, /export interface Deal \{/, "the entity interface is generated");
    assert.match(app, /value: number;/, "field types map to TS");
    assert.match(app, /label: "Overview"/, "the spec's nav label reached the nav list");
    assert.match(app, /export default \w+;/, "the app has a root component to render");

    // Nothing is invented: the columns only appear because the spec named fields.
    assert.match(app, /ColumnDef<Deal>\[\]/, "ColumnDef<Entity>[] is generated");
    assert.match(app, /accessorKey: "stage"/);

    const main = readFileSync(join(dir, "src/main.tsx"), "utf8");
    assert.match(main, /<ThemeProvider defaultTheme="dark">/, "the theme is wired at the root");
    assert.match(main, /import "\.\/styles\.css";/);

    const claude = readFileSync(join(dir, "CLAUDE.md"), "utf8");
    assert.match(claude, /dark/, "CLAUDE.md names the chosen theme");
    assert.match(claude, new RegExp(archetype), "CLAUDE.md names the archetype");
    assert.match(claude, /light.*dark/s, "the shipped themes, not a stale list");

    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    assert.match(agents, /CLAUDE\.md/, "AGENTS.md points at the full contract (AC2)");

    rmSync(dir, { recursive: true, force: true });
  });
}

// ---- the emitted app actually runs (#123 AC1) ------------------------------

test("emitScaffold: everything package.json's scripts need is emitted", () => {
  const dir = tmp();
  const r = emitScaffold(specFor("dashboard"), { root, target: dir });
  assert.equal(r.status, "written", r.error);

  // `dev`/`build` are vite; vite needs an entry document, a config and a tsconfig.
  const html = readFileSync(join(dir, "index.html"), "utf8");
  assert.match(html, /<div id="root"><\/div>/, "main.tsx's mount point exists");
  assert.match(html, /<script type="module" src="\/src\/main\.tsx"><\/script>/);
  assert.match(html, /data-theme="dark"/, "first paint is already themed");

  const vite = readFileSync(join(dir, "vite.config.ts"), "utf8");
  // Without the Tailwind plugin styles.css is never processed → unstyled render,
  // the exact mistake docs/CONSUMING.md §4 exists to prevent.
  assert.match(vite, /@tailwindcss\/vite/);
  assert.match(vite, /@vitejs\/plugin-react/);

  const ts = JSON.parse(readFileSync(join(dir, "tsconfig.json"), "utf8"));
  assert.equal(ts.compilerOptions.jsx, "react-jsx");
  assert.ok(ts.include.includes("src"));

  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.equal(pkg.scripts.dev, "vite");
  assert.ok(pkg.scripts.typecheck, "typecheck is runnable");
  assert.doesNotMatch(pkg.scripts.build, /tsc -b/, "no project-references build without them");
  // Every tool the scripts invoke is declared.
  for (const dep of [
    "vite",
    "@vitejs/plugin-react",
    "@tailwindcss/vite",
    "tailwindcss",
    "typescript",
    "eslint",
    "@types/react",
    "@types/react-dom",
    `${PKG_SCOPE}cli`,
  ]) {
    assert.ok(pkg.devDependencies[dep], `devDependencies carries ${dep}`);
  }
  // `pnpm audit` is pnpm's own command — the script must not be shadowed by it.
  assert.equal(pkg.scripts["audit:ui"], "brand-ui audit src");
  assert.equal(pkg.scripts.audit, undefined);

  // The gates the app is born with actually run somewhere.
  const ci = readFileSync(join(dir, ".github/workflows/brand-ui.yml"), "utf8");
  assert.match(ci, /pnpm audit:ui/, "the taxonomy pass runs in CI");
  assert.match(ci, /pnpm typecheck/);
  assert.match(ci, /pnpm lint/);

  rmSync(dir, { recursive: true, force: true });
});

test("emitScaffold: the manifest-derived context file ships with the app (#123 AC2)", () => {
  const dir = tmp();
  const r = emitScaffold(specFor("data-app"), { root, target: dir });
  assert.equal(r.status, "written", r.error);
  assert.deepEqual(r.plan.contextFiles, ["CLAUDE.md", "AGENTS.md", "brand-ui-context.md"]);

  const ctx = readFileSync(join(dir, "brand-ui-context.md"), "utf8");
  assert.match(ctx, /<!-- brand-ui:context:start -->/, "the regenerable marker block");
  assert.match(ctx, /### @elabs\/components-ui/, "the real component inventory");
  assert.match(ctx, /\bDataTable\b/, "a component an agent would otherwise guess at");
  assert.match(
    readFileSync(join(dir, "CLAUDE.md"), "utf8"),
    /brand-ui-context\.md/,
    "the agent contract points at it",
  );
  rmSync(dir, { recursive: true, force: true });
});

// The invariant #263 AC2 is really about: what the app INSTALLS === what the app
// IMPORTS. Asserting against the emitted source (not the template) also covers
// the packages the spec pulls in (entities ⇒ …-data) and main.tsx's tokens.
for (const archetype of ["ai-assistant", "flow-workspace", "data-app"]) {
  test(`emitScaffold(${archetype}): the dependency set === the emitted app's imports`, () => {
    const dir = tmp();
    const r = emitScaffold(specFor(archetype, { standalone: true, release: "2.0.0" }), {
      root,
      target: dir,
    });
    assert.equal(r.status, "written", r.error);

    const source = ["src/App.tsx", "src/main.tsx"]
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    const imported = [
      ...new Set(
        [...source.matchAll(/from\s+["'](@elabs\/[^"']+)["']/g)]
          .map((m) => m[1])
          .concat([...source.matchAll(/^import\s+["'](@elabs\/[^"']+)["']/gm)].map((m) => m[1]))
          // a subpath import (…-editor/monaco-environment) is still that package
          .map((s) => s.split("/").slice(0, 2).join("/")),
      ),
    ].sort();

    assert.deepEqual(
      r.plan.install.packages,
      imported,
      "no package installed that isn't imported, and none imported that isn't installed",
    );
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    for (const p of imported) assert.ok(pkg.dependencies[p], `${p} is a dependency`);
    const css = readFileSync(join(dir, "src/styles.css"), "utf8");
    for (const p of imported) assert.ok(css.includes(`/${p}/dist`), `${p} has an @source line`);
    rmSync(dir, { recursive: true, force: true });
  });
}

test("emitScaffold: engine peers are pinned to the range their package declares", () => {
  const dir = tmp();
  const r = emitScaffold(specFor("flow-workspace", { standalone: true, release: "2.0.0" }), {
    root,
    target: dir,
  });
  assert.equal(r.status, "written", r.error);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const declared = JSON.parse(readFileSync(join(root, "packages/flow/package.json"), "utf8"))
    .peerDependencies["@xyflow/react"];
  assert.equal(pkg.dependencies["@xyflow/react"], declared, "the library's own range, not `*`");
  assert.ok(
    !Object.values(pkg.dependencies).includes("*"),
    `no wildcard dependency: ${JSON.stringify(pkg.dependencies)}`,
  );
  rmSync(dir, { recursive: true, force: true });
});

test("emitScaffold: every archetype emits, and no emitted file carries a raw colour", () => {
  for (const archetype of ARCHETYPES) {
    const dir = tmp();
    const r = emitScaffold(specFor(archetype), { root, target: dir });
    assert.equal(r.status, "written", `${archetype}: ${r.error}`);

    // The emitter runs the audit itself and refuses to write a violating app, so
    // "born compliant" is a checked result, not a claim (AC3).
    assert.equal(r.audit.issues, 0, `${archetype}: ${r.audit.findings.join("; ")}`);
    assert.equal(r.audit.command, "brand-ui audit");

    for (const rel of r.written) {
      const text = readFileSync(join(dir, rel), "utf8");
      // The literal check the issue asks for…
      assert.doesNotMatch(text, /#[0-9a-fA-F]{6}\b/, `${archetype}/${rel} has a raw hex colour`);
      // …and the repo's own static token pass, so a scaffolded app is born clean.
      if (!/\.(tsx|css)$/.test(rel)) continue;
      const blocking = scanText(text, { isCss: rel.endsWith(".css") }).filter((f) => !f.advisory);
      assert.deepEqual(
        blocking.map((f) => `${rel}:${f.line} ${f.rule}`),
        [],
        `${archetype}/${rel} must pass \`brand-ui audit\``,
      );
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- nothing invented, nothing dropped -------------------------------------

test("emitScaffold: unanswered spec fields become TODO(spec) — never invented", () => {
  const dir = tmp();
  // A minimal spec: no surfaces, no entities.
  const r = emitScaffold(
    { archetype: "dashboard", theme: "dark", title: "Bare" },
    {
      root,
      target: dir,
    },
  );
  assert.equal(r.status, "written", r.error);
  assert.ok(r.todos.length, "the gaps are reported back to the caller");
  assert.ok(
    r.todos.some((t) => t.startsWith("entities:")),
    "an unanswered entity model is called out",
  );
  const app = readFileSync(join(dir, "src/App.tsx"), "utf8");
  assert.match(app, /TODO\(spec\):/, "the source carries the marker the handoff greps for");
  assert.doesNotMatch(app, /export interface \w+ \{/, "no entity was invented");
  rmSync(dir, { recursive: true, force: true });
});

test("emitScaffold: a surface the template has no slot for is appended, not dropped", () => {
  const dir = tmp();
  const spec = specFor("dashboard");
  spec.surfaces = [
    { id: "a", navLabel: "Alpha" },
    { id: "b", navLabel: "Beta" },
    { id: "c", navLabel: "Gamma" },
    { id: "d", navLabel: "Delta" },
    { id: "e", navLabel: "Epsilon" },
  ];
  const r = emitScaffold(spec, { root, target: dir });
  assert.equal(r.status, "written", r.error);
  const app = readFileSync(join(dir, "src/App.tsx"), "utf8");
  for (const s of spec.surfaces) assert.match(app, new RegExp(`label: "${s.navLabel}"`));
  assert.ok(
    r.todos.some((t) => t.includes("surfaces[e]")),
    "the surface beyond the template's nav is reported, not silently dropped",
  );
  rmSync(dir, { recursive: true, force: true });
});

// ---- write discipline ------------------------------------------------------

test("planScaffold writes nothing (plan-only is the default)", () => {
  const dir = tmp();
  const r = planScaffold(specFor("settings"), { root });
  assert.equal(r.status, "planned");
  assert.deepEqual(readdirSync(dir), [], "the plan path touches no file");
  rmSync(dir, { recursive: true, force: true });
});

test("emitScaffold --dry-run lists the paths and writes nothing", () => {
  const dir = tmp();
  const r = emitScaffold(specFor("marketing"), { root, target: dir, dryRun: true });
  assert.equal(r.status, "planned");
  assert.equal(r.dryRun, true);
  assert.deepEqual(r.written, SCAFFOLD_FILES, "it lists what it WOULD write");
  assert.deepEqual(readdirSync(dir), [], "…and writes none of it");
  rmSync(dir, { recursive: true, force: true });
});

test("emitScaffold into an existing app is `partial`, not a headline `written`", () => {
  const dir = tmp();
  // The documented alternative path: scaffold into a folder that already IS a
  // Vite app. Those files are the user's, so they are skipped — and skipping
  // src/App.tsx or package.json means what landed does not run.
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "package.json"), '{ "name": "mine" }\n');
  writeFileSync(join(dir, "src/App.tsx"), "export default function App() { return null; }\n");
  writeFileSync(join(dir, "index.html"), "<!doctype html>\n");

  const r = emitScaffold(specFor("dashboard"), { root, target: dir });
  assert.equal(r.status, "partial", "not `written` — the app is incomplete");
  assert.deepEqual(
    r.skipped.slice().sort(),
    ["index.html", "package.json", "src/App.tsx"],
    "the user's files were left alone",
  );
  assert.deepEqual(r.missingCritical.slice().sort(), ["index.html", "package.json", "src/App.tsx"]);
  assert.ok(
    r.notes.some((n) => n.startsWith("PARTIAL")),
    "the caller is told, in the notes, not only in a field",
  );
  assert.equal(
    readFileSync(join(dir, "package.json"), "utf8"),
    '{ "name": "mine" }\n',
    "nothing of the user's was overwritten",
  );
  rmSync(dir, { recursive: true, force: true });
});

test("emitScaffold refuses to overwrite an already-scaffolded target without --force", () => {
  const dir = tmp();
  assert.equal(emitScaffold(specFor("settings"), { root, target: dir }).status, "written");

  const second = emitScaffold(specFor("settings"), { root, target: dir });
  assert.equal(second.status, "error", "a second run refuses");
  assert.match(second.error, /--force/);

  const forced = emitScaffold(specFor("settings"), { root, target: dir, force: true });
  assert.equal(forced.status, "written", "--force overwrites deliberately");
  rmSync(dir, { recursive: true, force: true });
});

test("emitScaffold: an invalid app-spec.md is an error and writes nothing", () => {
  const dir = tmp();
  const specFile = join(dir, "app-spec.md");
  writeFileSync(
    specFile,
    '# bad\n\n```json\n{ "archetype": "dashboard", "theme": "hot-pink", "title": "X" }\n```\n',
  );
  const out = join(dir, "app");
  const r = emitScaffold(specFile, { root, target: out });
  assert.equal(r.status, "error");
  assert.equal(existsSync(out), false, "an invalid spec must not leave a half-written app");
  rmSync(dir, { recursive: true, force: true });
});

test("emitScaffold: missing target is a structured error (no throw)", () => {
  const r = emitScaffold(specFor("dashboard"), { root });
  assert.equal(r.status, "error");
  assert.match(r.error, /missing target/);
});

// ---- the standalone handoff reaches the emitted files (#263) ----------------

test("emitScaffold(standalone): package.json + CLAUDE.md carry the real install recipe", () => {
  const dir = tmp();
  const r = emitScaffold(specFor("data-app", { standalone: true, release: "2.0.0" }), {
    root,
    target: dir,
  });
  assert.equal(r.status, "written", r.error);

  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  for (const p of r.plan.install.packages) {
    assert.equal(pkg.dependencies[p], "^2.0.0", `${p} installs by semver range, not workspace:*`);
  }
  // #119 icon policy: Lucide at the version the monorepo itself ships.
  const ui = JSON.parse(readFileSync(join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.dependencies["lucide-react"], ui.dependencies["lucide-react"]);
  assert.equal(
    pkg.devDependencies[`${PKG_SCOPE}eslint-config`],
    undefined,
    "the shared eslint-config is private + unpublished — a standalone app cannot depend on it",
  );

  const css = readFileSync(join(dir, "src/styles.css"), "utf8");
  assert.match(css, /@import "@elabs\/components-tokens\/styles\.css";/);
  for (const line of r.plan.install.css.sources)
    assert.ok(css.includes(line), `styles.css: ${line}`);

  const claude = readFileSync(join(dir, "CLAUDE.md"), "utf8");
  // The scope is unpublished, so the handoff a standalone app inherits is the
  // local-tarball recipe — not a registry the app could never reach.
  assert.doesNotMatch(claude, /npm\.pkg\.github\.com|_authToken/);
  assert.match(
    claude,
    /private and unpublished/,
    "the agent contract says why there is no registry",
  );
  assert.match(claude, /pnpm add /);
  assert.doesNotMatch(claude, /pnpm\.overrides|gh release download/);

  rmSync(dir, { recursive: true, force: true });
});

test("emitScaffold(in-monorepo): keeps workspace:* and names no registry", () => {
  const dir = tmp();
  const r = emitScaffold(specFor("data-app"), { root, target: dir });
  assert.equal(r.status, "written", r.error);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.equal(pkg.dependencies[`${PKG_SCOPE}ui`], "workspace:*");
  assert.equal(pkg.devDependencies[`${PKG_SCOPE}eslint-config`], "workspace:*");
  const eslint = readFileSync(join(dir, "eslint.config.js"), "utf8");
  assert.match(eslint, /"brand\/no-raw-font-size": "error"/);
  assert.match(eslint, /"brand\/no-raw-color": "error"/);
  assert.doesNotMatch(
    readFileSync(join(dir, "CLAUDE.md"), "utf8"),
    /npm\.pkg\.github\.com/,
    "no registry block for an in-monorepo app",
  );
  rmSync(dir, { recursive: true, force: true });
});
