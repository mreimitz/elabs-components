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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkUseClient,
  checkExportsResolve,
  checkFontAssets,
  checkSingletons,
  tarballName,
  pinToTarballs,
  distributablePackages,
  APP_NPMRC,
} from "./check-consumer-install.mjs";

/** Build a throwaway node_modules tree: { "@elabs-ai/components-ui/dist/index.js": "…" }. */
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
    "@elabs-ai/components-ui/dist/index.js": "export const Button = () => null;\n",
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
    "@elabs-ai/components-ui/dist/index.js": '"use client";\nexport const Button = () => null;\n',
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
    "@elabs-ai/components-ui/dist/lib/cn.js": '"use client";\nexport const cn = () => "";\n',
    "@elabs-ai/components-editor/dist/markdown/parse.js":
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
    "@elabs-ai/components-tokens/dist/themes.css":
      '@font-face { src: url("./fonts/inter/Inter-Variable.woff"); }',
    // The real bug: present, but one directory too deep.
    "@elabs-ai/components-tokens/dist/fonts/fonts/inter/Inter-Variable.woff": "x",
  });
  const v = [];
  checkFontAssets(dir, v);
  cleanup(dir);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "unresolved-font");
});

test("PASSES: the same font once copied to the referenced depth", () => {
  const dir = plant({
    "@elabs-ai/components-tokens/dist/themes.css":
      '@font-face { src: url("./fonts/inter/Inter-Variable.woff"); }',
    "@elabs-ai/components-tokens/dist/fonts/inter/Inter-Variable.woff": "x",
  });
  const v = [];
  checkFontAssets(dir, v);
  cleanup(dir);
  assert.deepEqual(v, []);
});

// ── Defect 3/4: an export target that isn't actually in the tarball ──────────
test("FAILS: publishConfig export pointing at a file the tarball lacks", () => {
  const dir = plant({
    "@elabs-ai/components-editor/package.json": JSON.stringify({
      name: "@elabs-ai/components-editor",
      exports: { "./monaco-environment": { default: "./dist/lib/monaco-environment.js" } },
    }),
  });
  const v = [];
  checkExportsResolve(dir, [{ name: "@elabs-ai/components-editor" }], v);
  cleanup(dir);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "unresolved-export");
  assert.match(v[0].detail, /ERR_PACKAGE_PATH_NOT_EXPORTED/);
});

test("FAILS: a package that never installed at all", () => {
  const dir = plant({ "placeholder.txt": "" });
  const v = [];
  checkExportsResolve(dir, [{ name: "@elabs-ai/components-ui" }], v);
  cleanup(dir);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "package-not-installed");
});

test("PASSES: every export target present", () => {
  const dir = plant({
    "@elabs-ai/components-ui/package.json": JSON.stringify({
      name: "@elabs-ai/components-ui",
      exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
    }),
    "@elabs-ai/components-ui/dist/index.js": "",
    "@elabs-ai/components-ui/dist/index.d.ts": "",
  });
  const v = [];
  checkExportsResolve(dir, [{ name: "@elabs-ai/components-ui" }], v);
  cleanup(dir);
  assert.deepEqual(v, []);
});

// ── The reason monaco/maplibre/xyflow became peers ───────────────────────────
test("FAILS: a context-carrying engine resolved at two different versions", () => {
  // Precisely the @elabs-ai/components-flow ^12.11.1 vs @elabs-ai/components-ai ^12.3.6 split.
  const dir = plant({
    "@elabs-ai/components-flow/node_modules/@xyflow/react/package.json": '{"version":"12.11.1"}',
    "@elabs-ai/components-ai/node_modules/@xyflow/react/package.json": '{"version":"12.3.6"}',
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
  assert.equal(tarballName("@elabs-ai/components-ui", "1.9.0"), "elabs-ai-components-ui-1.9.0.tgz");
  assert.equal(
    tarballName("@elabs-ai/components-tokens", "2.0.0"),
    "elabs-ai-components-tokens-2.0.0.tgz",
  );
  assert.equal(tarballName("plain", "1.0.0"), "plain-1.0.0.tgz");
});

test("dependency pinning rewrites only the packed packages", () => {
  const { pkgJson, missing } = pinToTarballs(
    { dependencies: { "@elabs-ai/components-ui": "*", react: "^19.0.0" } },
    [
      {
        name: "@elabs-ai/components-ui",
        tarball: "/tmp/elabs-components-ui-1.9.0.tgz",
      },
    ],
  );
  assert.equal(
    pkgJson.dependencies["@elabs-ai/components-ui"],
    "file:/tmp/elabs-components-ui-1.9.0.tgz",
  );
  assert.equal(pkgJson.dependencies.react, "^19.0.0", "registry deps must resolve normally");
  assert.deepEqual(missing, []);
});

test("a fixture dependency with no matching tarball is reported, not silently skipped", () => {
  const { missing } = pinToTarballs({ dependencies: { "@elabs-ai/components-newpkg": "*" } }, []);
  assert.deepEqual(missing, ["@elabs-ai/components-newpkg"]);
});

test("the distributable set is derived from publishConfig, never hard-coded", () => {
  const dir = plant({
    "ui/package.json": JSON.stringify({
      name: "@elabs-ai/components-ui",
      version: "1.9.0",
      publishConfig: { exports: {} },
    }),
    "eslint-config/package.json": JSON.stringify({
      name: "@elabs-ai/components-eslint-config",
      version: "0.1.0",
    }),
  });
  const found = distributablePackages(dir);
  cleanup(dir);
  assert.deepEqual(
    found.map((p) => p.name),
    ["@elabs-ai/components-ui"],
    "a tooling package with no publishConfig must not be treated as distributable",
  );
});

// ── Defect 5 (#41): the fixture never pinned a peer independently, so a
// narrowed/wrong peer range on @xyflow/react / monaco-editor / maplibre-gl
// could never conflict with anything and auto-install-peers silently "fixed"
// it. This is the one real, end-to-end test in this file (a genuine `pnpm
// install`, no vite build) -- it exists specifically to prove the mechanism
// (strict-peer-dependencies=true + an independently-pinned peer) actually
// catches a #30-shaped regression, not merely that our own violation-array
// bookkeeping is correct. Network/registry-touching, so it gets a generous
// timeout; @xyflow/react is already in this monorepo's pnpm store (a
// devDependency of @elabs-ai/components-flow), so it resolves from the local
// store rather than a cold network fetch.
// Pin the SAME package manager the repo pins (mirrors check-consumer-install.mjs's
// own rootPkg.packageManager injection) -- otherwise this test's peer-conflict
// behavior depends on whatever pnpm happens to be on the developer's PATH.
const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ROOT_PACKAGE_MANAGER = JSON.parse(
  readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
).packageManager;

function writeConsumerAppFixture({ peerPackageName, declaredPeerRange, pinnedPeerVersion }) {
  const work = mkdtempSync(join(tmpdir(), "brand-ui-peertest-"));
  const pkgSrc = join(work, "peer-check-fixture");
  const app = join(work, "app");
  mkdirSync(pkgSrc, { recursive: true });
  mkdirSync(app, { recursive: true });

  // A synthetic package standing in for @elabs-ai/components-flow: all that
  // matters is that it declares a peerDependency on a REAL, already-cached
  // npm package, exactly like the real distributable packages do.
  writeFileSync(
    join(pkgSrc, "package.json"),
    JSON.stringify(
      {
        name: "peer-check-fixture",
        version: "1.0.0",
        main: "index.js",
        peerDependencies: { [peerPackageName]: declaredPeerRange },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(pkgSrc, "index.js"), "module.exports = {};\n");

  // The consumer app: depends on the synthetic package (by directory, no pack
  // step needed -- pnpm resolves a `file:` dependency straight from a
  // package.json) AND independently pins the peer, exactly like #41's fix to
  // fixtures/consumer-smoke/package.json.
  writeFileSync(
    join(app, "package.json"),
    JSON.stringify(
      {
        name: "peer-check-app",
        version: "0.0.0",
        packageManager: ROOT_PACKAGE_MANAGER,
        dependencies: {
          "peer-check-fixture": `file:${pkgSrc}`,
          [peerPackageName]: pinnedPeerVersion,
        },
      },
      null,
      2,
    ),
  );
  // The SAME .npmrc content check-consumer-install.mjs actually writes (not a
  // hand-copied duplicate) -- so if the real fix is ever reverted, this test
  // fails instead of quietly testing its own private copy.
  writeFileSync(join(app, ".npmrc"), APP_NPMRC);

  return { work, app };
}

test(
  "FAILS: pnpm install when an independently-pinned peer does not satisfy the declared peer range (#30-shaped regression)",
  { timeout: 120_000 },
  () => {
    const { work, app } = writeConsumerAppFixture({
      peerPackageName: "@xyflow/react",
      declaredPeerRange: "^12.11.1", // what @elabs-ai/components-flow actually declares
      pinnedPeerVersion: "12.0.0", // real, published, but < the declared floor -- mirrors #30
    });
    try {
      let failed = false;
      let output = "";
      try {
        execFileSync("pnpm", ["install", "--ignore-workspace", "--no-frozen-lockfile"], {
          cwd: app,
          stdio: "pipe",
          encoding: "utf8",
        });
      } catch (err) {
        failed = true;
        output = `${err.stdout ?? ""}${err.stderr ?? ""}${err.message ?? ""}`;
      }
      assert.equal(failed, true, "an unmet peer range must fail the install, not just warn");
      assert.match(output, /ERESOLVE|peer|unmet/i);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  },
);

test(
  "PASSES: pnpm install when the pinned peer satisfies the declared range",
  { timeout: 120_000 },
  () => {
    const { work, app } = writeConsumerAppFixture({
      peerPackageName: "@xyflow/react",
      declaredPeerRange: "^12.11.1",
      pinnedPeerVersion: "^12.11.1",
    });
    try {
      execFileSync("pnpm", ["install", "--ignore-workspace", "--no-frozen-lockfile"], {
        cwd: app,
        stdio: "pipe",
      });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  },
);
