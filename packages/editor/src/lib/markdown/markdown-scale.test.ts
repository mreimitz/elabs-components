import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MARKDOWN_HEADING_REM,
  MARKDOWN_HEADING_TRACKING,
  MARKDOWN_HEADING_WEIGHT,
  MARKDOWN_MEASURE,
  markdownScaleVars,
} from "./markdown-scale";

/**
 * Drift contract for issue #18: the markdown editor (CSS) and the preview (prose
 * React) must render ONE heading scale + measure. This test pins both sides to the
 * shared `markdown-scale` module and fails the moment either diverges.
 */

// The Tailwind step the prose `Heading` uses per level (prose.tsx HEADING_SIZE),
// expressed in rem. This is the React side's contract: keep it equal to the scale.
const PROSE_HEADING_REM: Record<1 | 2 | 3 | 4 | 5 | 6, number> = {
  1: 1.5, // text-2xl
  2: 1.25, // text-xl
  3: 1.125, // text-lg
  4: 1, // text-base
  5: 0.875, // text-sm
  6: 0.875, // text-sm
};

describe("markdown-scale (shared editor↔preview source of truth)", () => {
  it("the prose heading steps equal the canonical scale", () => {
    expect(MARKDOWN_HEADING_REM).toEqual(PROSE_HEADING_REM);
  });

  it("emits the scale as CSS vars for the editor host", () => {
    const vars = markdownScaleVars();
    expect(vars["--md-h1"]).toBe(`${MARKDOWN_HEADING_REM[1]}rem`);
    expect(vars["--md-h6"]).toBe(`${MARKDOWN_HEADING_REM[6]}rem`);
    expect(vars["--md-heading-weight"]).toBe(String(MARKDOWN_HEADING_WEIGHT));
    expect(vars["--md-heading-tracking"]).toBe(MARKDOWN_HEADING_TRACKING);
    expect(vars["--md-measure"]).toBe(MARKDOWN_MEASURE);
  });

  it("the editor CSS drives its headings + measure from the scale vars (no hardcoded sizes)", () => {
    // Resolve from the @elabs/components-editor package root (vitest runs with cwd = package).
    const cssPath = resolve(process.cwd(), "src/markdown-editor/markdown-editor.css");
    const css = readFileSync(cssPath, "utf8");

    // Each heading reads its --md-* var (so the editor can't carry its own numbers).
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      expect(css).toContain(`font-size: var(--md-h${level}`);
    }
    expect(css).toContain("font-weight: var(--md-heading-weight");
    expect(css).toContain("letter-spacing: var(--md-heading-tracking");
    // Measure: capped at the shared --md-measure (same as the preview's max-w-3xl).
    expect(css).toContain("max-width: var(--md-measure");

    // Guard against re-introducing the OLD standalone heading scale (the editor
    // used to carry its own 1.6 / 1.35 / 1.15 / 0.9rem heading sizes — #18).
    for (const old of ["1.6rem", "1.35rem", "1.15rem", "0.9rem"]) {
      expect(css).not.toContain(`font-size: ${old}`);
    }
  });
});
