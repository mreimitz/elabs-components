/**
 * tsup-modules.test.mjs — locks the per-module tsup entries (RM-130): every
 * source module a public entry reaches becomes its own output file, so an app's
 * bundler can drop the ones it never imports.
 * Run: `node --test scripts/lib/tsup-modules.test.mjs` (also in `pnpm check:test`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { moduleEntries } from "./tsup-modules.mjs";

/** A throwaway package: { "src/index.ts": "…" } → its directory. */
function pkg(files) {
  const dir = mkdtempSync(join(tmpdir(), "tsup-modules-"));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return dir;
}

test("moduleEntries: one entry per reachable module, named by its path", (t) => {
  const dir = pkg({
    "src/index.ts": [
      'export { Button } from "./components/button";',
      'export * from "./lib/cn.js";',
      'import "./styles";',
      'import React from "react";',
    ].join("\n"),
    "src/components/button/index.ts": 'export { Button } from "./button";',
    "src/components/button/button.tsx": 'const Lazy = () => import("../../engine/heavy");',
    "src/lib/cn.ts": "export const cn = () => '';",
    "src/styles.ts": "",
    "src/engine/heavy.ts": "export default 1;",
    "src/unused.ts": "export const nobody = 1;",
  });
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  assert.deepEqual(moduleEntries({ index: "src/index.ts" }, { pkgDir: dir }), {
    index: "src/index.ts",
    "components/button/button": "src/components/button/button.tsx",
    "components/button/index": "src/components/button/index.ts",
    "engine/heavy": "src/engine/heavy.ts",
    "lib/cn": "src/lib/cn.ts",
    styles: "src/styles.ts",
  });
});

test("moduleEntries: public entries keep their names; excluded modules stay shared", (t) => {
  const dir = pkg({
    "src/index.ts": 'export * from "./form"; export * from "./lib/cn";',
    "src/form/index.ts": 'export * from "../lib/cn";',
    "src/lib/cn.ts": "export const cn = 1;",
  });
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const entries = moduleEntries(
    { index: "src/index.ts", form: "src/form/index.ts" },
    { pkgDir: dir, exclude: ["lib/cn"] },
  );
  assert.deepEqual(entries, { index: "src/index.ts", form: "src/form/index.ts" });
});

test("moduleEntries: a module named like a public entry is an error, not a silent overwrite", (t) => {
  const dir = pkg({
    "src/main.ts": 'export * from "./index";',
    "src/index.ts": "export const x = 1;",
  });
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  assert.throws(
    () => moduleEntries({ index: "src/main.ts" }, { pkgDir: dir }),
    /module entry "index" collides with a public entry/,
  );
});
