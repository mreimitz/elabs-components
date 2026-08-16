/**
 * check-tt-aliases.test.mjs — locks the Trusted-Types alias dogfood gate.
 * Run in CI: `node --test scripts/check-tt-aliases.test.mjs`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TT_ALIASED_PACKAGES,
  appliesAlias,
  findAliasGaps,
  findBadResolutions,
} from "./check-tt-aliases.mjs";

// ── Alias detection ──────────────────────────────────────────────────────────
test("recognises the published require.resolve alias form", () => {
  const src = `alias: { "decode-named-character-reference": require.resolve("decode-named-character-reference") }`;
  assert.equal(appliesAlias(src, "decode-named-character-reference"), true);
});

test("REJECTS a bare string alias — it would throw ERR_PACKAGE_PATH_NOT_EXPORTED", () => {
  // Neither package exposes ./index.js as a subpath, so this shape is broken.
  const src = `alias: { "decode-named-character-reference": "decode-named-character-reference/index.js" }`;
  assert.equal(
    appliesAlias(src, "decode-named-character-reference"),
    false,
    "only the absolute-path form from the CJS resolver is acceptable",
  );
});

test("a config missing the alias is reported", () => {
  const gaps = findAliasGaps({
    root: "/nowhere",
    sites: [{ app: "apps/x", config: "apps/x/vite.config.ts" }],
  });
  assert.ok(gaps.some((g) => g.rule === "missing-config"));
});

test("a doc that omits a package is reported", () => {
  const gaps = findAliasGaps({ sites: [], docText: "nothing relevant here" });
  const missing = gaps.filter((g) => g.rule === "alias-not-documented");
  assert.equal(missing.length, TT_ALIASED_PACKAGES.length);
});

// ── The check that verifies the ADVICE against the filesystem ────────────────
test("require.resolve lands on the DOM-FREE build for both packages", () => {
  // This is the real assertion: the snippet we publish must actually produce a
  // safe path in this repo's node_modules, today.
  assert.deepEqual(findBadResolutions(), []);
});

// ── The real tree ────────────────────────────────────────────────────────────
test("every app aliases, declares, and documents the packages", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const docText = readFileSync(join(here, "..", "docs", "CSP-AND-NETWORK.md"), "utf8");

  const gaps = findAliasGaps({ docText });
  assert.deepEqual(gaps, [], JSON.stringify(gaps, null, 2));
});
