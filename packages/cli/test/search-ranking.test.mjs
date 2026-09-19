// search-ranking.test.mjs — locks the ranked search (lib/search.mjs) against the
// failures measured in docs/review/2026-09-18-ai-coding-top10.md: a spaced phrase
// found nothing, constants outranked components, a substring token routed
// "login form" to the process-explorer playbook, and common names from other
// libraries ("toast", "command palette", "stepper") returned "(none)" although
// the part ships under another name. Asserts against the REAL manifest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findRepoRoot, generateManifest, flat, matchPlaybooks } from "../lib/core.mjs";
import {
  searchExports,
  splitIdentifier,
  isConstantName,
  renderComponentArm,
  VOCABULARY,
  NO_MATCH_GUIDANCE,
} from "../lib/search.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "bin", "brand-ui.mjs");
const repoRoot = findRepoRoot(here);
const manifest = repoRoot ? generateManifest(repoRoot) : null;
const skip = (t) => (manifest ? false : (t.skip("not inside the monorepo"), true));
const names = (q, n = 5) =>
  searchExports(manifest, q)
    .rows.slice(0, n)
    .map((r) => r.name);

test("splitIdentifier handles Pascal, acronyms, digits and CONSTANT_CASE", () => {
  assert.deepEqual(splitIdentifier("DateRangePicker"), ["date", "range", "picker"]);
  assert.deepEqual(splitIdentifier("InputOTP"), ["input", "otp"]);
  assert.deepEqual(splitIdentifier("InputOTPSlot"), ["input", "otp", "slot"]);
  assert.deepEqual(splitIdentifier("DASHBOARD_SPEC_SCHEMA"), ["dashboard", "spec", "schema"]);
  assert.deepEqual(splitIdentifier("useFileUpload"), ["use", "file", "upload"]);
});

test("isConstantName separates constants from components", () => {
  assert.ok(isConstantName("CALENDAR_ROWS"));
  assert.ok(isConstantName("DASHBOARD_SPEC_SCHEMA"));
  assert.ok(!isConstantName("Button"));
  assert.ok(!isConstantName("InputOTP"));
  assert.ok(!isConstantName("A2uiSurface"));
});

test("a spaced phrase finds the PascalCase component, best match first", (t) => {
  if (skip(t)) return;
  assert.equal(names("date range picker")[0], "DateRangePicker");
  assert.equal(names("data table")[0], "DataTable");
  assert.equal(names("file upload")[0], "FileUpload");
  assert.equal(names("Button")[0], "Button");
  assert.equal(names("dialog")[0], "Dialog");
});

test("constants never appear in the component arm; they are listed as constants", (t) => {
  if (skip(t)) return;
  const r = searchExports(manifest, "dashboard");
  assert.ok(r.rows.length > 0);
  assert.ok(
    r.rows.every((row) => !isConstantName(row.name)),
    "no CONSTANT_CASE in components",
  );
  assert.ok(r.typeRows.some((row) => row.kind === "constant"));
  assert.ok(!/Icon$/.test(r.rows[0].name), "a glyph does not lead a non-icon query");
});

test("word-boundary alignment: 'charts' must not match Chart+S(tatFlow) first", (t) => {
  if (skip(t)) return;
  assert.ok(names("charts", 3).every((n) => /Chart$/.test(n)));
});

test("names from other libraries reach the brand-ui part that does the job", (t) => {
  if (skip(t)) return;
  assert.equal(names("toast")[0], "Toaster");
  assert.equal(names("command palette")[0], "CommandDialog");
  assert.equal(names("stepper")[0], "Wizard");
  assert.ok(names("multiselect").includes("Combobox"));
  assert.ok(names("modal").includes("Dialog"));
});

test("every vocabulary target exists — the table can never invent an import", (t) => {
  if (skip(t)) return;
  const real = new Set(flat(manifest).map((r) => r.name));
  const missing = [...new Set(Object.values(VOCABULARY).flat())].filter((n) => !real.has(n));
  assert.deepEqual(missing, []);
});

test("a typo still lands; a true miss says so and forbids inventing an import", (t) => {
  if (skip(t)) return;
  assert.equal(names("datepickr")[0], "DatePicker");
  const miss = searchExports(manifest, "kanban");
  assert.equal(miss.rows.length, 0);
  assert.ok(renderComponentArm("kanban", miss).join("\n").includes(NO_MATCH_GUIDANCE));
});

test("playbook tokens match on word starts: 'login form' is not process-explorer", (t) => {
  if (skip(t)) return;
  const books = matchPlaybooks(manifest, "login form").map((p) => p.archetype);
  assert.ok(!books.includes("process-explorer"), books.join(","));
  assert.ok(matchPlaybooks(manifest, "dashboard").some((p) => p.archetype === "dashboard"));
});

test("CLI: `search --json` carries nearest + guidance on a miss", (t) => {
  if (skip(t)) return;
  const res = spawnSync(process.execPath, [bin, "search", "kanban", "--json"], {
    encoding: "utf8",
    cwd: repoRoot,
  });
  const out = JSON.parse(res.stdout);
  assert.deepEqual(out.components, []);
  assert.ok(Array.isArray(out.nearest));
  assert.equal(out.guidance, NO_MATCH_GUIDANCE);
});
