#!/usr/bin/env node
/**
 * check-paused-surfaces.mjs — the teeth behind @.claude/rules/paused-surfaces.md.
 *
 * A PAUSED surface is kept as source but excluded from every test, gate, story,
 * doc, app and release. Prose decays; this gate does not. It asserts six
 * properties, each of which is a way the pause has actually been broken before
 * or could plausibly be broken by a well-meaning sweep:
 *
 *   A. A paused theme is NOT in `THEMES` / `THEME_META` (the active set).
 *   B. A paused theme's `[data-theme="…"]` block still EXISTS in themes.css.
 *      Pause is not delete — a "cleanup" that removes the block is a failure,
 *      because un-pausing must stay a one-line edit.
 *   C. No scanned surface (stories, apps, fixtures, playbooks, Storybook config,
 *      shipped docs, gate scripts) re-enumerates a paused theme name.
 *   D. A paused package is `private: true` — that is what keeps `pnpm -r publish`
 *      from shipping it.
 *   E. A paused package declares no `build`/`test`/`typecheck`/`lint` script, so
 *      no turbo task, CI job or local `pnpm -r` run touches it.
 *   F. Nothing depends on a paused package (no app, fixture or sibling package),
 *      and its stories are outside the Storybook glob.
 *
 * SCOPE — what is deliberately NOT scanned, and why. A paused surface's own
 * source keeps its name (obviously); so does the historical record. Excluded:
 * the paused package directories themselves, themes.css + decoration.css (the
 * kept CSS), CHANGELOG.md, docs/ADR/**, research/**, node_modules, dist, and
 * this gate + its self-test + the rule that documents the policy.
 *
 * The decoration dial is NOT paused and is never flagged: `--decoration`,
 * `data-decoration`, `DecorationProvider` and the decoration gates stay live.
 * Only the theme NAME and the package NAME are policed.
 *
 * Run via `pnpm paused:check`; self-tested by `pnpm paused:check:test`.
 *
 * Flags:
 *   --warn   print findings, never exit non-zero (dev-hook mode).
 *
 * Dependency-free; cwd-independent.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import {
  ACTIVE_THEMES,
  PAUSED_PACKAGES,
  PAUSED_PACKAGE_DIRS,
  PAUSED_THEMES,
  REPO_ROOT,
} from "./lib/paused-surfaces.mjs";

const WARN = process.argv.includes("--warn");

/** Roots that are scanned for a stray re-enumeration of a paused name. */
const SCAN_ROOTS = [
  "packages",
  "apps",
  "fixtures",
  "scripts",
  "hooks",
  "docs",
  "skills",
  "registry",
  ".claude",
  ".github",
];

/** Top-level files that are scanned too. */
const SCAN_FILES = ["CLAUDE.md", "AGENTS.md", "PROJECT.md", "README.md", "CONTRIBUTING.md"];

const SCAN_EXTS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".mjs",
  ".js",
  ".jsx",
  ".json",
  ".css",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
]);

/** Directories never walked. */
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".turbo",
  "storybook-static",
  "coverage",
  // Agent working directories, not repo source: scratch briefs, retro digests,
  // captured sweep reports and checked-out worktrees. They record what WAS,
  // and a worktree is a second copy of the tree that would double every finding.
  "worktrees",
  "scratch",
  "retros",
  "reports",
]);

/**
 * Paths (repo-relative, prefix match) exempt from the name scan. Each entry is
 * a place a paused name legitimately survives.
 */
const EXEMPT_PREFIXES = [
  // The paused source itself.
  ...PAUSED_PACKAGE_DIRS,
  // The kept CSS: the theme block and the decoration overlay that scopes to it.
  "packages/tokens/src/themes.css",
  "packages/tokens/src/decoration.css",
  "packages/tokens/tokens/",
  // The declaration sites — they must name what is paused.
  "packages/tokens/src/theme-types.ts",
  "scripts/lib/paused-surfaces.mjs",
  "scripts/check-paused-surfaces.mjs",
  "scripts/check-paused-surfaces.test.mjs",
  ".claude/rules/paused-surfaces.md",
  // The decoration policy: the dial is live and its own rule explains the theme
  // it came from. Its pause banner necessarily names it.
  ".claude/rules/blueprint-decoration.md",
  // Git-ignored build artifact: the CLI bundles a copy of the root manifest,
  // rewritten from source by its own `prepack`. Scanning it would flag a stale
  // local copy that no commit can contain.
  "packages/cli/brand-ui.manifest.json",
  "packages/cli/templates/",
  // Historical record — never rewritten.
  "docs/ADR/",
  "docs/review/",
  "research/",
];

/**
 * Gate MACHINERY may name what it excludes; gate DATA may not.
 *
 * `scripts/*.mjs` are the checkers themselves plus their self-tests. A checker
 * that filters paused themes out has to name the concept, and a self-test plants
 * fixture CSS whose selector is a literal string — neither renders, ships or
 * sweeps anything, and the property that actually matters (that the gate reads
 * the ACTIVE set) is asserted by check A and by each gate's own self-test.
 *
 * `scripts/*.json` are the RATCHET BASELINES, and they are still scanned: a
 * baseline row naming a paused package's file means that package is still being
 * gated — exactly the "paused surface is still being tested" state this rule
 * exists to prevent.
 */
function isMachinery(rel) {
  return rel.startsWith("scripts/") && (rel.endsWith(".mjs") || rel.endsWith(".js"));
}

/** A line is exempt when it is explicitly annotated as being about the pause. */
const LINE_EXEMPT_RE = /paused|PAUSED_THEMES|PAUSED_PACKAGES|un-?paus/i;

/**
 * THE LINE THIS GATE DRAWS: behaviour, not prose.
 *
 * A comment that says "…under blueprint the shadow is zeroed, so the border is
 * the sole cue" is DESIGN RATIONALE. It does not render, test, ship or sweep
 * anything, and deleting hundreds of such comments would destroy the reasoning
 * that makes the components maintainable — for zero enforcement value. Those
 * are not flagged.
 *
 * What IS flagged is a paused name in a position where it DOES something:
 * a string literal, an attribute value, an import specifier, a Storybook global,
 * a config key. So in code files the comments are stripped first and only the
 * remaining source is scanned; in Markdown only sweep INSTRUCTIONS are scanned.
 */
const CODE_EXTS = new Set([".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"]);
const DATA_EXTS = new Set([".json", ".yml", ".yaml"]);
const DOC_EXTS = new Set([".md", ".mdx"]);
const STYLE_EXTS = new Set([".css"]);

/**
 * In CSS, a `[data-theme="<paused>"]` selector is INERT — it matches nothing
 * unless someone deliberately sets the attribute, and deleting it would be
 * *changing how the paused theme renders*, which the rule forbids ("do not
 * update it"). So style sheets are only checked for things that make the paused
 * surface part of a BUILD: an `@import`/`@source` that pulls a paused package
 * into a consumer's Tailwind scan or bundle.
 */
function styleViolations(names) {
  const alt = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`@(?:import|source|use)[^;\\n]*(?:${alt})`, "i");
}

/** Strip `//` line comments and block comments, preserving line numbering. */
function stripComments(text) {
  // Block comments → same number of newlines, so line numbers survive.
  let out = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  out = out
    .split("\n")
    .map((line) => {
      // Naive but adequate: a `//` that is not inside a quote or a URL.
      const idx = line.search(/(^|[^:"'`\\])\/\//);
      if (idx === -1) return line;
      const cut = line.indexOf("//", idx);
      const before = line.slice(0, cut);
      const quotes = (before.match(/["'`]/g) ?? []).length;
      return quotes % 2 === 0 ? before : line;
    })
    .join("\n");
  return out;
}

/**
 * In Markdown, only an INSTRUCTION to exercise the paused surface fails — a
 * sweep global, a rendered attribute, an import, or a stale "three themes"
 * count. Prose that explains history or rationale is left alone.
 */
function docViolations(names) {
  const alt = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(
    [
      `globals=theme:(?:${alt})`,
      `theme:(?:${alt})\\b`,
      `data-theme=["'](?:${alt})["']`,
      `from ["'](?:${alt})["']`,
      `\\ball three themes\\b`,
      `\\bthree themes\\b`,
    ].join("|"),
    "i",
  );
}

const findings = [];
const fail = (file, line, msg) => findings.push({ file, line, msg });

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, out);
    } else if (e.isFile()) {
      const dot = e.name.lastIndexOf(".");
      if (dot > -1 && SCAN_EXTS.has(e.name.slice(dot))) out.push(full);
    }
  }
  return out;
}

function isExempt(rel) {
  return EXEMPT_PREFIXES.some((p) => rel === p || rel.startsWith(p));
}

function read(rel) {
  const full = join(REPO_ROOT, rel);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

// ── A. paused themes are out of the active set ──────────────────────────────
{
  for (const theme of PAUSED_THEMES) {
    if (ACTIVE_THEMES.includes(theme)) {
      fail(
        "packages/tokens/src/theme-types.ts",
        0,
        `"${theme}" is in BOTH THEMES and PAUSED_THEMES — a theme is active or paused, never both`,
      );
    }
  }
  const themeTypes = read("packages/tokens/src/theme-types.ts") ?? "";
  const metaBlock = themeTypes.match(/export const THEME_META[\s\S]*?\n\};/)?.[0];
  if (metaBlock) {
    for (const theme of PAUSED_THEMES) {
      // A commented-out mention is the un-pause recipe and is fine; a real key
      // is not. Strip comment lines before looking for the key.
      const code = metaBlock
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n");
      if (new RegExp(`(^|[\\s{,])["']?${theme}["']?\\s*:`, "m").test(code)) {
        fail(
          "packages/tokens/src/theme-types.ts",
          0,
          `THEME_META still has an entry for the paused theme "${theme}"`,
        );
      }
    }
  }
}

// ── B. the paused theme's CSS block still exists (pause ≠ delete) ───────────
{
  const css = read("packages/tokens/src/themes.css");
  if (css == null) {
    fail("packages/tokens/src/themes.css", 0, "themes.css not found");
  } else {
    for (const theme of PAUSED_THEMES) {
      if (!css.includes(`[data-theme="${theme}"]`)) {
        fail(
          "packages/tokens/src/themes.css",
          0,
          `the paused theme "${theme}" has NO [data-theme="${theme}"] block — pause is not delete; ` +
            `restore the block (git history) or un-pause the theme deliberately`,
        );
      }
    }
  }
}

// ── C. nothing re-enumerates a paused theme name ────────────────────────────
{
  const files = [];
  for (const root of SCAN_ROOTS) {
    const full = join(REPO_ROOT, root);
    if (existsSync(full) && statSync(full).isDirectory()) walk(full, files);
  }
  for (const f of SCAN_FILES) {
    const full = join(REPO_ROOT, f);
    if (existsSync(full)) files.push(full);
  }

  const names = [...PAUSED_THEMES, ...Object.keys(PAUSED_PACKAGES)];
  const alt = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  // Boundaries matter: `blueprint-decoration` is the name of a LIVE rule (the
  // decoration dial is not paused) and `--bp-*` tokens are live too. Only the
  // standalone name counts.
  const bounded = `(?<![\\w-])(?:${alt})(?![\\w-])`;
  /** A paused name in a position that DOES something (see the note above). */
  const codeRe = new RegExp(
    [
      `["'\`][^"'\`\\n]*${bounded}[^"'\`\\n]*["'\`]`, // any string literal containing the name
      `data-theme=["']${bounded}["']`,
      `theme:${bounded}`,
    ].join("|"),
  );
  const docRe = docViolations(names);
  const styleRe = styleViolations(names);

  for (const full of files) {
    const rel = relative(REPO_ROOT, full).split("\\").join("/");
    if (isExempt(rel) || isMachinery(rel)) continue;
    const dot = rel.lastIndexOf(".");
    const ext = dot > -1 ? rel.slice(dot) : "";
    let text;
    try {
      text = readFileSync(full, "utf8");
    } catch {
      continue;
    }

    let scanned;
    let re;
    if (CODE_EXTS.has(ext)) {
      scanned = stripComments(text);
      re = codeRe;
    } else if (DATA_EXTS.has(ext)) {
      scanned = text;
      re = codeRe;
    } else if (DOC_EXTS.has(ext)) {
      scanned = text;
      re = docRe;
    } else if (STYLE_EXTS.has(ext)) {
      scanned = text;
      re = styleRe;
    } else {
      continue;
    }
    if (!re.test(scanned)) continue;

    scanned.split("\n").forEach((line, i) => {
      if (!re.test(line)) return;
      if (LINE_EXEMPT_RE.test(line)) return;
      fail(rel, i + 1, `re-enumerates a paused surface: ${line.trim().slice(0, 120)}`);
    });
  }
}

// ── D/E/F. paused packages: private, task-less, unreferenced ────────────────
{
  const TASK_SCRIPTS = ["build", "test", "typecheck", "lint"];

  for (const [name, info] of Object.entries(PAUSED_PACKAGES)) {
    const pkgRel = `${info.dir}/package.json`;
    const raw = read(pkgRel);
    if (raw == null) {
      fail(pkgRel, 0, `paused package ${name} has no package.json at ${info.dir}`);
      continue;
    }
    let pkg;
    try {
      pkg = JSON.parse(raw);
    } catch (e) {
      fail(pkgRel, 0, `unparseable package.json: ${e.message}`);
      continue;
    }
    if (pkg.private !== true) {
      fail(pkgRel, 0, `paused package ${name} must set "private": true so it is never published`);
    }
    for (const s of TASK_SCRIPTS) {
      if (pkg.scripts && Object.hasOwn(pkg.scripts, s)) {
        fail(
          pkgRel,
          0,
          `paused package ${name} still declares a "${s}" script — a paused package runs no tasks`,
        );
      }
    }
  }

  // Nothing may depend on a paused package.
  const DEP_FIELDS = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ];
  const manifests = [];
  for (const root of ["packages", "apps", "fixtures"]) {
    const full = join(REPO_ROOT, root);
    if (!existsSync(full)) continue;
    for (const e of readdirSync(full, { withFileTypes: true })) {
      if (!e.isDirectory() || SKIP_DIRS.has(e.name)) continue;
      const m = join(full, e.name, "package.json");
      if (existsSync(m)) manifests.push(m);
    }
  }
  manifests.push(join(REPO_ROOT, "package.json"));

  for (const m of manifests) {
    const rel = relative(REPO_ROOT, m).split("\\").join("/");
    if (PAUSED_PACKAGE_DIRS.some((d) => rel.startsWith(d))) continue;
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(m, "utf8"));
    } catch {
      continue;
    }
    for (const field of DEP_FIELDS) {
      for (const dep of Object.keys(pkg[field] ?? {})) {
        if (Object.hasOwn(PAUSED_PACKAGES, dep)) {
          fail(
            rel,
            0,
            `depends on the paused package ${dep} (in "${field}") — remove the dependency`,
          );
        }
      }
    }
  }

  // Storybook must not glob a paused package's stories.
  const mainRel = "apps/docs/.storybook/main.ts";
  const main = read(mainRel);
  if (main != null) {
    const globs = [...main.matchAll(/["'`]([^"'`\n]*\*\.stories[^"'`\n]*)["'`]/g)].map((m) => m[1]);
    const wildcardPkgGlob = globs.some((g) => /packages\/\*\/src/.test(g));
    const excluded = /paused|blueprint|storyGlobExclude/i.test(main);
    if (wildcardPkgGlob && !excluded) {
      fail(
        mainRel,
        0,
        "the stories glob matches packages/*/src/** with no exclusion for paused packages — " +
          "a paused package's stories would still load, run in test-storybook and appear in the sidebar",
      );
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────
if (findings.length === 0) {
  console.log(
    `✔ paused-surfaces gate: ${PAUSED_THEMES.length} paused theme(s) ` +
      `[${PAUSED_THEMES.join(", ")}] and ${Object.keys(PAUSED_PACKAGES).length} paused package(s) ` +
      `stay as source and out of everything else.`,
  );
  process.exit(0);
}

console.error(`✖ paused-surfaces gate: ${findings.length} violation(s)\n`);
for (const f of findings) {
  console.error(`  ${f.file}${f.line ? `:${f.line}` : ""}`);
  console.error(`    ${f.msg}`);
}
console.error(
  "\n  A paused surface is kept as SOURCE and excluded from every test, gate, story, doc,\n" +
    "  app and release — see .claude/rules/paused-surfaces.md. Either remove the reference,\n" +
    "  or (maintainer decision only) un-pause the surface in PAUSED_THEMES / PAUSED_PACKAGES.\n" +
    "  A line that is genuinely ABOUT the pause is exempt — say so in the line itself.",
);

process.exit(WARN ? 0 : 1);
