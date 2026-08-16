/**
 * check-css-assets.test.mjs — locks the shipped-CSS asset & import gate.
 * Run in CI: `node --test scripts/check-css-assets.test.mjs`.
 *
 * All fixtures are INLINE strings (hermetic), except the final integration test
 * which asserts the real committed themes.css + package.json pass.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractCssRefs,
  findUnresolvedRefs,
  findUndeclaredBareImports,
  findUnreachableStylesheets,
  packageNameOf,
} from "./check-css-assets.mjs";

/** `exists` stub: only the listed absolute-ish suffixes resolve. */
const existsOnly =
  (...present) =>
  (path) =>
    present.some((p) => path.endsWith(p));

// ── RULE 1: the real #1 bug — fonts nested one level too deep ────────────────
test("FAILS: a font url() that isn't in dist (the doubled fonts/fonts bug)", () => {
  const css = `@font-face { src: url("./fonts/inter/Inter-Variable.woff") format("woff"); }`;
  const { relative } = extractCssRefs(css);
  assert.deepEqual(relative, ["./fonts/inter/Inter-Variable.woff"]);

  // dist/ has the file only under the doubled path, which is NOT what CSS asks for.
  const v = findUnresolvedRefs(relative, {
    baseDir: "/pkg/dist",
    exists: existsOnly("/pkg/dist/fonts/fonts/inter/Inter-Variable.woff"),
  });
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "unresolved-asset");
});

test("PASSES: the same font url() once the copy lands at the right depth", () => {
  const { relative } = extractCssRefs(
    `@font-face { src: url("./fonts/inter/Inter-Variable.woff"); }`,
  );
  const v = findUnresolvedRefs(relative, {
    baseDir: "/pkg/dist",
    exists: existsOnly("/pkg/dist/fonts/inter/Inter-Variable.woff"),
  });
  assert.equal(v.length, 0);
});

test("FAILS: a relative @import whose file was never copied to dist", () => {
  const { relative } = extractCssRefs(`@import "./decoration.css";`);
  assert.deepEqual(relative, ["./decoration.css"]);
  const v = findUnresolvedRefs(relative, { baseDir: "/pkg/dist", exists: () => false });
  assert.equal(v.length, 1);
});

test("resolves a ?query / #fragment suffix on an asset URL", () => {
  const { relative } = extractCssRefs(`@font-face { src: url("./fonts/a.woff2?v=2"); }`);
  const v = findUnresolvedRefs(relative, {
    baseDir: "/pkg/dist",
    exists: existsOnly("/pkg/dist/fonts/a.woff2"),
  });
  assert.equal(v.length, 0, "the cache-buster must not make the asset look missing");
});

// ── False positives the gate must NOT raise ──────────────────────────────────
test("ignores remote, data: and fragment url()s", () => {
  const css = `
    .a { background: url(https://cdn.example.com/x.png); }
    .b { background: url(//cdn.example.com/y.png); }
    .c { mask: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><circle fill="white"/></svg>'); }
    .d { fill: url(#gradient); }
  `;
  const { relative, bare } = extractCssRefs(css);
  assert.deepEqual(relative, [], "no relative refs in this fixture");
  assert.deepEqual(bare, [], "a fragment/remote/data ref is never a bare package import");
});

test("a data-URI containing url(%23b) is not truncated into a bogus ref", () => {
  // themes.css embeds an SVG mask whose filter attribute contains `url(%23b)`.
  // A naive /url\(([^)]*)\)/ stops at that inner `)` and reports garbage.
  const css = `.blur { mask: url('data:image/svg+xml,<svg><filter id="b"/><circle filter="url(%23b)"/></svg>'); }`;
  const { relative, bare, external } = extractCssRefs(css);
  assert.deepEqual(relative, []);
  assert.deepEqual(bare, []);
  assert.equal(external.length, 1);
  assert.ok(external[0].startsWith("data:image/svg+xml"));
});

// ── RULE 2: the real #4 bug — a devDependency can't ship ─────────────────────
test("FAILS: bare @import resolving to a devDependency only", () => {
  const { bare } = extractCssRefs(`@import "tailwindcss";\n@import "tw-animate-css";`);
  assert.deepEqual(bare, ["tailwindcss", "tw-animate-css"]);

  const v = findUndeclaredBareImports(bare, {
    devDependencies: { tailwindcss: "^4.0.0", "tw-animate-css": "^1.4.0" },
  });
  assert.equal(v.length, 2);
  assert.equal(v[0].rule, "undeclared-bare-import");
  assert.match(v[0].detail, /devDependency/, "the message must name the actual mistake");
});

test("PASSES: the same imports once declared as dependency / peerDependency", () => {
  const { bare } = extractCssRefs(`@import "tailwindcss";\n@import "tw-animate-css";`);
  const v = findUndeclaredBareImports(bare, {
    dependencies: { "tw-animate-css": "^1.4.0" },
    peerDependencies: { tailwindcss: "^4.0.0" },
    devDependencies: { tailwindcss: "^4.0.0", "tw-animate-css": "^1.4.0" },
  });
  assert.equal(v.length, 0, "declaring it dep/peer is the fix; keeping the devDep too is fine");
});

test("FAILS: bare @import of a package declared nowhere at all", () => {
  const v = findUndeclaredBareImports(["some-css-lib"], {});
  assert.equal(v.length, 1);
  assert.match(v[0].detail, /not declared/);
});

test("scoped specifiers with a subpath resolve to the package name", () => {
  assert.equal(packageNameOf("@scope/pkg/dist/x.css"), "@scope/pkg");
  assert.equal(packageNameOf("@scope/pkg"), "@scope/pkg");
  assert.equal(packageNameOf("pkg/sub/x.css"), "pkg");
  assert.equal(packageNameOf("pkg"), "pkg");

  const v = findUndeclaredBareImports(["@scope/pkg/dist/x.css"], {
    dependencies: { "@scope/pkg": "^1.0.0" },
  });
  assert.equal(v.length, 0, "the subpath must not defeat the declaration lookup");
});

test('@import url("…") form is extracted too', () => {
  const { bare, relative } = extractCssRefs(
    `@import url("tw-animate-css");\n@import url("./a.css");`,
  );
  assert.deepEqual(bare, ["tw-animate-css"]);
  assert.deepEqual(relative, ["./a.css"]);
});

// ── RULE 3: the real bug — esbuild extracts the CSS and drops the import ─────
/** Minimal in-memory dist/ for the reachability walker. */
const fakeDist = (files) => ({
  exportedCss: new Set(),
  readFile: (p) => files[p] ?? "",
  exists: (p) => p in files,
  // Good enough for the flat/one-level fixtures below.
  resolveFrom: (dir, ref) => `${dir}/${ref.replace(/^\.\//, "")}`,
});

test("FAILS: extracted CSS whose entry chunk lost the import (maps shipped unstyled)", () => {
  const files = {
    "/pkg/dist/index.css": ".maplibregl-popup { color: red }",
    "/pkg/dist/index.js": '"use client";\nexport const MapCanvas = () => null;',
  };
  const v = findUnreachableStylesheets(["/pkg/dist/index.css"], fakeDist(files));
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "unreachable-stylesheet");
  assert.match(v[0].detail, /render unstyled/);
});

test("PASSES: once link-dist-css re-inserts the import into the entry", () => {
  const files = {
    "/pkg/dist/index.css": ".maplibregl-popup { color: red }",
    "/pkg/dist/index.js":
      '"use client";\nimport "./index.css";\nexport const MapCanvas = () => null;',
  };
  const v = findUnreachableStylesheets(["/pkg/dist/index.css"], fakeDist(files));
  assert.equal(v.length, 0);
});

test("PASSES: a stylesheet reachable only via publishConfig.exports", () => {
  const ctx = fakeDist({ "/pkg/dist/themes.css": ":root{}" });
  ctx.exportedCss = new Set(["/pkg/dist/themes.css"]);
  const v = findUnreachableStylesheets(["/pkg/dist/themes.css"], ctx);
  assert.equal(v.length, 0);
});

test("PASSES: transitively — @qlik-coe-emea/qlabs-components-tokens ships rtl/density only via themes.css @import", () => {
  const files = {
    "/pkg/dist/themes.css":
      '@import "./decoration.css";\n@import "./density.css";\n@import "./rtl.css";',
    "/pkg/dist/decoration.css": ".d{}",
    "/pkg/dist/density.css": ".e{}",
    "/pkg/dist/rtl.css": ".f{}",
  };
  const ctx = fakeDist(files);
  ctx.exportedCss = new Set(["/pkg/dist/themes.css"]); // only themes.css is exported
  const v = findUnreachableStylesheets(
    Object.keys(files).filter((f) => f.endsWith(".css")),
    ctx,
  );
  assert.equal(v.length, 0, "an @import chain out of an exported stylesheet is a real path in");
});

test("FAILS: a stylesheet nobody imports, even when a sibling chain exists", () => {
  const files = {
    "/pkg/dist/themes.css": '@import "./density.css";',
    "/pkg/dist/density.css": ".e{}",
    "/pkg/dist/orphan.css": ".dead{}",
  };
  const ctx = fakeDist(files);
  ctx.exportedCss = new Set(["/pkg/dist/themes.css"]);
  const v = findUnreachableStylesheets(Object.keys(files), ctx);
  assert.equal(v.length, 1);
  assert.equal(v[0].ref, "/pkg/dist/orphan.css");
});

// ── The real shipped artifacts must pass (integration smoke) ─────────────────
test("PASSES: the committed themes.css + tokens package.json satisfy both rules", async () => {
  const { readFileSync } = await import("node:fs");
  const { existsSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const tokensSrc = join(here, "..", "packages", "tokens", "src");

  const css = readFileSync(join(tokensSrc, "themes.css"), "utf8");
  const pkgJson = JSON.parse(
    readFileSync(join(here, "..", "packages", "tokens", "package.json"), "utf8"),
  );
  const { relative, bare } = extractCssRefs(css);

  const unresolved = findUnresolvedRefs(relative, { baseDir: tokensSrc, exists: existsSync });
  assert.equal(unresolved.length, 0, `shipped themes.css assets: ${JSON.stringify(unresolved)}`);

  const undeclared = findUndeclaredBareImports(bare, pkgJson);
  assert.equal(undeclared.length, 0, `shipped themes.css imports: ${JSON.stringify(undeclared)}`);
});
