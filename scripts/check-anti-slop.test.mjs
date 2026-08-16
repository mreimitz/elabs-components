// check-anti-slop.test.mjs — self-test for the content anti-slop ratchet
// (WP-15 #107). Locks: (1) the detector flags the taste-skill's content slop
// (generic names, fake-perfect numbers, slop brand names) and stays quiet on
// realistic content; (2) the ratchet fails a file that rises above (or is new
// vs) the baseline and passes files at/below it; (3) a PLANTED bad-fixture file
// is actually caught end-to-end via scanTree (the issue's acceptance test), and
// a clean fixture passes; (4) copy-own blocks are recognized for the warn-only
// carve-out. Per quality-gates.md "Self-tested gates".
//
// Run: node --test scripts/check-anti-slop.test.mjs   (pnpm slop:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  countContentSlop,
  findContentSlop,
  compareToBaseline,
  scanTree,
  isBlockPath,
} from "./check-anti-slop.mjs";

test("detector flags the Jane Doe effect (names, fake numbers, slop brands)", () => {
  assert.ok(countContentSlop("<p>John Doe</p>") >= 1, "John Doe");
  assert.ok(countContentSlop('name="Jane Doe"') >= 1, "Jane Doe");
  assert.ok(countContentSlop("Sarah Chan, VP") >= 1, "Sarah Chan");
  assert.ok(countContentSlop("99.99% uptime") >= 1, "99.99%");
  assert.ok(countContentSlop("id 1234567") >= 1, "1234567");
  assert.ok(countContentSlop("Acme Inc / Nexus / SmartFlow / Cloudly") >= 4, "slop brands");
  // the issue's combined bad fixture → 3 distinct occurrences
  const bad = 'const u = { name: "John Doe", company: "Acme", uptime: "99.99%" };';
  assert.equal(countContentSlop(bad), 3, "combined fixture counts each occurrence");
});

test("detector is quiet on realistic content (low false positives)", () => {
  assert.equal(
    countContentSlop("Revenue grew to $4.2M for Northwind Traders"),
    0,
    "real name+number",
  );
  assert.equal(countContentSlop('className="bg-primary/50 text-foreground"'), 0, "/50 alpha");
  assert.equal(countContentSlop("$99.99 per seat"), 0, "a price is not a fake stat");
  assert.equal(countContentSlop("199.99% YoY"), 0, "199.99% is not the 99.99 fake stat");
});

test("findContentSlop reports id + line + match for actionability", () => {
  const hits = findContentSlop("line one\n<span>Acme</span>");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, "slop-brand-name");
  assert.equal(hits[0].line, 2, "1-based line number");
  assert.equal(hits[0].match.toLowerCase(), "acme");
});

test("ratchet: rising above baseline or new file fails; at/below passes", () => {
  const baseline = { "packages/ui/src/a.tsx": 1 };
  assert.deepEqual(compareToBaseline({ "packages/ui/src/a.tsx": 1 }, baseline), [], "at ceiling");
  assert.deepEqual(
    compareToBaseline({ "packages/ui/src/a.tsx": 0 }, baseline),
    [],
    "below ceiling",
  );
  assert.deepEqual(compareToBaseline({ "packages/ui/src/a.tsx": 2 }, baseline), [
    { file: "packages/ui/src/a.tsx", count: 2, allowed: 1 },
  ]);
  assert.deepEqual(compareToBaseline({ "packages/x/src/new.tsx": 1 }, baseline), [
    { file: "packages/x/src/new.tsx", count: 1, allowed: 0 },
  ]);
});

test("planted bad fixture is caught end-to-end (scanTree); clean fixture passes", () => {
  const dir = mkdtempSync(join(tmpdir(), "slop-"));
  try {
    // PLANT a bad fixture in shipped-style source.
    writeFileSync(join(dir, "bad.tsx"), 'export const u = { name: "John Doe", co: "Acme" };\n');
    // A clean fixture next to it.
    writeFileSync(
      join(dir, "clean.tsx"),
      'export const u = { name: "Mara Okafor", co: "Northwind" };\n',
    );
    // …and the kinds of files the gate must IGNORE.
    writeFileSync(join(dir, "demo.stories.tsx"), 'export const s = { name: "Jane Doe" };\n');
    writeFileSync(join(dir, "x.test.tsx"), 'it("Acme", () => {});\n');

    const counts = scanTree(dir, { repoRoot: dir });
    assert.equal(counts["clean.tsx"], undefined, "clean fixture not flagged");
    assert.equal(counts["demo.stories.tsx"], undefined, "stories excluded");
    assert.equal(counts["x.test.tsx"], undefined, "tests excluded");
    assert.equal(counts["bad.tsx"], 2, "planted slop counted (John Doe + Acme)");

    // …and against an empty baseline the ratchet FAILS on it.
    const violations = compareToBaseline(counts, {});
    assert.deepEqual(violations, [{ file: "bad.tsx", count: 2, allowed: 0 }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("copy-own blocks are recognized for the warn-only carve-out", () => {
  assert.ok(isBlockPath("packages/ui/src/blocks/sidebar-04/app-sidebar.tsx"));
  assert.ok(!isBlockPath("packages/ui/src/components/button/button.tsx"));
});

test("scanTree predicate splits gated vs blocks", () => {
  const dir = mkdtempSync(join(tmpdir(), "slop-blocks-"));
  try {
    mkdirSync(join(dir, "blocks"));
    writeFileSync(join(dir, "comp.tsx"), 'const c = "Acme";\n');
    writeFileSync(join(dir, "blocks", "b.tsx"), 'const b = "Acme";\n');
    const gated = scanTree(dir, { repoRoot: dir, predicate: (p) => !isBlockPath(p) });
    const blocks = scanTree(dir, { repoRoot: dir, predicate: isBlockPath });
    assert.equal(gated["comp.tsx"], 1, "non-block flagged in the gated set");
    assert.equal(gated["blocks/b.tsx"], undefined, "block excluded from the gated set");
    assert.equal(blocks["blocks/b.tsx"], 1, "block flagged in the warn-only set");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
