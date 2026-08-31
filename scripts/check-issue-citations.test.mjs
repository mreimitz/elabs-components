/**
 * check-issue-citations.test.mjs — self-test for the issue #63 citation-collision
 * guard. All fixtures are INLINE (hermetic — never real files), mirroring
 * check-docs-accuracy.test.mjs. A gate that can silently stop firing is worse than
 * none (quality-gates.md, "Self-tested gates").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  findIssueCitationViolations,
  findRegistryViolations,
  BARE_CITATION_RE,
  markedRe,
  bareRe,
} from "./check-issue-citations.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ── Pure threshold mechanism — mirrors the brief's "Test to add" verbatim ──────

test("FLAGS: a bare #N at or below a mocked current head, with no historical marker", () => {
  const text = "See the failure this records (#45) for details.";
  const violations = findIssueCitationViolations(text, /* currentHead */ 400);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].number, 45);
});

test("PASSES: the same number, marked historical (upstream#N), at/below the head", () => {
  const text = "See the failure this records (upstream#45) for details.";
  const violations = findIssueCitationViolations(text, 400);
  assert.equal(violations.length, 0);
});

test("PASSES: a bare #N ABOVE the mocked head (today-safe — the fork hasn't reached it yet)", () => {
  const text = "Tracked in #999.";
  const violations = findIssueCitationViolations(text, 400);
  assert.equal(violations.length, 0);
});

test("FLAGS: a citation exactly AT the head boundary (inclusive)", () => {
  const text = "Tracked in #400.";
  const violations = findIssueCitationViolations(text, 400);
  assert.equal(violations.length, 1);
});

test("PASSES: a citation one above the head boundary", () => {
  const text = "Tracked in #401.";
  const violations = findIssueCitationViolations(text, 400);
  assert.equal(violations.length, 0);
});

test("FLAGS: multiple bare citations below head, in one string", () => {
  const text = "See #34/#46 and #59/#60.";
  const violations = findIssueCitationViolations(text, 400);
  assert.equal(violations.length, 4);
  assert.deepEqual(
    violations.map((v) => v.number),
    [34, 46, 59, 60],
  );
});

test("BARE_CITATION_RE does not match an already-marked upstream#N as a second, separate bare hit", () => {
  const text = "upstream#45";
  const matches = [...text.matchAll(BARE_CITATION_RE)];
  assert.equal(matches.length, 0, "the negative lookbehind must suppress the marked form");
});

// ── markedRe / bareRe — the per-number regex builders ───────────────────────────

test("markedRe matches the marked form and not a different number", () => {
  assert.ok(markedRe(45).test("see upstream#45 for context"));
  assert.ok(!markedRe(45).test("see upstream#450 for context")); // \b boundary
  assert.ok(!markedRe(45).test("see #45 for context")); // bare, not marked
});

test("bareRe matches an unmarked citation and not the marked form", () => {
  assert.ok(bareRe(45).test("see #45 for context"));
  assert.ok(!bareRe(45).test("see upstream#45 for context"));
});

// ── Registry-driven check — the wired, real-file mechanism ──────────────────────

test("PASSES: a registry entry whose file carries ONLY the marked form", () => {
  const registry = [{ file: "fixture.md", number: 45, issueTitle: "unrelated real issue" }];
  const violations = findRegistryViolations(
    registry,
    () => "the failure this records (upstream#45)",
  );
  assert.equal(violations.length, 0);
});

test("FLAGS: a registry entry whose file still has the bare, unmarked form", () => {
  const registry = [{ file: "fixture.md", number: 45, issueTitle: "unrelated real issue" }];
  const violations = findRegistryViolations(registry, () => "the failure this records (#45)");
  assert.equal(violations.length, 1);
  assert.match(violations[0], /fixture\.md: registered collision #45/);
  assert.match(violations[0], /is not marked `upstream#45`/);
});

test("FLAGS: the marker present but an UNMARKED duplicate also remains (partial fix)", () => {
  const registry = [{ file: "fixture.md", number: 60, issueTitle: "unrelated real issue" }];
  const violations = findRegistryViolations(
    registry,
    () => "fixed one site (upstream#60) but missed this other one (#60)",
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0], /UNMARKED bare citation/);
});

test("FLAGS: a registry entry naming a file the reader can't resolve", () => {
  const registry = [{ file: "does-not-exist.md", number: 1, issueTitle: "x" }];
  const violations = findRegistryViolations(registry, () => {
    throw new Error("ENOENT");
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /does not exist or is unreadable/);
});

test("PASSES: an empty registry (nothing registered yet)", () => {
  assert.deepEqual(
    findRegistryViolations([], () => ""),
    [],
  );
});

// ── CLI: the REAL repo currently passes the gate, over the REAL registry ───────

test("the REAL repo currently passes issue-citations:check (CLI run)", () => {
  const out = execFileSync("node", [path.join(HERE, "check-issue-citations.mjs")], {
    encoding: "utf8",
  });
  assert.match(out, /✔ issue-citations: \d+ registered collision\(s\) stay marked/);
});
