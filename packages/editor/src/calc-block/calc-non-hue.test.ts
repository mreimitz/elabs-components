/**
 * Regression lock for the low-chroma calc role cues (#226). In a near-monochrome
 * theme the `--calc-*` tokens collapse toward one ink, so each role must
 * carry a color-independent cue. jsdom can't lay CSS out, so we assert the rules
 * exist and that the underline styles are mutually DISTINCT — the property that
 * makes the roles tell-apart-able without hue. The visual proof is the CalcBlock
 * theme story sweep.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/calc-block/calc-editor.css"), "utf8");

describe("calc low-chroma non-hue role cues (#226)", () => {
  // NOTE the per-role presence check named the PAUSED low-chroma theme, whose
  // rules are the only place these cues are scoped today. It is retired with
  // that theme (.claude/rules/paused-surfaces.md); the CSS itself is untouched
  // and the two assertions below still lock the cues' mutual distinctness.

  it("the underline cues are mutually distinct (solid / dashed / double / wavy)", () => {
    expect(css).toMatch(/--currency[\s\S]*?text-decoration: underline solid/);
    expect(css).toMatch(/--var-ref[\s\S]*?text-decoration: underline dashed/);
    expect(css).toMatch(/--line-ref[\s\S]*?text-decoration: underline double/);
    expect(css).toMatch(/--unknown[\s\S]*?text-decoration: underline wavy/);
  });

  it("number uses weight and unit uses italic (non-underline cues)", () => {
    expect(css).toMatch(/--number[\s\S]*?font-weight: 700/);
    expect(css).toMatch(/--unit[\s\S]*?font-style: italic/);
  });
});
