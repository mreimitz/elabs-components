/**
 * create-matrix.test.mjs — the hermetic half of the create matrix (RM-130): how an
 * app is pointed at local tarballs and what the matrix asserts on its output.
 * The end-to-end half (`pnpm create:matrix --pm npm|pnpm`) packs, installs and
 * builds for real; CI runs it per OS and package manager.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  countEresolve,
  entryChunk,
  fileSpec,
  parseArgs,
  pinApp,
  readPacked,
  workflowRuns,
  workspaceOverrides,
} from "./create-matrix.mjs";

const packed = [
  { name: "@elabs-ai/components-ui", tarball: "/t/ui.tgz" },
  { name: "@elabs-ai/components-tokens", tarball: "C:\\t\\tokens.tgz" },
];

test("parseArgs: --pm is required and templates are checked", () => {
  assert.throws(() => parseArgs([]), /--pm must be npm or pnpm/);
  assert.throws(() => parseArgs(["--pm", "yarn"]), /--pm must be npm or pnpm/);
  assert.throws(() => parseArgs(["--pm", "npm", "--template", "nope"]), /unknown template/);
  assert.throws(() => parseArgs(["--pm"]), /--pm needs a value/);
  const o = parseArgs(["--pm", "pnpm", "--template", "dashboard,settings", "--keep"]);
  assert.deepEqual(o.templates, ["dashboard", "settings"]);
  assert.equal(o.keep, true);
  assert.equal(parseArgs(["--pack", "out"]).pack, "out", "--pack needs no --pm");
});

test("readPacked: a --pack directory resolves on another machine; a missing tarball is loud", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "create-matrix-packed-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.throws(() => readPacked(dir), /packed\.json not found/);
  writeFileSync(
    join(dir, "packed.json"),
    JSON.stringify([{ name: "@elabs-ai/components-ui", version: "4.2.0", file: "ui.tgz" }]),
  );
  assert.throws(() => readPacked(dir), /ui\.tgz is listed in packed\.json but missing/);
  writeFileSync(join(dir, "ui.tgz"), "");
  assert.deepEqual(readPacked(dir), [
    { name: "@elabs-ai/components-ui", version: "4.2.0", tarball: join(dir, "ui.tgz") },
  ]);
});

test("fileSpec: forward slashes, so a Windows path survives JSON and YAML", () => {
  assert.equal(fileSpec("C:\\t\\tokens.tgz"), "file:C:/t/tokens.tgz");
});

test("pinApp: direct deps and every packed package resolve to their tarballs", () => {
  const app = {
    dependencies: { "@elabs-ai/components-ui": "^4.2.0", react: "^19.0.0" },
    devDependencies: { vite: "^7.0.0" },
  };
  const npm = pinApp(app, packed, "npm");
  assert.equal(npm.pkgJson.dependencies["@elabs-ai/components-ui"], "file:/t/ui.tgz");
  assert.equal(npm.pkgJson.dependencies.react, "^19.0.0", "third-party ranges untouched");
  // tokens is only transitive here: the override is what keeps it off the registry.
  assert.equal(npm.pkgJson.overrides["@elabs-ai/components-tokens"], "file:C:/t/tokens.tgz");
  assert.deepEqual(npm.missing, []);

  const pnpm = pinApp(app, packed, "pnpm");
  assert.equal(pnpm.pkgJson.overrides, undefined);
  assert.equal(pnpm.pkgJson.pnpm.overrides["@elabs-ai/components-ui"], "file:/t/ui.tgz");

  const unpacked = pinApp(
    { dependencies: { "@elabs-ai/components-maps": "^4.2.0" } },
    packed,
    "npm",
  );
  assert.deepEqual(unpacked.missing, ["@elabs-ai/components-maps"]);
});

test("workspaceOverrides: a YAML overrides block pnpm 10+ reads", () => {
  assert.match(
    workspaceOverrides({ "@elabs-ai/components-ui": "file:/t/ui.tgz" }),
    /\noverrides:\n {2}"@elabs-ai\/components-ui": "file:\/t\/ui\.tgz"\n$/,
  );
});

test("countEresolve / entryChunk / workflowRuns read what the tools print", () => {
  assert.equal(countEresolve("npm warn ERESOLVE overriding peer dependency\nok"), 1);
  assert.equal(countEresolve("added 312 packages"), 0);
  assert.equal(
    entryChunk('<script type="module" crossorigin src="/assets/index-AbC123.js"></script>'),
    "assets/index-AbC123.js",
  );
  assert.equal(entryChunk("<html></html>"), null);
  assert.deepEqual(
    workflowRuns(
      "steps:\n      - uses: actions/checkout@v4\n      - run: npm ci\n      # note\n      - run: npm run lint\n",
    ),
    ["npm ci", "npm run lint"],
  );
});
