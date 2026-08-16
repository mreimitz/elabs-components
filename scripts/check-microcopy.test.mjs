/**
 * check-microcopy.test.mjs — locks the hardcoded-microcopy ratchet.
 * Run in CI: `node --test scripts/check-microcopy.test.mjs`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { collectCounts, findHardcodedMicrocopy, findRegressions } from "./check-microcopy.mjs";

const kinds = (src) => findHardcodedMicrocopy(src).map((h) => `${h.kind}:${h.text}`);

// ── The four counted positions ───────────────────────────────────────────────
test("FLAGS a hardcoded aria-label", () => {
  assert.deepEqual(kinds(`<button aria-label="Next branch" />`), ["aria-label:Next branch"]);
});

test("FLAGS a hardcoded placeholder and title", () => {
  assert.deepEqual(kinds(`<input placeholder="Search…" title="Search" />`), [
    "placeholder:Search…",
    "title:Search",
  ]);
});

test("FLAGS a capitalized JSX text node", () => {
  assert.deepEqual(kinds(`<span>No results found</span>`), ["jsx-text:No results found"]);
});

// ── Things that must NOT be flagged ──────────────────────────────────────────
test("PASSES text already routed through t()", () => {
  assert.deepEqual(kinds(`<button aria-label={t("ai.message.nextBranch")} />`), []);
});

test("PASSES a JSX expression, not a literal", () => {
  assert.deepEqual(kinds(`<span>{label}</span>`), []);
});

test("PASSES an all-caps acronym (no lowercase letter)", () => {
  assert.deepEqual(kinds(`<span>API</span>`), [], "identifiers are not microcopy");
});

test("PASSES a line marked i18n-exempt", () => {
  const src = `<span>ChatGPT</span> // i18n-exempt: brand name`;
  assert.deepEqual(kinds(src), []);
});

test("PASSES lowercase text (identifiers, code, units)", () => {
  assert.deepEqual(kinds(`<code>npm install</code>`), []);
});

// ── Ratchet semantics ────────────────────────────────────────────────────────
test("a RISING count is a regression", () => {
  const r = findRegressions({ "a.tsx": 3 }, { "a.tsx": 2 });
  assert.deepEqual(r, [{ file: "a.tsx", baseline: 2, current: 3 }]);
});

test("a NEW file with any hardcoded string is a regression", () => {
  const r = findRegressions({ "new.tsx": 1 }, {});
  assert.deepEqual(r, [{ file: "new.tsx", baseline: 0, current: 1 }]);
});

test("a FALLING count is never a regression", () => {
  assert.deepEqual(findRegressions({ "a.tsx": 1 }, { "a.tsx": 5 }), []);
});

test("a file cleaned to zero drops out and is not a regression", () => {
  assert.deepEqual(findRegressions({}, { "a.tsx": 5 }), []);
});

// ── The real tree matches the committed baseline ─────────────────────────────
test("the committed baseline matches the real tree", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));

  const baseline = JSON.parse(readFileSync(join(here, "microcopy-baseline.json"), "utf8"));
  const regressions = findRegressions(collectCounts(), baseline);
  assert.deepEqual(regressions, [], JSON.stringify(regressions, null, 2));
});

test("the @elabs/components-ai a11y-critical surfaces are already routed through t()", async () => {
  // ADR 0017 Stage 1: every aria-label and placeholder in @elabs/components-ai is
  // translatable. This asserts the win doesn't quietly regress.
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const aiSrc = join(here, "..", "packages", "ai", "src");

  const { readdirSync } = await import("node:fs");
  const offenders = [];
  for (const name of readdirSync(aiSrc)) {
    if (!name.endsWith(".tsx") || /\.(test|stories)\.tsx$/.test(name)) continue;
    const hits = findHardcodedMicrocopy(readFileSync(join(aiSrc, name), "utf8"));
    for (const h of hits) {
      if (h.kind === "aria-label" || h.kind === "placeholder") offenders.push(`${name}:${h.text}`);
    }
  }
  assert.deepEqual(offenders, [], "a11y-critical microcopy must stay translatable");
});
