/**
 * no-biome-ignore — no inert `biome-ignore` directives in source (#185).
 * Ported from scripts/check-no-biome-ignore.mjs. This repo lints with ESLint, not
 * Biome, so a `biome-ignore` reads like a reviewed suppression while the warning it
 * names stays live (#185 found 49 hiding real exhaustive-deps / no-explicit-any hits).
 */

const DIRECTIVE = ["biome", "ignore"].join("-"); // assembled: keep the literal out of this file

/** `biome-ignore`, `-all`, `-start`, `-end` — only ever inside comments. */
export const BIOME_IGNORE_RE = new RegExp(`${DIRECTIVE}(?:-all|-start|-end)?\\b`);

const PATTERNS = ["{packages,apps,registry}/**/*.{js,jsx,ts,tsx,cjs,mjs,cts,mts,css,scss,less}"];

const src = (rel, body) => ({ files: { [rel]: body } });

export default {
  id: "no-biome-ignore",
  scope: "repo",
  doc: "Suppress lint findings with `// eslint-disable-next-line <rule> -- <reason>`, never a `biome-ignore` comment (this repo has no Biome, so it is inert).",
  baseline: "none",
  run(ctx) {
    const out = [];
    for (const file of ctx.glob(PATTERNS)) {
      const lines = ctx.readFile(file).split("\n");
      for (let i = 0; i < lines.length; i++)
        if (BIOME_IGNORE_RE.test(lines[i]))
          out.push({
            file,
            line: i + 1,
            msg: "inert Biome directive — fix the finding or use `// eslint-disable-next-line <rule> -- <reason>`",
          });
    }
    return out;
  },
  fixtures: {
    pass: [
      src(
        "packages/charts/src/a.tsx",
        [
          "// eslint-disable-next-line react-hooks/exhaustive-deps -- caller-controlled deps",
          "}, deps);",
          "// eslint-disable-next-line @typescript-eslint/no-explicit-any -- upstream types",
        ].join("\n"),
      ),
      src("apps/docs/stories/Introduction.mdx", `{/* ${DIRECTIVE} x */}`),
      src("scripts/some-gate.test.mjs", `// ${DIRECTIVE} x`),
      src("docs/ADR/0001-x.md", `// ${DIRECTIVE} x`),
      src("packages/charts/README.md", `// ${DIRECTIVE} x`),
    ],
    fail: [
      src(
        "packages/charts/src/area.tsx",
        `const a = 1;\n  // ${DIRECTIVE} lint/suspicious/noExplicitAny: d3 curve\ntype C = any;`,
      ),
      src("apps/playground/src/main.tsx", `// ${DIRECTIVE}-all lint/correctness/x: caller deps`),
      src("registry/blocks/foo/foo.tsx", `{/* ${DIRECTIVE} lint/a11y/x: hitbox */}`),
      src("packages/tokens/src/themes.css", `/* ${DIRECTIVE}-start */`),
    ],
  },
};
