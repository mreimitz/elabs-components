#!/usr/bin/env node
/**
 * Self-test for the chart-furniture hairline gate.
 *
 * Every case below plants a violation the real incident actually produced and
 * asserts the gate reports it. A gate that can silently stop firing is worse
 * than no gate, so the negative cases (the shapes that must KEEP passing) are
 * asserted just as hard as the positive ones.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  auditSource,
  auditThemes,
  elementSpan,
  readHairlineWidth,
} from "./check-chart-hairline.mjs";

const W = 0.65;
const audit = (src) => auditSource(src, "fixture.tsx", W);

test("reads the width from its source of truth, not a restated literal", () => {
  assert.equal(typeof readHairlineWidth(), "number");
  assert.ok(readHairlineWidth() > 0);
});

test("rule 1 — flags the exact multiplier that made network edges invisible", () => {
  const f = audit(`<path stroke="var(--chart-grid)" strokeOpacity={0.35} strokeWidth={0.65} />`);
  assert.equal(f.length, 1);
  assert.match(f[0].msg, /dimmed by 0\.35/);
});

test("rule 1 — flags the radar multiplier too, via the chartCssVars spelling", () => {
  const f = audit(`<line stroke={chartCssVars.grid} strokeOpacity={0.6} strokeWidth={0.65} />`);
  assert.equal(f.length, 1);
  assert.match(f[0].msg, /dimmed by 0\.6/);
});

test("rule 1 — a plain `opacity` attribute is the same violation", () => {
  const f = audit(`<line stroke={radarCssVars.grid} opacity={0.5} strokeWidth={0.65} />`);
  assert.equal(f.length, 1);
  assert.match(f[0].msg, /dimmed by 0\.5/);
});

test("rule 2 — flags a gridline back at the old 1px weight", () => {
  const f = audit(`<line stroke={chartCssVars.grid} strokeWidth={1} />`);
  assert.equal(f.length, 1);
  assert.match(f[0].msg, /strokeWidth 1, not the shared CHART_HAIRLINE_WIDTH/);
});

test("rule 2 — flags the old tree-link weight", () => {
  const f = audit(`<path stroke="var(--chart-grid)" strokeWidth={1.4} />`);
  assert.equal(f.length, 1);
});

test("both rules fire on one element rather than the gate stopping at the first", () => {
  const f = audit(`<path stroke="var(--chart-grid)" strokeOpacity={0.35} strokeWidth={1.4} />`);
  assert.equal(f.length, 2);
});

test("passes the conforming shape", () => {
  assert.deepEqual(
    audit(`<line stroke={chartCssVars.grid} strokeWidth={CHART_HAIRLINE_WIDTH} />`),
    [],
  );
});

test("passes a data-driven width — that is the one legitimate variation", () => {
  assert.deepEqual(audit(`<path stroke="var(--chart-grid)" strokeWidth={link.width} />`), []);
  assert.deepEqual(
    audit(`<line stroke={chartCssVars.grid} strokeWidth={TRACK_STROKE_WIDTH} />`),
    [],
  );
});

test("passes an explicit opacity of 1 — that is not a multiplier", () => {
  assert.deepEqual(
    audit(
      `<line stroke={chartCssVars.grid} strokeOpacity={1} strokeWidth={CHART_HAIRLINE_WIDTH} />`,
    ),
    [],
  );
});

test("ignores a stroke that is not the furniture ink", () => {
  assert.deepEqual(
    audit(`<line stroke="var(--chart-1)" strokeOpacity={0.35} strokeWidth={2} />`),
    [],
  );
});

test("the exemption silences one element and requires a reason", () => {
  const withReason = `<path stroke="var(--chart-grid)"
      // chart-hairline-exempt: a hatch texture, not a rule
      strokeWidth={1} />`;
  assert.deepEqual(audit(withReason), []);

  const bare = `<path stroke="var(--chart-grid)"
      // chart-hairline-exempt:
      strokeWidth={1} />`;
  assert.equal(audit(bare).length, 1, "a reasonless marker must not silence the gate");
});

test("the exemption does not leak to a sibling element", () => {
  const src = `<path stroke="var(--chart-grid)"
      // chart-hairline-exempt: a hatch texture, not a rule
      strokeWidth={1} />
    <line stroke={chartCssVars.grid} strokeWidth={1} />`;
  const f = audit(src);
  assert.equal(f.length, 1, "only the second element should be reported");
});

test("an arrow function in a sibling attribute does not blind the scanner", () => {
  // This is the real radar-grid shape: `angle={(d) => scale(d) ?? 0}` sits above
  // the stroke, and a naive backward walk reads its `>` as the end of a tag.
  const src = `<LineRadial
      angle={(d) => radialScale(d.angle) ?? 0}
      fill="none"
      stroke={radarCssVars.grid}
      strokeWidth={1}
    />`;
  const f = audit(src);
  assert.equal(f.length, 1);
  assert.match(f[0].msg, /strokeWidth 1/);
});

test("an undelimitable element is REPORTED, not silently skipped", () => {
  // A gate whose unknown case is "pass" is defeated by making the code unreadable.
  const f = audit(`stroke="var(--chart-grid)" strokeWidth={1}`);
  assert.equal(f.length, 1);
  assert.match(f[0].msg, /could not delimit/);
});

test("elementSpan stops at the opening tag's own `>`, not a later one", () => {
  const src = `<line stroke={chartCssVars.grid} strokeWidth={1} />\n<rect />`;
  const span = elementSpan(src, src.indexOf("stroke="));
  assert.ok(!span.includes("rect"));
});

test("rule 3 — flags a theme that aliases the token back to --border", () => {
  const dir = mkdtempSync(join(tmpdir(), "hairline-"));
  try {
    const src = join(dir, "packages", "tokens", "src");
    mkdirSync(join(src, "themes"), { recursive: true });
    writeFileSync(join(src, "themes.css"), ":root { --chart-grid: oklch(0.74 0.01 264); }");
    writeFileSync(
      join(src, "themes", "light.css"),
      '[data-theme="light"] { --chart-grid: var(--border); }',
    );
    const f = auditThemes(dir);
    assert.equal(f.length, 1);
    assert.match(f[0].msg, /aliased back to var\(--border\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rule 3 — passes when every theme carries its own literal", () => {
  const dir = mkdtempSync(join(tmpdir(), "hairline-"));
  try {
    const src = join(dir, "packages", "tokens", "src");
    mkdirSync(join(src, "themes"), { recursive: true });
    writeFileSync(join(src, "themes.css"), ":root { --chart-grid: oklch(0.74 0.01 264); }");
    writeFileSync(
      join(src, "themes", "dark.css"),
      '[data-theme="dark"] { --chart-grid: oklch(0.52 0.012 257); }',
    );
    assert.deepEqual(auditThemes(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
