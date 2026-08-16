#!/usr/bin/env node
/**
 * check-tt-aliases.mjs — the Trusted-Types aliases stay dogfooded.
 *
 * `docs/CSP-AND-NETWORK.md` §2.2 publishes a bundler snippet that resolves two
 * transitive markdown dependencies to their DOM-FREE builds. Their `browser`
 * export condition points at builds that use `innerHTML`/`DOMParser`, which blank
 * content under `require-trusted-types-for 'script'` (a message containing
 * `&amp;` renders empty).
 *
 * A snippet nobody runs is a snippet that rots — and this one has a sharp edge:
 * the alias target MUST be an absolute path from the CJS resolver, because
 * neither package exposes `./index.js` as a subpath (`ERR_PACKAGE_PATH_NOT_EXPORTED`).
 * So this gate asserts that:
 *
 *   1. every app actually applies the aliases,
 *   2. each declares the packages as direct devDependencies (needed for
 *      `require.resolve` under pnpm's isolated layout),
 *   3. `require.resolve` really lands on the DOM-free build, not the DOM one, and
 *   4. the doc still documents both packages.
 *
 * Rule 3 is the one that matters: it verifies the published advice against the
 * real filesystem rather than trusting that it still works.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

/** The two packages whose `browser` condition is a DOM (innerHTML) build. */
export const TT_ALIASED_PACKAGES = [
  "decode-named-character-reference",
  "hast-util-from-html-isomorphic",
];

/**
 * Config files that must apply the aliases, and the app each belongs to.
 *
 * `apps/playground` was the second site until it was deleted in 80a12fb
 * (2026-08-02); `apps/docs` is the only app left in the repo.
 */
const SITES = [{ app: "apps/docs", config: "apps/docs/.storybook/main.ts" }];

/** Path fragments that identify each package's DOM (unsafe) build. */
const DOM_BUILD = /index\.dom\.js$|[/\\]lib[/\\]browser\.js$/;

/** @returns {boolean} whether `source` aliases `pkg` via the CJS resolver. */
export function appliesAlias(source, pkg) {
  return (
    source.includes(`"${pkg}": require.resolve(`) || source.includes(`'${pkg}': require.resolve(`)
  );
}

/** @returns {{ site: string, rule: string, detail: string }[]} */
export function findAliasGaps({ root = REPO_ROOT, sites = SITES, docText } = {}) {
  const out = [];

  for (const { app, config } of sites) {
    let source;
    try {
      source = readFileSync(join(root, config), "utf8");
    } catch {
      out.push({ site: config, rule: "missing-config", detail: "config file not found" });
      continue;
    }

    let pkgJson = {};
    try {
      pkgJson = JSON.parse(readFileSync(join(root, app, "package.json"), "utf8"));
    } catch {
      /* reported below via the devDependency rule */
    }
    const declared = new Set(Object.keys(pkgJson.devDependencies ?? {}));

    for (const pkg of TT_ALIASED_PACKAGES) {
      if (!appliesAlias(source, pkg)) {
        out.push({
          site: config,
          rule: "alias-not-applied",
          detail: `does not alias "${pkg}" via require.resolve — the DOM build ships and blanks content under Trusted Types`,
        });
      }
      if (!declared.has(pkg)) {
        out.push({
          site: `${app}/package.json`,
          rule: "alias-dep-not-declared",
          detail: `"${pkg}" must be a direct devDependency or require.resolve throws under pnpm's isolated layout`,
        });
      }
    }
  }

  if (docText !== undefined) {
    for (const pkg of TT_ALIASED_PACKAGES) {
      if (!docText.includes(pkg)) {
        out.push({
          site: "docs/CSP-AND-NETWORK.md",
          rule: "alias-not-documented",
          detail: `"${pkg}" is aliased in the apps but absent from the published guidance`,
        });
      }
    }
  }

  return out;
}

/**
 * Resolve each package the way the published snippet does and report any that
 * land on the DOM build. This is the check that verifies the ADVICE, not the code.
 * @returns {{ site: string, rule: string, detail: string }[]}
 */
export function findBadResolutions({ root = REPO_ROOT } = {}) {
  // Resolve from the app that declares the packages — under pnpm's isolated
  // layout, `require.resolve` only finds them from a dependent's own directory.
  const require = createRequire(join(root, "apps", "docs", ".storybook", "main.ts"));
  const out = [];
  for (const pkg of TT_ALIASED_PACKAGES) {
    let resolved;
    try {
      resolved = require.resolve(pkg);
    } catch (error) {
      out.push({
        site: pkg,
        rule: "alias-unresolvable",
        detail: `require.resolve("${pkg}") threw (${error.code ?? "error"}) — the published snippet would fail here`,
      });
      continue;
    }
    if (DOM_BUILD.test(resolved)) {
      out.push({
        site: pkg,
        rule: "resolves-to-dom-build",
        detail: `require.resolve landed on ${resolved} — the DOM build the alias exists to avoid`,
      });
    }
  }
  return out;
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.includes("--warn");

  let docText = "";
  try {
    docText = readFileSync(join(REPO_ROOT, "docs", "CSP-AND-NETWORK.md"), "utf8");
  } catch {
    console.error("✖ tt-aliases: docs/CSP-AND-NETWORK.md is missing.");
    return warnOnly ? 0 : 1;
  }

  const violations = [...findAliasGaps({ docText }), ...findBadResolutions()];

  if (violations.length === 0) {
    console.log(
      `✔ tt-aliases: ${TT_ALIASED_PACKAGES.length} DOM-sink package(s) aliased in ${SITES.length} app(s), declared, documented, and resolving to their DOM-free builds.`,
    );
    return 0;
  }

  console.error("✖ tt-aliases: the Trusted-Types guidance is out of sync with reality:");
  for (const v of violations) console.error(`  ${v.site} — ${v.rule}\n      ${v.detail}`);
  console.error(
    "\n  These packages' `browser` export condition points at innerHTML/DOMParser\n" +
      "  builds. Under `require-trusted-types-for 'script'` they blank content — a\n" +
      "  message containing `&amp;` renders empty. See docs/CSP-AND-NETWORK.md §2.2.",
  );
  return warnOnly ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
