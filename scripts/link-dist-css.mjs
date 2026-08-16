#!/usr/bin/env node
/**
 * link-dist-css — re-attach extracted CSS to the entry chunk that owned it.
 *
 * WHY: a component imports its own stylesheet (`import "./maps.css"`). When tsup
 * bundles, esbuild EXTRACTS that CSS into a sibling artifact (`dist/index.css`)
 * and DROPS the import from the JS. Nothing fails — the package just ships
 * silently unstyled, which is exactly how `@elabs/components-maps` lost its popup overrides
 * and `@elabs/components-editor` lost the whole markdown-editor stylesheet.
 *
 * Packages like `@elabs/components-maps` document "consumers add no CSS imports", so the
 * self-contained contract has to survive the build. This re-inserts
 * `import "./<entry>.css";` into the emitted entry JS, after any directive
 * prologue (the "use client" banner MUST stay the first statement).
 *
 * Idempotent: re-running never double-inserts. Run it after `tsup`.
 *
 * Usage: node ../../scripts/link-dist-css.mjs [packageDir]
 */
import fs from "node:fs";
import path from "node:path";

const pkgDir = path.resolve(process.argv[2] ?? process.cwd());
const distDir = path.join(pkgDir, "dist");

if (!fs.existsSync(distDir)) {
  console.error(`link-dist-css: no dist/ in ${pkgDir} — run the build first.`);
  process.exit(1);
}

/** Every .css file under dist/, recursively. */
function cssFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...cssFiles(full));
    else if (e.name.endsWith(".css")) out.push(full);
  }
  return out;
}

/**
 * Insert `spec` as an import after the directive prologue. A bundled entry looks
 * like:  "use client";\n// src/…\nimport …  — the directive must stay first or
 * React stops treating the module as a client module.
 */
function withImport(source, spec) {
  const lines = source.split("\n");
  let at = 0;
  while (at < lines.length && /^\s*(["'])use [a-z ]+\1\s*;?\s*$/.test(lines[at])) at++;
  lines.splice(at, 0, `import "${spec}";`);
  return lines.join("\n");
}

let linked = 0;
let skipped = 0;

for (const css of cssFiles(distDir)) {
  const js = css.replace(/\.css$/, ".js");
  if (!fs.existsSync(js)) {
    console.warn(
      `link-dist-css: ${path.relative(pkgDir, css)} has no sibling entry chunk — skipped.`,
    );
    continue;
  }
  const spec = `./${path.basename(css)}`;
  const source = fs.readFileSync(js, "utf8");
  if (source.includes(`"${spec}"`) || source.includes(`'${spec}'`)) {
    skipped++;
    continue;
  }
  fs.writeFileSync(js, withImport(source, spec));
  linked++;
  console.log(`link-dist-css: ${path.relative(pkgDir, js)} += import "${spec}"`);
}

if (linked === 0 && skipped === 0)
  console.log("link-dist-css: no extracted CSS — nothing to link.");
