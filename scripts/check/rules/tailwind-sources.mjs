/**
 * tailwind-sources — every Tailwind-bearing package is named by a resolvable `@source` (#348).
 *
 * Tailwind v4 does not scan workspace packages resolved through node_modules. Every CSS
 * file under apps/** or fixtures/** that declares ≥1 `@source` must name each
 * `packages/<name>` shipping non-test, non-story `.tsx` — `packages/process` once
 * rendered a zero-height, half-ghosted canvas with every gate green because it was
 * missing from preview.css.
 *
 * Coverage RESOLVES, never string-matches: the value's prefix before the first glob
 * magic (`* ? { } [ ]`, as @tailwindcss/oxide does) is resolved against the CSS file's
 * own directory and must equal `packages/<name>/src` (SRC shape) or end with
 * `node_modules/<package.json name>/dist` (DIST shape, consumer-smoke). A wrong
 * relative depth is caught. Known limits: a broader-but-covering base
 * (`packages/process/**`) is rejected (loud false positive); a package whose classes
 * live only in stories or `.ts` is judged out of scope.
 *
 * `packages/tokens` is exempt by name: two non-test .tsx files, no Tailwind class
 * strings (its one `className=` sits in a doc comment).
 */
import { posix } from "node:path";

import { stripCssCommentsQuoteAware } from "../lib/css.mjs";

export const EXEMPT_PACKAGES = {
  tokens: "ships .tsx providers but no Tailwind class strings (#348)",
};
const SKIP = "**/{node_modules,.git,dist,build,storybook-static,.turbo,coverage}/**";
const GLOB_MAGIC = /[*?{}[\]]/;

/** Every `@source "<value>";` in a CSS text, comments stripped (quote-aware). */
export function extractSourceValues(cssText) {
  const code = stripCssCommentsQuoteAware(cssText);
  return [...code.matchAll(/@source\s+["']([^"']+)["']\s*;/g)].map((m) => m[1]);
}

/** A `@source` value's scan root, repo-relative, resolved against the CSS file's directory. */
export function sourceBaseDir(cssRel, value) {
  const segs = [];
  for (const seg of value.split("/")) {
    if (GLOB_MAGIC.test(seg)) break;
    segs.push(seg);
  }
  return posix.normalize(posix.join(posix.dirname(cssRel), segs.join("/") || "."));
}

function scopedPackages(ctx) {
  const byPkg = new Map();
  for (const f of ctx.glob("packages/*/src/**/*.tsx", {
    ignore: ["**/*.{test,stories}.tsx", SKIP],
  })) {
    const name = f.split("/")[1];
    if (!EXEMPT_PACKAGES[name]) byPkg.set(name, `packages/${name}/src`);
  }
  return [...byPkg].sort().map(([name, srcDir]) => {
    const manifest = `packages/${name}/package.json`;
    let packageName = null;
    try {
      packageName = ctx.exists(manifest) ? (ctx.json(manifest).name ?? null) : null;
    } catch {
      packageName = null;
    }
    return { name, srcDir, packageName };
  });
}

function suggestion(cssRel, values, pkg) {
  const dist = values.find((v) => v.includes("node_modules"));
  if (dist && pkg.packageName)
    return `@source "${dist.slice(0, dist.indexOf("node_modules"))}node_modules/${pkg.packageName}/dist";`;
  const rel = posix.relative(posix.dirname(cssRel), pkg.srcDir);
  return `@source "${rel.startsWith(".") ? rel : `./${rel}`}/**/*.{ts,tsx}";`;
}

const TSX = `export function W() {\n  return <div className="flex opacity-35">hi</div>;\n}\n`;
const PREVIEW = "apps/docs/.storybook/preview.css";

export default {
  id: "tailwind-sources",
  scope: "packages",
  doc: "Name every package that ships Tailwind classes in each `@source`-bearing app CSS file with a pattern that resolves to `packages/<name>/src` (or `node_modules/<pkg>/dist`); an unlisted package renders unstyled.",
  baseline: "none",
  run(ctx) {
    const packages = scopedPackages(ctx);
    const findings = [];
    for (const cssRel of ctx.glob("{apps,fixtures}/**/*.css", { ignore: SKIP })) {
      const values = extractSourceValues(ctx.readFile(cssRel));
      if (values.length === 0) continue;
      const dirs = values.map((v) => sourceBaseDir(cssRel, v));
      for (const pkg of packages) {
        const covered = dirs.some(
          (d) =>
            d === pkg.srcDir ||
            (pkg.packageName &&
              (d === `node_modules/${pkg.packageName}/dist` ||
                d.endsWith(`/node_modules/${pkg.packageName}/dist`))),
        );
        if (!covered)
          findings.push({
            file: cssRel,
            line: 1,
            msg: `packages/${pkg.name} is not covered by any @source — add: ${suggestion(cssRel, values, pkg)}`,
          });
      }
    }
    return findings;
  },
  fixtures: {
    pass: [
      {
        files: {
          "packages/ui/package.json": `{ "name": "@elabs-ai/components-ui" }`,
          "packages/ui/src/w.tsx": TSX,
          "packages/cli/package.json": `{ "name": "@elabs-ai/components-cli" }`,
          "packages/cli/src/index.ts": `export const x = 1;\n`,
          "packages/tokens/src/theme-provider.tsx": TSX,
          [PREVIEW]: `/* a comment naming @source "nothing"; */\n@source "../../../packages/ui/src/**/*.{ts,tsx}"; /* trailing */\n`,
        },
      },
      {
        files: {
          "packages/process/package.json": `{ "name": "@elabs-ai/components-process" }`,
          "packages/process/src/w.tsx": TSX,
          "packages/process/src/w.stories.tsx": TSX,
          "fixtures/consumer-smoke/src/index.css": `@source "../node_modules/@elabs-ai/components-process/dist";\n`,
        },
      },
      // a CSS file with no @source at all is not in scope
      {
        files: {
          "packages/ui/src/w.tsx": TSX,
          "apps/web/src/index.css": `@import "tailwindcss";\n`,
        },
      },
    ],
    fail: [
      {
        files: {
          "packages/ui/package.json": `{ "name": "@elabs-ai/components-ui" }`,
          "packages/ui/src/w.tsx": TSX,
          "packages/process/package.json": `{ "name": "@elabs-ai/components-process" }`,
          "packages/process/src/w.tsx": TSX,
          [PREVIEW]: `@source "../../../packages/ui/src/**/*.{ts,tsx}";\n`,
        },
      },
      // one "../" short: looks like coverage as a string, resolves elsewhere
      {
        files: {
          "packages/process/src/w.tsx": TSX,
          [PREVIEW]: `@source "../../packages/process/src/**/*.{ts,tsx}";\n`,
        },
      },
    ],
  },
};
