#!/usr/bin/env node
/**
 * build-surface-preview.mjs — rung 2 of the visual feedback loop's fidelity
 * ladder (VP-04 #57, issue-03).
 *
 * WHY THIS EXISTS
 * The loop's rule is "never advance a visual choice on text alone when a render
 * is possible". Rung 1 (a real Storybook render via the Storybook MCP) covers
 * anything that maps to a single story. It does NOT cover a **composed surface**
 * — an assembled multi-component screen no single story shows. Rung 2 fills that
 * gap: a self-contained HTML file, in the chosen theme, showing the composition's
 * real structure and its real surface hierarchy (chrome → canvas → raised).
 *
 * WHAT IT IS AND IS NOT
 * It is a STRUCTURE preview, not a render: React is never executed. The
 * archetype's generated template (`docs/playbooks/templates/<archetype>.tsx`) is
 * read purely as a **composition manifest** — which components, in what order —
 * and each composed region becomes a labelled placeholder block laid out with the
 * SAME semantic token utilities the template uses. Colour comes from exactly one
 * place: the inlined `themes.css`. The generator itself contains no colour value.
 *
 * SELF-CONTAINED BY CONSTRUCTION
 * Everything is inlined: no CDN, no external stylesheet, no webfont, no network
 * of any kind. The bare `@import "tailwindcss"` / `"tw-animate-css"` lines and
 * the `@font-face` blocks are stripped (their assets live next to the source
 * stylesheet and would not resolve from an arbitrary output path); the relative
 * `@import "./*.css"` siblings are inlined recursively. A small utility shim
 * supplies the handful of Tailwind class names the markup uses, each mapped
 * straight onto a token variable.
 *
 * USAGE
 *   pnpm surface:preview -- --archetype dashboard --theme qlik-dark --out /tmp/x.html
 *   pnpm surface:preview -- --archetype dashboard --theme qlik-dark --out-dir /tmp
 *   pnpm surface:preview -- --list
 *
 * Deterministic (same inputs → byte-identical output), dependency-free, and
 * cwd-independent. The pure half is exported for the self-test
 * (`pnpm surface:preview:test`).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, basename } from "node:path";
// The ACTIVE theme set — a paused theme is kept as source but never gated
// (single source of truth: PAUSED_THEMES in theme-types.ts).
import { ACTIVE_THEMES } from "./lib/paused-surfaces.mjs";
import { scanJsxTags, scanImports } from "../packages/cli/lib/engine.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

/** Where the generated consumer templates live (`pnpm gen:templates` owns them). */
export const TEMPLATES_DIR = join(REPO_ROOT, "docs", "playbooks", "templates");
/** The token stylesheet — the ONLY source of colour in a generated preview. */
export const THEMES_CSS = join(REPO_ROOT, "packages", "tokens", "src", "themes.css");

/** Markers that fence the inlined stylesheet, so a checker can scope its rules. */
export const TOKENS_BEGIN = "/* >>> brand-ui tokens (inlined) >>> */";
export const TOKENS_END = "/* <<< brand-ui tokens (inlined) <<< */";

// ---------------------------------------------------------------------------
// CSS inlining
// ---------------------------------------------------------------------------

/**
 * Read a stylesheet and inline its RELATIVE `@import`s recursively, dropping the
 * bare package imports (Tailwind's own layers — the shim replaces the handful of
 * utilities the preview needs) and every `@font-face` block (their `url()`s are
 * relative to the source stylesheet and cannot resolve from an output file).
 *
 * @param {string} file - absolute path to a stylesheet.
 * @param {Set<string>} [seen] - cycle guard.
 * @returns {string} the flattened CSS.
 */
export function inlineStylesheet(file, seen = new Set()) {
  if (seen.has(file) || !existsSync(file)) return "";
  seen.add(file);
  let css = readFileSync(file, "utf8");
  css = css.replace(/@font-face\s*\{[^}]*\}/g, "");
  css = css.replace(/@import\s+(?:url\()?["']([^"')]+)["']\)?\s*;/g, (_m, spec) => {
    if (!spec.startsWith(".")) return ""; // bare package import — not resolvable offline
    return inlineStylesheet(resolve(dirname(file), spec), seen);
  });
  return css.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * The utility shim: the class names the generated markup uses, each defined as a
 * single token lookup. No literal colour, ever — if a value is not `var(--…)` it
 * is a layout number.
 */
const UTILITY_SHIM = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--font-sans, system-ui, sans-serif);
  background: var(--background);
  color: var(--foreground);
  min-height: 100vh;
}
.bg-background { background: var(--background); }
.bg-card { background: var(--card); }
.bg-sidebar { background: var(--sidebar); }
.bg-surface-muted { background: var(--surface-muted); }
.bg-muted { background: var(--muted); }
.bg-primary { background: var(--primary); }
.text-foreground { color: var(--foreground); }
.text-muted-foreground { color: var(--muted-foreground); }
.text-card-foreground { color: var(--card-foreground); }
.text-sidebar-foreground { color: var(--sidebar-foreground); }
.text-primary-foreground { color: var(--primary-foreground); }
.border-border { border: 1px solid var(--border); }
.border-border-strong { border: 1px solid var(--border-strong); }
.rounded { border-radius: var(--radius); }

/* layout scaffold (bp- prefix: these are the preview's own, not brand-ui's) */
.bp-frame { display: flex; min-height: 100vh; }
.bp-rail {
  width: 15rem; flex: 0 0 15rem; padding: 1rem 0.75rem;
  border-right: 1px solid var(--sidebar-border, var(--border));
  display: flex; flex-direction: column; gap: 0.25rem;
}
.bp-brand { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; margin-bottom: 0.75rem; font-weight: 600; }
.bp-mark { width: 1.5rem; height: 1.5rem; border-radius: var(--radius); flex: 0 0 auto; }
.bp-nav { padding: 0.5rem 0.75rem; border-radius: var(--radius); font-size: 0.875rem; }
.bp-canvas { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.bp-topbar {
  display: flex; align-items: baseline; gap: 0.75rem;
  padding: 1rem 1.5rem; border-bottom: 1px solid var(--border);
}
.bp-title { font-size: 1.125rem; font-weight: 600; margin: 0; }
.bp-eyebrow { font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; }
.bp-main { flex: 1 1 auto; padding: 1.5rem; display: grid; grid-template-columns: repeat(12, 1fr); gap: 1rem; align-content: start; }
.bp-block { border-radius: var(--radius); padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
.bp-block-name { font-weight: 600; font-size: 0.875rem; }
.bp-block-meta { font-size: 0.75rem; font-family: var(--font-mono, ui-monospace, monospace); }
.bp-bars { display: flex; flex-direction: column; gap: 0.5rem; margin-top: auto; }
.bp-bar { height: 0.5rem; border-radius: 999px; }
.bp-foot { padding: 0.75rem 1.5rem; border-top: 1px solid var(--border); font-size: 0.75rem; }
`.trim();

// ---------------------------------------------------------------------------
// Template → composition manifest
// ---------------------------------------------------------------------------

/** Sub-part / wiring names that are structure, not a visible composed region. */
const NOT_A_REGION =
  /^(?:.*Provider|.*Trigger|.*Inset|.*Portal|.*Content|.*Header|.*Footer|.*Title|.*Description|.*Item|.*Group|.*Menu|.*Button|.*Label|.*Separator|.*List)$/;

/**
 * Size + role for a composed region, keyed by name. The first matching rule wins;
 * `span` is a 12-column grid span, `height` a minimum block height in rem.
 */
const ROLE_RULES = [
  {
    re: /^(?:Hero|CTASection|StatsBand|LogoStrip|FeatureGrid|UseCaseCard)$/,
    role: "section",
    span: 12,
    height: 9,
  },
  { re: /(?:Chart|Metric|Kpi|KPI)/, role: "chart", span: 6, height: 8 },
  { re: /(?:DataTable|DataGrid|^Table$|Gantt)/, role: "data", span: 12, height: 14 },
  {
    re: /(?:Conversation|ChatShell|PromptInput|Composer|Message)/,
    role: "chat",
    span: 12,
    height: 14,
  },
  { re: /(?:Canvas|Flow|Map)/, role: "canvas", span: 12, height: 16 },
  { re: /(?:Wizard|Descriptions|Form)/, role: "form", span: 8, height: 10 },
  { re: /^(?:Card|Panel|StatePanel|Alert|Callout)$/, role: "card", span: 6, height: 7 },
];

/** Fallback role for anything the table does not name. */
const DEFAULT_ROLE = { role: "block", span: 4, height: 6 };

/** Classify one composed region name. */
export function roleFor(name) {
  for (const r of ROLE_RULES)
    if (r.re.test(name)) return { role: r.role, span: r.span, height: r.height };
  return { ...DEFAULT_ROLE };
}

/**
 * Read a template as a COMPOSITION MANIFEST: which brand-ui components it puts on
 * screen, in source order, plus the navigation labels and the doc title.
 *
 * @param {string} source - the template's `.tsx` source.
 * @returns {{ title:string, packages:string[], nav:string[], regions:{name:string,pkg:string|null}[] }}
 */
export function readComposition(source) {
  // 1. which brand-ui names does it import, and from where
  const pkgOf = new Map();
  const packages = [];
  for (const { source: mod, specifiers } of scanImports(source)) {
    if (!mod.startsWith("@qlik-coe-emea/qlabs-components-")) continue;
    if (!packages.includes(mod)) packages.push(mod);
    for (const s of specifiers) if (/^[A-Z]/.test(s)) pkgOf.set(s, mod);
  }
  const imported = new Set(pkgOf.keys());

  // 2. a name that merely EXTENDS another imported name is a sub-part, not a region
  const isSubPart = (name) => {
    if (NOT_A_REGION.test(name) && !ROLE_RULES.some((r) => r.re.test(name))) return true;
    for (const other of imported) if (other !== name && name.startsWith(other)) return true;
    return false;
  };

  // 3. the regions, in source order, de-duplicated
  const regions = [];
  const seen = new Set();
  for (const { tag } of scanJsxTags(source)) {
    if (!imported.has(tag) || seen.has(tag)) continue;
    if (tag.startsWith("Sidebar") || tag === "AppIcon" || tag === "BrandLogo") continue;
    if (isSubPart(tag)) continue;
    seen.add(tag);
    regions.push({ name: tag, pkg: pkgOf.get(tag) ?? null });
  }

  // 4. nav labels — from a module-level array whose NAME says it is navigation.
  //    Scoping by name matters: a dashboard template also has a `metrics` array
  //    with labels, and a marketing template has `stats`; neither is navigation.
  //    No nav array → no rail, which is right for a landing page.
  const nav = [];
  for (const m of source.matchAll(/^const\s+(\w+)[^=\n]*=\s*\[([\s\S]*?)^\];/gm)) {
    if (!/nav|menu|link|section/i.test(m[1])) continue;
    const labels = [...m[2].matchAll(/\blabel:\s*"([^"]+)"/g)].map((x) => x[1]);
    if (!labels.length) continue;
    for (const l of labels) if (!nav.includes(l)) nav.push(l);
    break;
  }

  // 5. the human title: the first sentence of the leading doc comment
  const doc = source.match(/\/\*\*([\s\S]*?)\*\//);
  const firstLine = doc
    ? (doc[1]
        .split("\n")
        .map((l) => l.replace(/^\s*\*\s?/, "").trim())
        .filter(Boolean)[0] ?? "")
    : "";
  const title = firstLine.split(/\s+—\s+|\.\s/)[0].trim();

  return { title, packages, nav, regions };
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

/** Escape text for HTML. */
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Short package label, e.g. `@qlik-coe-emea/qlabs-components-ui` → `ui`. */
const shortPkg = (pkg) => (pkg ? pkg.replace(/^.*qlabs-components-/, "") : "local");

/**
 * Render the self-contained preview HTML.
 *
 * @param {object} input
 * @param {string} input.archetype
 * @param {string} input.theme - a theme SLUG (`qlik-bright` | `qlik-dark` | `blueprint`).
 * @param {ReturnType<typeof readComposition>} input.composition
 * @param {string} input.tokensCss - the flattened token stylesheet.
 * @returns {string} a complete HTML document.
 */
export function renderPreview({ archetype, theme, composition, tokensCss }) {
  const { title, nav, regions, packages } = composition;
  const hasShell = nav.length > 0;

  const rail = hasShell
    ? `    <nav class="bp-rail bg-sidebar text-sidebar-foreground" aria-label="Preview navigation">
      <div class="bp-brand"><span class="bp-mark bg-primary"></span><span>${esc(archetype)}</span></div>
${nav
  .slice(0, 8)
  .map((label, i) => `      <div class="bp-nav${i === 0 ? " bg-muted" : ""}">${esc(label)}</div>`)
  .join("\n")}
    </nav>
`
    : "";

  const blocks = regions.length
    ? regions
        .map(({ name, pkg }) => {
          const { role, span, height } = roleFor(name);
          return `      <section class="bp-block bg-card text-card-foreground border-border" style="grid-column: span ${span}; min-height: ${height}rem;">
        <span class="bp-block-name">${esc(name)}</span>
        <span class="bp-block-meta text-muted-foreground">${esc(shortPkg(pkg))} · ${esc(role)}</span>
        <div class="bp-bars" aria-hidden="true">
          <span class="bp-bar bg-surface-muted" style="width: 82%"></span>
          <span class="bp-bar bg-surface-muted" style="width: 64%"></span>
          <span class="bp-bar bg-muted" style="width: 40%"></span>
        </div>
      </section>`;
        })
        .join("\n")
    : `      <section class="bp-block bg-card text-card-foreground border-border" style="grid-column: span 12;">
        <span class="bp-block-name">No composed regions found</span>
        <span class="bp-block-meta text-muted-foreground">the template imports no brand-ui components</span>
      </section>`;

  return `<!doctype html>
<html lang="en" data-theme="${esc(theme)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(archetype)} — ${esc(theme)} — surface preview</title>
<style>
${TOKENS_BEGIN}
${tokensCss}
${TOKENS_END}
${UTILITY_SHIM}
</style>
</head>
<body class="bg-background text-foreground">
  <div class="bp-frame">
${rail}    <div class="bp-canvas bg-background">
      <header class="bp-topbar">
        <h1 class="bp-title">${esc(title || archetype)}</h1>
        <span class="bp-eyebrow text-muted-foreground">${esc(theme)}</span>
      </header>
      <main class="bp-main">
${blocks}
      </main>
      <footer class="bp-foot text-muted-foreground">
        Structure preview of the <strong>${esc(archetype)}</strong> composition in
        <strong>${esc(theme)}</strong> — ${regions.length} composed region(s) from
        ${esc(packages.map(shortPkg).join(", ") || "no packages")}. Placeholder blocks,
        real tokens: this shows hierarchy and theme, not the finished pixels.
      </footer>
    </div>
  </div>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/** Every archetype that has a generated template on disk. */
export function listArchetypes() {
  if (!existsSync(TEMPLATES_DIR)) return [];
  return readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => basename(f, ".tsx"))
    .sort();
}

/** The theme slugs the system ships (read from the manifest so it cannot drift). */
export function listThemes() {
  const manifest = join(REPO_ROOT, "brand-ui.manifest.json");
  if (existsSync(manifest)) {
    try {
      const themes = JSON.parse(readFileSync(manifest, "utf8")).themes;
      if (Array.isArray(themes) && themes.length) return [...themes].sort();
    } catch {
      /* fall through to the shipped default */
    }
  }
  return [...ACTIVE_THEMES].sort();
}

/**
 * Build one preview.
 *
 * @param {{ archetype:string, theme:string, out:string }} opts
 * @returns {{ file:string, regions:number }}
 */
export function buildPreview({ archetype, theme, out }) {
  const templateFile = join(TEMPLATES_DIR, `${archetype}.tsx`);
  if (!existsSync(templateFile)) {
    throw new Error(
      `unknown archetype "${archetype}" — available: ${listArchetypes().join(", ") || "(none)"}`,
    );
  }
  const composition = readComposition(readFileSync(templateFile, "utf8"));
  const html = renderPreview({
    archetype,
    theme,
    composition,
    tokensCss: inlineStylesheet(THEMES_CSS),
  });
  const file = resolve(out);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  return { file, regions: composition.regions.length };
}

// ───────────────────────────────── CLI ────────────────────────────────────────

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const [key, inline] = a.slice(2).split("=");
    opts[key] = inline ?? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true);
  }
  return opts;
}

function main(argv) {
  const opts = parseArgs(argv.slice(2));
  const themes = listThemes();

  if (opts.list) {
    console.log(`archetypes: ${listArchetypes().join(", ")}`);
    console.log(`themes:     ${themes.join(", ")}`);
    return 0;
  }

  const archetype = typeof opts.archetype === "string" ? opts.archetype : null;
  const theme = typeof opts.theme === "string" ? opts.theme : themes[0];
  if (!archetype) {
    console.error(
      "usage: pnpm surface:preview -- --archetype <name> [--theme <slug>] (--out <file.html> | --out-dir <dir>)\n" +
        "       pnpm surface:preview -- --list",
    );
    return 1;
  }
  if (!themes.includes(theme)) {
    console.error(`unknown theme "${theme}" — available: ${themes.join(", ")}`);
    return 1;
  }

  const out =
    typeof opts.out === "string"
      ? opts.out
      : join(
          typeof opts["out-dir"] === "string" ? opts["out-dir"] : process.cwd(),
          `${archetype}.${theme}.html`,
        );

  try {
    const { file, regions } = buildPreview({ archetype, theme, out });
    // Surface the absolute path so the caller can hand it straight to the user
    // (the loop's "surface the preview URL/artifact" rule).
    console.log(`${archetype} · ${theme} · ${regions} region(s)`);
    console.log(file);
    return 0;
  } catch (err) {
    console.error(String(err.message ?? err));
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv));
}
