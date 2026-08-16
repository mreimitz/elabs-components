#!/usr/bin/env node
/**
 * check-css-assets.mjs — shipped-CSS asset & import gate.
 *
 * A package's CSS is only usable by a CONSUMER if everything it references
 * resolves from the artifact that actually ships. Two ways that silently broke:
 *
 *   1. `@elabs/components-tokens`' build ran `cp -r src/fonts dist/fonts`, which is not
 *      idempotent — tsup's `clean` removes files but leaves empty dirs, so the
 *      second build nested the fonts at `dist/fonts/fonts/…` while
 *      `dist/themes.css` still asked for `./fonts/inter/…`. Every consumer
 *      rendered in fallback fonts, and nothing failed.
 *   2. `dist/themes.css` carries `@import "tw-animate-css"`, but the package
 *      declared it only as a devDependency — so `pnpm pack` produced a tarball
 *      whose CSS build hard-fails on install (module not found).
 *
 * So, for every CSS file a package names in `exports` (source entry) AND in
 * `publishConfig.exports` (the published/`pnpm pack` entry):
 *
 *   RULE 1 (unresolved-asset)      every relative `url(…)` / `@import "./…"`
 *                                  resolves on disk, relative to that CSS file.
 *   RULE 2 (undeclared-bare-import) every BARE `@import "pkg"` names a package
 *                                  in `dependencies` or `peerDependencies` —
 *                                  a devDependency does not ship.
 *
 * And a third failure mode, on the other side of the build:
 *
 *   3. A component imports its own stylesheet (`import "./maps.css"`). esbuild
 *      EXTRACTS that CSS to a sibling artifact and DROPS the import from the JS,
 *      so `@elabs/components-maps` shipped without its popup overrides and `@elabs/components-editor`
 *      shipped with no markdown-editor styles at all. Nothing failed — the
 *      components just rendered unstyled for every consumer.
 *
 *   RULE 3 (unreachable-stylesheet) every EMITTED `dist/**\/*.css` is reachable:
 *                                  imported by its sibling entry chunk (see
 *                                  scripts/link-dist-css.mjs) or named in
 *                                  `publishConfig.exports`. Dead CSS = silently
 *                                  unstyled components.
 *
 * Flags:
 *   --warn           never exit non-zero (dev-hook mode); still prints findings.
 *   --require-dist   fail when a `publishConfig.exports` CSS target is missing
 *                    instead of skipping it. Use in CI *after* `pnpm build`;
 *                    without it a fresh clone with no dist/ still checks the
 *                    src/ side and reports how many dist entries were skipped.
 *
 * Dependency-free; ESM; locates packages relative to this file (cwd-independent).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root

/** Schemes that leave the filesystem — never our problem to resolve. */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Blank out `/* … *​/` comments, preserving newlines so any line-based reporting
 * stays accurate. CSS has no nested comments, so a non-greedy scan is exact.
 */
function blankComments(cssText) {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * Every `url(…)` target and `@import` specifier in a stylesheet.
 *
 * `url(` is matched quote-aware: a data-URI can legally contain `)` (themes.css
 * embeds `<circle filter="url(%23b)"/>` inside an SVG mask), so a naive
 * `url\(([^)]*)\)` truncates it and then reports a bogus violation.
 *
 * COMMENTS ARE BLANKED FIRST. A stylesheet's own docblock routinely shows the
 * consumer how to import it (`@import "@elabs/components-tokens/themes/dark.css"`),
 * and counting that as a real edge reports a dependency the package must declare
 * on ITSELF. Same comment-blindness class as #401.
 *
 * @param {string} cssText
 * @returns {{ relative: string[], bare: string[], external: string[] }}
 */
export function extractCssRefs(rawCssText) {
  const cssText = blankComments(rawCssText);
  const relative = [];
  const bare = [];
  const external = [];

  const push = (raw) => {
    const ref = raw.trim();
    if (ref === "") return;
    // `#foo` is a same-document fragment (SVG filter/gradient reference).
    if (ref.startsWith("#")) return;
    if (EXTERNAL.test(ref)) {
      external.push(ref);
      return;
    }
    (ref.startsWith(".") || ref.startsWith("/") ? relative : bare).push(ref);
  };

  // @import "x" | @import 'x' | @import url("x")  (layer()/supports()/media
  // suffixes are ignored — we only need the specifier).
  const importRe = /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)')/g;
  for (const m of cssText.matchAll(importRe)) {
    push(m[1] ?? m[2] ?? "");
  }

  // url("x") | url('x') | url(x)  — quoted alternatives first so `)` inside a
  // quoted data-URI can't terminate the match (themes.css embeds an SVG mask
  // containing `url(%23b)`). Scan with the @import preludes blanked out, or
  // `@import url("x")` would be counted twice.
  const withoutImports = cssText.replace(importRe, " ");
  for (const m of withoutImports.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")][^)]*))\s*\)/g)) {
    push(m[1] ?? m[2] ?? m[3] ?? "");
  }

  return { relative, bare, external };
}

/**
 * Relative refs that don't resolve on disk.
 * @param {string[]} relativeRefs
 * @param {{ baseDir: string, exists: (path: string) => boolean }} ctx
 * @returns {{ ref: string, rule: "unresolved-asset", detail: string }[]}
 */
export function findUnresolvedRefs(relativeRefs, { baseDir, exists }) {
  const out = [];
  for (const ref of new Set(relativeRefs)) {
    // Strip a `?query` / `#fragment` suffix — common on font URLs.
    const cleaned = ref.replace(/[?#].*$/, "");
    const target = resolve(baseDir, cleaned);
    if (!exists(target)) {
      out.push({ ref, rule: "unresolved-asset", detail: `does not exist at ${target}` });
    }
  }
  return out;
}

/** The package name of a bare specifier: `@scope/name/sub.css` → `@scope/name`. */
export function packageNameOf(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/**
 * Bare `@import`s whose package isn't a real (shipping) dependency.
 * @param {string[]} bareRefs
 * @param {{ dependencies?: object, peerDependencies?: object, devDependencies?: object }} pkgJson
 * @returns {{ ref: string, rule: "undeclared-bare-import", detail: string }[]}
 */
export function findUndeclaredBareImports(bareRefs, pkgJson) {
  const ships = new Set([
    ...Object.keys(pkgJson.dependencies ?? {}),
    ...Object.keys(pkgJson.peerDependencies ?? {}),
  ]);
  const devOnly = new Set(Object.keys(pkgJson.devDependencies ?? {}));

  const out = [];
  for (const ref of new Set(bareRefs)) {
    const name = packageNameOf(ref);
    if (ships.has(name)) continue;
    out.push({
      ref,
      rule: "undeclared-bare-import",
      detail: devOnly.has(name)
        ? `"${name}" is a devDependency — devDeps are not installed for consumers of the tarball; move it to dependencies or peerDependencies`
        : `"${name}" is not declared in dependencies or peerDependencies`,
    });
  }
  return out;
}

/**
 * Emitted stylesheets that no consumer can ever reach.
 *
 * A stylesheet in dist/ is only delivered if something pulls it in. There are
 * three ways in, and reachability is TRANSITIVE:
 *
 *   a. the package names it in `publishConfig.exports` (consumer imports it), or
 *   b. its sibling entry chunk imports it (link-dist-css re-inserts the import
 *      esbuild dropped), or
 *   c. an already-reachable stylesheet `@import`s it — how `@elabs/components-tokens` ships
 *      decoration/density/rtl.css, which only themes.css pulls in.
 *
 * So: seed from (a) and (b), then walk relative `@import`s to a fixpoint.
 * Anything outside the closure ships as dead bytes and its components render
 * unstyled.
 *
 * @param {string[]} distCssPaths absolute paths of every `dist/**\/*.css`
 * @param {{ exportedCss: Set<string>, readFile: (p: string) => string, exists: (p: string) => boolean, resolveFrom: (dir: string, ref: string) => string }} ctx
 *        `exportedCss` holds absolute paths of CSS named in publishConfig.exports.
 * @returns {{ ref: string, rule: "unreachable-stylesheet", detail: string }[]}
 */
export function findUnreachableStylesheets(
  distCssPaths,
  { exportedCss, readFile, exists, resolveFrom },
) {
  const dirOf = (p) => p.slice(0, p.lastIndexOf("/"));
  const baseOf = (p) => p.slice(p.lastIndexOf("/") + 1);

  // Seed: (a) exported, and (b) imported by the sibling entry chunk.
  const reachable = new Set();
  for (const cssPath of distCssPaths) {
    if (exportedCss.has(cssPath)) {
      reachable.add(cssPath);
      continue;
    }
    const jsPath = cssPath.replace(/\.css$/, ".js");
    const specifier = `./${baseOf(cssPath)}`;
    if (exists(jsPath)) {
      const js = readFile(jsPath);
      if (js.includes(`"${specifier}"`) || js.includes(`'${specifier}'`)) reachable.add(cssPath);
    }
  }

  // (c) Transitively follow relative @imports out of everything reachable.
  const queue = [...reachable];
  while (queue.length > 0) {
    const cssPath = queue.pop();
    if (!exists(cssPath)) continue;
    for (const ref of extractCssRefs(readFile(cssPath)).relative) {
      if (!ref.replace(/[?#].*$/, "").endsWith(".css")) continue;
      const target = resolveFrom(dirOf(cssPath), ref.replace(/[?#].*$/, ""));
      if (!reachable.has(target) && exists(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }

  return distCssPaths
    .filter((p) => !reachable.has(p))
    .map((cssPath) => ({
      ref: cssPath,
      rule: "unreachable-stylesheet",
      detail:
        `emitted but unreachable — no entry chunk imports "./${baseOf(cssPath)}", no reachable ` +
        `stylesheet @imports it, and publishConfig.exports does not name it, so consumers render unstyled`,
    }));
}

/** Every `*.css` file under `dir`, recursively (absolute paths). */
function collectCss(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...collectCss(full));
    else if (e.name.endsWith(".css")) out.push(full);
  }
  return out;
}

/** Every `*.css` string inside an exports-like object. */
function cssTargets(exportsObj) {
  const out = [];
  const walk = (node) => {
    if (typeof node === "string") {
      if (node.endsWith(".css")) out.push(node);
    } else if (node && typeof node === "object") {
      for (const v of Object.values(node)) walk(v);
    }
  };
  walk(exportsObj);
  return [...new Set(out)];
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.includes("--warn");
  const requireDist = argv.includes("--require-dist");

  const pkgsDir = join(REPO_ROOT, "packages");
  const violations = [];
  let checked = 0;
  let skipped = 0;
  let reachChecked = 0;

  for (const entry of readdirSync(pkgsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgDir = join(pkgsDir, entry.name);
    const pkgJsonPath = join(pkgDir, "package.json");
    if (!existsSync(pkgJsonPath)) continue;
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

    const targets = [
      ...cssTargets(pkgJson.exports).map((t) => ({ target: t, published: false })),
      ...cssTargets(pkgJson.publishConfig?.exports).map((t) => ({ target: t, published: true })),
    ];

    for (const { target, published } of targets) {
      const cssPath = resolve(pkgDir, target);
      if (!existsSync(cssPath)) {
        // A missing dist/ is normal before `pnpm build`; a missing src/ never is.
        if (published && !requireDist) {
          skipped++;
          continue;
        }
        violations.push({
          pkg: pkgJson.name,
          target,
          ref: target,
          rule: "missing-css-entry",
          detail: published
            ? `publishConfig.exports points at ${target}, which does not exist (run \`pnpm build\`)`
            : `exports points at ${target}, which does not exist`,
        });
        continue;
      }

      checked++;
      const css = readFileSync(cssPath, "utf8");
      const { relative, bare } = extractCssRefs(css);
      const found = [
        ...findUnresolvedRefs(relative, { baseDir: dirname(cssPath), exists: existsSync }),
        ...findUndeclaredBareImports(bare, pkgJson),
      ];
      for (const v of found) violations.push({ pkg: pkgJson.name, target, ...v });
    }

    // RULE 3 — every emitted stylesheet must be reachable. Only meaningful once
    // the package has been built; a fresh clone has no dist/ to inspect.
    const distDir = join(pkgDir, "dist");
    if (existsSync(distDir)) {
      const distCss = collectCss(distDir);
      const exportedCss = new Set(
        cssTargets(pkgJson.publishConfig?.exports).map((t) => resolve(pkgDir, t)),
      );
      const unreachable = findUnreachableStylesheets(distCss, {
        exportedCss,
        readFile: (p) => readFileSync(p, "utf8"),
        exists: existsSync,
        resolveFrom: resolve,
      });
      for (const v of unreachable) {
        violations.push({
          pkg: pkgJson.name,
          target: v.ref.slice(pkgDir.length + 1),
          ...v,
          ref: v.ref.slice(pkgDir.length + 1),
        });
      }
      reachChecked += distCss.length;
    }
  }

  if (violations.length === 0) {
    const note = skipped > 0 ? ` (${skipped} dist entr(y/ies) skipped — not built)` : "";
    console.log(
      `✔ css-assets: ${checked} shipped stylesheet(s) — every relative url()/@import resolves, every bare @import is a real dependency${note}.\n` +
        `✔ css-assets: ${reachChecked} emitted stylesheet(s) in dist/ — every one is reachable (imported by its entry, or exported).`,
    );
    return 0;
  }

  console.error("✖ css-assets: shipped CSS references something a consumer won't have:");
  for (const v of violations) {
    console.error(`  ${v.pkg} → ${v.target} — ${v.rule}: ${v.ref}\n      ${v.detail}`);
  }
  console.error(
    "\n  Fix: make the build copy the asset into dist/ (idempotently), or declare the\n" +
      "  imported package in dependencies/peerDependencies — devDependencies do not ship.\n" +
      "  For unreachable-stylesheet: append `&& node ../../scripts/link-dist-css.mjs` to\n" +
      "  the package's build script, or name the stylesheet in publishConfig.exports.",
  );
  return warnOnly ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
