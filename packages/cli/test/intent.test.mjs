import { test } from "node:test";
import assert from "node:assert/strict";
import { collectIntent, INTENT } from "../lib/intent.mjs";

test("collectIntent surfaces authored intent only for exported components", () => {
  const got = collectIntent([{ name: "Button" }, { name: "Card" }, { name: "NotAuthored" }]);
  assert.ok(got.Button, "Button intent included (authored + exported)");
  assert.ok(got.Card, "Card intent included");
  assert.equal(got.NotAuthored, undefined, "unauthored component is omitted, not invented");
  // A component the package does NOT export must not appear even if authored.
  assert.equal(got.Dialog, undefined, "Dialog omitted when not in the export list");
});

test("collectIntent is deterministic (sorted keys, graceful when empty)", () => {
  const a = collectIntent([{ name: "Card" }, { name: "Button" }]);
  const b = collectIntent([{ name: "Button" }, { name: "Card" }]);
  assert.deepEqual(Object.keys(a), Object.keys(b), "input order does not change output");
  assert.deepEqual(Object.keys(a), ["Button", "Card"], "keys are sorted");
  assert.deepEqual(collectIntent([]), {}, "no exports → empty map, no throw");
});

test("Button intent carries purpose, relationships and anti-patterns", () => {
  const { Button } = INTENT;
  assert.match(Button.purpose, /action/i);
  assert.equal(Button.category, "action");
  assert.ok(Button.relationships.avoidNextTo.includes("another primary Button"));
  assert.ok(
    Button.antiPatterns.some((p) => /navigation/i.test(p)),
    "Button anti-pattern about navigation present",
  );
});

test("every authored intent entry is well-formed (schema sanity)", () => {
  for (const [name, meta] of Object.entries(INTENT)) {
    assert.equal(typeof meta.purpose, "string", `${name}: purpose is a string`);
    assert.ok(meta.purpose.length > 0, `${name}: purpose non-empty`);
    assert.equal(typeof meta.category, "string", `${name}: category is a string`);
    assert.ok(Array.isArray(meta.antiPatterns), `${name}: antiPatterns is an array`);
    if (meta.relationships) {
      for (const k of Object.keys(meta.relationships))
        assert.ok(
          ["usedInside", "contains", "pairsWith", "avoidNextTo"].includes(k),
          `${name}: unknown relationship key ${k}`,
        );
    }
  }
});

test("intent covers the highest-traffic components named in #80", () => {
  for (const name of ["Button", "Dialog", "DataTable", "Card", "ChatShell", "CanvasShell"]) {
    assert.ok(INTENT[name], `${name} has authored intent (≥15 core components, #80)`);
  }
  assert.ok(Object.keys(INTENT).length >= 15, "at least 15 core components covered");
});
