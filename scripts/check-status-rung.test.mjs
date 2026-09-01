// check-status-rung.test.mjs — self-test for the status-fill-as-text ratchet (#124).
// -----------------------------------------------------------------------------
// Locks the precision/completeness contract measured against the #124 corpus:
// a bare `text-<tone>` + a text tell (text-xs, a type role, font-*, truncate)
// in the SAME literal flags; a bare `text-<tone>` + a mark tell (size-*,
// fill-*, `[&>svg]:`/`[&_svg]:` anywhere in the string) or no tell at all does
// NOT flag. Also plants a real bad fixture (the shape #124 fixed) and asserts
// the CLI actually fails on it end-to-end, per "a gate that can silently stop
// firing is worse than none" (quality-gates.md).
//
// Run: node --test scripts/check-status-rung.test.mjs   (pnpm rung:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classStringViolates,
  countRungViolations,
  compareToBaseline,
} from "./check-status-rung.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check-status-rung.mjs");

test("bare status-fill + text tell → flags (the 7 real #124 shapes)", () => {
  assert.equal(classStringViolates("text-xs text-destructive"), true); // file-upload.tsx / tag-input.tsx
  assert.equal(
    classStringViolates(
      "text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-1 ease-entrance",
    ),
    true,
  ); // form.tsx FormMessage
  assert.equal(
    classStringViolates("flex min-w-0 items-center gap-1.5 px-2 py-1.5 text-body text-destructive"),
    true,
  ); // tree.tsx ErrorRow (type role text-body)
  assert.equal(classStringViolates("text-destructive font-bold text-meta"), true); // change-review.tsx hunk glyph
  assert.equal(classStringViolates("shrink-0 font-semibold text-destructive"), true); // stack-trace.tsx
  assert.equal(
    classStringViolates(
      "inline-flex items-center gap-1 rounded px-2 py-0.5 text-caption bg-destructive/10 text-destructive ",
    ),
    true,
  ); // paste-embed.ts chip (type role text-caption)
  assert.equal(classStringViolates("text-xs text-warning"), true); // any tone, not just destructive
});

test("marks (icon slots) do NOT flag — size-*/fill-* tells", () => {
  assert.equal(classStringViolates("size-4 text-success"), false); // file-upload.tsx statusIcon
  assert.equal(classStringViolates("size-4 shrink-0 text-destructive"), false); // stack-trace.tsx icon
  assert.equal(classStringViolates("fill-current text-warning"), false); // rating.tsx star
  assert.equal(
    classStringViolates(
      "size-4 text-success animate-in fade-in zoom-in-95 duration-fast ease-entrance",
    ),
    false,
  ); // copy-button.tsx CheckIcon
});

test("no tell at all → silent (the stated completeness gap, not a false positive)", () => {
  // a standalone ternary-branch literal (form.tsx FormLabel pre-#124 shape) —
  // the gate cannot see the sibling literal that carries the text tell.
  assert.equal(classStringViolates("text-destructive"), false);
  assert.equal(classStringViolates("bg-destructive/10 text-destructive"), false); // tool.tsx pre-#124
});

test("[&>svg]:/[&_svg]: anywhere suppresses — the NAMED, undone extension (alert.tsx shape)", () => {
  // #124's alert.tsx pre-fix line: a bare ambient-text token sits beside an
  // `[&>svg]:`-scoped icon token of the SAME utility. The basic gate treats
  // the `[&>svg]:` presence as a mark tell and stays silent — this is the
  // documented, NOT-yet-implemented "extension 2" gap, locked here so nobody
  // "fixes" it by surprise without updating the header's completeness claim.
  assert.equal(
    classStringViolates(
      "border-destructive/40 bg-destructive/10 text-destructive [&>svg]:text-destructive",
    ),
    false,
  );
});

test("already-correct ink/foreground rungs never flag", () => {
  assert.equal(classStringViolates("text-xs text-destructive-text"), false);
  assert.equal(classStringViolates("text-xs text-destructive-foreground"), false);
  assert.equal(
    classStringViolates("rounded-full bg-destructive text-destructive-foreground"),
    false,
  );
});

test("counts violating class-string literals in source text", () => {
  const src = [
    'const a = cn("text-xs text-destructive");',
    "const b = `shrink-0 font-semibold text-warning`;",
    'const ok = "size-4 text-success";',
    'const ok2 = "text-xs text-success-text";',
  ].join("\n");
  assert.equal(countRungViolations(src), 2);
});

test("ratchet semantics: only NEW violations fail", () => {
  const baseline = { "packages/ui/src/legacy/legacy.tsx": 1 };
  assert.deepEqual(compareToBaseline({ "packages/ui/src/legacy/legacy.tsx": 1 }, baseline), []);
  assert.deepEqual(compareToBaseline({ "packages/ai/src/new.tsx": 1 }, baseline), [
    { file: "packages/ai/src/new.tsx", count: 1, allowed: 0 },
  ]);
});

test("end-to-end: the CLI actually fails on a planted bad fixture", () => {
  const root = mkdtempSync(join(tmpdir(), "rung-check-"));
  try {
    mkdirSync(join(root, "packages", "ui", "src", "widget"), { recursive: true });
    writeFileSync(
      join(root, "packages", "ui", "src", "widget", "widget.tsx"),
      'export const Bad = () => <p className="text-xs text-destructive">oops</p>;\n',
    );
    assert.throws(() => {
      execFileSync(process.execPath, [SCRIPT, "--root", root], { stdio: "pipe" });
    }, /Command failed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("end-to-end: a clean tree with no baseline passes", () => {
  const root = mkdtempSync(join(tmpdir(), "rung-check-clean-"));
  try {
    mkdirSync(join(root, "packages", "ui", "src", "widget"), { recursive: true });
    writeFileSync(
      join(root, "packages", "ui", "src", "widget", "widget.tsx"),
      'export const Good = () => <p className="text-xs text-destructive-text">ok</p>;\n',
    );
    const out = execFileSync(process.execPath, [SCRIPT, "--root", root], {
      stdio: "pipe",
    }).toString();
    assert.match(out, /no new status-fill-as-text violations/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
