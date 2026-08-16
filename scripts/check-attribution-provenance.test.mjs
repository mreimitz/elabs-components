#!/usr/bin/env node
/**
 * check-attribution-provenance.test.mjs — self-test for the attribution-provenance gate.
 *
 * A gate that can silently stop firing is worse than none (see
 * .claude/rules/quality-gates.md, "Enforcement over reminders"), so this plants
 * bad fixtures and asserts the gate FAILS on them — and, just as important,
 * asserts it stays QUIET on the ordinary prose that made the first draft 65%
 * noise.
 *
 * Run in CI: `node --test scripts/check-attribution-provenance.test.mjs`
 * (`pnpm attribution:provenance:check:test`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

import {
  PROVENANCE_RE,
  SCANNED_RE,
  SCANNED_EXT_RE,
  EXCLUDED_RE,
  CONTEXT_LINES,
  FIRST_PARTY_ALIASES,
  aliasesFor,
  lineResolves,
  findUnattributed,
  creditedAliases,
  scannedFiles,
  keyOf,
} from "./check-attribution-provenance.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const GATE = join(SCRIPT_DIR, "check-attribution-provenance.mjs");

/** A credited upstream, in the shape `attributions.sources.json` uses. */
const CREDITED = new Set([
  ...aliasesFor({
    id: "blocks-so",
    name: "blocks.so",
    url: "https://github.com/ephraimduncan/blocks",
  }),
  ...aliasesFor({ id: "mapcn", name: "mapcn", url: "https://github.com/AnmolSaini16/mapcn" }),
  ...FIRST_PARTY_ALIASES,
]);

// ── The detector ─────────────────────────────────────────────────────────────

test("FLAGS: a borrowing whose upstream is not credited", () => {
  const hits = findUnattributed(
    [{ file: "packages/ui/src/a.tsx", content: "// Adapted from acme/widget's layout.\n" }],
    CREDITED,
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 1);
  assert.match(hits[0].text, /acme\/widget/);
});

test("PASSES: a borrowing whose upstream IS credited", () => {
  const hits = findUnattributed(
    [{ file: "packages/ui/src/a.tsx", content: "// Adapted from blocks.so, re-tokenized.\n" }],
    CREDITED,
  );
  assert.deepEqual(hits, []);
});

test("PASSES: credited via the URL's owner segment, not its display name", () => {
  // The comment names the GitHub owner, never the project's display name.
  const hits = findUnattributed(
    [{ file: "packages/ui/src/a.tsx", content: "// Adapted from ephraimduncan's sidebar.\n" }],
    CREDITED,
  );
  assert.deepEqual(hits, []);
});

test("PASSES: the upstream name wraps onto the NEXT line of a block comment", () => {
  // The real sidebar-04 shape — matching only the hit line reported this as
  // uncredited while the credit sat one line below.
  const hits = findUnattributed(
    [
      {
        file: "packages/ui/src/blocks/sidebar-04/app-sidebar.tsx",
        content:
          "/** sidebar-04 — mail sidebar (copy-owned block). Adapted from\n * blocks.so. */\n",
      },
    ],
    CREDITED,
  );
  assert.deepEqual(hits, []);
});

test("FLAGS: an uncredited name still outside the context window", () => {
  const far = ["// Adapted from", ...Array(CONTEXT_LINES + 2).fill("//"), "// acme/widget"].join(
    "\n",
  );
  const hits = findUnattributed([{ file: "packages/ui/src/a.tsx", content: far }], CREDITED);
  assert.equal(hits.length, 1);
});

test("PASSES: first-party provenance is not an attribution obligation", () => {
  const hits = findUnattributed(
    [{ file: "registry/registry.json", content: '"description": "Ported from the qlik palette."' }],
    CREDITED,
  );
  assert.deepEqual(hits, []);
});

// ── The noise floor (why this gate is trusted) ───────────────────────────────

test("QUIET: 'derived from' meaning 'computed from' is not a provenance claim", () => {
  // Measured at 22 occurrences in this repo against zero real credits. Including
  // it made the gate 65% noise; that regression must not come back.
  for (const line of [
    "* Column definitions. Omitted → derived from Object.keys(data[0]).",
    "/** Display name. Derived from the URL path when the caller gave none. */",
    "* it is derived from the active brand theme",
  ]) {
    assert.equal(PROVENANCE_RE.test(line), false, `should not match: ${line}`);
  }
});

test("QUIET: 'based on' and 'inspired by' are not provenance claims", () => {
  assert.equal(PROVENANCE_RE.test("Spacing based on the density factor."), false);
  assert.equal(PROVENANCE_RE.test("Layout inspired by mission-control dashboards."), false);
});

test("PURE: aliases match whole words only — the font Inter must not resolve 'interval'", () => {
  const inter = new Set(aliasesFor({ id: "font:inter", name: "Inter", url: null }));
  assert.equal(lineResolves("pick a nice time interval", inter), false);
  assert.equal(lineResolves("Adapted from Inter's metrics", inter), true);
});

test("PURE: aliases shorter than 3 chars are dropped as vacuous", () => {
  const aliases = aliasesFor({ id: "ai", name: "ui", url: "https://github.com/x/ai" });
  for (const a of aliases) assert.ok(a.length >= 3, `alias too short: ${a}`);
});

// ── Scope ────────────────────────────────────────────────────────────────────

test("SCOPE: shipped source and the registry are scanned; docs and rules are not", () => {
  assert.ok(SCANNED_RE.test("packages/ui/src/components/x.tsx"));
  assert.ok(SCANNED_RE.test("registry/registry.json"));
  assert.equal(SCANNED_RE.test("docs/ADR/0024-viewer-package.md"), false);
  assert.equal(SCANNED_RE.test(".claude/rules/attribution.md"), false);
  assert.equal(SCANNED_RE.test("packages/ui/package.json"), false);
});

test("SCOPE: tests are excluded — they describe fixtures, not what ships", () => {
  assert.ok(EXCLUDED_RE.test("packages/ui/src/x.test.tsx"));
  assert.ok(EXCLUDED_RE.test("packages/ui/src/x.spec.ts"));
  assert.equal(EXCLUDED_RE.test("packages/ui/src/x.tsx"), false);
  assert.ok(SCANNED_EXT_RE.test("packages/ui/src/x.css"));
});

// ── The real repo ────────────────────────────────────────────────────────────

test("REAL: the committed dataset credits the upstreams shipped source names", () => {
  const aliases = creditedAliases(REPO_ROOT);
  // A representative slice — if the sweep is ever reverted, these go missing.
  for (const expected of ["blocks.so", "assistant-ui", "milkdown", "anyview", "mapcn"]) {
    assert.ok(aliases.has(expected), `dataset lost the alias: ${expected}`);
  }
});

test("REAL: the gate passes on the committed tree", () => {
  const out = execFileSync("node", [GATE], { encoding: "utf8" });
  assert.match(out, /every provenance claim in shipped source resolves/);
});

test("REAL: every baselined key still names a real file", () => {
  const file = join(SCRIPT_DIR, "attribution-provenance-baseline.json");
  const baseline = JSON.parse(readFileSync(file, "utf8")).unresolved ?? {};
  for (const key of Object.keys(baseline)) {
    const path = key.slice(0, key.lastIndexOf(":"));
    assert.ok(existsSync(join(REPO_ROOT, path)), `baseline names a missing file: ${path}`);
  }
});

test("REAL: the baseline is REPRODUCIBLE — no entry the scanner does not currently produce", () => {
  // The derivation rung of `pnpm baseline-provenance:check` (#400), applied here
  // rather than there: that meta-gate takes array-shaped, manifest-driven
  // baselines, and this one is a `{ "file:line": text }` map of source hits. The
  // invariant it protects is the one that matters — a hand-added entry, or one
  // describing debt that has since been fixed, makes the gate exit 0 while
  // silencing something real. Remedy either way: re-run `--update`.
  const baseline = JSON.parse(
    readFileSync(join(SCRIPT_DIR, "attribution-provenance-baseline.json"), "utf8"),
  ).unresolved;
  // Exactly what `--update` would write: the same scan, the same alias set.
  const derived = new Set(
    findUnattributed(scannedFiles(REPO_ROOT), creditedAliases(REPO_ROOT)).map(keyOf),
  );
  for (const key of Object.keys(baseline)) {
    assert.ok(
      derived.has(key),
      `baseline entry is not reproducible — the scanner no longer produces ${key}. ` +
        `Run \`pnpm attribution:provenance:check -- --update\` to ratchet it down.`,
    );
  }
});

test("REAL: the gate FAILS when a fresh uncredited borrowing appears", () => {
  // The whole point: a NEW borrowing must not be absorbable by the baseline.
  const hits = findUnattributed(
    [{ file: "packages/ui/src/new.tsx", content: "// Vendored from someone-elses/library.\n" }],
    creditedAliases(REPO_ROOT),
  );
  assert.equal(hits.length, 1);
  const baseline = JSON.parse(
    readFileSync(join(SCRIPT_DIR, "attribution-provenance-baseline.json"), "utf8"),
  ).unresolved;
  assert.ok(!(keyOf(hits[0]) in baseline), "a new hit must not already be baselined");
});

test("REAL: the gate is wired as an npm script pair", () => {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  assert.ok(pkg.scripts["attribution:provenance:check"], "missing attribution:provenance:check");
  assert.ok(
    pkg.scripts["attribution:provenance:check:test"],
    "missing attribution:provenance:check:test — an unwired self-test never runs",
  );
});
