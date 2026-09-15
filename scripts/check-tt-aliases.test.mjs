/**
 * check-tt-aliases.test.mjs — locks the node_modules half of the Trusted-Types alias gate.
 * The file-reading half is fixture-tested as the `tt-aliases` check rule.
 * Run in CI: `node --test scripts/check-tt-aliases.test.mjs`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findBadResolutions } from "./check-tt-aliases.mjs";

test("require.resolve lands on the DOM-FREE build for both packages", () => {
  // The snippet we publish must actually produce a safe path in this repo's node_modules.
  assert.deepEqual(findBadResolutions(), []);
});

test("an unresolvable root is reported, not silently passed", () => {
  const out = findBadResolutions({ root: "/nowhere-brand-ui-fixture" });
  assert.equal(out.length, 2);
  assert.ok(out.every((v) => v.rule === "alias-unresolvable"));
});
