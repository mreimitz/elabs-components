/**
 * check-consumer-install.test.mjs — locks the published-artifact gate.
 * Run in CI: `node --test scripts/check-consumer-install.test.mjs`.
 *
 * Each test plants a bad node_modules tree in a temp dir and asserts the gate
 * reports it. The fixtures ARE the four real defects that shipped undetected,
 * so if someone weakens a check, one of these fails.
 *
 * These are the fast, hermetic half. The end-to-end half (`pnpm consumer:check`)
 * packs, installs and Vite-builds for real; it is too slow for `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  checkUseClient,
  checkExportsResolve,
  checkFontAssets,
  checkSingletons,
  tarballName,
  pinToTarballs,
  distributablePackages,
} from "./check-consumer-install.mjs";

/** Build a throwaway node_modules tree: { "@elabs/components-ui/dist/index.js": "…" }. */
function plant(files) {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-gatetest-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}
const cleanup = (dir) => rmSync(dir, { recursive: true, force: true });

// ── Defect 1: esbuild strips "use client" out of every bundle ────────────────
test("FAILS: a client package whose dist lost the use-client directive", () => {
  const dir = plant({
    "@elabs/components-ui/dist/index.js": "export const Button = () => null;\n",
  });
  const v = [];
  checkUseClient(dir, v);
  cleanup(dir);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "missing-use-client");
  assert.match(v[0].detail, /RSC/);
});

test("PASSES: once the banner puts the directive back", () => {
  const dir = plant({
    "@elabs/components-ui/dist/index.js": '"use client";\nexport const Button = () => null;\n',
  });
  const v = [];
  checkUseClient(dir, v);
  cleanup(dir);
  assert.deepEqual(v, []);
});

test("FAILS: a server-safe leaf wrongly marked use client", () => {
  // `cn` and the Monaco-free markdown parser must stay callable from a server
  // component — a blanket banner across all entries would break exactly this.
  const dir = plant({
    "@elabs/components-ui/dist/lib/cn.js": '"use client";\nexport const cn = () => "";\n',
    "@elabs/components-editor/dist/markdown/parse.js":
      '"use client";\nexport const parseMarkdown = () => ({});\n',
  });
  const v = [];
  checkUseClient(dir, v);
  cleanup(dir);
  assert.equal(v.length, 2);
  assert.ok(v.every((x) => x.rule === "spurious-use-client"));
});

// ── Defect 2: fonts copied to dist/fonts/fonts/… so every @font-face 404s ────
test("FAILS: themes.css asking for a font that isn't in the tarball", () => {
  const dir = plant({
    "@elabs/components-tokens/dist/themes.css":
      '@font-face { src: url("./fonts/inter/Inter-Variable.woff"); }',
    // The real bug: present, but one directory too deep.
    "@elabs/components-tokens/dist/fonts/fonts/inter/Inter-Variable.woff": "x",
  });
  const v = [];
  checkFontAssets(dir, v);
  cleanup(dir);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "unresolved-font");
});

test("PASSES: the same font once copied to the referenced depth", () => {
  const dir = plant({
    "@elabs/components-tokens/dist/themes.css":
      '@font-face { src: url("./fonts/inter/Inter-Variable.woff"); }',
    "@elabs/components-tokens/dist/fonts/inter/Inter-Variable.woff": "x",
  });
  const v = [];
  checkFontAssets(dir, v);
  cleanup(dir);
  assert.deepEqual(v, []);
});

// ── Defect 3/4: an export target that isn't actually in the tarball ──────────
test("FAILS: publishConfig export pointing at a file the tarball lacks", () => {
  const dir = plant({
    "@elabs/components-editor/package.json": JSON.stringify({
      name: "@elabs/components-editor",
      exports: { "./monaco-environment": { default: "./dist/lib/monaco-environment.js" } },
    }),
  });
  const v = [];
  checkExportsResolve(dir, [{ name: "@elabs/components-editor" }], v);
  cleanup(dir);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "unresolved-export");
  assert.match(v[0].detail, /ERR_PACKAGE_PATH_NOT_EXPORTED/);
});

test("FAILS: a package that never installed at all", () => {
  const dir = plant({ "placeholder.txt": "" });
  const v = [];
  checkExportsResolve(dir, [{ name: "@elabs/components-ui" }], v);
  cleanup(dir);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "package-not-installed");
});

test("PASSES: every export target present", () => {
  const dir = plant({
    "@elabs/components-ui/package.json": JSON.stringify({
      name: "@elabs/components-ui",
      exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
    }),
    "@elabs/components-ui/dist/index.js": "",
    "@elabs/components-ui/dist/index.d.ts": "",
  });
  const v = [];
  checkExportsResolve(dir, [{ name: "@elabs/components-ui" }], v);
  cleanup(dir);
  assert.deepEqual(v, []);
});

// ── The reason monaco/maplibre/xyflow became peers ───────────────────────────
test("FAILS: a context-carrying engine resolved at two different versions", () => {
  // Precisely the @elabs/components-flow ^12.11.1 vs @elabs/components-ai ^12.3.6 split.
  const dir = plant({
    "@elabs/components-flow/node_modules/@xyflow/react/package.json": '{"version":"12.11.1"}',
    "@elabs/components-ai/node_modules/@xyflow/react/package.json": '{"version":"12.3.6"}',
  });
  const v = [];
  checkSingletons(dir, v);
  cleanup(dir);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "duplicate-singleton");
  assert.match(v[0].detail, /12\.11\.1/);
  assert.match(v[0].detail, /12\.3\.6/);
});

test("PASSES: a single hoisted copy", () => {
  const dir = plant({ "@xyflow/react/package.json": '{"version":"12.11.1"}' });
  const v = [];
  checkSingletons(dir, v);
  cleanup(dir);
  assert.deepEqual(v, []);
});

test("PASSES: pnpm's isolated layout materialising ONE version many times", () => {
  // .pnpm legitimately contains a directory per peer-resolution of the same
  // version. Counting directories (the first implementation) false-positived here.
  const dir = plant({
    "@xyflow/react/package.json": '{"version":"12.11.1"}',
    ".pnpm/@xyflow+react@12.11.1_react@19.0.0/node_modules/@xyflow/react/package.json":
      '{"version":"12.11.1"}',
    ".pnpm/@xyflow+react@12.11.1_react@19.2.0/node_modules/@xyflow/react/package.json":
      '{"version":"12.11.1"}',
  });
  const v = [];
  checkSingletons(dir, v);
  cleanup(dir);
  assert.deepEqual(v, [], "same version many times is normal pnpm, not a defect");
});

// ── Helpers ──────────────────────────────────────────────────────────────────
test("tarball names match pnpm pack's scheme", () => {
  // pnpm strips the leading @ and turns the scope separator into a dash, so the
  // scope rename changed every tarball filename too.
  assert.equal(tarballName("@elabs/components-ui", "1.9.0"), "elabs-components-ui-1.9.0.tgz");
  assert.equal(
    tarballName("@elabs/components-tokens", "2.0.0"),
    "elabs-components-tokens-2.0.0.tgz",
  );
  assert.equal(tarballName("plain", "1.0.0"), "plain-1.0.0.tgz");
});

test("dependency pinning rewrites only the packed packages", () => {
  const { pkgJson, missing } = pinToTarballs(
    { dependencies: { "@elabs/components-ui": "*", react: "^19.0.0" } },
    [
      {
        name: "@elabs/components-ui",
        tarball: "/tmp/elabs-components-ui-1.9.0.tgz",
      },
    ],
  );
  assert.equal(
    pkgJson.dependencies["@elabs/components-ui"],
    "file:/tmp/elabs-components-ui-1.9.0.tgz",
  );
  assert.equal(pkgJson.dependencies.react, "^19.0.0", "registry deps must resolve normally");
  assert.deepEqual(missing, []);
});

test("a fixture dependency with no matching tarball is reported, not silently skipped", () => {
  const { missing } = pinToTarballs({ dependencies: { "@elabs/components-newpkg": "*" } }, []);
  assert.deepEqual(missing, ["@elabs/components-newpkg"]);
});

test("the distributable set is derived from publishConfig, never hard-coded", () => {
  const dir = plant({
    "ui/package.json": JSON.stringify({
      name: "@elabs/components-ui",
      version: "1.9.0",
      publishConfig: { exports: {} },
    }),
    "eslint-config/package.json": JSON.stringify({
      name: "@elabs/components-eslint-config",
      version: "0.1.0",
    }),
  });
  const found = distributablePackages(dir);
  cleanup(dir);
  assert.deepEqual(
    found.map((p) => p.name),
    ["@elabs/components-ui"],
    "a tooling package with no publishConfig must not be treated as distributable",
  );
});
