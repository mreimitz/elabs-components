/**
 * tt-aliases — the Trusted-Types aliases stay dogfooded (docs/CSP-AND-NETWORK.md §2.2).
 * Ported from the file-reading half of scripts/check-tt-aliases.mjs.
 *
 * Two markdown dependencies ship a `browser` build that uses innerHTML/DOMParser and
 * blanks content under `require-trusted-types-for 'script'`. Every app must:
 *   1. alias each via `"<pkg>": require.resolve(` (a bare string alias throws
 *      ERR_PACKAGE_PATH_NOT_EXPORTED),
 *   2. declare each as a direct devDependency (require.resolve under pnpm isolation),
 * and the doc must still name both packages.
 * The node_modules half — that require.resolve really lands on the DOM-free build —
 * stays in scripts/check-tt-aliases.mjs (it resolves real packages, not repo files).
 */
export const TT_ALIASED_PACKAGES = [
  "decode-named-character-reference",
  "hast-util-from-html-isomorphic",
];
const SITES = [{ app: "apps/docs", config: "apps/docs/.storybook/main.ts" }];
const DOC = "docs/CSP-AND-NETWORK.md";

const appliesAlias = (source, pkg) =>
  source.includes(`"${pkg}": require.resolve(`) || source.includes(`'${pkg}': require.resolve(`);

// ── fixtures ─────────────────────────────────────────────────────────────────
const [A, B] = TT_ALIASED_PACKAGES;
const GOOD_CONFIG = `alias: {\n  "${A}": require.resolve("${A}"),\n  '${B}': require.resolve("${B}"),\n}`;
const GOOD_PKG = JSON.stringify({ devDependencies: { [A]: "^2.0.0", [B]: "^3.0.0" } });
const GOOD_DOC = `Alias ${A} and ${B} to their DOM-free builds.`;
const tree = ({ config = GOOD_CONFIG, pkg = GOOD_PKG, doc = GOOD_DOC } = {}) => ({
  files: {
    ...(config == null ? {} : { "apps/docs/.storybook/main.ts": config }),
    ...(pkg == null ? {} : { "apps/docs/package.json": pkg }),
    ...(doc == null ? {} : { [DOC]: doc }),
  },
});

export default {
  id: "tt-aliases",
  scope: "repo",
  doc: "Every app aliases `decode-named-character-reference` and `hast-util-from-html-isomorphic` via `require.resolve(…)`, declares both as direct devDependencies, and `docs/CSP-AND-NETWORK.md` still documents both.",
  baseline: "none",
  run(ctx) {
    const out = [];
    for (const { app, config } of SITES) {
      if (!ctx.exists(config)) {
        out.push({ file: config, line: 1, msg: "config file not found" });
        continue;
      }
      const source = ctx.readFile(config);
      const pkgPath = `${app}/package.json`;
      let declared = new Set();
      try {
        declared = new Set(Object.keys(ctx.json(pkgPath).devDependencies ?? {}));
      } catch {
        /* reported per package below */
      }
      for (const pkg of TT_ALIASED_PACKAGES) {
        if (!appliesAlias(source, pkg))
          out.push({
            file: config,
            line: 1,
            msg: `does not alias "${pkg}" via require.resolve — the DOM build ships and blanks content under Trusted Types`,
          });
        if (!declared.has(pkg))
          out.push({
            file: pkgPath,
            line: 1,
            msg: `"${pkg}" must be a direct devDependency or require.resolve throws under pnpm's isolated layout`,
          });
      }
    }
    if (!ctx.exists(DOC)) return [...out, { file: DOC, line: 1, msg: "doc is missing" }];
    const docText = ctx.readFile(DOC);
    for (const pkg of TT_ALIASED_PACKAGES)
      if (!docText.includes(pkg))
        out.push({
          file: DOC,
          line: 1,
          msg: `"${pkg}" is aliased in the apps but absent from the published guidance`,
        });
    return out;
  },
  fixtures: {
    pass: [tree()],
    fail: [
      tree({ config: `alias: { "${A}": "${A}/index.js", "${B}": require.resolve("${B}") }` }),
      tree({ config: null }),
      tree({ pkg: JSON.stringify({ dependencies: { [A]: "^2.0.0", [B]: "^3.0.0" } }) }),
      tree({ pkg: null }),
      tree({ doc: "nothing relevant here" }),
      tree({ doc: null }),
    ],
  },
};
