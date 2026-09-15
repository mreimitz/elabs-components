#!/usr/bin/env node
/**
 * check-tt-aliases.mjs — the Trusted-Types alias ADVICE still resolves safely.
 *
 * `docs/CSP-AND-NETWORK.md` §2.2 publishes a bundler snippet that resolves two
 * transitive markdown dependencies to their DOM-FREE builds via `require.resolve`.
 * Their `browser` export condition points at builds that use `innerHTML`/`DOMParser`,
 * which blank content under `require-trusted-types-for 'script'`.
 *
 * The file-reading half (every app applies the alias, declares the packages, the doc
 * names them) is the `tt-aliases` rule in scripts/check/rules/tt-aliases.mjs. This
 * script keeps ONLY the half that cannot live in the check runner: it resolves the
 * real packages in node_modules and fails if `require.resolve` lands on the DOM build
 * (or throws) — verifying the published advice against the filesystem.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { TT_ALIASED_PACKAGES } from "./check/rules/tt-aliases.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Path fragments that identify each package's DOM (unsafe) build. */
const DOM_BUILD = /index\.dom\.js$|[/\\]lib[/\\]browser\.js$/;

/**
 * Resolve each package the way the published snippet does and report any that land on
 * the DOM build.
 * @returns {{ site: string, rule: string, detail: string }[]}
 */
export function findBadResolutions({ root = REPO_ROOT } = {}) {
  // Resolve from the app that declares the packages — under pnpm's isolated layout,
  // `require.resolve` only finds them from a dependent's own directory.
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

function main(argv) {
  const warnOnly = argv.includes("--warn");
  const violations = findBadResolutions();
  if (violations.length === 0) {
    console.log(
      `✔ tt-aliases: ${TT_ALIASED_PACKAGES.length} DOM-sink package(s) resolve to their DOM-free builds.`,
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
