/**
 * @elabs-ai/components-cli — the experience engine (scaffold / scan / map / codemod).
 *
 * The deterministic backend the vibe-coder-plugin flows call so they are
 * repeatable, reviewable code paths — NOT hand-wavy LLM steps (VP-01 #121).
 * Greenfield (`new-app`/VP-02) calls `planScaffold`; brownfield (`migrate`/VP-03)
 * calls `scanRepo` → `mapComponents` → `planCodemod`.
 *
 * SCOPE OF THIS MODULE: `scaffold` is **implemented** (VP-02 #123/#55 — it reads
 * an `app-spec.md`, plans, and with `emitScaffold` writes a real app); `scan` /
 * `map` / `codemod` remain #121 skeletons with stable contracts that VP-03 builds
 * the full behavior against. Those three still carry `implemented: false` and a
 * `notes[]` array saying what is deferred and where, so a caller (or an agent) is
 * never misled into thinking a skeleton is the finished engine.
 *
 * Design rules honored here:
 *  - **Deterministic, no paid deps** (no network, no LLM, no clock in the shape).
 *  - **Reuse the substrate** — the manifest (`loadManifest`/`flat`), the registry,
 *    the generated templates (`docs/playbooks/templates/<archetype>.tsx`, derived
 *    from the Storybook stories by `pnpm gen:templates`) and playbooks
 *    (`docs/playbooks/<archetype>.md`) — never re-derive them. The app-spec reader
 *    + validator come from `./app-spec.mjs`, the SAME module the `pnpm
 *    app-spec:check` gate imports, so contract and consumer cannot drift.
 *  - **Plan by default, write only when asked** — `planScaffold` is read-only;
 *    `emitScaffold` is the separate, explicit write. `codemod` never edits a file;
 *    migration stays read-only until plan approval (VP-03 #125).
 *  - **Errors are data** — expected failures (missing file, unknown archetype)
 *    return `{ status: "error", error }` rather than throwing, so a `--json`
 *    consumer always gets a shape.
 */
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadManifest, flat } from "./core.mjs";
import { loadSchema, specFromFile, validateSpec } from "./app-spec.mjs";
import { scanText } from "./audit.mjs";
import { applyMarkerBlock } from "./context.mjs";
import { renderContextBlock } from "./render-docs.mjs";

// The markdown deliverables (`migration/{repo-profile,analysis,plan}.md`) are
// rendered by a sibling module and re-exported here so `scan`/`map`/`docs` all
// hang off one import. Pure string generation — it never touches the filesystem.
export { renderMigrationDocs, MIGRATION_DOCS, MIGRATION_PHASES } from "./migration-report.mjs";

/** The six app archetypes — each maps to a registry template + a playbook. */
export const ARCHETYPES = [
  "dashboard",
  "data-app",
  "ai-assistant",
  "flow-workspace",
  "settings",
  "marketing",
];

/**
 * How an existing component maps onto brand-ui (brownfield analysis, VP-03):
 *  - `direct`  — a 1:1 brand-ui equivalent (drop-in rename).
 *  - `props`   — an equivalent exists but props/API differ (rename + prop remap).
 *  - `compose` — no single equivalent; rebuild by composing brand-ui primitives.
 *  - `gap`     — no equivalent; needs a new library component (or registry block).
 *  - `drop`    — bespoke/no-op; remove or leave as-is.
 */
export const MAP_CLASSES = ["direct", "props", "compose", "gap", "drop"];

/** The codemod lifecycle (every transform is generate → dry-run → apply). */
export const CODEMOD_MODES = ["generate", "dry-run", "apply"];

/**
 * The AST codemod tool the full migration engine will use (VP-03 #125).
 * OSS / no-paid-deps. Declared here as the contract; the dependency is added
 * when the transforms are actually implemented (this module never runs it).
 */
export const CODEMOD_TOOL = "jscodeshift";

// ---- shared helpers --------------------------------------------------------

/** Read + JSON.parse a file; `{ data }` on success, `{ error }` on failure. */
function readJson(file) {
  if (!existsSync(file)) return { error: `not found: ${file}` };
  try {
    return { data: JSON.parse(readFileSync(file, "utf8")) };
  } catch (err) {
    return { error: `invalid JSON in ${file}: ${err.message}` };
  }
}

/**
 * Resolve an input that may be a path to a JSON file OR an already-parsed object
 * (so the functions compose in-process AND from the CLI). Returns `{ data }` or
 * `{ error }`.
 */
function resolveInput(input, label) {
  if (input && typeof input === "object") return { data: input };
  if (typeof input === "string" && input) return readJson(resolve(input));
  return { error: `missing ${label} (pass a path to a JSON file)` };
}

/** package.json at `dir` or `dir/package.json`, parsed; null if absent/bad. */
function readPkgJson(dir) {
  const file = dir.endsWith("package.json") ? dir : join(dir, "package.json");
  const r = readJson(file);
  return r.data ?? null;
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  "storybook-static",
  "coverage",
]);

/** Walk a tree collecting source files (capped), depth- and dir-pruned. */
function walkSource(dir, { exts, cap = 4000, acc = [] } = {}) {
  if (acc.length >= cap || !existsSync(dir)) return acc;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (acc.length >= cap) break;
    if (SKIP_DIRS.has(e) || e.startsWith(".")) continue;
    const p = join(dir, e);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) walkSource(p, { exts, cap, acc });
    else if (exts.test(e)) acc.push(p);
  }
  return acc;
}

// ---- scaffold (greenfield; VP-02 #123 / #55 / #263) ------------------------

/** The npm scope every brand-ui package lives under. */
export const PKG_SCOPE = "@elabs-ai/components-";
/**
 * Where a scaffolded app resolves `@elabs-ai/*` from: the PUBLIC npm registry.
 *
 * Was `null` while the scope was unpublished, which forced every standalone
 * scaffold onto local `pnpm pack` tarballs. The packages are public now, so an
 * ordinary `pnpm add` works with no configuration at all — see `npmrcFor()` for
 * why that means the scaffold still emits an EMPTY `.npmrc`.
 */
export const REGISTRY_URL = "https://registry.npmjs.org/";

/** npm's own default registry — the one host that needs no scope mapping. */
const PUBLIC_REGISTRY_HOSTS = new Set(["registry.npmjs.org"]);

/**
 * The `.npmrc` a standalone app needs to resolve this scope — usually nothing.
 *
 * A scope mapping is what a PRIVATE or mirrored registry requires. Emitting one
 * for npmjs.org would be worse than redundant: it hands every generated app a
 * `${NPM_TOKEN}` placeholder to provision for packages that install
 * anonymously, and the first thing a reader does with an unexplained token line
 * is go looking for the secret. Pure.
 */
export function npmrcFor(registry) {
  if (!registry) return "";
  let host;
  try {
    host = new URL(registry).host;
  } catch {
    return "";
  }
  if (PUBLIC_REGISTRY_HOSTS.has(host)) return "";
  return [`@elabs-ai:registry=${registry}`, `//${host}/:_authToken=\${NPM_TOKEN}`].join("\n");
}
/** Every scaffold installs at least these two (tokens = the theme, ui = the shell). */
export const BASE_PACKAGES = [`${PKG_SCOPE}tokens`, `${PKG_SCOPE}ui`];

/**
 * One-time side-effect imports a PEER engine requires, keyed by the peer itself
 * (not by the brand-ui package) — `@xyflow/react` is peered by BOTH `…-flow` and
 * `…-ai`, so keying by peer is what makes the stylesheet follow the engine
 * wherever it is pulled in. These mirror `docs/CONSUMING.md` §3.
 */
const PEER_EXTRAS = {
  "@xyflow/react": [`import "@xyflow/react/dist/style.css";`],
};

/** One-time side-effect imports a brand-ui package itself requires (its own subpath). */
const PACKAGE_EXTRAS = {
  [`${PKG_SCOPE}editor`]: [`import "${PKG_SCOPE}editor/monaco-environment";`],
};

/**
 * Peers every scaffold needs regardless of archetype (CONSUMING.md §3 + §4), with
 * the range the scaffold pins. React 19 is the scaffold's target (the packages
 * themselves peer `^18.2.0 || ^19.0.0`; an app picks one).
 */
const BASE_PEERS = { react: "^19.0.0", "react-dom": "^19.0.0", tailwindcss: "^4.0.0" };

const uniqSorted = (xs) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
const uniq = (xs) => [...new Set(xs)];

/** Path (repo-relative) of an archetype's generated template source. */
export const templatePath = (archetype) => `docs/playbooks/templates/${archetype}.tsx`;

/** This CLI package's own root (works installed AND from a source checkout). */
const CLI_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Where the templates ship INSIDE the installed CLI. `packages/cli` carries them
 * in `files` and copies them in `prepack` (mirroring the manifest copy), so
 * `brand-ui scaffold --write` works in any project that installed the CLI — not
 * only from a brand-ui checkout. Absent in a dev checkout, where the repo copy
 * under `docs/playbooks/templates/` is the source of truth.
 */
export const BUNDLED_TEMPLATE_DIR = join(CLI_ROOT, "templates");

/**
 * Resolve an archetype's template source on disk, or `null` when it is reachable
 * from neither place. Repo copy first (a checkout is always the freshest — it is
 * regenerated by `pnpm gen:templates`), then the copy bundled with the CLI.
 *
 * `bundledDir` is an override (the tests use it to exercise the unreachable case;
 * it also allows an alternate template pack).
 */
export function resolveTemplateFile(archetype, { root, bundledDir = BUNDLED_TEMPLATE_DIR } = {}) {
  const candidates = [];
  if (root) candidates.push(join(root, templatePath(archetype)));
  if (bundledDir) candidates.push(join(bundledDir, `${archetype}.tsx`));
  return candidates.find((f) => existsSync(f)) ?? null;
}

/**
 * The module specifiers a template imports, or `null` when the template file is
 * unreachable. Parsed from the generated source, never hand-listed: `pnpm
 * gen:templates` regenerates those files from the Storybook stories, so a
 * hand-kept table would drift the moment a template gains a package.
 *
 * `null` (not `[]`) is deliberate — an empty list is indistinguishable from "this
 * template imports nothing", and silently planning `{tokens, ui}` off a missing
 * file is exactly the missing-package/unstyled-render failure #263 exists to
 * prevent. Callers MUST fail on `null`.
 */
export function templateImports(archetype, opts = {}) {
  const file = resolveTemplateFile(archetype, opts);
  if (!file) return null;
  const src = readFileSync(file, "utf8");
  const out = [];
  for (const m of src.matchAll(/^import\s[\s\S]*?from\s+["']([^"']+)["'];?\s*$/gm)) out.push(m[1]);
  return uniqSorted(out);
}

/**
 * The `@elabs-ai/components-*` package set a scaffold needs.
 *
 *  - `fromTemplate` — DERIVED from the archetype template's import specifiers.
 *  - `extra`        — packages the SPEC pulls in (entities ⇒ the data package, for
 *                     the generated `ColumnDef<Entity>[]` the emitter writes).
 *  - `all`          — `BASE_PACKAGES ∪ fromTemplate ∪ extra`; the single array the
 *                     dependency block, the peer list AND the `@source` lines are
 *                     all generated from, so those three sets cannot diverge.
 *
 * An unreachable template is `{ error }` — NEVER a silent fallback to the
 * tokens+ui floor (that would hand a standalone app a plan missing `…-ai` /
 * `…-flow` and their engines, with no warning).
 */
export function scaffoldPackages(archetype, spec = {}, { root, bundledDir } = {}) {
  const imports = templateImports(archetype, { root, bundledDir });
  if (imports === null) {
    return {
      error:
        `cannot derive the package set — ${templatePath(archetype)} is unreachable ` +
        `(looked in the repo root${root ? ` \`${root}\`` : " (none found)"} and in the ` +
        `templates bundled with the CLI). Run from a brand-ui checkout (\`pnpm gen:templates\` ` +
        `if the file is missing) or reinstall @elabs-ai/components-cli.`,
    };
  }
  const fromTemplate = imports.filter((s) => s.startsWith(PKG_SCOPE));
  const extra =
    spec.entities?.length && !fromTemplate.includes(`${PKG_SCOPE}data`) ? [`${PKG_SCOPE}data`] : [];
  return { fromTemplate, extra, all: uniqSorted([...BASE_PACKAGES, ...fromTemplate, ...extra]) };
}

/**
 * The peers a brand-ui package declares, with the range IT declares — read from
 * the package itself, never hand-listed (#263 AC3). Two sources, same data:
 *
 *  1. the checkout (`<root>/packages/<pkg>/package.json`) — freshest;
 *  2. the manifest's `peerDependencies` (bundled with the CLI) — the only one
 *     reachable in consumer mode, outside the monorepo.
 *
 * Intra-scope peers (`@elabs-ai/…`) are dropped — they are the brand-ui
 * packages themselves, already in the dependency block — as are the base peers
 * every app installs anyway (react / react-dom / tailwindcss).
 */
export function packagePeers(pkgName, { root, manifest } = {}) {
  const entry = manifest?.packages?.[pkgName];
  const dir = entry?.path ?? `packages/${pkgName.slice(PKG_SCOPE.length)}`;
  const fromDisk = root ? readPkgJson(join(root, dir))?.peerDependencies : null;
  const peers = fromDisk ?? entry?.peerDependencies ?? {};
  return Object.fromEntries(
    Object.entries(peers).filter(
      ([name]) => !name.startsWith("@elabs-ai/") && !(name in BASE_PEERS),
    ),
  );
}

/** The monorepo's own version — the release a standalone scaffold installs by default. */
function repoVersion(root) {
  const pkg = root ? readPkgJson(root) : null;
  return pkg?.version ?? null;
}

/**
 * The "make it runnable" handoff (#263). A scaffold that targets a folder OUTSIDE
 * this monorepo cannot install anything without the GitHub-Packages recipe, and
 * renders **unstyled** without the `@source` lines — the single most common
 * consumer mistake (`docs/CONSUMING.md` §4). So the plan carries the whole block,
 * generated from ONE package array.
 *
 * `standalone: false` (the default) keeps `workspace:*` and emits no registry
 * block at all.
 */
export function planInstall(archetype, spec, { root, manifest, bundledDir } = {}) {
  const set = scaffoldPackages(archetype, spec, { root, bundledDir });
  if (set.error) return { error: set.error };
  const packages = set.all;
  const standalone = spec.standalone === true;
  const release = spec.release || repoVersion(root) || null;

  // Peer ranges come from the packages' own `peerDependencies` — so the app
  // installs the range the library actually supports (`@xyflow/react ^12.11.1`,
  // `ai ^6.0.0 || ^7.0.0`), never a `*` wildcard on a context-singleton engine.
  const mf = manifest ?? loadManifest(root);
  const peerRanges = { ...BASE_PEERS };
  const extras = [];
  for (const pkg of packages) {
    for (const [peer, range] of Object.entries(packagePeers(pkg, { root, manifest: mf }))) {
      // First declaration wins; the packages are versioned in lockstep, so they
      // agree — and a genuine disagreement is a repo bug, not a scaffold choice.
      peerRanges[peer] ??= range;
      extras.push(...(PEER_EXTRAS[peer] ?? []));
    }
    extras.push(...(PACKAGE_EXTRAS[pkg] ?? []));
  }
  const peers = uniqSorted(Object.keys(peerRanges));
  const spec$ = (name) => `${name}@${peerRanges[name]}`;

  const css = {
    // The engine, then the two REFERENCE themes — which are opt-in subpaths since
    // ADR 0029 (styles.css alone ships a neutral `:root` base and no selectable
    // theme). A scaffolded app gets both so its theme switcher works out of the
    // box; an app that authors its own theme deletes these two lines.
    import: [
      `@import "${PKG_SCOPE}tokens/styles.css";`,
      `@import "${PKG_SCOPE}tokens/themes/light.css";`,
      `@import "${PKG_SCOPE}tokens/themes/dark.css";`,
    ].join("\n"),
    // One `@source` per installed package — generated from the SAME array as the
    // deps, so "I installed it but it renders unstyled" cannot happen.
    sources: packages.map((p) => `@source "../node_modules/${p}/dist";`),
  };

  if (!standalone) {
    return {
      standalone: false,
      packages,
      peers,
      peerRanges,
      dependencyRange: "workspace:*",
      css,
      extras: uniq(extras),
    };
  }

  const range = release ? `^${release}` : "latest";
  return {
    standalone: true,
    registry: REGISTRY_URL,
    release,
    packages,
    peers,
    peerRanges,
    dependencyRange: range,
    // Empty for the public registry: npmjs.org is npm's default, so there is
    // nothing to map and nothing to authenticate against.
    npmrc: npmrcFor(REGISTRY_URL),
    // Quoted: `^` and `@` are glob/history characters in some shells, and a
    // copy-pasted install line has to work in the shell the user actually has.
    addCommand: `pnpm add ${packages.map((p) => `"${p}@${range}"`).join(" ")}`,
    peerCommand: `pnpm add ${peers.map((p) => `"${spec$(p)}"`).join(" ")}`,
    css,
    extras: uniq(extras),
    docs: "docs/CONSUMING.md §1-4",
  };
}

/** Normalize + validate an app-spec (path to .md/.json, or an already-parsed object). */
function resolveSpec(input, { root } = {}) {
  let data;
  if (input && typeof input === "object") {
    data = input;
  } else if (typeof input === "string" && input) {
    // `.md` → the fenced ```json "Machine spec" block; `.json` → the whole file.
    const r = specFromFile(resolve(input));
    if (r.error) return { error: r.error };
    data = r.data;
  } else {
    return { error: `missing spec (pass a path to app-spec.md or a JSON file)` };
  }

  const archetype = data.archetype;
  if (!archetype || !ARCHETYPES.includes(archetype)) {
    return {
      error:
        `spec.archetype must be one of: ${ARCHETYPES.join(", ")}` +
        (archetype ? ` (got "${archetype}")` : " (missing)"),
    };
  }
  // Defaults BEFORE validation, so a minimal `{ archetype }` stays legal while the
  // schema still catches bad enums/shapes on everything the interview did answer.
  const normalized = { ...data, archetype, theme: data.theme || "light" };
  normalized.title = data.title || archetype;

  const schema = loadSchema(root);
  if (schema) {
    const errors = validateSpec(normalized, schema);
    if (errors.length) return { error: `app-spec does not satisfy the contract: ${errors[0]}` };
  }
  return { data: normalized };
}

/**
 * Plan a born-compliant app scaffold from an `app-spec` (greenfield). **Read-only** —
 * `emitScaffold` is the separate, explicit write, so the CLI stays plan-by-default.
 *
 * INPUT  — `spec`: a path to `app-spec.md` (the fenced ```json Machine-spec block is
 *          extracted + validated against the shipped schema), a path to a JSON file,
 *          or the parsed object. Only `archetype` is required.
 * OUTPUT — a scaffold PLAN: which template + playbook + theme + gates + agent-context
 *          files the app is generated from, the file set it lays down, and the
 *          "make it runnable" install handoff (#263).
 *
 * @returns {{ command:"scaffold", status:"planned"|"error", implemented:true,
 *   error?:string, spec?:object, template?:object, playbook?:object, theme?:string,
 *   gates?:string[], contextFile?:string, contextFiles?:string[], install?:object,
 *   files?:string[], notes?:string[] }}
 */
export function planScaffold(spec, { root, bundledDir } = {}) {
  const base = { command: "scaffold", implemented: true };
  const r = resolveSpec(spec, { root });
  if (r.error) return { ...base, status: "error", error: r.error };

  const { archetype, theme, title } = r.data;

  // Resolve the template from the generated source (single source of truth: the
  // Storybook stories; `pnpm gen:templates` derives docs/playbooks/templates/<name>.tsx
  // + the manifest `templates` entry). The old per-archetype registry:page items
  // (template-<archetype>) were dropped — the generated .tsx is now the seed.
  const manifest = loadManifest(root);
  const inManifest = (manifest?.templates ?? []).some((t) => t.name === archetype);
  const templateRel = templatePath(archetype);
  const templateFile = resolveTemplateFile(archetype, { root, bundledDir });

  const playbookRel = `docs/playbooks/${archetype}.md`;
  const playbookExists = root ? existsSync(join(root, playbookRel)) : false;

  // An underivable package set is a HARD failure, never a quiet {tokens, ui}
  // default: a plan that silently drops `…-ai`/`…-flow` and their engines is the
  // missing-package / unstyled-render failure #263 exists to prevent.
  const install = planInstall(archetype, r.data, { root, manifest, bundledDir });
  if (install.error) return { ...base, status: "error", error: install.error };

  return {
    ...base,
    status: "planned",
    spec: {
      archetype,
      theme,
      title,
      // The stage-5 taste profile (#109) — carried through so the scaffolder
      // applies it via the DIALS (ThemeProvider defaultRegister/defaultDensity/
      // defaultMotionPreference/defaultDecoration), never as hardcoded values in
      // emitted component source. Absent → the restrained default (ADR 0020).
      ...(r.data.taste ? { taste: r.data.taste } : {}),
      ...(r.data.surfaces ? { surfaces: r.data.surfaces } : {}),
      ...(r.data.entities ? { entities: r.data.entities } : {}),
      ...(r.data.standalone !== undefined ? { standalone: r.data.standalone } : {}),
      ...(r.data.release ? { release: r.data.release } : {}),
    },
    template: {
      name: archetype,
      inManifest,
      path: templateRel,
      exists: Boolean(templateFile),
      file: templateFile,
    },
    playbook: { path: playbookRel, exists: playbookExists },
    theme,
    // The WP-10 gates a scaffolded app is born passing (cross-theme = the ACTIVE themes).
    gates: ["typecheck", "lint", "tokens-only", "theme-safe(light,dark)", "a11y", "brand-ui audit"],
    // The agent handoff (#123 AC2): the two contracts + the manifest-derived
    // component inventory (`brand-ui context`'s block) so a later session's agent
    // knows what exists without a running server.
    contextFile: "brand-ui-context.md",
    contextFiles: ["CLAUDE.md", "AGENTS.md", "brand-ui-context.md"],
    install,
    files: SCAFFOLD_FILES,
    notes: [
      `Plan only. Run \`brand-ui scaffold <spec> --write <dir>\` to emit the ${SCAFFOLD_FILES.length} file(s) above.`,
      `Template seed: ${templateFile ?? templateRel} (generated from the Storybook story) with the spec applied.`,
      install.standalone
        ? "Standalone: the install handoff (registry + deps + CSS) is in `install` — see docs/CONSUMING.md §1-4."
        : "In-monorepo: dependencies stay `workspace:*` (set `standalone: true` in the spec for the registry handoff).",
    ],
  };
}

// ---- scaffold emission -----------------------------------------------------

/**
 * The file set every scaffold lays down, relative to the target directory.
 *
 * It is the RUNNABLE set, not just the interesting one: `package.json` declares
 * `dev`/`build`, so everything those scripts need — `index.html` (the Vite entry
 * that mounts `#root`), `vite.config.ts` (the `@tailwindcss/vite` plugin, without
 * which `styles.css` is never processed and the app renders unstyled —
 * `docs/CONSUMING.md` §4), `tsconfig.json` — ships with them (#123 AC1).
 */
export const SCAFFOLD_FILES = [
  "index.html",
  "src/App.tsx",
  "src/main.tsx",
  "src/styles.css",
  "vite.config.ts",
  "tsconfig.json",
  "app-spec.md",
  "CLAUDE.md",
  "AGENTS.md",
  "brand-ui-context.md",
  "eslint.config.js",
  ".github/workflows/brand-ui.yml",
  "package.json",
];

/**
 * The files whose absence means the target is NOT a working app. Skipping any of
 * them (scaffolding into a folder that already has one) downgrades the result to
 * `partial` — a non-zero, explicitly-reported outcome, never a headline "written".
 */
const CRITICAL_FILES = new Set([
  "index.html",
  "src/App.tsx",
  "src/main.tsx",
  "src/styles.css",
  "vite.config.ts",
  "package.json",
]);

const TS_TYPE = { text: "string", number: "number", date: "string", status: "string" };
const tsType = (t) => TS_TYPE[t] ?? (t === "boolean" ? "boolean" : "string");

/** "unitPrice" / "unit_price" / "unit price" → "Unit price". */
function titleCase(name) {
  const words = String(name)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
/** "Sales Pulse" → "sales-pulse" (a legal npm package name segment). */
function slug(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "brand-ui-app"
  );
}
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const pascal = (s) => String(s).replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""));

/**
 * Rewrite bare `#123` issue references in the template's COMMENTS to
 * "brand-ui issue 123". Two reasons, one edit: a scaffolded app has no access to
 * this repo's tracker (the plugin's consumer-clean reasoning), and `#269` is a
 * false `raw-hex` hit for `brand-ui audit` — so a born-compliant app would report
 * token violations on day one. Only comment lines are touched.
 */
function derefIssues(src) {
  return src
    .split("\n")
    .map((line) => {
      const t = line.trimStart();
      const isComment =
        t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*");
      return isComment ? line.replace(/#(\d{1,5})\b/g, "brand-ui issue $1") : line;
    })
    .join("\n");
}

/** The last top-level `function X(` in a template — its root composition. */
function rootComponent(src) {
  const names = [...src.matchAll(/^function\s+([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]);
  return names.at(-1) ?? null;
}

/**
 * Rewrite the template's `const nav = [...]` labels from `spec.surfaces`.
 *
 * Labels only — the entry **ids** stay as the template wrote them because they drive
 * the template's own `active === "<id>"` view switching; renaming them silently would
 * leave the main region blank. Extra spec surfaces are appended with their own id and
 * a `TODO(spec)` so nothing is dropped.
 */
function applyNavLabels(src, surfaces, todos) {
  const m = src.match(/^const nav = \[\n([\s\S]*?)\n\];$/m);
  if (!surfaces.length) return src;
  if (!m) {
    todos.push(`nav: this template has no nav list — place the surfaces yourself`);
    return src;
  }
  const entries = m[1].split("\n").filter((l) => l.trim());
  const iconOf = (line) => line.match(/icon:\s*([A-Za-z0-9_]+)/)?.[1] ?? null;
  const firstIcon = entries.map(iconOf).find(Boolean) ?? null;

  const next = entries.map((line, i) => {
    const s = surfaces[i];
    const templateId = line.match(/id:\s*"([^"]*)"/)?.[1];
    if (!s) {
      todos.push(`nav[${templateId}]: template entry the spec never named — rename it or drop it`);
      return `${line.replace(/,?\s*$/, ",")} // TODO(spec): surface not named in the spec`;
    }
    const label = JSON.stringify(s.navLabel);
    const renamed = line.replace(/label:\s*"[^"]*"/, `label: ${label}`);
    if (!s.id || !templateId || s.id === templateId) return renamed;
    // Ids drive the template's own `active === "<id>"` switching, so they are kept.
    todos.push(
      `nav[${templateId}]: labelled "${s.navLabel}" but keeps the template id — rename the id AND its \`active === "${templateId}"\` checks to "${s.id}" if you want the spec's id`,
    );
    return `${renamed.replace(/,?\s*$/, ",")} // TODO(spec): spec id "${s.id}"`;
  });
  for (const s of surfaces.slice(entries.length)) {
    const icon = firstIcon ? `, icon: ${firstIcon}` : "";
    next.push(
      `  { id: ${JSON.stringify(s.id)}, label: ${JSON.stringify(s.navLabel)}${icon} }, // TODO(spec): render this surface`,
    );
    todos.push(`surfaces[${s.id}]: nav entry added — its view is not built yet`);
  }
  return src.replace(m[0], `const nav = [\n${next.join("\n")}\n];`);
}

/** `interface <Entity>` + (when the data package is in scope) `ColumnDef<Entity>[]`. */
function entityBlock(spec, hasColumnDef, todos) {
  const entities = spec.entities ?? [];
  if (!entities.length) {
    todos.push("entities: none in the spec — model your domain objects before wiring data");
    return "";
  }
  const chunks = entities.map((e) => {
    const name = pascal(e.name) || "Entity";
    const fields = (e.fields ?? []).map((f) => {
      const note = f.rendersAs ? ` // TODO(spec): render as ${f.rendersAs}` : "";
      return `  ${f.name}: ${tsType(f.type)};${note}`;
    });
    const iface = `export interface ${name} {\n${fields.join("\n")}\n}`;
    if (!hasColumnDef) {
      todos.push(
        `entities[${name}]: columns not generated — add ${PKG_SCOPE}data (DataTable + ColumnDef) to render a table`,
      );
      return iface;
    }
    const cols = (e.fields ?? []).map(
      (f) =>
        `  { accessorKey: ${JSON.stringify(f.name)}, header: ${JSON.stringify(titleCase(f.name))} },`,
    );
    const columns = `export const ${lowerFirst(name)}Columns: ColumnDef<${name}>[] = [\n${cols.join("\n")}\n];`;
    return `${iface}\n\n${columns}`;
  });
  return [
    "",
    "// ---------------------------------------------------------------------------",
    "// Domain model — generated from app-spec.md (stage 4). Wire it into the",
    "// composition above; the sample data the template ships is placeholder only.",
    "// ---------------------------------------------------------------------------",
    chunks.join("\n\n"),
    "",
  ].join("\n");
}

/** Turn the archetype template into the scaffolded app's `src/App.tsx`. */
function buildApp(templateSrc, spec, { archetype, packages, todos }) {
  let src = derefIssues(templateSrc);

  // 1 · Replace the template's whole "GENERATED … do not edit / single source of
  //     truth" preamble (everything before the first import) — this copy IS the
  //     user's code, and the story-provenance prose would only mislead them.
  const firstImport = src.search(/^import /m);
  const preamble =
    `/* ${spec.title} — scaffolded by \`brand-ui scaffold\` from ./app-spec.md.\n` +
    ` *\n` +
    ` * Archetype: ${archetype} · theme: ${spec.theme}.\n` +
    ` * Seed: ${templatePath(archetype)} in the brand-ui repo (itself generated from\n` +
    ` * that archetype's Storybook story). This is YOUR code now — edit freely.\n` +
    ` *\n` +
    ` * \`TODO(spec):\` marks everything the app-spec did not answer. Sample data is\n` +
    ` * placeholder — replace it, don't ship it.\n` +
    ` */\n`;
  if (firstImport > 0) src = preamble + src.slice(firstImport);
  todos.push(
    "data: the template's sample rows/metrics are placeholder — replace them with the real source (brand-ui never fetches; that lives in this app)",
  );

  // 2 · Apply the spec's nav labels.
  src = applyNavLabels(src, spec.surfaces ?? [], todos);

  // 3 · The domain model. `ColumnDef` needs the data package in scope; when the
  //     template doesn't already import it, `scaffoldPackages` added it — so import it.
  const hasData = packages.includes(`${PKG_SCOPE}data`);
  // The templates use multi-line import clauses, so match the whole statement —
  // a per-line test would miss `type ColumnDef,` and emit a duplicate import.
  const dataImport = src.match(
    new RegExp(`^import\\s+([\\s\\S]*?)\\s+from\\s+["']${PKG_SCOPE}data["'];?$`, "m"),
  );
  const importsColumnDef = Boolean(dataImport && /\bColumnDef\b/.test(dataImport[1]));
  if (hasData && !importsColumnDef && spec.entities?.length) {
    src = src.replace(
      /^import .*$/m,
      (first) => `import { type ColumnDef } from "${PKG_SCOPE}data";\n${first}`,
    );
  }
  src += entityBlock(spec, hasData, todos);

  // 4 · The templates are story bodies — give the app a default export to render.
  const root = rootComponent(src);
  if (root) src += `\nexport default ${root};\n`;
  else todos.push("export: no root component found in the template — export your own");

  return src;
}

/** Escape the five XML entities so a spec title can't break (or inject into) the HTML. */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * `index.html` — Vite's entry document. Without it `pnpm dev` / `vite build` have
 * nothing to serve and `main.tsx`'s `getElementById("root")` has no mount point.
 * `data-theme` is set here too so the first paint is already themed (no flash
 * before `ThemeProvider` writes it).
 */
function buildIndexHtml(spec) {
  return `<!doctype html>
<html lang="en" data-theme="${escapeHtml(spec.theme)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(spec.title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

/**
 * `vite.config.ts` — react + Tailwind v4. The `@tailwindcss/vite` plugin is NOT
 * optional: without it `src/styles.css` is never processed, so the token
 * stylesheet and the `@source` lines do nothing and every brand-ui component
 * renders unstyled (`docs/CONSUMING.md` §4).
 */
function buildViteConfig() {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4 runs as a Vite plugin. Remove it and src/styles.css is never
// processed — the app builds, and renders completely UNSTYLED. See
// docs/CONSUMING.md §4 in the brand-ui repo.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
`;
}

/**
 * `tsconfig.json` — the same shape as the monorepo's own Vite apps
 * (`@elabs-ai/components-typescript-config/vite-app.json`), inlined
 * because that config package is private + unpublished. `noUnusedLocals` /
 * `noUnusedParameters` are deliberately NOT on: a scaffold legitimately carries
 * imports for the `TODO(spec):` wiring that isn't done yet, and a fresh app that
 * cannot `typecheck` teaches the wrong lesson on day one.
 */
function buildTsConfig() {
  return (
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "Bundler",
          moduleDetection: "force",
          jsx: "react-jsx",
          types: ["vite/client"],
          esModuleInterop: true,
          resolveJsonModule: true,
          isolatedModules: true,
          verbatimModuleSyntax: true,
          strict: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          noEmit: true,
        },
        include: ["src", "vite.config.ts"],
        exclude: ["node_modules", "dist"],
      },
      null,
      2,
    ) + "\n"
  );
}

/**
 * `.github/workflows/brand-ui.yml` — the gates, actually running somewhere.
 *
 * A standalone app cannot install the shared eslint-config (private +
 * unpublished), so `brand-ui audit` is its ONLY machine enforcement of the
 * type/colour taxonomy — a gate that never runs is not a gate, so the scaffold
 * ships the CI job that runs it (#123 AC2 "gates").
 */
function buildWorkflow(install) {
  // brand-ui publishes PUBLIC packages to npmjs.org, so a scaffolded app needs
  // no registry mapping and no token: npmjs.org is npm's default and the
  // packages resolve anonymously. The `registry-url` / `NODE_AUTH_TOKEN` pair
  // this used to emit is what a PRIVATE registry needs — emitting it now would
  // hand every generated app a secret it must provision and can never use.
  const auth = "";
  const env = "";
  return `name: quality

on:
  push:
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm${auth}
      - run: pnpm install --frozen-lockfile${env}
      - run: pnpm typecheck
      - run: pnpm lint
      # The static token / anti-slop taxonomy pass. Keep it: type is a role and
      # colour is a token, and this is what proves it on every push.
      - run: pnpm audit:ui
`;
}

/**
 * `brand-ui-context.md` — the manifest-derived component inventory (the same
 * block `brand-ui context` generates, WP-03 #82). #123 AC2 asks for a context
 * file next to CLAUDE.md/AGENTS.md: this is it, so a later agent session knows
 * what exists across `@elabs-ai/components-*` without a running
 * Storybook, an MCP server, or a guess.
 */
function buildContextFile(root) {
  const manifest = loadManifest(root);
  const seed = `# Agent context — brand-ui ground truth

Generated by \`brand-ui scaffold\` from the component manifest. Refresh it with
\`brand-ui context\` (or re-run the scaffold) after upgrading the packages. The
live, queryable API is \`brand-ui docs <Component>\` / \`brand-ui search <concept>\`.
`;
  if (!manifest) {
    return (
      seed +
      `
> The component manifest was not reachable when this app was scaffolded, so the
> inventory below is empty. Run \`brand-ui context\` from a brand-ui checkout, or
> reinstall \`@elabs-ai/components-cli\` (it ships the manifest), then
> re-run to fill it in.
`
    );
  }
  return applyMarkerBlock(seed, renderContextBlock(manifest));
}

/** `src/main.tsx` — the root wiring: stylesheet, ThemeProvider, engine side-effects. */
function buildMain(spec, install) {
  const extras = install.extras.map((e) => `${e}\n`).join("");
  return `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "${PKG_SCOPE}tokens";
import "./styles.css";
${extras}import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="${spec.theme}">
      <App />
    </ThemeProvider>
  </StrictMode>,
);
`;
}

/** `src/styles.css` — the tokens import + one `@source` per installed package. */
function buildStyles(install) {
  return `/* brand-ui styling entry.
 *
 * 1) The token stylesheet pulls in Tailwind v4, the @theme inline token→utility
 *    map, a neutral \`:root\` base and the fonts. The two REFERENCE themes are
 *    separate, opt-in imports — keep the ones you use, or drop both and import
 *    your own theme stylesheet instead (see docs/CONSUMING.md §5.1).
 * 2) Tailwind ignores node_modules unless you @source it — one line per
 *    @elabs-ai/components-* package you render. Delete a line and those
 *    components render UNSTYLED. See docs/CONSUMING.md §4.
 */
${install.css.import}

${install.css.sources.join("\n")}
`;
}

/** `eslint.config.js` — the taxonomy lint (`brand/no-raw-*` at `error`). */
function buildEslintConfig(standalone) {
  if (!standalone) {
    return `import { reactConfig } from "${PKG_SCOPE}eslint-config/react";

// A freshly scaffolded app starts clean, so the two taxonomy rules run at
// \`error\`: type is a role (never text-2xl/text-[18px]) and colour is a token
// (never #hex / bg-gray-500). That is what keeps an agent's edit loop on-system.
export default [
  ...reactConfig,
  {
    rules: {
      "brand/no-raw-font-size": "error",
      "brand/no-raw-color": "error",
    },
  },
];
`;
  }
  // Standalone: the shared config is a PRIVATE, unpublished package — it cannot be
  // installed from outside the monorepo by any specifier. Emit a self-contained
  // config and say plainly which enforcement is missing.
  return `import js from "@eslint/js";
import tseslint from "typescript-eslint";

// NOTE: the shared \`${PKG_SCOPE}eslint-config\` (which ships
// \`brand/no-raw-font-size\` + \`brand/no-raw-color\`) is a PRIVATE, unpublished
// package — a standalone app cannot install it. Until it is published, the two
// taxonomy rules are NOT machine-enforced here; they are still non-negotiable and
// are spelled out in CLAUDE.md, and \`brand-ui audit <dir>\` catches raw colours
// and other token violations statically. Run it in CI.
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: ["dist/**"] },
];
`;
}

/** `CLAUDE.md` — the agent contract a later session inherits. */
function buildClaudeMd(spec, plan, install) {
  const { title, archetype, theme } = spec;
  const installSection = install.standalone
    ? `## Install / make it runnable

The \`@elabs-ai/components-*\` packages are **public on npmjs.org** — no registry
configuration, no token:

\`\`\`bash
${install.addCommand}
${install.peerCommand}
\`\`\`

\`src/styles.css\` already carries the token import and one \`@source\` line per
installed package — **do not delete them**, the components render unstyled without
them. Full recipe: ${install.docs} in the brand-ui repo.`
    : `## Install / make it runnable

This app lives inside the brand-ui monorepo: \`@elabs-ai/components-*\`
dependencies stay \`workspace:*\` and \`pnpm install\` at the repo root wires them.
\`src/styles.css\` carries the token import and one \`@source\` line per package —
**do not delete them**, the components render unstyled without them.`;

  return `# CLAUDE.md — ${title}

This app is built on **brand-ui** (\`@elabs-ai/components-*\`). It was
scaffolded from the **${archetype}** template; the spec is in \`./app-spec.md\` — read
it before making structural changes.

## Non-negotiable rules

- **Use brand-ui components first.** Before writing any UI markup, check
  \`…-ui\`, \`…-data\`, \`…-ai\`, \`…-flow\`, \`…-charts\`, \`…-marketing\` for an existing
  component (\`pnpm exec brand-ui search <concept>\`, or the \`mcp__brand-ui__search\`
  tool in Claude Code). Do not hand-roll tables, dialogs, chat bubbles, or KPI tiles.
- **Type is a role, not a size.** Use a \`text-<role>\` utility (\`text-title\`,
  \`text-body\`, \`text-caption\`, \`text-display\`, \`text-kpi\`, …) or the
  \`<Heading>\`/\`<Text>\` components. Never \`text-2xl\`, \`text-sm\`, or \`text-[18px]\`.
- **Semantic tokens only.** \`bg-background\`, \`text-muted-foreground\`,
  \`bg-primary\` (+ \`text-primary-foreground\`), \`border-border\`,
  \`var(--chart-1..5)\`. Never raw hex, \`rgb()\`, \`bg-[#…]\`, or a Tailwind palette
  (\`text-gray-500\`). Re-theming must stay a token swap.
- **Don't touch the theme mechanism.** The app is themed via
  \`<ThemeProvider defaultTheme="${theme}">\` from \`…-tokens\` (see \`src/main.tsx\`).
  To change look-and-feel, change tokens/theme — not component styles.
- **Keep the existing shell.** Extend the sidebar/nav in place; don't rebuild it.
- **Icons:** generic glyphs from \`lucide-react\`; brand marks from \`…-icons\`.
  No other icon libraries.
- **States:** every async surface gets loading (\`Skeleton\`), empty
  (\`StatePanel kind="empty"\`), and error (\`StatePanel kind="error"\`) — never a
  blank region.
- **brand-ui is presentation-only.** Model calls, fetching, and transport live in
  this app's hooks/services — never inside shared UI components.
- **Audit after UI edits.** \`pnpm lint\` and \`pnpm audit:ui\` (= \`brand-ui audit
src\`) — the static token/anti-slop pass; the rendered cross-theme + contrast pass
  is the \`brand-ui-audit\` skill. Both run in CI
  (\`.github/workflows/brand-ui.yml\`) — keep that job green.

## What exists (don't guess an API)

\`./brand-ui-context.md\` is the generated inventory of every component in every
\`@elabs-ai/components-*\` package — read it before inventing a
component. For the real props of one component: \`pnpm exec brand-ui docs <Name>\`
(or \`mcp__brand-ui__docs\`). Refresh the inventory after upgrading the packages
with \`pnpm exec brand-ui context\`.

## Run it

\`\`\`bash
pnpm dev        # vite (index.html → src/main.tsx → src/App.tsx)
pnpm typecheck  # tsc --noEmit
pnpm lint
pnpm audit:ui   # brand-ui audit src
\`\`\`

${installSection}

## Wiring points

Unfinished spots are marked \`TODO(spec):\` (what the spec did not answer) and
\`WIRE:\` (where real data plugs in). \`grep -rn "TODO(spec):\\|WIRE:" src\` lists
what's left. Wire them; don't delete the guidance until each is wired.

## Themes

Two shipped themes: \`light\` and \`dark\`. Anything you build must read
correctly in **both** — that is an observed result (render it), never inferred from
"it uses tokens".

## Composition reference

This archetype's recipe: \`${plan.playbook.path}\` in the brand-ui repo (building
blocks, wiring order, common mistakes). Follow it before inventing new structure.
`;
}

/** `AGENTS.md` — the vendor-neutral pointer at the same contract. */
function buildAgentsMd(spec) {
  return `# AGENTS.md — ${spec.title}

**Read \`./CLAUDE.md\` first — it is the full contract for this app** (component
reuse, the type/colour taxonomy, theming, state coverage, the presentation-layer
boundary). This file exists so agents that look for \`AGENTS.md\` find the same rules.

The short version:

- Compose from \`@elabs-ai/components-*\`; don't hand-roll tables, dialogs,
  chat bubbles or KPI tiles.
- Type is a **role** (\`text-title\`/\`text-body\`/…), colour is a **token**
  (\`bg-primary\`, \`text-muted-foreground\`) — never a raw size or hex.
- The theme is \`${spec.theme}\`, applied by \`<ThemeProvider>\` in \`src/main.tsx\`;
  change tokens, not component styles. Everything must read in all three themes.
- The spec is \`./app-spec.md\`; \`grep -rn "TODO(spec):" src\` is the to-do list.
- \`./brand-ui-context.md\` lists every component in every package — read it instead
  of inventing one; \`brand-ui docs <Name>\` gives the real props.
- brand-ui renders models — it never calls them. Fetching/transport lives in this app.
`;
}

/** `app-spec.md` — the spec as given, with its fenced json Machine-spec block. */
function buildAppSpecMd(spec, sourceMarkdown) {
  if (sourceMarkdown) return sourceMarkdown;
  return `# app-spec — ${spec.title}

Generated by \`brand-ui scaffold\`. The prose and the machine block below must stay
in sync; the machine block is what \`brand-ui scaffold\` re-reads.

## Machine spec

\`\`\`json
${JSON.stringify(spec, null, 2)}
\`\`\`
`;
}

/** `package.json` — deps generated from the same package array as the CSS sources. */
function buildPackageJson(spec, install, { lucide, tooling, cliRange }) {
  const range = install.dependencyRange;
  const deps = Object.fromEntries(install.packages.map((p) => [p, range]));
  // #119 icon policy: Lucide is the default glyph set, pinned to the version the
  // monorepo itself ships (read, never hard-coded), so a scaffold can't drift.
  deps["lucide-react"] = lucide;
  deps["react"] = install.peerRanges.react;
  deps["react-dom"] = install.peerRanges["react-dom"];
  for (const peer of install.peers) {
    if (peer === "react" || peer === "react-dom" || peer === "tailwindcss") continue;
    // The range the brand-ui package that needs it DECLARES — never `"*"`. These
    // are context-singleton engines (`@xyflow/react`, `monaco-editor`, the `ai`
    // SDK): a wildcard resolves a version the library never supported and breaks
    // at runtime, not at install (docs/CONSUMING.md §3).
    deps[peer] = install.peerRanges[peer];
  }
  const sorted = (o) =>
    Object.fromEntries(
      Object.keys(o)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => [k, o[k]]),
    );
  return (
    JSON.stringify(
      {
        name: slug(spec.title),
        private: true,
        type: "module",
        scripts: {
          dev: "vite",
          build: "tsc --noEmit && vite build",
          typecheck: "tsc --noEmit",
          lint: "eslint .",
          // NOT `audit` — `pnpm audit` is pnpm's own vulnerability command and
          // would shadow the script.
          "audit:ui": "brand-ui audit src",
        },
        dependencies: sorted(deps),
        devDependencies: sorted({
          [`${PKG_SCOPE}cli`]: cliRange, // `brand-ui audit` / `docs` / `search`
          "@tailwindcss/vite": tooling["@tailwindcss/vite"],
          "@types/react": tooling["@types/react"],
          "@types/react-dom": tooling["@types/react-dom"],
          "@vitejs/plugin-react": tooling["@vitejs/plugin-react"],
          eslint: tooling.eslint,
          tailwindcss: tooling.tailwindcss,
          typescript: tooling.typescript,
          vite: tooling.vite,
          ...(install.standalone
            ? { "@eslint/js": "^9", "typescript-eslint": "^8" }
            : { [`${PKG_SCOPE}eslint-config`]: "workspace:*" }),
        }),
      },
      null,
      2,
    ) + "\n"
  );
}

/** The `lucide-react` range the monorepo itself uses (never hard-coded — #119). */
function lucideVersion(root) {
  const pkg = root ? readPkgJson(join(root, "packages", "ui")) : null;
  return pkg?.dependencies?.["lucide-react"] ?? "^0.577.0";
}

/**
 * The build-tool ranges a scaffold pins — read from the monorepo's own Vite app
 * (`apps/playground`) so the scaffold uses the toolchain this repo actually runs
 * on, not a hand-typed guess that drifts. The fallbacks apply only in consumer
 * mode (published CLI, no checkout reachable).
 */
function toolingVersions(root) {
  const dev = (root ? readPkgJson(join(root, "apps", "playground")) : null)?.devDependencies ?? {};
  const pick = (name, fallback) => dev[name] ?? fallback;
  return {
    "@tailwindcss/vite": pick("@tailwindcss/vite", "^4.0.0"),
    "@types/react": pick("@types/react", "^19.0.2"),
    "@types/react-dom": pick("@types/react-dom", "^19.0.2"),
    "@vitejs/plugin-react": pick("@vitejs/plugin-react", "^4.3.4"),
    eslint: pick("eslint", "^9.17.0"),
    tailwindcss: pick("tailwindcss", "^4.0.0"),
    typescript: pick("typescript", "^5.7.3"),
    vite: pick("vite", "^6.0.7"),
  };
}

/**
 * The closing audit gate: run the SAME static token / anti-slop pass `brand-ui
 * audit` runs, over the bytes the scaffold just produced. "Born compliant" is a
 * claim about what was checked, so the emitter checks it and reports the result
 * instead of asking the caller to remember. Blocking findings are a hard error —
 * the scaffold must never hand over an app that violates the token rules.
 */
function auditEmitted(files) {
  const findings = [];
  for (const [rel, text] of Object.entries(files)) {
    if (!/\.(tsx|jsx|css|html)$/.test(rel)) continue;
    for (const f of scanText(text, { isCss: rel.endsWith(".css") })) findings.push({ ...f, rel });
  }
  const blocking = findings.filter((f) => !f.advisory);
  return {
    command: "brand-ui audit",
    files: Object.keys(files).length,
    issues: blocking.length,
    advisory: findings.length - blocking.length,
    findings: findings.map((f) => `${f.rel}:${f.line} [${f.rule}] ${f.msg}`),
  };
}

/**
 * Emit the scaffold: turn an app-spec into real files on disk.
 *
 * Deterministic and additive — it never overwrites an existing file unless `force`
 * is set (those paths come back in `skipped`), and `dryRun` writes nothing at all.
 * Everything the spec does NOT answer is left as a `TODO(spec):` comment and echoed
 * in `todos` — never invented, never silently dropped.
 *
 * A target that already contains part of an app (scaffolding into a `create-vite`
 * project) comes back as **`partial`**, not `written`: the files that already
 * existed were NOT written, so the emitted app is incomplete and the caller must
 * see it (the CLI exits non-zero). `--force` overwrites — including files the
 * user wrote — so it is never the automatic answer.
 *
 * @returns {{ command:"scaffold", status:"written"|"partial"|"planned"|"error",
 *   implemented:true, error?:string, target?:string, dryRun?:boolean,
 *   written?:string[], skipped?:string[], todos?:string[], plan?:object,
 *   notes?:string[] }}
 */
export function emitScaffold(
  spec,
  { root, target, dryRun = false, force = false, bundledDir } = {},
) {
  const base = { command: "scaffold", implemented: true };
  if (!target) return { ...base, status: "error", error: "missing target (pass --write <dir>)" };

  const plan = planScaffold(spec, { root, bundledDir });
  if (plan.status === "error") return { ...base, status: "error", error: plan.error };

  const archetype = plan.spec.archetype;
  const templateAbs = plan.template.file;
  if (!templateAbs) {
    return {
      ...base,
      status: "error",
      error: `template not found: ${templatePath(archetype)} (run \`pnpm gen:templates\`, or run from inside the monorepo)`,
    };
  }

  const todos = [];
  const set = scaffoldPackages(archetype, plan.spec, { root, bundledDir });
  if (set.error) return { ...base, status: "error", error: set.error };
  const packages = set.all;
  const install = plan.install;
  const sourceMarkdown =
    typeof spec === "string" && spec.endsWith(".md") ? readFileSync(resolve(spec), "utf8") : null;

  const files = {
    "index.html": buildIndexHtml(plan.spec),
    "src/App.tsx": buildApp(readFileSync(templateAbs, "utf8"), plan.spec, {
      archetype,
      packages,
      todos,
    }),
    "src/main.tsx": buildMain(plan.spec, install),
    "src/styles.css": buildStyles(install),
    "vite.config.ts": buildViteConfig(),
    "tsconfig.json": buildTsConfig(),
    "app-spec.md": buildAppSpecMd(plan.spec, sourceMarkdown),
    "CLAUDE.md": buildClaudeMd(plan.spec, plan, install),
    "AGENTS.md": buildAgentsMd(plan.spec),
    "brand-ui-context.md": buildContextFile(root),
    "eslint.config.js": buildEslintConfig(install.standalone),
    ".github/workflows/brand-ui.yml": buildWorkflow(install),
    "package.json": buildPackageJson(plan.spec, install, {
      lucide: lucideVersion(root),
      tooling: toolingVersions(root),
      cliRange: install.standalone ? install.dependencyRange : "workspace:*",
    }),
  };

  // The closing gate (#123 AC3): audit the bytes BEFORE they land. A scaffold that
  // would emit a token violation is a bug in the engine or the template — never
  // something the user has to discover afterwards.
  const audit = auditEmitted(files);
  if (audit.issues) {
    return {
      ...base,
      status: "error",
      audit,
      error: `refusing to emit — the scaffold would violate the token rules (${audit.issues} issue(s)):\n  ${audit.findings.join("\n  ")}`,
    };
  }

  const targetAbs = resolve(target);
  const written = [];
  const skipped = [];
  for (const rel of SCAFFOLD_FILES) {
    const abs = join(targetAbs, rel);
    if (!force && existsSync(abs)) {
      skipped.push(rel);
      continue;
    }
    if (dryRun) {
      written.push(rel);
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, files[rel], "utf8");
    written.push(rel);
  }

  // Refuse rather than no-op: an already-scaffolded target with nothing left to
  // write is a mistake the caller must see (exit 1), not a silent success.
  if (!written.length) {
    return {
      ...base,
      status: "error",
      target: targetAbs,
      skipped,
      error: `nothing to write — all ${skipped.length} file(s) already exist in ${targetAbs} (pass --force to overwrite)`,
    };
  }

  // A skipped file is a HOLE in the emitted app, not a detail: `partial` is the
  // honest status (and a non-zero exit), because `src/App.tsx` or `package.json`
  // left behind means what's on disk does not run.
  const missingCritical = skipped.filter((f) => CRITICAL_FILES.has(f));
  const status = dryRun ? "planned" : skipped.length ? "partial" : "written";

  return {
    ...base,
    status,
    target: targetAbs,
    dryRun,
    written,
    skipped,
    missingCritical,
    todos,
    audit,
    plan,
    notes: [
      dryRun
        ? `Dry run — nothing was written. Re-run with --write ${target} to emit ${written.length} file(s).`
        : `Wrote ${written.length} file(s) into ${targetAbs}.`,
      `brand-ui audit: ${audit.issues} issue(s), ${audit.advisory} advisory across ${audit.files} emitted file(s).`,
      ...(skipped.length
        ? [
            `PARTIAL — ${skipped.length} file(s) already existed and were NOT written: ${skipped.join(", ")}.`,
            ...(missingCritical.length
              ? [
                  `The app will NOT run as emitted: ${missingCritical.join(", ")} ${missingCritical.length === 1 ? "is" : "are"} the target's own, not the scaffold's. Merge by hand, or re-run with --force (which OVERWRITES your versions).`,
                ]
              : [
                  "Merge the skipped file(s) by hand, or re-run with --force (which overwrites them).",
                ]),
          ]
        : []),
      "Next: install (see `install`), then `typecheck` + `lint`, then RENDER it in light and dark — theme-safety is observed, never inferred.",
    ],
  };
}

// ---- scan (brownfield profile; full impl VP-03 #124) -----------------------

const FRAMEWORK_DEPS = [
  ["next", "next"],
  ["@remix-run/react", "remix"],
  ["react-router-dom", "react-router"],
  ["vite", "vite"],
  ["react", "react"],
];
const UI_LIB_DEPS = [
  [/^@elabs-ai\/components-/, "brand-ui"],
  ["@mui/material", "mui"],
  ["antd", "antd"],
  ["@chakra-ui/react", "chakra"],
  ["react-bootstrap", "react-bootstrap"],
  ["@mantine/core", "mantine"],
  ["@radix-ui/react-dialog", "radix"],
];
const STYLING_DEPS = [
  ["tailwindcss", "tailwind"],
  ["styled-components", "styled-components"],
  ["@emotion/react", "emotion"],
  ["sass", "sass"],
];

/** Match a dep table against a [needle, label] table; needle is string|RegExp. */
function detect(deps, table) {
  const hits = [];
  for (const [needle, label] of table) {
    const found =
      needle instanceof RegExp ? Object.keys(deps).some((d) => needle.test(d)) : needle in deps;
    if (found && !hits.includes(label)) hits.push(label);
  }
  return hits;
}

/**
 * Scan one source file's JSX for capitalized opening tags AND the attribute
 * NAMES each carries. Deliberately regex/scanner-based, not an AST parse: the
 * engine is dependency-free by contract (no `@babel/parser`, no `jscodeshift`),
 * and a first-pass migration map only needs "which tag, how often, with which
 * props" — not a faithful tree.
 *
 * KNOWN LIMITS (documented, not hidden): a `<Tag` inside a comment or a string
 * literal counts; a member tag (`<Card.Header>`) is attributed to its root
 * (`Card`), matching the pre-existing inventory's behavior. Attribute names are
 * read only at brace/quote depth 0, so `onClick={() => x = 1}` contributes
 * `onClick` and nothing else.
 *
 * @param {string} src - file contents.
 * @returns {{ tag: string, props: string[] }[]} one entry per opening tag, in source order.
 */
export function scanJsxTags(src) {
  const out = [];
  const tagRe = /<([A-Z][A-Za-z0-9]*)/g;
  for (const m of src.matchAll(tagRe)) {
    const start = m.index + m[0].length;
    // Walk to this tag's closing ">" collecting only depth-0, unquoted text.
    let depth = 0;
    let quote = null;
    let attrText = "";
    for (let i = start; i < src.length && i - start < 4000; i++) {
      const ch = src[i];
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        continue;
      }
      if (ch === "{") {
        depth++;
        continue;
      }
      if (ch === "}") {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (ch === ">" && depth === 0) break;
      if (depth === 0) attrText += ch;
    }
    const props = [];
    for (const p of attrText.matchAll(/(?:^|\s)([A-Za-z_][A-Za-z0-9_:-]*)\s*=/g)) {
      if (!props.includes(p[1])) props.push(p[1]);
    }
    out.push({ tag: m[1], props });
  }
  return out;
}

/**
 * Parse a module's `import` statements into `{ source, specifiers }`.
 * Handles default, namespace (`* as ns`) and named (`{ a, b as c }`) clauses,
 * plus side-effect-only imports (`import "x"` → no specifiers).
 *
 * @param {string} src - file contents.
 * @returns {{ source: string, specifiers: string[] }[]}
 */
export function scanImports(src) {
  const out = [];
  const re = /import\s+(?:([^;]*?)\s+from\s+)?["']([^"']+)["']/g;
  for (const m of src.matchAll(re)) {
    const clause = (m[1] ?? "").trim();
    const source = m[2];
    const specifiers = [];
    const named = clause.match(/\{([^}]*)\}/);
    if (named) {
      for (const part of named[1].split(",")) {
        const name = part
          .trim()
          .split(/\s+as\s+/)[0]
          .trim();
        if (name) specifiers.push(name);
      }
    }
    const head = clause.replace(/\{[^}]*\}/g, "").replace(/,/g, " ");
    const ns = head.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (ns) specifiers.push(ns[1]);
    const def = head.replace(/\*\s+as\s+[A-Za-z_$][\w$]*/, "").trim();
    if (def && /^[A-Za-z_$][\w$]*$/.test(def)) specifiers.unshift(def);
    out.push({ source, specifiers });
  }
  return out;
}

/** Raw (non-token) spacing utility, e.g. `p-[12px]` / `gap-[1.5rem]`. */
const RAW_SPACING_RE =
  /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|w|h|size)-\[[\d.]+(?:px|rem|em)\]/;
/** Raw (non-role) font size, e.g. `text-[13px]` or a CSS `font-size:` declaration. */
const RAW_FONT_SIZE_RE = /\btext-\[[\d.]+(?:px|rem|em)\]|font-size\s*:/;
/** `scanText` rule ids that mean "a raw colour literal" (see lib/audit.mjs). */
const COLOR_RULE_IDS = new Set(["raw-hex", "rgb-literal", "arbitrary-color"]);

/**
 * Count the token debt a migration has to pay off: raw colours (reusing the
 * audit's rule set — one source of truth, never a second colour scanner), raw
 * spacing utilities and raw font sizes.
 *
 * @param {string[]} files - absolute paths.
 * @returns {{ filesScanned:number, hardcodedColors:number, hardcodedSpacing:number, fontSizes:number }}
 */
function scanTokenDebt(files) {
  let hardcodedColors = 0;
  let hardcodedSpacing = 0;
  let fontSizes = 0;
  for (const f of files) {
    let src;
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    const isCss = /\.css$/.test(f);
    for (const finding of scanText(src, { isCss })) {
      if (COLOR_RULE_IDS.has(finding.rule)) hardcodedColors++;
    }
    for (const line of src.split("\n")) {
      if (RAW_SPACING_RE.test(line)) hardcodedSpacing++;
      if (RAW_FONT_SIZE_RE.test(line)) fontSizes++;
    }
  }
  return { filesScanned: files.length, hardcodedColors, hardcodedSpacing, fontSizes };
}

/**
 * Composite-map-key separator. A file path can contain a space but never a NUL,
 * so a `file + KEY_SEP + tag` key round-trips through `split` unambiguously.
 */
const KEY_SEP = "\u0000";
/** Cap on the per-file usage rows kept in a scan result (keeps `--json` sane). */
const BY_FILE_CAP = 500;
/** Cap on the import-graph rows kept in a scan result. */
const IMPORT_CAP = 200;

/**
 * Profile a repo, read-only (brownfield step 1).
 *
 * INPUT  — `path`: repo/app root (default cwd).
 * OUTPUT — framework, UI library, styling, and a component-usage inventory:
 *          which JSX tags appear, how often, **in which files**, **with which
 *          prop names**, plus the module **import graph** and a count of the raw
 *          colour/spacing/font values a migration has to tokenize.
 *          Deterministic; touches no files, ever.
 *
 * @returns {{ command:"scan", status:"ok"|"error", implemented:false, error?:string,
 *   path?:string, project?:string|null, framework?:string, uiLibrary?:object,
 *   styling?:object, components?:object, imports?:object, tokens?:object, notes?:string[] }}
 */
export function scanRepo(path = process.cwd()) {
  const base = { command: "scan", implemented: false };
  const abs = resolve(path || process.cwd());
  if (!existsSync(abs)) return { ...base, status: "error", error: `not found: ${path}` };

  const pkg = readPkgJson(abs);
  const deps = pkg ? { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } : {};

  const frameworks = detect(deps, FRAMEWORK_DEPS);
  const uiLibs = detect(deps, UI_LIB_DEPS);
  const styling = detect(deps, STYLING_DEPS);

  const files = walkSource(abs, { exts: /\.(tsx|jsx)$/, cap: 2000 });
  const counts = new Map(); // tag -> total usages
  const tagFiles = new Map(); // tag -> Set(relative file)
  const tagProps = new Map(); // tag -> Set(prop name)
  const perFile = new Map(); // KEY_SEP-joined `file+tag` -> count
  const importSources = new Map(); // module source -> { specifiers:Set, files:Set }

  for (const f of files) {
    let src;
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    const rel = relative(abs, f) || f;
    for (const { tag, props } of scanJsxTags(src)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
      if (!tagFiles.has(tag)) tagFiles.set(tag, new Set());
      tagFiles.get(tag).add(rel);
      if (!tagProps.has(tag)) tagProps.set(tag, new Set());
      for (const p of props) tagProps.get(tag).add(p);
      const key = `${rel}${KEY_SEP}${tag}`;
      perFile.set(key, (perFile.get(key) || 0) + 1);
    }
    for (const { source, specifiers } of scanImports(src)) {
      if (!importSources.has(source))
        importSources.set(source, { specifiers: new Set(), files: new Set() });
      const entry = importSources.get(source);
      for (const s of specifiers) entry.specifiers.add(s);
      entry.files.add(rel);
    }
  }

  const sortedProps = (tag) => [...(tagProps.get(tag) ?? [])].sort((a, b) => a.localeCompare(b));
  const top = [...counts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      files: tagFiles.get(name)?.size ?? 0,
      props: sortedProps(name),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 50);

  const byFile = [...perFile.entries()]
    .map(([key, count]) => {
      const [file, tag] = key.split(KEY_SEP);
      return { file, tag, count };
    })
    .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file) || a.tag.localeCompare(b.tag))
    .slice(0, BY_FILE_CAP);

  const propsByTag = {};
  for (const tag of [...counts.keys()].sort((a, b) => a.localeCompare(b)))
    propsByTag[tag] = sortedProps(tag);

  const importRows = [...importSources.entries()]
    .map(([source, v]) => ({
      source,
      specifiers: [...v.specifiers].sort((a, b) => a.localeCompare(b)),
      files: v.files.size,
    }))
    .sort((a, b) => b.files - a.files || a.source.localeCompare(b.source));

  const styleFiles = walkSource(abs, { exts: /\.css$/, cap: 500 });

  return {
    ...base,
    status: "ok",
    path: abs,
    project: pkg?.name ?? null,
    framework: frameworks[0] ?? "unknown",
    uiLibrary: { primary: uiLibs[0] ?? "unknown", detected: uiLibs },
    styling: { primary: styling[0] ?? "unknown", detected: styling },
    components: {
      filesScanned: files.length,
      distinct: counts.size,
      usages: [...counts.values()].reduce((a, b) => a + b, 0),
      top,
      byFile,
      props: propsByTag,
    },
    imports: {
      distinct: importSources.size,
      sources: importRows.slice(0, IMPORT_CAP),
    },
    tokens: scanTokenDebt([...files, ...styleFiles]),
    notes: [
      "Read-only: `scan` reads source and writes nothing (the `--out` flag is the only writer, and it only creates migration/*.md).",
      "Heuristic inventory (no AST): tags in comments/strings count, and a member tag (<Card.Header>) is attributed to its root.",
    ],
  };
}

// ---- map (brownfield mapping; VP-03 #124) ----------------------------------

/**
 * Known third-party component names → what a brand-ui migration does with them.
 * A DATA table, not an algorithm: extending the coverage of `props` / `compose` /
 * `drop` is adding a row here, never touching `mapComponents`.
 *
 * Entry shape:
 *  - `from`    the third-party component name (matched case-insensitively).
 *  - `lib`     which ecosystem it comes from (documentation only — the match is
 *              by name, because a scan can carry tags whose import we never saw).
 *  - `class`   the `MAP_CLASSES` verdict this row asserts.
 *  - `to`      (`props`) the brand-ui component that replaces it.
 *  - `props`   (`props`) the concrete prop rename map, `{ from: to }`.
 *  - `compose` (`compose`) the brand-ui primitives / utilities to rebuild it from.
 *  - `note`    a one-line human reason, surfaced in the analysis markdown.
 *
 * NOTE ON PRECEDENCE: an exact **manifest** name match always wins (see
 * `mapComponents`), so a row whose `from` is also a brand-ui component name is
 * dead. Rows below are deliberately restricted to names brand-ui does NOT ship.
 *
 * @type {{ from:string, lib?:string, class:"props"|"compose"|"drop", to?:string,
 *   props?:Record<string,string>, compose?:string[], note?:string }[]}
 */
export const SOURCE_ALIASES = [
  // — MUI —
  {
    from: "Typography",
    lib: "mui",
    class: "props",
    to: "Text",
    props: { variant: "role", component: "as" },
    note: "type is a role, not a size: variant=h1|body1 becomes the role scale",
  },
  {
    from: "Paper",
    lib: "mui",
    class: "props",
    to: "Card",
    props: { elevation: "className (shadow-*)", square: "className (rounded-none)" },
    note: "elevation is a token/utility decision in brand-ui, not a numeric prop",
  },
  {
    from: "TextField",
    lib: "mui",
    class: "compose",
    compose: ["Label", "Input", "FormMessage"],
    note: "brand-ui keeps label/control/message as separate composable parts",
  },
  {
    from: "Box",
    lib: "mui",
    class: "compose",
    compose: ["div + token utilities"],
    note: "no styled-Box primitive: a plain element plus semantic utilities",
  },
  {
    from: "Stack",
    lib: "mui",
    class: "compose",
    compose: ["div + flex utilities (gap-*)"],
  },
  {
    from: "Container",
    lib: "mui",
    class: "compose",
    compose: ["div + max-w-* mx-auto"],
  },
  {
    from: "Divider",
    lib: "mui",
    class: "props",
    to: "Separator",
    props: { flexItem: "className" },
  },
  { from: "IconButton", lib: "mui", class: "props", to: "Button", props: { color: "variant" } },
  {
    from: "CircularProgress",
    lib: "mui",
    class: "props",
    to: "Spinner",
    props: { size: "size", color: "className" },
  },
  { from: "LinearProgress", lib: "mui", class: "props", to: "Progress", props: { value: "value" } },
  { from: "Modal", lib: "mui", class: "props", to: "Dialog", props: { open: "open" } },
  {
    from: "Snackbar",
    lib: "mui",
    class: "props",
    to: "Toaster",
    props: { autoHideDuration: "duration" },
  },
  {
    from: "DataGrid",
    lib: "mui",
    class: "props",
    to: "DataTable",
    props: { rows: "data", columns: "columns", loading: "loading" },
  },
  { from: "Chip", lib: "mui", class: "props", to: "Badge", props: { color: "variant" } },
  // — antd —
  { from: "Layout", lib: "antd", class: "compose", compose: ["AppShell", "Sidebar"] },
  { from: "Row", lib: "antd", class: "compose", compose: ["div + grid/flex utilities"] },
  { from: "Col", lib: "antd", class: "compose", compose: ["div + grid/flex utilities"] },
  { from: "Space", lib: "antd", class: "compose", compose: ["div + gap-* utilities"] },
  {
    from: "Spin",
    lib: "antd",
    class: "props",
    to: "Spinner",
    props: { spinning: "(render gate)" },
  },
  { from: "Result", lib: "antd", class: "props", to: "StatePanel", props: { status: "kind" } },
  { from: "Empty", lib: "antd", class: "props", to: "StatePanel", props: { description: "title" } },
  { from: "Tag", lib: "antd", class: "props", to: "Badge", props: { color: "variant" } },
  { from: "Statistic", lib: "antd", class: "props", to: "MetricCard", props: { title: "label" } },
  { from: "Steps", lib: "antd", class: "props", to: "Wizard", props: { current: "step" } },
  { from: "Collapse", lib: "antd", class: "props", to: "Accordion", props: { activeKey: "value" } },
  // — Chakra —
  { from: "Flex", lib: "chakra", class: "compose", compose: ["div + flex utilities"] },
  { from: "HStack", lib: "chakra", class: "compose", compose: ["div + flex gap-* utilities"] },
  { from: "VStack", lib: "chakra", class: "compose", compose: ["div + flex-col gap-* utilities"] },
  { from: "SimpleGrid", lib: "chakra", class: "compose", compose: ["div + grid utilities"] },
  { from: "Center", lib: "chakra", class: "compose", compose: ["div + grid place-items-center"] },
  // — framework / layout noise: nothing to migrate —
  { from: "Fragment", class: "drop", note: "language construct, not UI" },
  { from: "StrictMode", class: "drop", note: "React runtime wrapper" },
  { from: "Suspense", class: "drop", note: "React runtime wrapper" },
  { from: "Head", class: "drop", note: "document head, not UI" },
  { from: "Script", class: "drop", note: "document script, not UI" },
  { from: "Router", class: "drop", note: "routing, not UI" },
  { from: "BrowserRouter", class: "drop", note: "routing, not UI" },
  { from: "Routes", class: "drop", note: "routing, not UI" },
  { from: "Route", class: "drop", note: "routing, not UI" },
  { from: "Outlet", class: "drop", note: "routing, not UI" },
  { from: "QueryClientProvider", class: "drop", note: "data runtime, not UI" },
];

/** SOURCE_ALIASES indexed by lowercased `from`. */
const ALIAS_BY_NAME = new Map(SOURCE_ALIASES.map((a) => [a.from.toLowerCase(), a]));

/** The app-UI package — the preferred home when a component name is ambiguous. */
const isAppUiPkg = (pkg) => /(^|\/)[^/]*components-ui$/.test(String(pkg ?? ""));

/** Rungs, ordered low → high, for the risk/effort model. */
const LEVELS = ["low", "medium", "high"];
const atLeast = (level, floor) => LEVELS[Math.max(LEVELS.indexOf(level), LEVELS.indexOf(floor))];
const atMost = (level, ceiling) => LEVELS[Math.min(LEVELS.indexOf(level), LEVELS.indexOf(ceiling))];

/**
 * Score a mapping's risk + effort from `class × usage count × file spread`.
 *
 * The matrix (documented so a reader never has to reverse-engineer it):
 *
 *   blast = usages × distinct files       → low <10, medium 10–39, high ≥40
 *
 *   | class   | risk                    | effort                        |
 *   | ------- | ----------------------- | ----------------------------- |
 *   | direct  | blast, capped at medium | low (medium once blast ≥ 40)  |
 *   | drop    | low                     | low                           |
 *   | props   | blast                   | medium (high once blast ≥ 40) |
 *   | compose | blast, floored at medium| high                          |
 *   | gap     | blast, floored at medium| high                          |
 *
 * `direct`/`drop` can never read as high risk (a rename is reviewable however
 * often it appears); `compose`/`gap` can never read as low (they need a design
 * decision even for a single call site).
 *
 * @param {string} cls - a `MAP_CLASSES` value.
 * @param {number} count - total JSX usages of the source component.
 * @param {number} files - distinct files it appears in.
 * @returns {{ risk:string, effort:string, blast:number }}
 */
export function scoreMapping(cls, count, files) {
  const usages = Number.isFinite(count) && count > 0 ? count : 1;
  const spread = Number.isFinite(files) && files > 0 ? files : 1;
  const blast = usages * spread;
  const base = blast >= 40 ? "high" : blast >= 10 ? "medium" : "low";
  switch (cls) {
    case "direct":
      return { risk: atMost(base, "medium"), effort: blast >= 40 ? "medium" : "low", blast };
    case "drop":
      return { risk: "low", effort: "low", blast };
    case "props":
      return { risk: base, effort: blast >= 40 ? "high" : "medium", blast };
    case "compose":
    case "gap":
      return { risk: atLeast(base, "medium"), effort: "high", blast };
    default:
      return { risk: base, effort: base, blast };
  }
}

/**
 * Intrinsic DOM/React attributes that say nothing about a component's own API —
 * excluded before reporting "props brand-ui doesn't declare".
 */
const INTRINSIC_PROPS = new Set([
  "className",
  "style",
  "id",
  "key",
  "ref",
  "children",
  "role",
  "title",
  "tabIndex",
  "onClick",
  "onChange",
  "onSubmit",
  "onKeyDown",
  "onBlur",
  "onFocus",
  "type",
  "name",
  "value",
  "href",
  "target",
  "rel",
  "src",
  "alt",
  "width",
  "height",
  "disabled",
]);

/** The own-declared prop names + cva variant groups a manifest row publishes. */
function knownProps(row) {
  const names = new Set();
  for (const p of row?.props?.props ?? []) names.add(p.name);
  for (const k of Object.keys(row?.props?.resolved ?? {})) names.add(k);
  for (const g of Object.keys(row?.variants?.variants ?? {})) names.add(g);
  return names;
}

/**
 * Map a scan's component inventory onto brand-ui via the manifest (brownfield
 * step 2).
 *
 * INPUT  — `scan`: a path to a `scan` JSON file, or the parsed object.
 * OUTPUT — per-component classification (`MAP_CLASSES`), a risk/effort score
 *          (see `scoreMapping`), the concrete prop-remap / composition advice,
 *          and a summary carrying `coveragePct`.
 *
 * RESOLUTION ORDER (first match wins):
 *   1. exact **manifest** name match      → `direct`
 *   2. a `SOURCE_ALIASES` row             → that row's class (`props`/`compose`/`drop`)
 *   3. otherwise                          → `gap`
 *
 * A `direct` mapping additionally reports `unknownProps` — attribute names the
 * scan saw that the manifest entry does not declare. It is INFORMATION, not a
 * downgrade: intrinsic DOM attributes are inherited (not listed in the manifest),
 * so a prop diff cannot honestly prove "the API differs". The `props` class comes
 * from the alias table, where the rename is actually known.
 *
 * @returns {{ command:"map", status:"ok"|"error", implemented:false, error?:string,
 *   classes?:string[], mappings?:object[], summary?:object, notes?:string[] }}
 */
export function mapComponents(scan, { root } = {}) {
  const base = { command: "map", implemented: false, classes: MAP_CLASSES };
  const r = resolveInput(scan, "scan");
  if (r.error) return { ...base, status: "error", error: r.error };

  const propsByTag = r.data.components?.props ?? {};
  const sources = (r.data.components?.top ?? []).map((c) =>
    typeof c === "string" ? { name: c, count: 1 } : c,
  );

  const manifest = loadManifest(root);
  const byName = new Map();
  for (const row of flat(manifest ?? { packages: {} })) {
    const key = row.name.toLowerCase();
    const seen = byName.get(key);
    // Several packages can export the same NAME (e.g. `Text` in ui and editor).
    // A migration target should be the app-UI one, so prefer `…-ui` and
    // otherwise keep the first row — never let package iteration order decide.
    if (!seen || (isAppUiPkg(row.pkg) && !isAppUiPkg(seen.pkg))) byName.set(key, row);
  }

  const mappings = sources.map((src) => {
    const name = String(src.name);
    const count = src.count ?? null;
    const files = src.files ?? 0;
    const observed = src.props ?? propsByTag[name] ?? [];
    const common = { source: name, count, files: files || null };

    const hit = byName.get(name.toLowerCase());
    if (hit) {
      const known = knownProps(hit);
      const unknownProps = observed.filter(
        (p) => !known.has(p) && !INTRINSIC_PROPS.has(p) && !/^(?:data|aria)-/.test(p),
      );
      return {
        ...common,
        target: hit.name,
        pkg: hit.pkg,
        class: "direct",
        ...scoreMapping("direct", count, files),
        ...(unknownProps.length ? { unknownProps } : {}),
      };
    }

    const alias = ALIAS_BY_NAME.get(name.toLowerCase());
    if (alias) {
      const targetRow = alias.to ? byName.get(alias.to.toLowerCase()) : null;
      return {
        ...common,
        target: alias.to ?? null,
        pkg: targetRow?.pkg ?? null,
        class: alias.class,
        ...scoreMapping(alias.class, count, files),
        ...(alias.props ? { propRemap: alias.props } : {}),
        ...(alias.compose ? { compose: alias.compose } : {}),
        ...(alias.lib ? { lib: alias.lib } : {}),
        ...(alias.note ? { note: alias.note } : {}),
        ...(alias.to && !targetRow ? { targetMissing: true } : {}),
      };
    }

    return {
      ...common,
      target: null,
      pkg: null,
      class: "gap",
      ...scoreMapping("gap", count, files),
    };
  });

  const summary = Object.fromEntries(MAP_CLASSES.map((c) => [c, 0]));
  for (const m of mappings) summary[m.class]++;

  // Coverage is measured in USAGES, not component names: replacing one tag used
  // 300 times is most of a migration; ten one-off tags are not.
  const totalUsages = mappings.reduce((a, m) => a + (m.count ?? 0), 0);
  const mappedUsages = mappings
    .filter((m) => m.class === "direct" || m.class === "props")
    .reduce((a, m) => a + (m.count ?? 0), 0);
  summary.coverage = { mappedUsages, totalUsages };
  summary.coveragePct = totalUsages ? Math.round((mappedUsages / totalUsages) * 100) : 0;

  return {
    ...base,
    status: "ok",
    mappings,
    summary,
    notes: [
      "Classification: manifest name match → direct; SOURCE_ALIASES row → props|compose|drop; otherwise gap.",
      "coveragePct is the share of JSX USAGES covered by direct+props — not the share of component names.",
      "Read-only: `map` writes nothing unless `--out <dir>` is given, and then only migration/*.md.",
    ],
  };
}

// ---- codemod (brownfield migration; full impl VP-03 #125) ------------------

/**
 * Plan AST codemods from a mapping (brownfield step 3). **Read-only** — this
 * module never edits a file; migration stays read-only until plan approval.
 *
 * INPUT  — `map`: a path to a `map` JSON file, or the parsed object.
 *          `mode`: one of `CODEMOD_MODES` (default `generate`).
 * OUTPUT — a phased codemod plan (one phase per mapping class) describing the
 *          transforms `jscodeshift` would run. `apply` is intentionally inert
 *          (`status: "blocked"`) until VP-03 (#125).
 *
 * @returns {{ command:"codemod", status:"planned"|"blocked"|"error",
 *   implemented:false, error?:string, tool?:string, mode?:string, phases?:object[],
 *   notes?:string[] }}
 */
export function planCodemod(map, { mode = "generate" } = {}) {
  const base = { command: "codemod", implemented: false, tool: CODEMOD_TOOL };
  if (!CODEMOD_MODES.includes(mode)) {
    return { ...base, status: "error", error: `mode must be one of: ${CODEMOD_MODES.join(", ")}` };
  }
  const r = resolveInput(map, "map");
  if (r.error) return { ...base, status: "error", error: r.error };

  const mappings = r.data.mappings ?? [];
  // One phase per class that has actionable, renameable mappings.
  const direct = mappings.filter((m) => m.class === "direct" && m.target);
  const props = mappings.filter((m) => m.class === "props" && m.target);
  const phases = [];
  if (direct.length)
    phases.push({
      name: "direct-renames",
      transforms: direct.map((m) => ({
        from: m.source,
        to: m.target,
        pkg: m.pkg,
        kind: "import+jsx-rename",
      })),
      dryRun: true,
      apply: false,
    });
  if (props.length)
    phases.push({
      name: "prop-remaps",
      transforms: props.map((m) => ({
        from: m.source,
        to: m.target,
        pkg: m.pkg,
        kind: "prop-remap",
      })),
      dryRun: true,
      apply: false,
    });

  if (mode === "apply") {
    return {
      ...base,
      status: "blocked",
      mode,
      phases,
      notes: [
        "apply is intentionally inert in the skeleton (#121): migration stays read-only until plan approval.",
        "The transform engine (jscodeshift, OSS) + generate→dry-run→diff→apply land in VP-03 (#125).",
      ],
    };
  }

  return {
    ...base,
    status: "planned",
    mode,
    phases,
    notes: [
      "Skeleton (#121): emits a phased codemod plan + dry-run contract only; no files are edited.",
      `Transform engine: ${CODEMOD_TOOL} (OSS, no paid deps) — added as a dependency when transforms are implemented in VP-03 (#125).`,
    ],
  };
}
